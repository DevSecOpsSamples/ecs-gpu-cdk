# Sample project for ECS GPU Inference API

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=ContainerOnAWS_ecs-gpu-cdk&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=ContainerOnAWS_ecs-gpu-cdk) [![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=ContainerOnAWS_ecs-gpu-cdk&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=ContainerOnAWS_ecs-gpu-cdk)

## Table of Contents

1. Deploy VPC stack
2. Deploy ECS GPU cluster stack
3. Deploy IAM Role stack
4. Deploy ECS Service stack
5. Scaling Test
6. GPU usage test
7. Execute a command using ECS Exec

## Prerequisites

```bash
npm install -g aws-cdk@2.33.0

# install packages in the root folder
npm install
cdk bootstrap
```

Use the `cdk` command-line toolkit to interact with your project:

* `cdk deploy`: deploys your app into an AWS account
* `cdk synth`: synthesizes an AWS CloudFormation template for your app
* `cdk diff`: compares your app with the deployed stack
* `cdk watch`: deployment every time a file change is detected

## CDK Stack

|   | Stack                         | Time    |
|---|-------------------------------|---------|
| 1 | VPC                           | 3m      |
| 2 | ECS EC2 cluster               | 5m      |
| 3 | IAM roles                     | 1m      |
| 4 | ECS Service and ALB           | 10m     |
|   | Total                         | 19m     |

Docker image size: 3.1GB

## Steps

Use the [deploy-all.sh](./deploy-all.sh) file if you want to deploy all stacks without prompt at a time.

### Step 1: VPC

The VPC ID will be saved into the SSM Parameter Store to refer from other stacks.

Parameter Name : `/cdk-ecs-gpu-ec2/vpc-id`

Use the `-c vpcId` context parameter to use the existing VPC.

```bash
cd vpc
cdk deploy
```

[vpc/lib/vpc-stack.ts](./vpc/lib/vpc-stack.ts)

### Step 2: ECS GPU cluster

```bash
cd ../ecs-ec2-cluster
cdk deploy 

# or define your VPC id with context parameter
cdk deploy -c vpcId=<vpc-id>
```

SSM parameter:

* /cdk-ecs-gpu-ec2/vpc-id

Cluster Name: [ecs-ec2-cluster/lib/cluster-config.ts](./ecs-ec2-cluster/lib/cluster-config.ts)

[ecs-ec2-cluster/lib/ec2ecs-cluster-stack.ts](./ecs-ec2-cluster/lib/ec2ecs-cluster-stack.ts)

### Step 3: IAM Role

Create the ECS Task Execution role and default Task Role.

* AmazonECS`GPU`TaskExecutionRole
* ECS`GPU`DefaultTaskRole including a policy for ECS Exec

```bash
cd ../iam-role
cdk deploy 
```

[ecs-iam-role/lib/ecs-gpu-iam-role-stack.ts](./ecs-iam-role/lib/ecs-gpu-iam-role-stack.ts)

### Step 4: ECS Service

```bash
cd ../ecs-restapi-service
cdk deploy 
```

SSM parameters:

* /cdk-ecs-gpu-ec2/vpc-id
* /cdk-ecs-gpu-ec2/cluster-capacityprovider-name
* /cdk-ecs-gpu-ec2/cluster-securitygroup-id
* /cdk-ecs-gpu-ec2/task-execution-role-arn
* /cdk-ecs-gpu-ec2/default-task-role-arn

[ecs-restapi-service/lib/ecs-restapi-service-stack.ts](./ecs-restapi-service/lib/ecs-restapi-service-stack.ts)

**IMPORTANT**

If the ECS cluster was re-created, you HAVE to deploy `ecs-restapi-service` stack after cdk.context.json files deletion with the below because old SSM parameter values exist in `cdk.context.json`.

`find . -name "cdk.context.json" -exec rm -f {} \;`

### Step 5: Scaling Test

It taks arround x minutes until attached to ALB.

```bash
aws ecs update-service --cluster gpu-ec2-local --service gpu-restapi --desired-count 3
```

### Step 6: GPU usage test

```bash
cd test
TEST_URL=$(aws cloudformation describe-stacks --stack-name ecs-gpu-service-restapi-local --query "Stacks[0].Outputs[?OutputKey=='TestURL'].OutputValue" --output text)
echo $TEST_URL
sed -e "s|<url>|${TEST_URL}|g" gpu-api-bzt-template.yaml > gpu-api-bzt.yaml
cat gpu-api-bzt.yaml
```

```bash
bzt gpu-api-bzt.yaml
```

### Step 7: Execute the gpustat command using ECS Exec

Install the Session Manager plugin for the AWS CLI:

https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html#install-plugin-linux

```bash
aws ecs list-tasks --cluster gpu-ec2-local --service-name gpu-restapi
```

```json
{
    "taskArns": [
        "arn:aws:ecs:us-east-1:123456789:task/gpu-ec2-local/0a244ff8b8654b3abaaed0880b2b78f1",
        "arn:aws:ecs:us-east-1:123456789:task/gpu-ec2-local/ac3d5a4e7273460a80aa18264e4a8f5e"
    ]
}
```

```bash
TASK_ID=$(aws ecs list-tasks --cluster gpu-ec2-local --service-name gpu-restapi | jq '.taskArns[0]' | cut -d '/' -f3 | cut -d '"' -f1)
aws ecs execute-command --cluster gpu-ec2-local --task $TASK_ID --container gpu-restapi-container  --interactive --command "/bin/sh"
```

Connect to an ECS Task and run the `gpustat` command:

```bash
gpustat
```

![gpustat](./screenshots/gpustat.png?raw=true)

## Clean Up

[clean-up.sh](./clean-up.sh)

## Structure

```text
├── build.gradle
├── package.json
├── ssm-prefix.ts
├── tsconfig.json
├── vpc
│   ├── bin
│   │   └── index.ts
│   ├── cdk.json
│   └── lib
│       └── vpc-stack.ts
├── ecs-ec2-cluster
│   ├── bin
│   │   └── index.ts
│   ├── cdk.json
│   ├── lib
│   │   ├── cluster-config.ts
│   │   └── ec2ecs-cluster-stack.ts
│   └── settings.yaml
├── ecs-iam-role
│   ├── bin
│   │   └── index.ts
│   ├── cdk.json
│   └── lib
│       └── ecs-gpu-iam-role-stack.ts
├── ecs-restapi-service
│   ├── bin
│   │   └── index.ts
│   ├── cdk.json
│   ├── lib
│   │   └── ecs-restapi-service-stack.ts
├── app
│   ├── Dockerfile
│   ├── README.md
│   ├── build.sh
│   ├── flask_api.py
│   ├── gunicorn.config.py
│   └── requirements.txt
```

## Reference

### Docs

* [Working with GPUs on Amazon ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-gpu.html)

* [Networking > networkmode > bridge](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/networking-networkmode-bridge.html)

* [Dynamic Port Mapping](https://aws.amazon.com/premiumsupport/knowledge-center/dynamic-port-mapping-ecs) - The host and awsvpc network modes do not support dynamic host port mapping.

* [ECS Exec](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-exec.html) for debugging

### CDK Lib

* [ECS](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecs-readme.html)

* [ECR Assets](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ecr_assets-readme.html)

* [IAM](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_iam-readme.html)

* [SSM](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ssm-readme.html)

### IAM Role & Policy

* [Task Role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)

* [Exec Role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-exec.html)