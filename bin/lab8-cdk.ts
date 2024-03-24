#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { devParameter } from '../parameter';
import { MainProps, MainStack } from '../lib/lab8-main';

const app = new cdk.App({
  context: {
    region: devParameter.env?.region,
  }
})

const MainProps: MainProps = {
  envParameter: devParameter
}
const main = new MainStack(app, "lab8-CDK", MainProps);

