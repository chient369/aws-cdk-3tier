import { NestedStack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import {readFileSync} from 'fs';


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
    // Create EC2 instance with user data
    // const userDataScript = ec2.UserData.forLinux();
    // userDataScript.addCommands(
    //   `sudo yum update -y`,
    //   `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash`,
    //   `export NVM_DIR="$HOME/.nvm"`,
    //   `[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"`,
    //   `source ~/.bashrc`,
    //   `nvm install 16`,
    //   `nvm use 16`,
    //   `version=$(node --version)`,
    //   `cd /home/ec2-user/`,
    //   `aws s3 cp s3://${props.s3BucketName}/src/web-tier/ web-tier --recursive`,
    //   `cd /home/ec2-user/web-tier`,
    //   `npm install`,
    //   `npm run build`,
    //   `sudo amazon-linux-extras install nginx1 -y`,
    //   `cd /etc/nginx`,
    //   `sudo rm nginx.conf`,
    //   `sudo aws s3 cp s3://${props.s3BucketName}/src/nginx.conf .`,
    //   `sudo sed -i "s/INTERNAL-LB-DNS/${props.internalLB}/g" nginx.conf`,
    //   `sudo service nginx restart`,
    //   `chmod -R 755 /home/ec2-user`,
    //   `sudo chkconfig nginx on`
    // );
    const subnets = props.vpc.publicSubnets;

    // Create auto scaling group
    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'AutoScalingGroup', {
      vpc: props.vpc,
      role: ec2Role,
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      minCapacity: 1,
      maxCapacity: 1,
      desiredCapacity: 1,
      associatePublicIpAddress: true,
      securityGroup: props.webTierSG,
      vpcSubnets: { subnets: subnets },
      userData: ec2.UserData.custom(userDataText),

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

    // const certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', props.DomainCerArn);
    // this.loadBalancer.addListener('HttpsListener', {
    //   port: 443,
    //   open: true,
    //   certificates: [certificate],
    //   defaultTargetGroups: [targetGroup]
    // });


  }
}