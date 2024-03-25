import * as cdk from 'aws-cdk-lib';
import { NestedStack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { readFileSync } from 'fs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';


export interface WebServerProps extends StackProps {
  vpc: ec2.Vpc;
  webTierSG: ec2.SecurityGroup;
  extenalLBSG: ec2.SecurityGroup;
  s3BucketName: string;
  internalLB: string;
  DomainCerArn: string;
}

export class WebServerNestedStack extends NestedStack {
  public loadBalancer: elbv2.ApplicationLoadBalancer
  private ServerInitFilePath = 'lib/asset/web-server-init.sh'

  constructor(scope: Construct, id: string, props: WebServerProps) {
    super(scope, id, props);

    const ec2Role = new iam.Role(this, 'EC2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'), // Assume the role by EC2 service
      managedPolicies: [ // Attach managed policies
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'), // SSM core managed policy
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3ReadOnlyAccess'), // Read-only access to S3
      ],
    });
    const userDataText = readFileSync(
      this.ServerInitFilePath,
      'utf-8')
      .replaceAll('${s3BucketName}', props.s3BucketName)
      .replaceAll('${InternalLB}', props.internalLB)
    const subnets = props.vpc.publicSubnets;

    const launchTemplate = new ec2.LaunchTemplate(this, 'AppServerLauchTempalte', {
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      securityGroup: props.webTierSG,
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
      port: 80,
      targets: [autoScalingGroup],
      protocol: elbv2.ApplicationProtocol.HTTP
    });

    // Create load balancer
    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'LoadBalancer', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.extenalLBSG
    });

    // Add listener to load balancer
    this.loadBalancer.addListener('HttpListener', {
      port: 80,
      open: true,
      defaultTargetGroups: [targetGroup]
    });

    const certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', props.DomainCerArn);
    this.loadBalancer.addListener('HttpsListener', {
      port: 443,
      open: true,
      certificates: [certificate],
      defaultTargetGroups: [targetGroup]
    });

  }
}