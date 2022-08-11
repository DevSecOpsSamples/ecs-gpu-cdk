#!/usr/bin/env node

/**
 * /cdk-ecs-gpu-ec2/vpc-id
 * 
 * ecs-ec2-cluster:
 *   /cdk-ecs-gpu-ec2/cluster-capacityprovider-name
 *   /cdk-ecs-gpu-ec2/cluster-securitygroup-id
 * 
 * iam-role:
 *   /cdk-ecs-gpu-ec2/task-execution-role-arn
 *   /cdk-ecs-gpu-ec2/default-task-role-arn
 * 
 */
export const SSM_PREFIX = '/cdk-ecs-gpu-ec2';