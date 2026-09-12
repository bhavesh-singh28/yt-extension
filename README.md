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

## ☁️ Deployment Guide (Render & AWS Lambda)

You can easily deploy this backend to the cloud so you don't need to run it locally on your machine.

### Option A: Deploy to Render (Recommended - Free & Easiest)

Render provides free Node.js hosting with automatic HTTPS.

1. Push this repository to GitHub or GitLab.
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New → Web Service**.
3. Connect your repository.
4. Set the following options:
   * **Root Directory**: `server`
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
5. Under **Environment Variables**, add:
   * `GEMINI_API_KEY`: Your Gemini API Key from Google AI Studio.
   * `GEMINI_MODEL`: `gemini-3.5-flash-lite`
   * `NODE_ENV`: `production`
   * `ALLOWED_ORIGINS`: `*`
6. Click **Create Web Service**.
7. Once deployed, Render will provide a public URL like:
   ```text
   https://youtube-study-filter.onrender.com
   ```
8. **Connect Extension**: Click the extension icon in Chrome, paste your Render URL into the **Backend API URL** field, and click **Save**!

---

### Option B: Deploy to AWS Lambda (Serverless)

We included a zero-dependency native AWS Lambda handler (`server/lambda.js`) that works with **AWS Lambda Function URLs** or **Amazon API Gateway**.

1. **Package the server**:
   ```bash
   cd server
   npm ci --omit=dev
   zip -r function.zip lambda.js src package.json
   ```
2. **Create Lambda Function in AWS Console**:
   * **Function Name**: `youtube-study-filter`
   * **Runtime**: `Node.js 20.x`
   * **Handler**: `lambda.handler`
3. **Upload Zip**: Upload `function.zip` under **Code source**.
4. **Environment Variables** (under *Configuration → Environment variables*):
   * `GEMINI_API_KEY`: Your Gemini API Key.
   * `GEMINI_MODEL`: `gemini-3.5-flash-lite`
5. **Enable Function URL** (easiest):
   * Go to *Configuration → Function URL* → Click **Create function URL**.
   * Auth type: `NONE`.
   * Configure CORS: Allow Origin `*`, Methods `GET, POST, OPTIONS`, Headers `*`.
6. Copy the generated Function URL (e.g. `https://xyz.lambda-url.us-east-1.on.aws`).
7. Paste this URL into the extension popup under **Backend API URL** and click **Save**!
