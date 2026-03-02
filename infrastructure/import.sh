#!/usr/bin/env bash
set -euo pipefail

# One-time script to import existing AWS resources into Terraform state.
# Resources that don't exist yet will be created by `terraform apply`.

# Required environment variables
: "${AWS_ACCOUNT_ID:?Set AWS_ACCOUNT_ID}"
: "${EC2_INSTANCE_ID:?Set EC2_INSTANCE_ID}"
: "${APP_SECURITY_GROUP_ID:?Set APP_SECURITY_GROUP_ID}"
: "${ASSETS_BUCKET_NAME:?Set ASSETS_BUCKET_NAME}"

# Export as TF_VAR so terraform picks it up automatically
export TF_VAR_assets_bucket_name="$ASSETS_BUCKET_NAME"

cd "$(dirname "$0")"
terraform init

# Import existing resources (run once, in this order)
# Only import resources that already exist in AWS

# EC2 instance and security group (pre-existing)
terraform import aws_instance.app "$EC2_INSTANCE_ID" || echo "aws_instance.app already imported or not found"
terraform import aws_security_group.app "$APP_SECURITY_GROUP_ID" || echo "aws_security_group.app already imported or not found"

# GitHub OIDC provider (pre-existing)
terraform import aws_iam_openid_connect_provider.github \
  "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com" || echo "OIDC provider already imported or not found"

# IAM roles and instance profile — these do NOT exist yet.
# Terraform will create them via `terraform apply`.
# - aws_iam_role.ec2 (discord-clone-ec2)
# - aws_iam_instance_profile.ec2 (discord-clone-ec2)
# - aws_iam_role.deploy (discord-clone-deploy)

# Verify no destructive changes
echo ""
echo "=== Running terraform plan to verify imports ==="
echo "Expect zero destroy/replace actions. Only cosmetic changes are acceptable."
echo "IAM roles and instance profile will show as 'will be created' — this is expected."
echo ""
terraform plan
