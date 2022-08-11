echo "Delete cdk.context.json files"
find . -name "cdk.context.json" -exec rm -f {} \;

echo "[1/4] Deploy vpc"
cd ./vpc
cdk deploy --require-approval never

echo "[2/4] Deploy ecs-ec2-cluster"
cd ../ecs-ec2-cluster
cdk deploy --require-approval never

echo "[3/4] Deploy ecs-iam-role"
cd ../ecs-iam-role
cdk deploy --require-approval never

echo "[4/4] Deploy ecs-restapi-service"
cd ../ecs-restapi-service
cdk deploy --require-approval never