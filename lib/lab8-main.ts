import { Construct } from 'constructs';
import { Stack, StackProps } from 'aws-cdk-lib';
import { VpcStackProps, VpcNestedStack} from '../lib/vpc';
import { WebServerProps, WebServerNestedStack} from '../lib/web-server';
import { AppServerProps, AppServerNestedStack} from '../lib/app-server';
import { DBProps, RdsNestedStack} from '../lib/rds';
import { S3Props, S3Resource} from '../lib/assetBucket';
import { Route53Stack, Route53StackProps} from '../lib/route53';
import { AppParameter } from '../parameter';


export interface MainProps extends StackProps{
    envParameter: AppParameter;
}

export class MainStack extends Stack {
  private vpcResource: VpcNestedStack;
  private webServerResource: WebServerNestedStack;
  private appServerResource: AppServerNestedStack;
  private dbResource: RdsNestedStack;
  private S3Resource: S3Resource;
  private Route53Resource: Route53Stack;

  constructor(scope: Construct, id: string, props: MainProps) {
    super(scope, id, props);


    const S3ResourceProps : S3Props = {
      s3BucketName: props.envParameter.s3BucketName
    }

     this.S3Resource = new S3Resource(this,'S3',S3ResourceProps);

    // //Deploy VPC nested stack
    const vpcStackProps: VpcStackProps = {
      vpcName: props?.envParameter.vpcName || 'myvpc',
      vpcMaxAzs: props?.envParameter.vpcMaxAzs || 2,
      vpcNatGateways: props?.envParameter.vpcNatGateways || 1,
      webTierSubnetCidr: props?.envParameter.webTierSubnetCidr || 24,
      appTierSubnetCidr: props?.envParameter.appTierSubnetCidr || 24,
      rdsSubnetCidr: props?.envParameter.rdsSubnetCidr || 24,
      env: {
        account: props?.envParameter.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
        region: props?.envParameter.env?.region || process.env.CDK_DEFAULT_REGION,
      },
      tags: {
        Project: 'lab8-cdk',
        Environment: props?.envParameter.envName,
      },
    }
    
    this.vpcResource = new VpcNestedStack(this,"VPC",vpcStackProps);

    
    // //Deploy RDS nested stack
    const rdsProps: DBProps = {
      vpc: this.vpcResource.vpc,
      dbTierSG: this.vpcResource.rdsSG,
      DBUserName: props?.envParameter.DBUserName,
      DBPassword: props?.envParameter.DBPassword,
      DatabaseName: props?.envParameter.DatabaseName,
      RDSClusterName: props?.envParameter.RDSClusterName,
      EngineVersion: props?.envParameter.EngineVersion,
      DBInstanceType:props?.envParameter.DBInstanceType,
      env: {
        account: props?.envParameter.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
        region: props?.envParameter.env?.region || process.env.CDK_DEFAULT_REGION,
      }
    }
    
    this.dbResource = new RdsNestedStack(this, "RDS", rdsProps);

    
    // //Deploy AppServer  nested stack
    const appServerProps : AppServerProps={
      vpc: this.vpcResource.vpc,
      appTierSG: this.vpcResource.appTierSG,
      s3BucketName: props?.envParameter.s3BucketName,
      intenalLBSG: this.vpcResource.internalLBSG,
      DBSecretArn: this.dbResource.DBSecretArn,
      // DBUserName: props?.envParameter.DBUserName,
      // DBPassword: this.dbResource.DBPassword,
      // DatabaseName: props?.envParameter.DatabaseName,
      // DBConnectionDNS: this.dbResource.DBEndpoint,
      env: {
        account: props?.envParameter.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
        region: props?.envParameter.env?.region || process.env.CDK_DEFAULT_REGION,
      }
    }
    
     this.appServerResource = new AppServerNestedStack(this,'AppServer', appServerProps)

    
    //Deploy web Server  nested stack
    const webServerProps : WebServerProps={
      vpc: this.vpcResource.vpc,
      webTierSG: this.vpcResource.webTierSG,
      s3BucketName: props?.envParameter.s3BucketName,
      internalLB: this.appServerResource.internalLBDNS,
      extenalLBSG: this.vpcResource.extenalLBSG,
      DomainCerArn: props.envParameter.CertificateArn,
      env: {
        account: props?.envParameter.env?.account || process.env.CDK_DEFAULT_ACCOUNT,
        region: props?.envParameter.env?.region || process.env.CDK_DEFAULT_REGION,
      }
    }
    
    this.webServerResource = new WebServerNestedStack(this,"WebServer", webServerProps);

    //Deploy Route53
    const route53Props : Route53StackProps = {
      extenalLB: this.webServerResource.loadBalancer,
      domainName: props.envParameter.DomainName,
      hostedZoneId: props.envParameter.PublicHostedZoneId,
      hostedZoneName: props.envParameter.PublicHostedZoneName

    }
    this.Route53Resource = new Route53Stack(this,'Route53',route53Props);


    this.dbResource.addDependency(this.vpcResource);
    this.appServerResource.addDependency(this.dbResource);
    this.webServerResource.addDependency(this.appServerResource);
    this.Route53Resource.addDependency(this.webServerResource);
  }
}
