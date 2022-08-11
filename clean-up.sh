echo "[1/4] destroy ecs-restapi-service"
cd ecs-restapi-service
cdk destroy

echo "[2/4] destroy ecs-ec2-cluster"
cd ../ecs-ec2-cluster
cdk destroy

echo "[3/4] destroy ecs-iam-role"
cd ../ecs-iam-role
cdk destroy

echo "[4/4] destroy vpc"
cd ../vpc
cdk destroy

find . -name "cdk.context.json" -exec rm -f {} \;