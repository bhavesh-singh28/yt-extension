/**
 * YouTube Study Filter - Background Service Worker
 * Proxies API requests from YouTube content scripts to the local backend server.
 * This bypasses browser Mixed Content restrictions (HTTPS -> HTTP) and YouTube CSP.
 */

console.log('[YT Study Filter:SW] 🚀 Background Service Worker initialized');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return false;

  const { action, backendUrl = 'http://localhost:3000' } = message;
  const baseUrl = backendUrl.replace(/\/+$/, '');

  if (action === 'CLASSIFY_BATCH') {
    (async () => {
      try {
        const url = `${baseUrl}/api/classify-batch`;
        console.log(`[YT Study Filter:SW] 📤 Proxying batch request for ${message.videos?.length || 0} videos to ${url}...`);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ videos: message.videos || [] }),
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          console.warn(`[YT Study Filter:SW] ⚠️ Backend returned HTTP ${response.status}: ${errText.slice(0, 200)}`);
          sendResponse({
            success: false,
            error: `HTTP ${response.status}: ${errText}`
          });
          return;
        }

        const data = await response.json();
        console.log(`[YT Study Filter:SW] ✅ Received ${data.results?.length || 0} classifications from backend`);
        sendResponse({
          success: true,
          results: data.results || []
        });
      } catch (err) {
        console.error('[YT Study Filter:SW] ❌ Fetch to backend failed:', err.message);
        sendResponse({
          success: false,
          error: err.message
        });
      }
    })();
    return true; // Keep message port open for async response
  }

  if (action === 'CLASSIFY_SINGLE') {
    (async () => {
      try {
        const url = `${baseUrl}/api/classify`;
        console.log(`[YT Study Filter:SW] 📤 Proxying single classify request for [${message.videoId}] to ${url}...`);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            videoId: message.videoId,
            title: message.title
          }),
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          sendResponse({ success: false, error: `HTTP ${response.status}: ${errText}` });
          return;
        }

        const data = await response.json();
        sendResponse({ success: true, data });
      } catch (err) {
        console.error('[YT Study Filter:SW] ❌ Single classify fetch failed:', err.message);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (action === 'CHECK_HEALTH') {
    (async () => {
      try {
        const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
        const data = await res.json();
        sendResponse({ success: true, data });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  return false;
});
