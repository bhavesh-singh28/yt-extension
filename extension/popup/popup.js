/**
 * YouTube Study Filter - Popup Script
 * Manages Serverless Multi-Engine AI selection (Gemini Nano on-device & Direct Gemini API BYOK)
 */

const STORAGE_KEYS = {
  SETTINGS: 'yt_study_filter_settings',
  CACHE: 'yt_study_filter_cache',
  STATS: 'yt_study_filter_stats'
};

const DEFAULT_SETTINGS = {
  enabled: true,
  aiEngine: 'nano', // 'nano' (Chrome Built-in) | 'direct' (Gemini BYOK)
  geminiApiKey: '',
  geminiModel: 'gemini-2.5-flash',
  strictness: 'balanced',
  blurEnabled: true,
  revealEnabled: true
};

// UI Elements - Core
const toggleEnabled = document.getElementById('toggle-enabled');
const toggleBlur = document.getElementById('toggle-blur');
const toggleReveal = document.getElementById('toggle-reveal');
const strictnessRadios = document.querySelectorAll('input[name="strictness"]');
const btnClearCache = document.getElementById('btn-clear-cache');
const actionFeedback = document.getElementById('action-feedback');

// UI Elements - Status Banner
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

// UI Elements - Engine Selection
const engineRadios = document.querySelectorAll('input[name="aiEngine"]');
const panelNano = document.getElementById('panel-nano');
const panelDirect = document.getElementById('panel-direct');

const cardEngineNano = document.getElementById('card-engine-nano');
const cardEngineDirect = document.getElementById('card-engine-direct');

// UI Elements - Nano Panel
const nanoStatusDot = document.getElementById('nano-status-dot');
const nanoStatusLabel = document.getElementById('nano-status-label');

// UI Elements - Direct BYOK Panel
const inputApiKey = document.getElementById('input-api-key');
const btnToggleKey = document.getElementById('btn-toggle-key');
const selectGeminiModel = document.getElementById('select-gemini-model');
const btnSaveKey = document.getElementById('btn-save-key');
const btnTestKey = document.getElementById('btn-test-key');

// UI Elements - Stats
const statAnalyzed = document.getElementById('stat-analyzed');
const statEducational = document.getElementById('stat-educational');
const statFiltered = document.getElementById('stat-filtered');
const statRevealed = document.getElementById('stat-revealed');

let currentSettings = { ...DEFAULT_SETTINGS };
let nanoAvailability = 'untested'; // 'ready' | 'downloading' | 'unavailable'

/**
 * Check on-device Chrome Built-in AI (Prompt API / Gemini Nano)
 */
async function detectNano() {
  const aiObj = window.ai || globalThis.ai;
  if (!aiObj || !aiObj.languageModel) {
    nanoAvailability = 'unavailable';
    nanoStatusDot.className = 'status-dot-sm unavailable';
    nanoStatusLabel.textContent = 'Gemini Nano Not Available (Flags needed)';
    return 'unavailable';
  }

  try {
    let state = 'no';
    if (typeof aiObj.languageModel.capabilities === 'function') {
      const caps = await aiObj.languageModel.capabilities();
      state = caps.available;
    } else if (typeof aiObj.languageModel.availability === 'function') {
      state = await aiObj.languageModel.availability();
    }

    if (state === 'readily') {
      nanoAvailability = 'ready';
      nanoStatusDot.className = 'status-dot-sm ready';
      nanoStatusLabel.textContent = 'Gemini Nano Ready (On-Device)';
      return 'ready';
    } else if (state === 'after-download') {
      nanoAvailability = 'downloading';
      nanoStatusDot.className = 'status-dot-sm';
      nanoStatusLabel.textContent = 'Downloading Gemini Nano Model...';
      return 'downloading';
    } else {
      nanoAvailability = 'unavailable';
      nanoStatusDot.className = 'status-dot-sm unavailable';
      nanoStatusLabel.textContent = 'Gemini Nano Disabled (Check chrome://flags)';
      return 'unavailable';
    }
  } catch (err) {
    nanoAvailability = 'unavailable';
    nanoStatusDot.className = 'status-dot-sm unavailable';
    nanoStatusLabel.textContent = 'Gemini Nano Check Failed';
    return 'unavailable';
  }
}

/**
 * Update UI panels and active card highlight based on chosen AI engine
 */
function updateEngineUI(engine) {
  // Update active radio
  for (const radio of engineRadios) {
    radio.checked = (radio.value === engine);
  }

  // Update card highlights
  if (cardEngineNano) cardEngineNano.classList.toggle('active', engine === 'nano');
  if (cardEngineDirect) cardEngineDirect.classList.toggle('active', engine === 'direct');

  // Toggle config panels
  if (panelNano) panelNano.style.display = (engine === 'nano') ? 'flex' : 'none';
  if (panelDirect) panelDirect.style.display = (engine === 'direct') ? 'flex' : 'none';

  // Update Status Banner
  refreshStatusBanner();
}

/**
 * Refresh top status banner based on active settings and health
 */
async function refreshStatusBanner() {
  if (!currentSettings.enabled) {
    statusDot.className = 'status-dot offline';
    statusText.textContent = 'Study Filter is Disabled';
    return;
  }

  const engine = currentSettings.aiEngine || 'nano';

  if (engine === 'nano') {
    if (nanoAvailability === 'ready') {
      statusDot.className = 'status-dot online';
      statusText.textContent = 'Active • Gemini Nano (On-Device)';
    } else if (nanoAvailability === 'downloading') {
      statusDot.className = 'status-dot';
      statusText.textContent = 'Downloading • Gemini Nano Model';
    } else {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Nano Unavailable (Enable in flags)';
    }
  } else if (engine === 'direct') {
    const key = (currentSettings.geminiApiKey || '').trim();
    if (key) {
      statusDot.className = 'status-dot online';
      statusText.textContent = `Active • Direct Gemini (${currentSettings.geminiModel || 'Flash'})`;
    } else {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Direct Gemini: API Key Required';
    }
  }
}

/**
 * Test Direct Gemini API key
 */
async function testDirectKey() {
  const key = inputApiKey.value.trim();
  const model = selectGeminiModel.value;

  if (!key) {
    showFeedback('Please enter an API key first');
    return;
  }

  btnTestKey.disabled = true;
  btnTestKey.textContent = 'Testing...';
  showFeedback('Testing Gemini API key...');

  try {
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: 'CHECK_GEMINI_KEY',
          geminiApiKey: key,
          geminiModel: model
        },
        (res) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { success: false, error: 'No response from worker' });
          }
        }
      );
    });

    if (response && response.success) {
      showFeedback(`✅ Key Valid! Connected to ${response.model}`);
      statusDot.className = 'status-dot online';
      statusText.textContent = `Active • Direct Gemini (${response.model})`;
    } else {
      showFeedback(`❌ Key Error: ${response?.error || 'Failed'}`);
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Invalid Gemini API Key';
    }
  } catch (err) {
    showFeedback(`❌ Error: ${err.message}`);
  } finally {
    btnTestKey.disabled = false;
    btnTestKey.textContent = 'Test Key';
  }
}

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

    // Default engine to 'nano' if it was pointing to removed 'backend'
    if (currentSettings.aiEngine === 'backend') {
      currentSettings.aiEngine = 'nano';
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

    // Populate API Key & Model
    if (inputApiKey) inputApiKey.value = currentSettings.geminiApiKey || '';
    if (selectGeminiModel) selectGeminiModel.value = currentSettings.geminiModel || 'gemini-2.5-flash';

    // Check Gemini Nano availability
    await detectNano();

    // Populate AI Engine Selection UI
    updateEngineUI(currentSettings.aiEngine || 'nano');

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

// Event Listeners - Engine Selector
engineRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (radio.checked) {
      currentSettings.aiEngine = radio.value;
      updateEngineUI(radio.value);
      saveSettings();
      showFeedback(`Switched to ${radio.value === 'nano' ? 'Gemini Nano (On-Device)' : 'Direct Gemini API'}`);
    }
  });
});

// Event Listeners - Toggles
toggleEnabled.addEventListener('change', () => {
  currentSettings.enabled = toggleEnabled.checked;
  saveSettings();
  refreshStatusBanner();
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

// Event Listeners - Direct BYOK
if (btnToggleKey) {
  btnToggleKey.addEventListener('click', () => {
    if (inputApiKey.type === 'password') {
      inputApiKey.type = 'text';
      btnToggleKey.textContent = '🔒';
    } else {
      inputApiKey.type = 'password';
      btnToggleKey.textContent = '👁️';
    }
  });
}

if (btnSaveKey) {
  btnSaveKey.addEventListener('click', async () => {
    currentSettings.geminiApiKey = inputApiKey.value.trim();
    currentSettings.geminiModel = selectGeminiModel.value;
    await saveSettings();
    showFeedback('Gemini API key saved!');
    refreshStatusBanner();
  });
}

if (selectGeminiModel) {
  selectGeminiModel.addEventListener('change', async () => {
    currentSettings.geminiModel = selectGeminiModel.value;
    await saveSettings();
    refreshStatusBanner();
  });
}

if (btnTestKey) {
  btnTestKey.addEventListener('click', testDirectKey);
}

// Clear Cache & Stats
btnClearCache.addEventListener('click', async () => {
  try {
    await chrome.storage.local.remove([STORAGE_KEYS.CACHE]);
    const zeroStats = {
      videosAnalyzed: 0,
      educationalVideos: 0,
      nonEducationalVideos: 0,
      manuallyRevealedVideos: 0
    };
    await chrome.storage.local.set({
      [STORAGE_KEYS.STATS]: zeroStats
    });

    statAnalyzed.textContent = '0';
    statEducational.textContent = '0';
    statFiltered.textContent = '0';
    statRevealed.textContent = '0';

    try {
      const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action: 'CLEAR_CACHE_AND_STATS' }).catch(() => {});
      }
    } catch (_) {}

    showFeedback('Cache & Dashboard stats reset!');
  } catch (err) {
    console.error('Failed to clear cache:', err);
    showFeedback('Failed to clear cache');
  }
});

// Initialize on DOM loaded
document.addEventListener('DOMContentLoaded', loadState);
