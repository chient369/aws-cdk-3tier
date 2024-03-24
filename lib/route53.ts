import { NestedStack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {aws_route53 as route53} from 'aws-cdk-lib';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';

// Define props for Route53Stack
export interface Route53StackProps extends StackProps {
  // The DNS name of the Application Load Balancer (ALB)
  extenalLB: elbv2.ApplicationLoadBalancer;
  // The domain name for which you want to configure Route53 records
  domainName: string;
  hostedZoneId: string;
  hostedZoneName: string;
}

export class Route53Stack extends NestedStack {
  constructor(scope: Construct, id: string, props: Route53StackProps) {
    super(scope, id, props);
    // Create a hosted zone for the specified domain
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'MyHostedZone', {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.hostedZoneName
      });
    // Create an A record pointing to the ALB
    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName: props.domainName,      
      target: route53.RecordTarget.fromAlias(new LoadBalancerTarget(props.extenalLB)),
    });
  }
}
