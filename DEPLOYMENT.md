# AWS Lambda Deployment & CI/CD Guide 🚀

This guide walks you through deploying the **YouTube Study Filter** backend to **AWS Lambda** (Serverless) using **AWS Lambda Function URLs** and setting up automated **CI/CD with GitHub Actions**.

---

## 📑 Table of Contents

1. [Overview & Architecture](#-overview--architecture)
2. [Step 1: Obtain AWS Access Keys (IAM)](#-step-1-obtain-aws-access-keys-iam)
3. [Step 2: Configure AWS CLI on Your Machine](#-step-2-configure-aws-cli-on-your-machine)
4. [Step 3: 1-Click Automated Deployment](#-step-3-1-click-automated-deployment)
5. [Step 4: Automated CI/CD Pipeline (GitHub Actions)](#-step-4-automated-cicd-pipeline-github-actions)
6. [Step 5: Alternative - Manual AWS Console Deployment](#-step-5-alternative---manual-aws-console-deployment)
7. [Step 6: Connect to Chrome Extension](#-step-6-connect-to-chrome-extension)
8. [Testing & Verification](#-testing--verification)
9. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🏗 Overview & Architecture

Instead of paying for an always-on virtual server or container, we deploy to **AWS Lambda with Function URLs**:

- **Direct HTTPS URL**: No expensive Amazon API Gateway required.
- **Cost**: $0.00/month under AWS Free Tier (1M requests and 3.2M seconds of compute free every month).
- **Speed**: Sub-second cold starts with native Node.js 20.x ES modules.
- **Zero Maintenance**: Scales automatically from 0 to thousands of concurrent requests.

---

## 🔑 Step 1: Obtain AWS Access Keys (IAM)

To allow your terminal or GitHub Actions to deploy code to AWS, you need an **Access Key ID** and a **Secret Access Key**.

### 1. Log in to AWS

Go to [AWS Management Console](https://console.aws.amazon.com/) and sign in.

### 2. Navigate to IAM (Identity and Access Management)

- In the search bar at the very top, search for **IAM**.
- Select **IAM** (under Services).
- On the left sidebar, click **Users**.

### 3. Create a New User

1. Click the orange **Create user** button.
2. **User name**: Enter `youtube-filter-admin` (or your preferred name).
3. Leave _"Provide user access to the AWS Management Console"_ **unchecked** (this user is only for CLI and CI/CD).
4. Click **Next**.

### 4. Attach Permissions

1. Choose **Attach policies directly**.
2. In the search box, search for:
   ```text
   AdministratorAccess
   ```
3. Check the checkbox next to **AdministratorAccess** _(provides necessary permissions to create Lambda functions, IAM roles, and configure public Function URLs)_.
4. Click **Next**, then click **Create user**.

### 5. Generate Access Keys

1. In the Users table, click on the user you just created (`youtube-filter-admin`).
2. Go to the **Security credentials** tab in the middle of the page.
3. Scroll down to the **Access keys** section and click **Create access key**.
4. Select **Command Line Interface (CLI)**.
5. Check the confirmation checkbox: _"I understand the above recommendation and want to proceed to create an access key."_
6. Click **Next**, then click **Create access key**.
7. **Download or copy your keys immediately**:
   - **Access key**: Starts with `AKIA...`
   - **Secret access key**: A long string of letters/numbers.
   - Click **Download .csv file** so you do not lose them.
8. Click **Done**.

---

## 💻 Step 2: Configure AWS CLI on Your Machine

### 1. Check if AWS CLI is installed

Open your Mac terminal:

```bash
aws --version
```

- If installed, you will see `aws-cli/2.x.x`.
- If not installed, install it using Homebrew:
  ```bash
  brew install awscli
  ```
  _(Or download from [AWS CLI Official Installer](https://awscli.amazonaws.com/AWSCLIV2.pkg))_.

### 2. Configure your credentials

Run:

```bash
aws configure
```

Enter your details when prompted:

```text
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: us-east-1
Default output format [None]: json
```

### 3. Verify connection

```bash
aws sts get-caller-identity
```

If this prints your AWS Account ID, your terminal is successfully authenticated!

---

## ⚡ Step 3: 1-Click Automated Deployment

We have created an automated deployment script [`server/deploy-aws.sh`](file:///Users/bhavesh/Work/yt-chrome/server/deploy-aws.sh) that runs locally and provisions everything for you.

### 1. Verify Gemini API Key

Make sure your Gemini API key is configured in `server/.env`:

```env
PORT=3000
GEMINI_API_KEY=AIzaSyYourActualKeyHere
GEMINI_MODEL=gemini-3.5-flash-lite
ALLOWED_ORIGINS=*
```

### 2. Run the deployment script

```bash
cd /Users/bhavesh/Work/yt-chrome/server
chmod +x deploy-aws.sh
./deploy-aws.sh
```

### What the script handles automatically:

- Prunes development dependencies and builds a minimal `function.zip`.
- Creates the AWS IAM execution role (`AWSLambdaBasicExecutionRole`).
- Creates or updates the Lambda function with Node.js 20.x runtime.
- Creates a public HTTPS **Function URL** with open CORS (`*`).
- Injects your `GEMINI_API_KEY` into AWS Lambda environment variables.
- Prints your live HTTPS endpoint URL!

---

## 🔄 Step 4: Automated CI/CD Pipeline (GitHub Actions)

Your repository already includes [`.github/workflows/deploy-lambda.yml`](file:///Users/bhavesh/Work/yt-chrome/.github/workflows/deploy-lambda.yml). Every time you push changes to `server/**` on `main`, GitHub deploys it to Lambda automatically.

### 1. Add Secrets to your GitHub Repository

1. Go to your repository on GitHub.
2. Click **Settings** → **Secrets and variables** → **Actions**.
3. Click **New repository secret** and add:

| Secret Name                | Description                  | Example                 |
| :------------------------- | :--------------------------- | :---------------------- |
| `AWS_ACCESS_KEY_ID`        | Access key from Step 1       | `AKIAIOSFODNN7EXAMPLE`  |
| `AWS_SECRET_ACCESS_KEY`    | Secret key from Step 1       | `wJalrXUtnFEMI/K7MD...` |
| `AWS_REGION`               | Target AWS region            | `us-east-1`             |
| `AWS_LAMBDA_FUNCTION_NAME` | Name of your Lambda function | `youtube-study-filter`  |
| `GEMINI_API_KEY`           | Google Gemini API Key        | `AIzaSy...`             |
| `GEMINI_MODEL`             | _(Optional)_ Model ID        | `gemini-3.5-flash-lite` |

### 2. Triggering Deployments

- **Automatic**:
  ```bash
  git add .
  git commit -m "update backend"
  git push origin main
  ```
- **Manual**: Go to **Actions** tab on GitHub → Click **Deploy to AWS Lambda** → Click **Run workflow**.

---

## 🖥 Step 5: Alternative - Manual AWS Console Deployment

If you ever prefer deploying manually through the AWS Web UI without CLI:

1. **Package your code locally**:

   ```bash
   cd server
   rm -rf node_modules
   npm ci --omit=dev
   zip -q -r function.zip lambda.js src package.json node_modules
   ```

2. **Create the Function in AWS**:
   - Open [AWS Lambda Console](https://console.aws.amazon.com/lambda/).
   - Click **Create function** → Select **Author from scratch**.
   - Function name: `youtube-study-filter`.
   - Runtime: `Node.js 20.x`.
   - Click **Create function**.

3. **Upload Code**:
   - In the **Code source** section, click **Upload from** → **.zip file**.
   - Choose `server/function.zip` and click **Save**.
   - Scroll down to **Runtime settings** → click **Edit**:
     - Change **Handler** from `index.handler` to `lambda.handler`.
     - Click **Save**.

4. **Add Environment Variables**:
   - Click **Configuration** tab → **Environment variables** → **Edit**.
   - Add:
     - `GEMINI_API_KEY`: your Gemini API key.
     - `GEMINI_MODEL`: `gemini-3.5-flash-lite`.
     - `NODE_ENV`: `production`.
     - `ALLOWED_ORIGINS`: `*`.
   - Click **Save**.

5. **Enable Public Function URL**:
   - Click **Configuration** tab → **Function URL** → **Create function URL**.
   - Auth type: Select **NONE**.
   - Check **Configure cross-origin resource sharing (CORS)**:
     - Allow origin: `*`
     - Allow methods: `GET, POST, OPTIONS`
     - Allow headers: `*`
   - Click **Save**.
   - Copy the generated **Function URL**.

---

## 🔌 Step 6: Connect to Chrome Extension

1. Copy your Lambda Function URL:
   ```text
   https://abcdefgh123456789.lambda-url.us-east-1.on.aws/
   ```
2. In Google Chrome, click the **YouTube Study Filter** extension icon.
3. Paste your Function URL into the **Backend API URL** field.
4. Click **Save Settings**.
5. Navigate to [YouTube](https://www.youtube.com). Non-educational cards will be filtered and blurred automatically!

---

## 🧪 Testing & Verification

### 1. Test Health Check

In your terminal, test your live Function URL:

```bash
curl -s https://<your-function-id>.lambda-url.us-east-1.on.aws/api/health
```

**Expected Response**:

```json
{
  "status": "ok",
  "platform": "aws-lambda",
  "geminiConfigured": true,
  "model": "gemini-3.5-flash-lite",
  "timestamp": "2026-09-12T16:30:00.000Z"
}
```

### 2. Test Single Classification

```bash
curl -s -X POST https://<your-function-id>.lambda-url.us-east-1.on.aws/api/classify \
  -H "Content-Type: application/json" \
  -d '{"videoId": "abc12345", "title": "Calculus 1 Full College Course - Derivatives and Integrals"}'
```

**Expected Response**:

```json
{
  "videoId": "abc12345",
  "isEducational": true
}
```

---

## ❓ Troubleshooting & FAQs

### Q1: I get a CORS error in the browser console

- In AWS Lambda Console, go to **Configuration** → **Function URL** → **Edit**.
- Under **CORS**, ensure:
  - `Allow origin`: `*`
  - `Allow methods`: `*` (or `GET, POST, OPTIONS`)
  - `Allow headers`: `*` (or `Content-Type, Authorization`)

### Q2: How does logging work on AWS Lambda?

- AWS Lambda has a read-only filesystem, but allows writing to `/tmp`.
- [`server/src/utils/fileLogger.js`](file:///Users/bhavesh/Work/yt-chrome/server/src/utils/fileLogger.js) automatically detects the Lambda environment and logs classifications to `/tmp/classifications.txt`.
- Real-time console logs are automatically sent to **AWS CloudWatch Logs** (under _Monitor → View CloudWatch logs_ in the Lambda Console).

### Q3: Lambda times out on large batches

- Default AWS Lambda timeout is 3 seconds.
- Our script sets the timeout to **15 seconds** and memory to **256 MB**.
- If configuring manually in the AWS Console, go to **Configuration** → **General configuration** → **Edit** and set **Timeout** to `15 sec`.
