# Chrome Web Store Publishing Guide: YouTube Study Filter

This document contains everything needed to publish **YouTube Study Filter** to the Chrome Web Store, including copy-paste listing metadata, permission justifications, privacy disclosures, and packaging instructions.

---

## 📦 1. How to Package the Extension for Submission

> [!IMPORTANT]
> The Chrome Web Store requires a ZIP file containing the **contents** of the `extension/` directory, **not** the root repository. `manifest.json` must be at the root of the ZIP file.

Run this terminal command from the project root:

```bash
cd extension && zip -r ../yt-study-filter-v1.0.0.zip . -x "*.DS_Store"
```

This creates `yt-study-filter-v1.0.0.zip` ready for upload.

---

## 🚀 2. Chrome Developer Dashboard Steps

1. **Sign in / Register**:
   - Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
   - Sign in with your Google Account.
   - Pay the one-time $5 developer registration fee if you haven't already.

2. **Upload Package**:
   - Click **"Add new item"** (top right).
   - Drag and drop `yt-study-filter-v1.0.0.zip`.

3. **Fill Out Store Listing Tab** (Copy-paste details from Section 3 below).

4. **Fill Out Privacy Tab** (Copy-paste answers from Section 4 below).

5. **Submit for Review**:
   - Click **"Submit for review"**. Standard approval typically takes 24 to 72 hours.

---

## 📝 3. Store Listing Tab Details

### Basic Information
* **Package Name**: YouTube Study Filter
* **Summary (132 chars max)**:
  `Distraction-free YouTube study mode. Automatically detects and blurs non-educational videos using Gemini AI.`
* **Category**: `Productivity` or `Education`

### Detailed Description (Markdown formatting supported)
```markdown
Transform YouTube into an effective study and learning environment.

YouTube Study Filter uses Gemini AI to analyze video titles in real-time, cleanly separating educational tutorials, courses, and academic content from entertainment, gaming, vlogs, and clickbait.

✨ KEY FEATURES:
• Dual AI Engine:
  - 🧠 Chrome Built-in AI (Gemini Nano): 100% on-device local classification. Free, zero network latency, and completely private.
  - ⚡ Direct Gemini API: Direct client-to-Google calls using your own free Google AI Studio API key. Zero intermediate servers.
• Title-Only Analysis: Fast and lightweight text classification. Thumbnails, comments, and video files are never downloaded or analyzed.
• Distraction-Free Blurring: Non-educational video cards are neatly blurred while maintaining YouTube's original grid layout.
• One-Click Reveal: Need a study break? Click the "Show" button on any blurred card to reveal it for your current session without affecting other videos.
• Three Strictness Modes:
  - Relaxed: Only filters obvious entertainment and time-wasters.
  - Balanced: Standard AI classification for everyday studying.
  - Strict: Filters borderline and uncertain videos as well.
• Fast Local Cache: Videos you've already seen are classified instantly from local browser storage.
• 100% Privacy Focused: No analytics, no account required, and no user tracking.

HOW TO USE:
1. Click the extension icon in your browser toolbar.
2. Select your preferred engine (Gemini Nano or Direct Gemini API).
3. Browse YouTube — distracting videos are blurred automatically, keeping your focus on learning!
```

### Graphic Assets
* **Store Icon**: Upload `extension/icons/icon-128.png` (128×128 PNG).
* **Screenshots**: At least 1 screenshot is required:
  * Supported resolutions: `1280×800` or `640×400` PNG/JPEG.
  * Take a screenshot showing YouTube with the blur overlay and the extension popup open.

---

## 🔒 4. Privacy Tab Form (Crucial for Fast Approval)

### Single Purpose Description
> "A distraction-free YouTube study filter that analyzes public video titles to automatically blur non-educational content."

### Permissions Justification (Copy-paste directly)

* **`storage`**:
  > "Required to save user configuration settings (strictness mode, blur toggle, selected AI engine) and store local video classification caches and productivity statistics across browsing sessions."

* **Host Permission: `*://*.youtube.com/*`**:
  > "Required to read public video titles on YouTube pages and inject CSS styling to blur non-educational video cards."

* **Host Permission: `https://generativelanguage.googleapis.com/*`**:
  > "Required to send video title text directly to Google Gemini API when the user enables Direct Gemini API mode."

### Data Usage Disclosures
Check the following checkboxes in the Developer Dashboard:
* ✅ **No user tracking**: The extension does not collect or transmit personal identifiers, browsing history across websites, or user location.
* ✅ **Certify Single Purpose**: The developer certifies that data is only processed for the stated single purpose.
* ✅ **Do not sell user data**: The extension does not sell or transfer user data to third parties.

---

## 📄 5. Privacy Policy & Website (Hosted on GitHub Pages)

Your GitHub Pages website is created in the `docs/` folder.

### How to Enable GitHub Pages (30 seconds):
1. Go to your GitHub repository: `https://github.com/bhavesh-singh28/yt-extension`
2. Click **Settings** (tab at top) → **Pages** (on the left sidebar).
3. Under **Build and deployment**:
   * **Source**: `Deploy from a branch`
   * **Branch**: `main`
   * **Folder**: `/docs` (select `/docs` instead of `/root`)
4. Click **Save**.

Within 1-2 minutes, your website is live!

### Links to enter in Chrome Developer Dashboard:
* **Official Homepage / Support URL**:  
  `https://bhavesh-singh28.github.io/yt-extension/`
* **Privacy Policy URL**:  
  `https://bhavesh-singh28.github.io/yt-extension/#privacy`

---

## 🔑 6. How to Get a Free Gemini API Key (User Guide)

Share this link with users who want to use the Direct Gemini API:
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Sign in with any Google account.
3. Click **"Create API key"** and choose a project.
4. Copy the key (`AIzaSy...`) and paste it into the extension popup under **Direct Gemini API**.
5. Click **Test Key** to confirm connectivity.

