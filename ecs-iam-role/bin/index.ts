#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

import { EcsGpuIamRoleStack } from '../lib/ecs-gpu-iam-role-stack';

const app = new cdk.App();
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
};
const stage = app.node.tryGetContext('stage') || 'local';

new EcsGpuIamRoleStack(app, `ecs-gpu-iam-role-${stage}`,  {
    env,
    description: 'EC2 ECS IAM Role for GPU cluster and tasks',
    terminationProtection: stage!='local'
});