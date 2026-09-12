# Chrome Web Store Listing: YouTube Study Filter

## Metadata

* **Name**: YouTube Study Filter
* **Short Name**: Study Filter
* **Version**: 1.0.0
* **Category**: Productivity / Education
* **Short Description**: Automatically detects and blurs distracting non-educational YouTube videos using Gemini AI for study sessions.

---

## Detailed Description

Transform YouTube into an effective study and learning environment.

YouTube Study Filter analyzes video titles in real-time using Google Gemini AI to separate educational content from entertainment, gaming, and distractions.

### Key Capabilities:
- **Intelligent Title Analysis**: Leverages Google Gemini AI to classify educational lectures, programming tutorials, STEM subjects, and academic courses versus entertainment or clickbait.
- **Distraction-Free Blurring**: Non-educational video cards are neatly blurred with their layout preserved.
- **Instant Reveal Button**: Need to watch a non-study video? Click "Show" on any blurred card to reveal it for your current session without affecting other videos.
- **Fast Local Pre-Filter**: Common educational lectures and tutorials are recognized instantly with zero network delay.
- **Three Strictness Modes**:
  - Relaxed: Only blurs obvious entertainment and time-wasters.
  - Balanced: Standard AI classification.
  - Strict: Blurs borderline and uncertain videos as well.
- **Privacy First**: Only video titles are analyzed. Video thumbnails, images, personal data, and watch history are NEVER collected or transmitted.

---

## Permissions Justification

### `storage`
* **Justification**: Required to save the user's selected strictness setting, toggle preferences (enable/disable blur), local classification cache, and productivity statistics (e.g., number of videos analyzed and filtered) across browsing sessions.

### `host_permissions`
* `*://*.youtube.com/*`: Required to detect video titles on YouTube web pages and apply the blur/reveal overlay styling.
* `http://localhost:3000/*` and `http://127.0.0.1:3000/*`: Required to communicate with the local Gemini AI backend server for title classification.

---

## Privacy Policy Summary

YouTube Study Filter does NOT collect, sell, or monetize user data.
* **No Account Required**: The extension functions anonymously without registration.
* **No Tracking**: No browsing activity outside YouTube is monitored.
* **No Media Transmission**: Thumbnails, videos, comments, and cookies are never uploaded. Only the public text title and video ID are processed.
