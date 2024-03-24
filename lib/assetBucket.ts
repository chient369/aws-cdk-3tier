import {aws_s3 as s3} from 'aws-cdk-lib';
import { Source, BucketDeployment } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { RemovalPolicy} from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';

export interface S3Props extends StackProps{
  s3BucketName: string
}

export class S3Resource extends Construct{
    constructor(scope: Construct, id: string, props: S3Props) {
        super(scope, id);
    
        // Create an Asset Bucket for the Instance.  Assets in this bucket will be downloaded to the EC2 during deployment
        const assetBucket = new s3.Bucket(this, props.s3BucketName, {
          publicReadAccess: false,
          removalPolicy: RemovalPolicy.DESTROY,
          objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED,
          autoDeleteObjects: true,
          bucketName: props.s3BucketName
        });
    
        // Deploy the local assets to the Asset Bucket during the CDK deployment
        new BucketDeployment(this, 'assetBucketDeployment', {
          sources: [Source.asset('src/')],
          destinationBucket: assetBucket,
          retainOnDelete: false,
          memoryLimit: 512,
        });

    }
}