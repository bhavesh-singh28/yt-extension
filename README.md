# YouTube Study Filter 🎓

A distraction-free YouTube study environment powered by Google Gemini AI (**Manifest V3**). It intelligently analyzes video titles in real time and automatically blurs non-educational videos, keeping you focused on learning and studying.

🌐 **Live Website & Setup Guide**: [https://bhavesh-singh28.github.io/yt-extension/](https://bhavesh-singh28.github.io/yt-extension/)  
🔒 **Privacy Policy**: [https://bhavesh-singh28.github.io/yt-extension/#privacy](https://bhavesh-singh28.github.io/yt-extension/#privacy)

---

## 🌟 Key Features

* **100% Serverless**: No servers, Docker containers, or cloud proxies required.
* **Dual AI Engine**:
  * 🧠 **Chrome Built-in AI (Gemini Nano)**: Runs entirely on-device via Chrome's native Prompt API (`ai.languageModel`). Completely free, zero network latency, 100% private.
  * ⚡ **Direct Gemini API (BYOK)**: Connects directly from Chrome to Google's Gemini API (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`) using your personal free Google AI Studio key.
* **Title-Only Evaluation**: Analyzes public video titles with zero thumbnail image scraping, saving bandwidth and ensuring maximum privacy.
* **Non-Destructive Blurring**: Blurs non-educational cards smoothly while preserving YouTube's grid layout.
* **Instant Session Reveal**: Click **"Show"** on any blurred card to reveal it for your current session without affecting other videos.
* **Local Regex Pre-Filter**: Common educational lectures (*Calculus*, *Python Tutorial*, *CS50*) and obvious entertainment (*Vlogs*, *Pranks*) are recognized instantly with zero API calls.
* **Persistent Two-Tier Caching**: Uses synchronous in-memory session cache and `chrome.storage.local` so titles are never classified twice.
* **Three Strictness Modes**:
  * **Relaxed**: Only blurs obvious entertainment and time-wasters.
  * **Balanced** *(default)*: Standard AI classification.
  * **Strict**: Blurs borderline and uncertain videos as well.

---

## 🏗️ Architecture

```
YouTube Page (SPA)
       │
       ▼
MutationObserver (DOM scans)
       │
       ▼
Extract Title & Video ID
       │
       ├─► [1] Local In-Memory & Storage Cache (Hit -> Apply Filter)
       ├─► [2] Local Regex Pre-Filter (Hit -> Cache & Apply Filter)
       └─► [3] AI Engine Classification:
                 ├─► Chrome Built-in AI (Gemini Nano On-Device)
                 └─► Direct Gemini API (Google AI Studio Key via SW)
```

---

## 🚀 Getting Started

### 1. Load Unpacked in Chrome (Development)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/bhavesh-singh28/yt-extension.git
   cd yt-chrome
   ```
2. Open Google Chrome and go to `chrome://extensions`.
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the `extension/` folder in this repository.
5. Click the extension icon in your browser toolbar to select your engine:
   * **Gemini Nano**: Uses on-device AI. Enable via `chrome://flags/#prompt-api-for-gemini-nano`.
   * **Direct Gemini API**: Paste your free API key from [Google AI Studio](https://aistudio.google.com/app/apikey) and click **Test Key**.

---


## 📂 Project Structure

```
yt-chrome/
├── extension/                     # The complete Chrome Extension (Manifest V3)
│   ├── background/
│   │   └── service-worker.js      # Direct Gemini API fetcher & key validator
│   ├── content/
│   │   ├── cache.js               # In-memory & chrome.storage caching
│   │   ├── classifier.js          # Gemini Nano & Direct Gemini API router
│   │   ├── config.js              # Selectors & default settings
│   │   ├── content.js             # DOM orchestrator & hydration scans
│   │   ├── dom.js                 # Blur overlays & reveal button controls
│   │   └── youtube.js             # YouTube SPA DOM title extractor
│   ├── icons/                     # Extension icons (16px, 48px, 128px)
│   ├── popup/
│   │   ├── popup.html             # Extension settings popup UI
│   │   ├── popup.css              # Dark theme styling
│   │   └── popup.js               # Settings & engine switcher logic
│   ├── styles/
│   │   └── filter.css             # Blur and glassmorphism overlay styles
│   └── manifest.json              # Extension manifest (MV3)
├── .gitignore                     # Git exclusions (credentials, zip, OS files)
├── CHROMEWEBSTORE.md              # Chrome Web Store submission & listing guide
└── README.md                      # Project documentation
```

---

## 🛡️ Privacy & Security

* **No tracking**: The extension does not collect or track user data.
* **No credentials stored in repo**: Uses user-provided keys or on-device models.
* **Open source**: All code is transparent and runs directly in your browser.

---

## 📄 License

MIT License.
