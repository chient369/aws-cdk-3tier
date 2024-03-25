import * as cdk from 'aws-cdk-lib';
import { NestedStack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { readFileSync } from 'fs';

export interface AppServerProps extends StackProps {
  vpc: ec2.Vpc;
  appTierSG: ec2.SecurityGroup;
  intenalLBSG: ec2.SecurityGroup;
  s3BucketName: string;
  // DBHost: string;
  // DBUserName: string;
  // DBPassword: string;
  // DDBName: string;
  DBSecretArn: string;
}

export class AppServerNestedStack extends NestedStack {
  public internalLBDNS: string;
  private ServerInitFilePath =  'lib/asset/app-server-init.sh';

  constructor(scope: Construct, id: string, props: AppServerProps) {
    super(scope, id, props);

    const ec2Role = new iam.Role(this, 'EC2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'), // Assume the role by EC2 service
      managedPolicies: [ // Attach managed policies
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'), // SSM core managed policy
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'), // Read-only access to S3
        iam.ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite'), // Read-write access to Secrets Manager
      ],
    });

    const userDataText = readFileSync(this.ServerInitFilePath, 'utf-8')
      .replaceAll('$S3BucketName', props.s3BucketName)
      .replaceAll('$SECRET_ARN', props.DBSecretArn)
      .replaceAll('$REGION', props.env?.region || 'us-east-1')

    const AppTiersubnets = props.vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
    });

    const subnets = AppTiersubnets.subnets.slice(0, 2);

    const launchTemplate = new ec2.LaunchTemplate(this, 'AppServerLauchTempalte', {
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      securityGroup: props.appTierSG,
      userData: ec2.UserData.custom(userDataText),
      instanceType: new ec2.InstanceType('t2.micro'),
      role: ec2Role,
    });

    // Create auto scaling group
    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'AutoScalingGroup', {
      vpc: props.vpc,
      minCapacity: 1,
      maxCapacity: 1,
      desiredCapacity: 1,
      vpcSubnets: { subnets: subnets },
      launchTemplate: launchTemplate,
      healthCheck: autoscaling.HealthCheck.elb({
        grace: cdk.Duration.minutes(3),
      })
    });

    autoScalingGroup.scaleOnCpuUtilization('ScaleToCPU', {
      targetUtilizationPercent: 50,
    });

    // Create target group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      vpc: props.vpc,
      port: 4000,
      targetType: elbv2.TargetType.INSTANCE,
      targets: [autoScalingGroup],
      protocol: elbv2.ApplicationProtocol.HTTP,
      healthCheck: {
        protocol: elbv2.Protocol.HTTP,
        port: '4000',
        path: '/health',
        interval: cdk.Duration.seconds(6),
        timeout: cdk.Duration.seconds(2),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
      },
    });


    // Create load balancer
    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc: props.vpc,
      internetFacing: false,
      securityGroup: props.intenalLBSG
    });

    // Add listener to load balancer
    loadBalancer.addListener('Listener', {
      port: 80,
      open: true,
      defaultTargetGroups: [targetGroup]
    });

    this.internalLBDNS = loadBalancer.loadBalancerDnsName;
  }
}
