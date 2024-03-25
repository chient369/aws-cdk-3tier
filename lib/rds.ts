import * as cdk from 'aws-cdk-lib';
import { NestedStack, NestedStackProps, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager'

export interface DBProps extends StackProps {
  vpc: ec2.Vpc;
  dbTierSG: ec2.SecurityGroup;
  DBUserName: string;
  DBPassword: string;
  DatabaseName: string;
  RDSClusterName: string;
  EngineVersion: string;
  DBInstanceType: String;
}

export class RdsNestedStack extends NestedStack {
  public DBSecretArn: string;

  constructor(scope: Construct, id: string, props: DBProps) {
    super(scope, id, props);


    const AppTiersubnets = props.vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_ISOLATED
    });;

    const subnets = AppTiersubnets.subnets.slice(0, 2);
    // Create RDS Subnet Group
    const subnetGroup = new rds.SubnetGroup(this, 'RDSSubnetGroup', {
      vpc: props.vpc,
      description: 'My RDS Subnet Group',
      vpcSubnets: { subnets: subnets }
    });

    const dbEngine = rds.DatabaseClusterEngine.auroraMysql({ version: rds.AuroraMysqlEngineVersion.of(props.EngineVersion) })

    const parameterGroupForInstance = new rds.ParameterGroup(
      this,
      `${props.RDSClusterName}-${dbEngine.engineVersion?.fullVersion}`,
      {
        engine: dbEngine,
        description: `Aurora RDS Instance Parameter Group for database ${props.RDSClusterName}`
      },
    )
    const databaseCredentialsSecret = new Secret(this, 'DBCredentialsSecret', {
      secretName: `${props.RDSClusterName}-credentials`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: props.DBUserName,
        }),
        excludeCharacters: "\"@/\\ '", // Loại bỏ các ký tự đặc biệt
        excludePunctuation: true, // Loại bỏ dấu câu
        includeSpace: false, // Không bao gồm khoảng trắng
        generateStringKey: 'password',
        passwordLength: 30,
      },
    })

    const mysqlCredentials = rds.Credentials.fromSecret(
      databaseCredentialsSecret,
      props.DBUserName,
    );

    const rdsCluster = new rds.DatabaseCluster(this, props.RDSClusterName, {
      vpc: props.vpc,
      engine: dbEngine,
      iamAuthentication: false,
      clusterIdentifier: props.RDSClusterName,
      defaultDatabaseName: props.DatabaseName,
      subnetGroup: subnetGroup,
      writer: rds.ClusterInstance.provisioned('writer',{
        instanceType: new ec2.InstanceType(`${props.DBInstanceType}`),
        parameterGroup: parameterGroupForInstance,
        publiclyAccessible: false,

      }),
      vpcSubnets: {
        subnets: subnets
      },
      securityGroups: [props.dbTierSG],
      parameterGroup: parameterGroupForInstance,
      credentials: mysqlCredentials

    })
    this.DBSecretArn = databaseCredentialsSecret.secretFullArn + ''
  }
}
