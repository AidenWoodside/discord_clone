#!/usr/bin/env bash
set -euo pipefail

# One-time script to import existing AWS resources into Terraform state.
# Fill in actual resource IDs before running.
# After import, run `terraform plan` and verify zero destroy/replace actions.

cd "$(dirname "$0")"
terraform init

# Import existing resources (run once, in this order)
# Replace placeholder IDs with actual values before running

terraform import aws_instance.app "i-REPLACE_WITH_INSTANCE_ID"
terraform import aws_security_group.app "sg-REPLACE_WITH_SG_ID"
terraform import aws_iam_role.ec2 "discord-clone-ec2"
terraform import aws_iam_instance_profile.ec2 "discord-clone-ec2"
terraform import aws_iam_role.deploy "discord-clone-deploy"
terraform import aws_iam_openid_connect_provider.github \
  "arn:aws:iam::REPLACE_WITH_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"

# Verify no destructive changes
echo ""
echo "=== Running terraform plan to verify imports ==="
echo "Expect zero destroy/replace actions. Only cosmetic changes are acceptable."
echo ""
terraform plan
