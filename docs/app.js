/**
 * YouTube Study Filter — GitHub Pages Interactive Scripts
 */

// Tab Switcher between Direct Gemini API & Gemini Nano
function switchGuideTab(tabName) {
  const btnDirect = document.getElementById('tab-btn-direct');
  const btnNano = document.getElementById('tab-btn-nano');
  const panelDirect = document.getElementById('panel-guide-direct');
  const panelNano = document.getElementById('panel-guide-nano');

  if (tabName === 'direct') {
    btnDirect.classList.add('active');
    btnNano.classList.remove('active');
    panelDirect.classList.add('active');
    panelNano.classList.remove('active');
  } else {
    btnNano.classList.add('active');
    btnDirect.classList.remove('active');
    panelNano.classList.add('active');
    panelDirect.classList.remove('active');
  }
}

// Reveal a blurred simulated video card
function revealSimCard(buttonElement) {
  const card = buttonElement.closest('.sim-video-card');
  if (!card) return;

  const overlay = card.querySelector('.sim-overlay');
  if (card.classList.contains('blurred')) {
    card.classList.remove('blurred');
    if (overlay) overlay.style.display = 'none';
    buttonElement.textContent = 'Hide';
  } else {
    card.classList.add('blurred');
    if (overlay) overlay.style.display = 'flex';
    buttonElement.textContent = 'Show';
  }
}

// Toggle all blurred cards in the simulation
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('btn-toggle-demo-blur');
  let isFilterActive = true;

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const blurredCards = document.querySelectorAll('.non-edu-card');
      isFilterActive = !isFilterActive;

      blurredCards.forEach(card => {
        const overlay = card.querySelector('.sim-overlay');
        const revealBtn = card.querySelector('.sim-reveal-btn');

        if (isFilterActive) {
          card.classList.add('blurred');
          if (overlay) overlay.style.display = 'flex';
          if (revealBtn) revealBtn.textContent = 'Show';
        } else {
          card.classList.remove('blurred');
          if (overlay) overlay.style.display = 'none';
          if (revealBtn) revealBtn.textContent = 'Hide';
        }
      });

      toggleBtn.textContent = isFilterActive ? 'Disable Filter' : 'Enable Filter';
      const statusText = document.querySelector('.sim-status strong');
      if (statusText) {
        statusText.textContent = isFilterActive ? 'Active' : 'Disabled';
        statusText.style.color = isFilterActive ? 'var(--accent-edu)' : 'var(--text-dim)';
      }
    });
  }
});
