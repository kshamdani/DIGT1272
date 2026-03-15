// ===== CUSTOM CURSOR =====
const cursor = document.getElementById('cursor');
const trail = document.getElementById('cursor-trail');
let mx = -200, my = -200;

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cursor.style.left = mx + 'px';
  cursor.style.top = my + 'px';
  setTimeout(() => {
    trail.style.left = mx + 'px';
    trail.style.top = my + 'px';
  }, 80);
});

document.querySelectorAll('a, button, [tabindex="0"], input, select').forEach(el => {
  el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
  el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
});

// ===== DWELL CLICK SYSTEM (used by both gaze.js and keyboard nav) =====
const gazeCursor = document.getElementById('gaze-cursor');

// Dwell constants 
const _DWELL_MS      = 1500;
const _CIRCUMFERENCE = 150.8; // 2π × 24

let _dwellTimer    = null;
let _dwellInterval = null;
let _dwellProgress = 0;
let _dwellX        = 0;
let _dwellY        = 0;
window._dwellTarget = null;

// Dwell indicator (SVG arc ring that follows the gaze point) 
const dwellIndicator = document.createElement('div');
dwellIndicator.id = 'dwell-indicator';
dwellIndicator.setAttribute('aria-hidden', 'true');
dwellIndicator.style.cssText = `
  display:none; position:fixed; pointer-events:none; z-index:9996;
  transform:translate(-50%,-50%); width:72px; height:72px;
`;
dwellIndicator.innerHTML = `
  <svg width="72" height="72" viewBox="0 0 72 72">
    <circle cx="36" cy="36" r="32" fill="rgba(56,189,248,0.08)"
      stroke="rgba(56,189,248,0.25)" stroke-width="2"/>
    <circle id="dwell-arc" cx="36" cy="36" r="32" fill="none"
      stroke="#38bdf8" stroke-width="3.5"
      stroke-dasharray="201.1" stroke-dashoffset="201.1"
      stroke-linecap="round" transform="rotate(-90 36 36)"/>
    <circle id="dwell-dot" cx="36" cy="36" r="5"
      fill="#38bdf8" opacity="0.9"/>
  </svg>
  <div id="dwell-label" style="
    position:absolute; top:76px; left:50%; transform:translateX(-50%);
    font-family:'DM Mono',monospace; font-size:0.62rem; color:#38bdf8;
    white-space:nowrap; background:rgba(10,10,15,0.85);
    padding:0.15rem 0.5rem; border-radius:4px; border:1px solid rgba(56,189,248,0.3);
  "></div>`;
document.body.appendChild(dwellIndicator);

const dwellArc   = document.getElementById('dwell-arc');
const dwellDot   = document.getElementById('dwell-dot');
const dwellLabel = document.getElementById('dwell-label');
const _ARC_FULL  = 201.1; // 2π × 32

//  Audio feedback (Web Audio API no external files needed) 
let _audioCtx = null;
function _getAudio() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}
function playTick(freq = 880, dur = 0.04) {
  try {
    const ctx = _getAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch(e) { /* audio unavailable */ }
}
function playActivate() {
  try {
    const ctx = _getAudio();
    [440, 660, 880].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = f;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.12);
      osc.start(ctx.currentTime + i * 0.06);
      osc.stop(ctx.currentTime + i * 0.06 + 0.15);
    });
  } catch(e) { /* audio unavailable */ }
}

//  Scroll zones 
const SCROLL_ZONE_H  = 0.15;  // top/bottom 15% of viewport triggers scroll
const SCROLL_SPEED   = 8;     // px per frame
let   _scrollZone    = 0;     // -1 = up, 0 = none, 1 = down
let   _scrollRAF     = null;

// Scroll zone indicators injected when gaze mode activates
let _scrollUpZone   = null;
let _scrollDownZone = null;

window.showScrollZones = function() {
  if (_scrollUpZone) return;
  _scrollUpZone = _makeScrollZone('up');
  _scrollDownZone = _makeScrollZone('down');
  document.body.appendChild(_scrollUpZone);
  document.body.appendChild(_scrollDownZone);
};
window.hideScrollZones = function() {
  _scrollUpZone?.remove();  _scrollUpZone   = null;
  _scrollDownZone?.remove(); _scrollDownZone = null;
  _stopScroll();
};

function _makeScrollZone(dir) {
  const z = document.createElement('div');
  z.setAttribute('aria-hidden', 'true');
  z.style.cssText = `
    position:fixed; left:0; right:0; height:${SCROLL_ZONE_H * 100}vh;
    ${dir === 'up' ? 'top:0' : 'bottom:0'};
    background:linear-gradient(${dir === 'up' ? 'to bottom' : 'to top'},
      rgba(56,189,248,0.07), transparent);
    border-${dir === 'up' ? 'bottom' : 'top'}:1px dashed rgba(56,189,248,0.2);
    pointer-events:none; z-index:8900; opacity:0;
    transition:opacity 0.3s;
    display:flex; align-items:${dir === 'up' ? 'flex-start' : 'flex-end'};
    justify-content:center; padding:0.5rem;
  `;
  const lbl = document.createElement('div');
  lbl.style.cssText = `font-family:'DM Mono',monospace; font-size:0.65rem;
    color:rgba(56,189,248,0.5); letter-spacing:0.1em; text-transform:uppercase;`;
  lbl.textContent = dir === 'up' ? '↑ gaze here to scroll up' : '↓ gaze here to scroll down';
  z.appendChild(lbl);
  return z;
}

function _startScroll(dir) {
  if (_scrollZone === dir) return;
  _scrollZone = dir;
  _stopScroll();

  // Light up the appropriate zone
  if (dir === -1 && _scrollUpZone)   _scrollUpZone.style.opacity   = '1';
  if (dir ===  1 && _scrollDownZone) _scrollDownZone.style.opacity  = '1';

  function frame() {
    window.scrollBy(0, dir * SCROLL_SPEED);
    _scrollRAF = requestAnimationFrame(frame);
  }
  _scrollRAF = requestAnimationFrame(frame);
}

function _stopScroll() {
  if (_scrollRAF) { cancelAnimationFrame(_scrollRAF); _scrollRAF = null; }
  _scrollZone = 0;
  if (_scrollUpZone)   _scrollUpZone.style.opacity   = '0';
  if (_scrollDownZone) _scrollDownZone.style.opacity  = '0';
}

//  Called by gaze.js on every gaze update 
window.handleGazePoint = function(x, y) {
  // Update dwell indicator position to follow gaze continuously
  if (dwellIndicator.style.display !== 'none') {
    dwellIndicator.style.left = x + 'px';
    dwellIndicator.style.top  = y + 'px';
  }

  // Check scroll zones (only if not mid dwell on a button)
  const inTopZone    = y < window.innerHeight * SCROLL_ZONE_H;
  const inBottomZone = y > window.innerHeight * (1 - SCROLL_ZONE_H);

  if (inTopZone && !window._dwellTarget) {
    _startScroll(-1); return;
  } else if (inBottomZone && !window._dwellTarget) {
    _startScroll(1);  return;
  } else {
    _stopScroll();
  }

  // Hit test for interactive elements
  const hit = document.elementFromPoint(x, y);
  if (!hit || hit.id === 'gaze-cursor' || hit.id === 'dwell-indicator') {
    window.clearDwell(); return;
  }
  const target = hit.closest(
    'a,button,input,select,textarea,[role="button"],[role="link"],[role="tab"]'
  );
  if (target && target !== window._dwellTarget) {
    window.startDwell(target, x, y);
  } else if (!target) {
    window.clearDwell();
  }
};

// Dwell API
window.clearDwell = function() {
  clearTimeout(_dwellTimer);
  clearInterval(_dwellInterval);
  _dwellTimer = _dwellInterval = null;
  _dwellProgress = 0;
  window._dwellTarget = null;
  if (dwellArc)   { dwellArc.style.strokeDashoffset = _ARC_FULL; dwellArc.style.stroke = '#38bdf8'; }
  if (dwellDot)   dwellDot.style.fill = '#38bdf8';
  if (dwellLabel) dwellLabel.textContent = '';
  dwellIndicator.style.display = 'none';
  const fill = document.getElementById('dwell-fill');
  if (fill) fill.style.width = '0%';
};

window.startDwell = function(el, x, y) {
  if (window._dwellTarget === el) return;
  window.clearDwell();

  const tag  = el.tagName.toLowerCase();
  const role = el.getAttribute('role');
  const isInteractive =
    ['a','button','input','select','textarea'].includes(tag) ||
    ['button','link','tab','menuitem','option'].includes(role) ||
    el.hasAttribute('onclick') ||
    (el.getAttribute('tabindex') && el.getAttribute('tabindex') !== '-1');
  if (!isInteractive) return;

  window._dwellTarget = el;
  _dwellX = x; _dwellY = y;

  // Show and position indicator
  dwellIndicator.style.display = 'block';
  dwellIndicator.style.left = x + 'px';
  dwellIndicator.style.top  = y + 'px';

  // Set label to element name
  const name = el.getAttribute('aria-label') || el.textContent.trim().substring(0, 24) || tag;
  if (dwellLabel) dwellLabel.textContent = name;

  // Highlight the target element
  el.style.outline = '2px dashed rgba(56,189,248,0.6)';
  el.style.outlineOffset = '3px';

  let lastTickAt = 0;
  _dwellInterval = setInterval(() => {
    _dwellProgress += 100 / (_DWELL_MS / 50);
    const pct    = Math.min(_dwellProgress, 100);
    const offset = _ARC_FULL * (1 - pct / 100);
    if (dwellArc) {
      dwellArc.style.strokeDashoffset = offset;
      // Colour shifts green as it fills
      const g = Math.round(189 + (255 - 189) * pct / 100);
      dwellArc.style.stroke = pct > 66
        ? `rgb(${Math.round(56 * (1 - (pct - 66) / 34))},${g},${Math.round(248 * (1 - (pct - 66) / 34) + 159 * (pct - 66) / 34)})`
        : '#38bdf8';
    }
    const fill = document.getElementById('dwell-fill');
    if (fill) fill.style.width = pct + '%';

    // Tick sound every 25%
    if (pct >= lastTickAt + 25) { lastTickAt += 25; playTick(440 + lastTickAt * 6); }
  }, 50);

  _dwellTimer = setTimeout(() => {
    const target = window._dwellTarget;
    window.clearDwell();
    if (target) {
      target.style.outline = '';
      target.style.outlineOffset = '';
      activateElement(target);
    }
  }, _DWELL_MS);
};

function activateElement(el) {
  // Flash + sound
  el.style.outline = '3px solid #7cfc9f';
  el.style.outlineOffset = '3px';
  playActivate();
  setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 700);

  // SR announce
  if (window.srMode) {
    const msg = buildAnnouncement(el);
    if (msg && srText) srText.textContent = 'Activated: ' + msg;
  }

  // Trigger
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') {
    (['checkbox','radio'].includes(el.type)) ? el.click() : el.focus();
  } else if (tag === 'select' || tag === 'textarea') {
    el.focus();
  } else {
    el.click();
  }

  // Demo log
  const gazeLog = document.getElementById('gaze-log');
  if (gazeLog) {
    const label = el.getAttribute('aria-label') || el.textContent.trim().substring(0, 30) || el.tagName;
    gazeLog.insertAdjacentHTML('afterbegin',
      `<div style="color:var(--accent3)">[${new Date().toLocaleTimeString()}] Activated: ${label}</div>`);
  }
}

// ===== SR OVERLAY =====
const srOverlay = document.getElementById('sr-overlay');
const srText = document.getElementById('sr-text');

window.srMode = false;
window.announceGlobal = function(msg) {
  if (srText) srText.textContent = msg;
};

// ===== PERSIST ACCESSIBILITY STATE =====
function loadState() {
  if (sessionStorage.getItem('hc') === '1') applyHC(true);
  if (sessionStorage.getItem('lt') === '1') applyLT(true);
  if (sessionStorage.getItem('sr') === '1') applySR(true);
  // Gaze is intentionally not auto restored camera access requires a user gesture
}

function applyHC(on) {
  document.body.classList.toggle('high-contrast', on);
  const btn = document.getElementById('btn-hc');
  if (btn) { btn.classList.toggle('active', on); btn.setAttribute('aria-pressed', on); }
  sessionStorage.setItem('hc', on ? '1' : '0');
}
function applyLT(on) {
  document.documentElement.classList.toggle('large-text', on);
  const btn = document.getElementById('btn-text');
  if (btn) { btn.classList.toggle('active', on); btn.setAttribute('aria-pressed', on); }
  sessionStorage.setItem('lt', on ? '1' : '0');
}
function applySR(on) {
  window.srMode = on;
  if (srOverlay) srOverlay.classList.toggle('active', on);
  const btn = document.getElementById('btn-sr');
  if (btn) { btn.classList.toggle('active', on); btn.setAttribute('aria-pressed', on); }
  if (on && srText) srText.textContent = 'Screen reader active. Hover any element for announcement.';
  sessionStorage.setItem('sr', on ? '1' : '0');
}
function applyGaze(on) {
  if (on) {
    window.GazeTracker?.enable();
  } else {
    window.GazeTracker?.disable();
  }
}

// ===== SCREEN READER: BUILD ANNOUNCEMENT FOR ANY ELEMENT =====
function buildAnnouncement(el) {
  const tag = el.tagName.toLowerCase();

  // Explicit override always wins
  if (el.dataset.srAnnounce) return el.dataset.srAnnounce;

  // Derive accessible name: aria label > aria labelledby > alt > placeholder > text content
  let name =
    el.getAttribute('aria-label') ||
    (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby'))?.textContent.trim()) ||
    el.getAttribute('alt') ||
    el.getAttribute('placeholder') ||
    el.getAttribute('title') ||
    el.textContent.trim().replace(/\s+/g, ' ').substring(0, 80) ||
    '';

  const role = el.getAttribute('role');
  const pressed = el.getAttribute('aria-pressed');
  const expanded = el.getAttribute('aria-expanded');
  const required = el.hasAttribute('required') ? 'Required. ' : '';
  const disabled = el.hasAttribute('disabled') ? 'Dimmed, unavailable. ' : '';

  // Heading
  if (/^h[1-6]$/.test(tag)) {
    const level = tag[1];
    return `Heading level ${level}. ${name}. Press H in a screen reader to jump between headings.`;
  }

  // Link
  if (tag === 'a') {
    const href = el.getAttribute('href') || '';
    const newTab = el.getAttribute('target') === '_blank' ? ' Opens in new tab.' : '';
    if (!name) name = href;
    return `Link. ${name}.${newTab} Press Enter to follow.`;
  }

  // Button
  if (tag === 'button' || role === 'button') {
    const pressedMsg = pressed !== null ? ` State: ${pressed === 'true' ? 'pressed' : 'not pressed'}.` : '';
    const expandedMsg = expanded !== null ? ` ${expanded === 'true' ? 'Expanded' : 'Collapsed'}.` : '';
    return `Button. ${name}.${pressedMsg}${expandedMsg} ${disabled}Press Space or Enter to activate.`;
  }

  // Input
  if (tag === 'input') {
    const type = el.getAttribute('type') || 'text';
    const value = el.value ? `Current value: ${el.value}. ` : '';
    const labelEl = el.id && document.querySelector(`label[for="${el.id}"]`);
    const labelText = labelEl ? labelEl.textContent.trim() : name;
    if (type === 'checkbox') {
      return `Checkbox. ${labelText}. ${el.checked ? 'Checked' : 'Unchecked'}. ${required}Press Space to toggle.`;
    }
    if (type === 'radio') {
      return `Radio button. ${labelText}. ${el.checked ? 'Selected' : 'Not selected'}. ${required}Press Space to select.`;
    }
    if (type === 'range') {
      return `Slider. ${labelText}. Value: ${el.value}. Range: ${el.min} to ${el.max}. Use arrow keys to adjust.`;
    }
    return `${type.charAt(0).toUpperCase() + type.slice(1)} input. ${labelText}. ${required}${value}${disabled}Type to enter text.`;
  }

  // Select
  if (tag === 'select') {
    const selected = el.options[el.selectedIndex]?.text || '';
    const labelEl = el.id && document.querySelector(`label[for="${el.id}"]`);
    const labelText = labelEl ? labelEl.textContent.trim() : name;
    return `Dropdown. ${labelText}. Currently: ${selected}. ${required}Press Enter or Space to open.`;
  }

  // Textarea
  if (tag === 'textarea') {
    const labelEl = el.id && document.querySelector(`label[for="${el.id}"]`);
    const labelText = labelEl ? labelEl.textContent.trim() : name;
    return `Text area. ${labelText}. ${required}${disabled}Type to enter multiple lines of text.`;
  }

  // Image
  if (tag === 'img') {
    const alt = el.getAttribute('alt');
    if (alt === '') return 'Image. Decorative. No description needed.';
    if (alt) return `Image. ${alt}.`;
    return 'Image. Missing alt text. Screen reader users cannot understand this image. Accessibility failure.';
  }

  // Nav landmark
  if (tag === 'nav' || role === 'navigation') {
    return `Navigation landmark. ${name || 'Site navigation'}. Contains ${el.querySelectorAll('a').length} links.`;
  }

  // Article / section / aside
  if (tag === 'article' || role === 'article') return `Article. ${name}. Press Enter to read.`;
  if (tag === 'aside'   || role === 'complementary') return `Aside. ${name || 'Supplementary content'}.`;
  if (tag === 'main'    || role === 'main') return 'Main content landmark.';

  // List items
  if (tag === 'li' || role === 'listitem') {
    const list = el.closest('ul, ol');
    const items = list ? list.querySelectorAll(':scope > li').length : '?';
    const idx = list ? [...list.querySelectorAll(':scope > li')].indexOf(el) + 1 : '?';
    return `List item ${idx} of ${items}. ${name}`;
  }

  // Tabpanel / tab
  if (role === 'tabpanel') return `Tab panel. ${name}. Contains interactive content.`;
  if (role === 'tab') {
    const sel = el.getAttribute('aria-selected') === 'true' ? 'Selected.' : 'Not selected.';
    return `Tab. ${name}. ${sel} Press Enter to activate.`;
  }

  // Generic landmark with aria label
  if (el.getAttribute('aria-label')) return `${name}.`;

  // Paragraph / div with text
  if (name) return name;

  return null; // nothing useful to announce
}

function srHover(el) {
  if (!window.srMode) return;
  // Skip purely decorative or invisible elements
  if (el.getAttribute('aria-hidden') === 'true') return;
  if (el.closest('[aria-hidden="true"]')) return;

  const msg = buildAnnouncement(el);
  if (!msg || msg.trim() === '') return;

  if (srText) srText.textContent = msg;
  window.speakText(msg);
}

// ===== NAV BUTTON EVENTS =====
document.addEventListener('DOMContentLoaded', () => {
  loadState();

  document.getElementById('btn-hc')?.addEventListener('click', () => applyHC(!document.body.classList.contains('high-contrast')));
  document.getElementById('btn-text')?.addEventListener('click', () => applyLT(!document.documentElement.classList.contains('large-text')));
  document.getElementById('btn-sr')?.addEventListener('click', () => applySR(!window.srMode));
  document.getElementById('btn-gaze')?.addEventListener('click', () => {
    const isOn = window.GazeTracker?.mode !== 'off';
    applyGaze(!isOn);
  });

  // Attach SR hover to every meaningful element on the page
  const srTargets = 'a, button, input, select, textarea, img, h1, h2, h3, h4, h5, h6, li, [role], [aria-label], nav, main, article, aside, [tabindex]';
  document.querySelectorAll(srTargets).forEach(el => {
    el.addEventListener('mouseenter', () => srHover(el));
  });

  // Highlight active nav link
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href').split('/').pop();
    if (href === path) a.classList.add('active');
  });

  // Scroll reveal
  const reveals = document.querySelectorAll('.reveal');
  const obs = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 100);
      }
    });
  }, { threshold: 0.1 });
  reveals.forEach(el => obs.observe(el));
});

// ===== WEB SPEECH =====
window.speakText = function(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.2;
    window.speechSynthesis.speak(utt);
  }
};
