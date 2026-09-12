/**
 * YouTube Study Filter - Popup Script
 */

const STORAGE_KEYS = {
  SETTINGS: 'yt_study_filter_settings',
  CACHE: 'yt_study_filter_cache',
  STATS: 'yt_study_filter_stats'
};

const DEFAULT_SETTINGS = {
  enabled: true,
  strictness: 'balanced',
  blurEnabled: true,
  revealEnabled: true,
  backendUrl: 'https://y4hyu4hzjip5u4srfd44ajqtha0apzcc.lambda-url.ap-south-1.on.aws'
};

// UI Elements
const toggleEnabled = document.getElementById('toggle-enabled');
const toggleBlur = document.getElementById('toggle-blur');
const toggleReveal = document.getElementById('toggle-reveal');
const strictnessRadios = document.querySelectorAll('input[name="strictness"]');
const btnClearCache = document.getElementById('btn-clear-cache');
const actionFeedback = document.getElementById('action-feedback');

const statAnalyzed = document.getElementById('stat-analyzed');
const statEducational = document.getElementById('stat-educational');
const statFiltered = document.getElementById('stat-filtered');
const statRevealed = document.getElementById('stat-revealed');

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

const inputBackendUrl = document.getElementById('input-backend-url');
const btnSaveUrl = document.getElementById('btn-save-url');

let currentSettings = { ...DEFAULT_SETTINGS };

/**
 * Load settings and statistics from chrome.storage.local
 */
async function loadState() {
  try {
    const data = await chrome.storage.local.get([
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.STATS
    ]);

    if (data[STORAGE_KEYS.SETTINGS]) {
      currentSettings = { ...DEFAULT_SETTINGS, ...data[STORAGE_KEYS.SETTINGS] };
    }

    // If still pointing to localhost:3000, migrate to active Lambda Function URL
    if (!currentSettings.backendUrl || currentSettings.backendUrl === 'http://localhost:3000') {
      currentSettings.backendUrl = DEFAULT_SETTINGS.backendUrl;
      saveSettings();
    }

    // Populate toggles
    toggleEnabled.checked = currentSettings.enabled;
    toggleBlur.checked = currentSettings.blurEnabled;
    toggleReveal.checked = currentSettings.revealEnabled;

    // Populate strictness radio
    for (const radio of strictnessRadios) {
      radio.checked = (radio.value === currentSettings.strictness);
    }

    if (inputBackendUrl) {
      inputBackendUrl.value = currentSettings.backendUrl;
    }

    // Populate statistics
    const stats = data[STORAGE_KEYS.STATS] || {
      videosAnalyzed: 0,
      educationalVideos: 0,
      nonEducationalVideos: 0,
      manuallyRevealedVideos: 0
    };

    statAnalyzed.textContent = (stats.videosAnalyzed || 0).toLocaleString();
    statEducational.textContent = (stats.educationalVideos || 0).toLocaleString();
    statFiltered.textContent = (stats.nonEducationalVideos || 0).toLocaleString();
    statRevealed.textContent = (stats.manuallyRevealedVideos || 0).toLocaleString();

    // Check backend health
    checkBackendHealth(currentSettings.backendUrl);
  } catch (err) {
    console.error('Error loading popup state:', err);
  }
}

/**
 * Save updated settings to chrome.storage.local
 */
async function saveSettings() {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: currentSettings
    });
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

/**
 * Check backend connection status and Gemini configuration
 */
async function checkBackendHealth(url) {
  if (!url) return;
  const cleanUrl = url.replace(/\/+$/, '');

  statusDot.className = 'status-dot';
  statusText.textContent = 'Checking connection...';

  // Strategy 1: Check via Background Service Worker (bypasses CSP & origin restrictions)
  try {
    const swResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'CHECK_HEALTH', backendUrl: cleanUrl },
        (res) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { success: false, error: 'No response from worker' });
          }
        }
      );
    });

    if (swResponse && swResponse.success && swResponse.data) {
      const info = swResponse.data;
      statusDot.className = 'status-dot online';
      if (info.geminiConfigured) {
        statusText.textContent = `Online • Gemini Active (${info.model || 'Gemini'})`;
      } else {
        statusText.textContent = `Online • Dev Mock Mode`;
      }
      return;
    }
  } catch (swErr) {
    console.warn('[Popup] Service worker health check failed, falling back to direct fetch:', swErr);
  }

  // Strategy 2: Direct Fetch from Popup Page
  try {
    const res = await fetch(`${cleanUrl}/api/health`, {
      signal: AbortSignal.timeout(8000)
    });

    if (res.ok) {
      const info = await res.json();
      statusDot.className = 'status-dot online';
      if (info.geminiConfigured) {
        statusText.textContent = `Online • Gemini Active (${info.model || 'Gemini'})`;
      } else {
        statusText.textContent = `Online • Dev Mock Mode`;
      }
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    console.error('[Popup] Health check failed for:', cleanUrl, err);
    statusDot.className = 'status-dot offline';
    statusText.textContent = `Backend offline (${err.message || 'Connection failed'})`;
  }
}

/**
 * Display temporary feedback message to the user
 */
function showFeedback(text, durationMs = 2500) {
  actionFeedback.textContent = text;
  setTimeout(() => {
    if (actionFeedback.textContent === text) {
      actionFeedback.textContent = '';
    }
  }, durationMs);
}

// Event Listeners
toggleEnabled.addEventListener('change', () => {
  currentSettings.enabled = toggleEnabled.checked;
  saveSettings();
});

toggleBlur.addEventListener('change', () => {
  currentSettings.blurEnabled = toggleBlur.checked;
  saveSettings();
});

toggleReveal.addEventListener('change', () => {
  currentSettings.revealEnabled = toggleReveal.checked;
  saveSettings();
});

for (const radio of strictnessRadios) {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      currentSettings.strictness = radio.value;
      saveSettings();
    }
  });
}

btnClearCache.addEventListener('click', async () => {
  try {
    await chrome.storage.local.remove([STORAGE_KEYS.CACHE]);
    showFeedback('Cache cleared successfully!');
  } catch (err) {
    showFeedback('Failed to clear cache');
  }
});

if (btnSaveUrl) {
  btnSaveUrl.addEventListener('click', async () => {
    const rawVal = inputBackendUrl.value.trim();
    if (!rawVal) return;
    const cleanUrl = rawVal.replace(/\/+$/, '');
    currentSettings.backendUrl = cleanUrl;
    inputBackendUrl.value = cleanUrl;
    await saveSettings();
    showFeedback('Backend URL saved!');
    checkBackendHealth(cleanUrl);
  });
}

// Initialize on DOM loaded
document.addEventListener('DOMContentLoaded', loadState);
