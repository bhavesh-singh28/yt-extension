# YouTube Study Filter 🎓

A production-quality Chrome Extension (**Manifest V3**) and Express backend that provides a distraction-free YouTube study environment. It uses the **Google Gemini API** to analyze YouTube video titles in real-time and automatically blurs non-educational videos while allowing students and self-learners to reveal content when desired.

---

## 🌟 Key Features

* **AI-Powered Title Analysis**: Classifies video titles using Google Gemini 2.5 Flash without ever downloading or transmitting video thumbnails/images (saving bandwidth and preserving privacy).
* **Non-Destructive Blurring**: Blurs non-educational cards smoothly while preserving YouTube's grid layout and player flow.
* **Instant Session Reveal**: A clean glassmorphism overlay with a **"Show"** button allows you to unblur any video for your current browsing session without modifying its persistent classification.
* **Two-Tier High-Speed Caching**: Combines fast synchronous in-memory session cache with persistent `chrome.storage.local` (7-day TTL). Videos are never classified twice.
* **Request Deduplication & Batching**: Groups dynamic video detections into a single debounced batch API request (`/api/classify-batch`) to minimize Gemini API calls and prevent rate limits.
* **Strictness Controls**:
  * **Relaxed**: Only blurs obvious high-confidence entertainment/clickbait.
  * **Balanced** *(default)*: Normal Gemini AI classification.
  * **Strict**: Blurs borderline and ambiguous content as well.
* **Local Heuristic Pre-Filter**: Instant local regex matching for unambiguous educational titles (e.g. *React Tutorial*, *Calculus Lecture*) and obvious entertainment (e.g. *Vlog*, *Pranks*), completely eliminating server latency for common titles.
* **Fail-Open Resilience**: If the backend is unreachable or Gemini times out, YouTube remains completely usable and unblurred.

---

## 🏗️ Architecture

```
                       YouTube Page (SPA)
                               │
                               ▼
                   MutationObserver & SPA Events
                     (yt-navigate-finish, etc.)
                               │
                               ▼
                    extractVideoData(element)
                     (Extract videoId + title)
                               │
                               ▼
                     Check In-Memory Cache
                     (sessionCache / storage)
                     ┌─────────┴─────────┐
                  Found               Not Found
                     │                   │
                     │          Local Heuristic Match?
                     │          ┌────────┴────────┐
                     │        Match           No Match
                     │          │                 │
                     │          ▼                 ▼
                     │     Store Cache    Deduplication Queue
                     │          │                 │
                     │          │           Batch Buffer
                     │          │        (150-200ms debounce)
                     │          │                 │
                     │          │                 ▼
                     │          │         Node.js / Express
                     │          │      POST /api/classify-batch
                     │          │                 │
                     │          │                 ▼
                     │          │             Gemini API
                     │          │       (Strict JSON Schema)
                     │          │                 │
                     │          │                 ▼
                     │          └──────────► Update Cache
                     │                            │
                     └────────────────────────────┤
                                                  ▼
                                       Apply Filter to DOM
                                  ┌───────────────┴───────────────┐
                            EDUCATIONAL                    NON_EDUCATIONAL
                                  │                               │
                                  ▼                               ▼
                             Keep Normal                   Add Blur Class
                                                        + Inject Reveal Overlay
```

---

## 💻 Tech Stack

### Chrome Extension (Manifest V3)
* **Runtime**: Manifest V3, ES6+ JavaScript.
* **DOM Handling**: `MutationObserver`, Custom YouTube SPA lifecycle hooks (`yt-navigate-finish`, `yt-page-data-updated`).
* **Storage**: `chrome.storage.local` with automatic TTL pruning.
* **Styling**: Vanilla CSS, backdrop filters, CSS transitions (no heavy CSS frameworks).

### Backend Service
* **Runtime**: Node.js (v18+ or v20+), Express.js (ES modules).
* **AI Model**: Google Gemini API (`gemini-2.5-flash` or `gemini-1.5-flash`).
* **Environment & Security**: `dotenv`, `cors`, input sanitization, safe JSON payload limits, timeouts via `AbortSignal`.

---

## 📁 Project Structure

```text
yt-chrome/
├── extension/
│   ├── manifest.json              # Manifest V3 extension configuration
│   ├── icons/
│   │   ├── icon-16.png            # 16x16 icon
│   │   ├── icon-48.png            # 48x48 icon
│   │   ├── icon-128.png           # 128x128 icon
│   │   └── generate-icons.js      # Self-contained icon generator
│   ├── content/
│   │   ├── config.js              # Selectors, default settings, constants
│   │   ├── cache.js               # In-memory & chrome.storage.local cache
│   │   ├── youtube.js             # Card extraction & SPA navigation listeners
│   │   ├── classifier.js          # Local heuristics & backend API client
│   │   ├── dom.js                 # Blurring, reveal overlay, Show button
│   │   └── content.js             # Observer orchestration, queue & batching
│   ├── popup/
│   │   ├── popup.html             # Clean extension popup interface
│   │   ├── popup.css              # Minimal dark styling
│   │   └── popup.js               # Settings sync, stats, health indicator
│   └── styles/
│       └── filter.css             # Blur effect, overlay styles
│
├── server/
│   ├── package.json               # Backend dependencies & test scripts
│   ├── .env.example               # Template for environment variables
│   ├── src/
│   │   ├── server.js              # Express app setup, CORS, error handling
│   │   ├── routes/
│   │   │   └── classify.js        # /api/classify and /api/classify-batch routes
│   │   ├── services/
│   │   │   └── gemini.js          # Gemini API prompt & batch classification
│   │   └── utils/
│   │       └── validation.js      # Input validation & schema normalization
│   └── test/
│       └── test-api.js            # Automated verification test suite
│
├── README.md                      # Comprehensive documentation
├── CHROMEWEBSTORE.md              # Store listing metadata & justifications
└── .gitignore
```

---

## 🚀 Getting Started

### 1. Backend Setup

1. **Navigate to the server directory**:
   ```bash
   cd server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and add your **Gemini API Key**:
   ```env
   PORT=3000
   GEMINI_API_KEY=your_actual_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash
   ALLOWED_ORIGINS=*
   ```
   > 💡 *Note: If `GEMINI_API_KEY` is not provided during development, the backend automatically runs in a local mock classification mode so you can test end-to-end immediately!*

4. **Start the server**:
   ```bash
   npm start
   ```
   Or for auto-reload during development:
   ```bash
   npm run dev
   ```

5. **Run automated API verification tests**:
   In another terminal, run:
   ```bash
   npm test
   ```

---

### 2. Chrome Extension Setup

1. Open Google Chrome and navigate to:
   ```text
   chrome://extensions
   ```
2. Enable **"Developer mode"** via the toggle in the top-right corner.
3. Click the **"Load unpacked"** button.
4. Select the `extension/` folder inside this repository:
   ```text
   /Users/bhavesh/Work/yt-chrome/extension
   ```
5. The extension icon will now appear in your Chrome toolbar. Pin it for easy access.

---

## 🔍 How Classification Works

### Gemini System Prompt
The model is instructed with strict guidelines:
* **EDUCATIONAL**: Content whose primary purpose is teaching, explaining, practicing, or providing useful academic, technical, or practical knowledge/skills (e.g. computer science, coding, mathematics, science, engineering, language learning, exam preparation).
* **NON_EDUCATIONAL**: Content focused on entertainment, gaming, vlogs, comedy, memes, reactions, sports highlights, celebrity gossip, music videos, drama, or clickbait.
* Titles are not classified as educational simply because they contain generic words like *"tips"* or *"learn"*.

### Batching & JSON Mode
The backend requests structured JSON outputs (`application/json`) from Gemini with `temperature: 0.1`. The `/api/classify-batch` route bundles multiple titles detected in a scroll viewport into one prompt, which reduces API latency by over 80%.

---

## 🗄️ Caching & Deduplication

1. **Synchronous In-Memory Cache**: `sessionCache` (`Map<videoId, result>`) stores classifications for instantaneous lookup when navigating back and forth across YouTube SPA views.
2. **Persistent Chrome Storage**: Classifications are persisted in `chrome.storage.local` with timestamps. Any cache entry older than 7 days is automatically evicted.
3. **Pending Request Map**: If multiple DOM elements reference the same `videoId` (e.g., in a shelf and a feed simultaneously), the extension creates only one network request and links all elements to the pending result.

---

## ⚠️ Known Limitations & YouTube DOM Selectors

* **YouTube SPA DOM Evolutions**: YouTube frequently experiments with internal custom element names. To accommodate this, all selectors are isolated in `extension/content/config.js` (`SELECTORS.CARD_CONTAINERS`, `SELECTORS.TITLE_ELEMENTS`).
* **Live Streams & Premieres**: Video titles for upcoming premieres or ongoing live chats may be classified based on the title, but chat text is not analyzed.
* **YouTube Shorts**: When watching full-screen vertical Shorts (`/shorts/...`), the extension blurs cards in the reel shelf. In full-screen reel view, YouTube dynamically unmounts offscreen cards.

---

## 🔒 Security & Privacy Considerations

* **No Hardcoded Keys**: The Gemini API key is stored strictly on your backend server (`.env`) and is never embedded in the extension manifest or client scripts.
* **Privacy by Design**: Only video IDs and video titles are processed. User watch history, account details, comments, and cookies are never accessed or sent to the backend.
---

## ☁️ Deployment Guide (AWS Lambda Serverless & CI/CD)

> 📖 **Full Guide Available**: For the complete guide on getting AWS keys from scratch, IAM setup, and troubleshooting, see [**DEPLOYMENT.md**](file:///Users/bhavesh/Work/yt-chrome/DEPLOYMENT.md).

The backend is built to run serverless on **AWS Lambda** using Function URLs, giving you sub-second cold starts, zero idle cost, and effortless scaling.

We provide two deployment paths:
1. **Automated 1-Click Shell Script** (`server/deploy-aws.sh`)
2. **Automated CI/CD Pipeline with GitHub Actions** (`.github/workflows/deploy-lambda.yml`)

---

### Method 1: Automated 1-Click Deployment Script (`deploy-aws.sh`)

This script automatically provisions the IAM role, creates/updates the Lambda function with Node.js 20.x, configures the public Function URL with CORS, and injects your environment variables.

1. **Prerequisites**:
   * [AWS CLI installed](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) and configured:
     ```bash
     aws configure
     ```

2. **Run the deployment script**:
   ```bash
   cd server
   chmod +x deploy-aws.sh
   ./deploy-aws.sh
   ```

3. **Output**:
   The script outputs your live HTTPS Function URL:
   ```text
   🔗 Function URL:
      https://abcdef123456789.lambda-url.us-east-1.on.aws/
   ```

4. **Connect to Extension**:
   * Open Chrome and click the **YouTube Study Filter** extension icon.
   * Paste your Function URL into the **Backend API URL** field.
   * Click **Save Settings**.

---

### Method 2: Automated CI/CD Pipeline (GitHub Actions)

Continuous Deployment is set up via `.github/workflows/deploy-lambda.yml`. Every time you push changes to the `server/` directory on the `main` branch, GitHub Actions builds and updates the Lambda function automatically.

#### 1. Setup GitHub Secrets
In your GitHub repository, go to **Settings → Secrets and variables → Actions → New repository secret**, and add:

| Secret Name | Description | Example / Default |
|-------------|-------------|-------------------|
| `AWS_ACCESS_KEY_ID` | AWS IAM User Access Key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM User Secret Key | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | Target AWS Region | `us-east-1` |
| `AWS_LAMBDA_FUNCTION_NAME` | Name of your Lambda function | `youtube-study-filter` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSy...` |
| `GEMINI_MODEL` | *(Optional)* Model identifier | `gemini-3.5-flash-lite` |

#### 2. IAM Permissions Required for GitHub Actions
The AWS IAM user or role used for CI/CD needs these permissions:
* `lambda:UpdateFunctionCode`
* `lambda:UpdateFunctionConfiguration`
* `lambda:GetFunction`
* `lambda:GetFunctionConfiguration`

#### 3. Triggering Deployments
* **Automated**: Push to `main` branch with changes under `server/**`.
* **Manual**: Go to **Actions** tab on GitHub → select **"Deploy to AWS Lambda"** → click **"Run workflow"**.

---

### Method 3: Manual AWS Console Deployment

If you prefer using the AWS Management Console directly:

1. **Package the server**:
   ```bash
   cd server
   rm -rf node_modules
   npm ci --omit=dev
   zip -q -r function.zip lambda.js src package.json node_modules
   ```
2. **Create Lambda Function in AWS Console**:
   * Open the **AWS Lambda Console** → click **Create function**.
   * Function name: `youtube-study-filter`
   * Runtime: `Node.js 20.x`
   * Architecture: `x86_64` (or `arm64`)
3. **Upload Code**:
   * Under the **Code** tab, click **Upload from → .zip file** and select `server/function.zip`.
   * Under **Runtime settings**, ensure the Handler is set to `lambda.handler`.
4. **Configure Environment Variables**:
   * Go to **Configuration → Environment variables → Edit**.
   * Add:
     * `GEMINI_API_KEY`: Your Gemini API Key from Google AI Studio.
     * `GEMINI_MODEL`: `gemini-3.5-flash-lite`
     * `NODE_ENV`: `production`
     * `ALLOWED_ORIGINS`: `*`
5. **Configure Function URL & CORS**:
   * Go to **Configuration → Function URL → Create function URL**.
   * Auth type: `NONE`.
   * Check **Configure cross-origin resource sharing (CORS)**:
     * Allow origin: `*`
     * Allow headers: `*`
     * Allow methods: `*`
   * Click **Save**.
6. **Copy URL**: Copy your Function URL and paste it into the Chrome Extension popup under **Backend API URL**.
