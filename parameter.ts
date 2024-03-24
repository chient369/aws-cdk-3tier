import { Environment } from 'aws-cdk-lib';

export interface AppParameter {
  env?: Environment;
  envName: string;
  s3BucketName: string;
  
  //vpc
  vpcName?: string;
  vpcMaxAzs?: number;
  vpcNatGateways?: number;
  webTierSubnetCidr? : number;
  appTierSubnetCidr?: number;
  rdsSubnetCidr?: number;

  //Web tier
  instanceType?: String;

  //DB
  DBUserName: string;
  DBPassword: string;
  DatabaseName: string;
  RDSClusterName: string;
  EngineVersion: string;
  DBInstanceType:String;

  //Route53
  DomainName: string;
  PublicHostedZoneId: string;
  PublicHostedZoneName: string;
  CertificateArn: string;

}

// Example for Develop Development
export const devParameter: AppParameter = {
  envName: 'Development',
  env: { account: <Account ID>, region: 'us-east-1' },
  s3BucketName: 'lab7-bucket999-demo',
  //vpc
  vpcName: 'lab7-vpc',
  vpcMaxAzs: 2,
  vpcNatGateways: 2,
  webTierSubnetCidr: 24,
  appTierSubnetCidr: 24,
  rdsSubnetCidr: 24,

  //DB
  DBUserName: 'lab8Admin',
  DBPassword: 'AdminDef',
  DatabaseName: 'webappdb',
  RDSClusterName: 'lab8-rds-cluster',
  EngineVersion: '5.7.mysql_aurora.2.11.4',
  DBInstanceType: 'r5.large',

  //Route53
  //Route53
  CertificateArn: <Certificate ARN>,
  DomainName: <Extenal LB domain>,
  PublicHostedZoneId: <Hosted zone ID>,
  PublicHostedZoneName: <Hosted zone NAME>
  
};