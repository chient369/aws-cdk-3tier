import { NestedStack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {aws_ec2 as ec2} from 'aws-cdk-lib';

export interface VpcStackProps extends StackProps {
  vpcName: string;
  vpcMaxAzs: number;
  vpcNatGateways: number;
  webTierSubnetCidr : number;
  appTierSubnetCidr: number;
  rdsSubnetCidr: number;
}

export class VpcNestedStack extends NestedStack {
  public vpc: ec2.Vpc;
  public webTierSG: ec2.SecurityGroup;
  public appTierSG: ec2.SecurityGroup;
  public rdsSG: ec2.SecurityGroup;
  public extenalLBSG: ec2.SecurityGroup;
  public internalLBSG: ec2.SecurityGroup;
  
  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, props);

    const subnetConfig: ec2.SubnetConfiguration[] = [
      {
        cidrMask: props.webTierSubnetCidr,
        name: "webTier",
        subnetType: ec2.SubnetType.PUBLIC,
      },
      {
        cidrMask: props.appTierSubnetCidr,
        name: "appTier",
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      {
        cidrMask: props.rdsSubnetCidr,
        name: "rds",
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    ];

    this.vpc = new ec2.Vpc(this, props.vpcName, {
      vpcName: props.vpcName,
      maxAzs: props.vpcMaxAzs,
      natGateways: props.vpcNatGateways,
      subnetConfiguration : subnetConfig,
    })

    this.extenalLBSG = new ec2.SecurityGroup(this, 'extenalLBSG',{
      vpc: this.vpc,
      description: `External Load Balancer Security Group`,
      allowAllOutbound: true,
    });
    this.extenalLBSG.addIngressRule(ec2.Peer.anyIpv4(),ec2.Port.tcp(80));

    this.webTierSG = new ec2.SecurityGroup(this, 'webTierSG',{
      vpc: this.vpc,
      description: 'Security Group for the Web Tier of our application',
      allowAllOutbound: true,
    })

    this.webTierSG.connections.allowFrom(
      new ec2.Connections({
          securityGroups:[this.extenalLBSG],
        }), 
        ec2.Port.tcp(80)
      )

    this.internalLBSG = new ec2.SecurityGroup(this, 'internalLBSG',{
      vpc: this.vpc,
      description: 'Security Group for the internal LBSG of our application',
      allowAllOutbound: true,
    })
    this.internalLBSG.connections.allowFrom(
      new ec2.Connections({
          securityGroups:[this.webTierSG],
        }), 
        ec2.Port.tcp(80)
      )

    this.appTierSG = new ec2.SecurityGroup(this, 'appTierSG',{
      vpc: this.vpc, 
      description: 'Security Group for the application tier of our application',
      allowAllOutbound: true,
    })
    this.appTierSG.connections.allowFrom(
      new ec2.Connections({
          securityGroups:[this.internalLBSG],
        }), 
        ec2.Port.tcp(4000)
      )

    this.rdsSG = new ec2.SecurityGroup(this, 'rdsSG',{
      vpc: this.vpc,
      description: 'Security Group for rds',
      allowAllOutbound: true,
    })
    this.rdsSG.connections.allowFrom(
      new ec2.Connections({
          securityGroups:[this.appTierSG],
        }), 
        ec2.Port.tcp(3306)
      )
  }

}
