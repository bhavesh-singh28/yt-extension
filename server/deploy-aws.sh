#!/bin/bash
# ==============================================================================
# Automated One-Click AWS Lambda Deployment Script
# Provisions IAM role, Lambda function, Function URL, CORS, and Environment Vars
# ==============================================================================

set -e

# Configuration
FUNCTION_NAME="${AWS_LAMBDA_FUNCTION_NAME:-youtube-study-filter}"
REGION="${AWS_REGION:-ap-south-1}"
ROLE_NAME="${FUNCTION_NAME}-role"
MODEL="${GEMINI_MODEL:-gemini-3.5-flash-lite}"

echo "============================================================"
echo "🚀 Deploying YouTube Study Filter to AWS Lambda ($REGION)"
echo "============================================================"

# Check for AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it or configure it before running."
    exit 1
fi

# Check AWS authentication
echo "🔑 Verifying AWS credentials..."
CALLER_IDENTITY=$(aws sts get-caller-identity 2>&1)
if [ $? -ne 0 ]; then
    echo "❌ AWS credentials not found or expired. Run 'aws configure' first."
    exit 1
fi
ACCOUNT_ID=$(echo "$CALLER_IDENTITY" | grep -o '"Account": "[^"]*' | cut -d'"' -f4)
echo "✅ Authenticated as AWS Account: $ACCOUNT_ID"

# Read GEMINI_API_KEY from .env if not provided in environment
if [ -z "$GEMINI_API_KEY" ] && [ -f ".env" ]; then
    GEMINI_API_KEY=$(grep -E "^GEMINI_API_KEY=" .env | cut -d'=' -f2- | tr -d ' "')
fi

if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️ Warning: GEMINI_API_KEY is not set. Please set it in AWS Lambda configuration."
fi

# Step 1: Package function code
echo "📦 Packaging code into function.zip..."
rm -f function.zip
rm -rf node_modules
npm ci --omit=dev --silent
zip -q -r function.zip lambda.js src package.json node_modules
echo "✅ function.zip created ($(du -h function.zip | cut -f1))"

# Step 2: Ensure IAM Execution Role exists
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
echo "🛡️ Checking IAM Role: $ROLE_NAME..."

if ! aws iam get-role --role-name "$ROLE_NAME" &> /dev/null; then
    echo "Creating IAM Role: $ROLE_NAME..."
    TRUST_POLICY='{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": { "Service": "lambda.amazonaws.com" },
          "Action": "sts:AssumeRole"
        }
      ]
    }'
    
    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document "$TRUST_POLICY" > /dev/null
    
    aws iam attach-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" > /dev/null

    echo "⏳ Waiting 10s for IAM role propagation across AWS..."
    sleep 10
else
    echo "✅ IAM Role exists: $ROLE_ARN"
fi

# Step 3: Create or Update Lambda Function
echo "⚡ Checking Lambda function: $FUNCTION_NAME..."

ENV_VARS="Variables={GEMINI_API_KEY=${GEMINI_API_KEY},GEMINI_MODEL=${MODEL},NODE_ENV=production,ALLOWED_ORIGINS='*'}"

if ! aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" &> /dev/null; then
    echo "Creating new Lambda function: $FUNCTION_NAME..."
    aws lambda create-function \
        --function-name "$FUNCTION_NAME" \
        --runtime "nodejs20.x" \
        --role "$ROLE_ARN" \
        --handler "lambda.handler" \
        --zip-file "fileb://function.zip" \
        --timeout 15 \
        --memory-size 256 \
        --environment "$ENV_VARS" \
        --region "$REGION" > /dev/null
    
    echo "⏳ Waiting for function creation..."
    aws lambda wait function-active --function-name "$FUNCTION_NAME" --region "$REGION"
else
    echo "Updating existing Lambda function code..."
    aws lambda update-function-code \
        --function-name "$FUNCTION_NAME" \
        --zip-file "fileb://function.zip" \
        --region "$REGION" > /dev/null
    
    aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"
    
    if [ -n "$GEMINI_API_KEY" ]; then
        echo "Updating environment variables..."
        aws lambda update-function-configuration \
            --function-name "$FUNCTION_NAME" \
            --environment "$ENV_VARS" \
            --timeout 15 \
            --memory-size 256 \
            --region "$REGION" > /dev/null
        aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION"
    fi
fi

# Step 4: Configure Function URL with CORS
echo "🌐 Configuring Lambda Function URL (HTTPS)..."

URL_CONFIG=$(aws lambda create-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --auth-type "NONE" \
    --cors '{"AllowOrigins":["*"],"AllowMethods":["*"],"AllowHeaders":["*"]}' \
    --region "$REGION" 2> /dev/null || \
    aws lambda update-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --auth-type "NONE" \
    --cors '{"AllowOrigins":["*"],"AllowMethods":["*"],"AllowHeaders":["*"]}' \
    --region "$REGION")

# Grant public access permission to invoke Function URL
aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id "FunctionURLAllowPublicAccess" \
    --action "lambda:InvokeFunctionUrl" \
    --principal "*" \
    --function-url-auth-type "NONE" \
    --region "$REGION" 2> /dev/null || true

# Grant public access to invoke Lambda execution
aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id "AllowPublicInvokeFunction" \
    --action "lambda:InvokeFunction" \
    --principal "*" \
    --region "$REGION" 2> /dev/null || true

FUNCTION_URL=$(echo "$URL_CONFIG" | grep -o '"FunctionUrl": "[^"]*' | cut -d'"' -f4)

# Clean up local zip
rm -f function.zip

echo "============================================================"
echo "🎉 AWS Lambda Deployment Complete!"
echo "============================================================"
echo ""
echo "🔗 Function URL:"
echo "   $FUNCTION_URL"
echo ""
echo "📋 Test health endpoint:"
echo "   curl -s ${FUNCTION_URL}api/health"
echo ""
echo "🔌 Paste this URL into the extension popup under 'Backend API URL'!"
echo "============================================================"
