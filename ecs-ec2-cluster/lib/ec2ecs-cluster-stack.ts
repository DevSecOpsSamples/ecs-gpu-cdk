import { Stack, StackProps, CfnOutput, Token, Fn, Duration } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import { Construct } from 'constructs';

import { CLUSTER_NAME, INSTANCE_TYPE } from '../lib/cluster-config';
import { SSM_PREFIX } from '../../ssm-prefix';

/**
 * GPU optimized API:
 * aws ssm get-parameters --names /aws/service/ecs/optimized-ami/amazon-linux-2/gpu/recommended
 * https://ap-northeast-2.console.aws.amazon.com/systems-manager/parameters/aws/service/ecs/optimized-ami/amazon-linux-2/gpu/recommended/image_id/description?region=ap-northeast-2#
 */
export class EcsEc2ClusterStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const stage = this.node.tryGetContext('stage') || 'local';
        const vpcId = this.node.tryGetContext('vpcId') || ssm.StringParameter.valueFromLookup(this, `${SSM_PREFIX}/vpc-id`);
        const vpc = ec2.Vpc.fromLookup(this, 'vpc', { vpcId });

        const cluster = new ecs.Cluster(this, 'cluster', {
            vpc,
            clusterName: `${CLUSTER_NAME}-${stage}`,
            containerInsights: true,
        });
        const privateSubnetsSelection = { subnets: vpc.privateSubnets };

        const autoScalingGroup = cluster.addCapacity('ec2-instance', {
            instanceType: new ec2.InstanceType(INSTANCE_TYPE),
            machineImage: ec2.MachineImage.fromSsmParameter(
                '/aws/service/ecs/optimized-ami/amazon-linux-2/gpu/recommended/image_id',
                { os: ec2.OperatingSystemType.LINUX }
            ),
            minCapacity: 2,
            maxCapacity: 10,
            groupMetrics: [autoscaling.GroupMetrics.all()],
            cooldown: Duration.seconds(10),
            vpcSubnets: privateSubnetsSelection,
            blockDevices: [
                {
                    deviceName: '/dev/xvda',
                    volume: autoscaling.BlockDeviceVolume.ebs(100, {
                        deleteOnTermination: true,
                        encrypted: true,
                        volumeType: autoscaling.EbsDeviceVolumeType.GP3
                    })
                }
            ]
        });
        autoScalingGroup.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
        // To test on EC2 by connect with SSM, 'ecr:BatchGetImage' permission is required in EC2 role   
        autoScalingGroup.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'));

        const capacityProvider = new ecs.AsgCapacityProvider(this, 'asg-capacityprovider', {
            capacityProviderName: `${cluster.clusterName}-AsgCapacityProvider`,
            autoScalingGroup
        });
        cluster.addAsgCapacityProvider(capacityProvider);

        const cfnLaunchConfig = autoScalingGroup.node.findChild('LaunchConfig');
        const ecsEc2SgToken = Token.asAny(Fn.select(0, cfnLaunchConfig.securityGroups as Array<any>));

        new CfnOutput(this, 'VPC', { value: vpc.vpcId });
        new CfnOutput(this, 'EC2 Security Group ID', { value: ecsEc2SgToken.toString() });
        new CfnOutput(this, 'Cluster', { value: cluster.clusterName });
        new CfnOutput(this, 'CapacityProvider', { value: capacityProvider.capacityProviderName });

        new ssm.StringParameter(this, 'ssm-cluster-capacityprovider-name', { parameterName: `${SSM_PREFIX}/cluster-capacityprovider-name`, stringValue: capacityProvider.capacityProviderName });
        new ssm.StringParameter(this, 'ssm-cluster-securitygroup-id', { parameterName: `${SSM_PREFIX}/cluster-securitygroup-id`, stringValue: ecsEc2SgToken.toString() });
    }
}
