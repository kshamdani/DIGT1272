/**
 * gaze.js Real eye tracking via WebGazer.js */

window.GazeTracker = (() => {
  const WEBGAZER_CDN  = 'https://cdn.jsdelivr.net/npm/webgazer@2.1.0/dist/webgazer.min.js';
  const SMOOTH_K      = 0.18;
  const CLICKS_PER_PT = 5;
  const CALIB_POINTS  = [
    [10,10],[50,10],[90,10],
    [10,50],[50,50],[90,50],
    [10,90],[50,90],[90,90],
  ];

  let mode = 'off'; // 'off' | 'loading' | 'calibrating' | 'real' | 'sim'
  let smoothX = null, smoothY = null;
  let calibIdx = 0, calibClicks = 0;

  const gazeCursor  = document.getElementById('gaze-cursor');
  const cursor      = document.getElementById('cursor');
  const cursorTrail = document.getElementById('cursor-trail');

  // Public API
  function enable()  { if (mode === 'off') showModeDialog(); }

  function disable() {
    if (mode === 'real' || mode === 'calibrating') stopReal();
    if (mode === 'sim') stopSim();
    mode = 'off';
    hideCursor();
    restorePCursor();
    syncNavBtn(false);
    syncDemoBtn(false);
  }

  //  Mode dialog 
  function showModeDialog() {
    const overlay = el('div', 'gaze-mode-dialog');
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-labelledby','gaze-dlg-title');
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.88);
      z-index:10000;display:flex;align-items:center;justify-content:center;`;
    overlay.innerHTML = `
      <div style="background:#13131a;border:1px solid #2a2a3d;border-radius:20px;
                  padding:2.5rem;max-width:480px;width:90%;text-align:center;">
        <div style="font-size:2.5rem;margin-bottom:1rem;"></div>
        <h2 id="gaze-dlg-title" style="font-family:'Syne',sans-serif;font-weight:800;
            font-size:1.4rem;color:#fff;margin-bottom:0.75rem;letter-spacing:-0.03em;">
          Eye Tracking Mode</h2>
        <p style="color:#7a7a9a;font-size:0.88rem;margin-bottom:2rem;line-height:1.6;">
          Choose how you want to experience gaze-based interaction.</p>
        <button id="dlg-real" style="display:block;width:100%;padding:1.2rem 1.5rem;
            margin-bottom:1rem;background:rgba(56,189,248,0.1);border:2px solid #38bdf8;
            border-radius:12px;color:#38bdf8;cursor:pointer;
            font-family:'Syne',sans-serif;font-weight:700;font-size:0.92rem;">
           Real Eye Tracking
          <div style="font-family:'DM Mono',monospace;font-size:0.7rem;color:#7a7a9a;
               margin-top:0.3rem;font-weight:400;">
            Webcam + WebGazer.js · needs camera permission &amp; 9-point calibration</div>
        </button>
        <button id="dlg-sim" style="display:block;width:100%;padding:1.2rem 1.5rem;
            margin-bottom:1.5rem;background:rgba(124,252,159,0.08);
            border:2px solid rgba(124,252,159,0.4);border-radius:12px;color:#7cfc9f;
            cursor:pointer;font-family:'Syne',sans-serif;font-weight:700;font-size:0.92rem;">
           Mouse Simulation
          <div style="font-family:'DM Mono',monospace;font-size:0.7rem;color:#7a7a9a;
               margin-top:0.3rem;font-weight:400;">
            Cursor drives gaze point · no camera needed</div>
        </button>
        <button id="dlg-cancel" style="font-family:'DM Mono',monospace;font-size:0.72rem;
            color:#7a7a9a;background:none;border:none;cursor:pointer;
            text-decoration:underline;">Cancel</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#dlg-real').onclick   = () => { overlay.remove(); startReal(); };
    overlay.querySelector('#dlg-sim').onclick    = () => { overlay.remove(); startSim();  };
    overlay.querySelector('#dlg-cancel').onclick = () => { overlay.remove(); };
  }

  //  SIM MODE 
  function startSim() {
    mode = 'sim';
    showCursor(); hidePCursor();
    syncNavBtn(true); syncDemoBtn(true);
    window.showScrollZones?.();
    document.addEventListener('mousemove', onSimMove);
  }

  function stopSim() {
    document.removeEventListener('mousemove', onSimMove);
    window.hideScrollZones?.();
    window.clearDwell?.();
  }

  function onSimMove(e) {
    moveCursor(e.clientX, e.clientY);
    window.handleGazePoint?.(e.clientX, e.clientY);
  }

  // REAL MODE
  function startReal() {
    mode = 'loading';
    showBanner('Loading WebGazer.js…');
    loadScript(WEBGAZER_CDN)
      .then(initWebGazer)
      .then(() => { hideBanner(); showCalibrationUI(); })
      .catch(err => {
        hideBanner();
        showError('Could not start eye tracking: ' + err.message + '. Switching to mouse simulation.');
        console.error('[GazeTracker]', err);
        startSim();
      });
  }

  function stopReal() {
    if (typeof webgazer !== 'undefined') {
      try { webgazer.pause(); } catch(e) { /* ignore */ }
    }
    window.hideScrollZones?.();
    // Clean up all DOM nodes WebGazer injects
    ['webgazerVideoFeed','webgazerFaceFeedbackBox','webgazerVideoContainer',
     'webgazerVideoContainerFull','webgazerGazeDot','webgazerFaceOverlay',
     'wg-video-label'].forEach(id => document.getElementById(id)?.remove());
    window.clearDwell?.();
  }

  function initWebGazer() {
    return new Promise((resolve, reject) => {
      try {
        webgazer
          .setRegression('ridgeWeighted')
          .setTracker('TFFacemesh')
          .setGazeListener(onGazePrediction)
          .saveDataAcrossSessions(false)
          .begin()
          .then(() => {
            // Show small video preview so user can see their face is detected
            webgazer.showVideoPreview(true);
            webgazer.showPredictionPoints(false);
            styleWebcamPreview();
            resolve();
          })
          .catch(reject);
      } catch(e) { reject(e); }
    });
  }

  function styleWebcamPreview() {
    // Poll briefly for the video container WebGazer inserts asynchronously
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      const container = document.getElementById('webgazerVideoContainerFull')
                     || document.getElementById('webgazerVideoContainer');
      if (container || attempts > 20) {
        clearInterval(poll);
        if (!container) return;
        container.style.cssText = `
          position:fixed!important;bottom:1rem!important;left:1rem!important;
          width:160px!important;height:120px!important;border-radius:12px!important;
          overflow:hidden!important;border:2px solid #38bdf8!important;
          z-index:9500!important;box-shadow:0 4px 20px rgba(56,189,248,0.3)!important;`;
        const video = document.getElementById('webgazerVideoFeed');
        if (video) {
          video.style.cssText = `width:160px!important;height:120px!important;
            object-fit:cover!important;transform:scaleX(-1)!important;`;
        }
        // Label above preview
        if (!document.getElementById('wg-video-label')) {
          const lbl = document.createElement('div');
          lbl.id = 'wg-video-label';
          lbl.style.cssText = `position:fixed;bottom:130px;left:1rem;
            font-family:'DM Mono',monospace;font-size:0.62rem;color:#38bdf8;
            background:#13131a;padding:0.2rem 0.5rem;border-radius:6px;
            border:1px solid #2a2a3d;z-index:9501;pointer-events:none;`;
          lbl.textContent = 'Face camera';
          document.body.appendChild(lbl);
        }
      }
    }, 150);
  }

  //  CALIBRATION 
  function showCalibrationUI() {
    // Set mode to calibrating NOW so onGazePrediction runs and updates cursor
    mode = 'calibrating';
    calibIdx = 0; calibClicks = 0;
    smoothX = null; smoothY = null;

    const ui = document.createElement('div');
    ui.id = 'gaze-calib-ui';
    ui.setAttribute('role','dialog');
    ui.setAttribute('aria-modal','true');
    ui.setAttribute('aria-label','Eye tracking calibration');
    ui.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.88);
      z-index:10001;font-family:'Syne',sans-serif;`;
    ui.innerHTML = `
      <div id="calib-banner" style="position:absolute;top:0;left:0;right:0;
          background:rgba(10,10,15,0.98);border-bottom:1px solid #2a2a3d;
          padding:1rem 2rem;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div id="calib-title" style="font-weight:800;font-size:1rem;color:#fff;">
            Calibration, point 1 of 9</div>
          <div style="font-family:'DM Mono',monospace;font-size:0.7rem;color:#7a7a9a;
               margin-top:0.2rem;">
            Look at the dot, then click it ${CLICKS_PER_PT} times</div>
        </div>
        <button id="calib-cancel" style="font-family:'DM Mono',monospace;font-size:0.7rem;
            color:#7a7a9a;background:none;border:1px solid #2a2a3d;border-radius:6px;
            padding:0.35rem 0.75rem;cursor:pointer;">Cancel</button>
      </div>

      <div style="position:absolute;top:57px;left:0;right:0;height:3px;background:#1c1c27;">
        <div id="calib-prog" style="height:100%;background:#38bdf8;width:0%;
             transition:width 0.3s;"></div>
      </div>

      <div id="calib-dot" tabindex="0" role="button"
           aria-label="Calibration point: look here and click"
           style="position:absolute;width:22px;height:22px;background:#38bdf8;
                  border-radius:50%;transform:translate(-50%,-50%);
                  box-shadow:0 0 0 8px rgba(56,189,248,0.2);cursor:crosshair;
                  transition:left 0.4s cubic-bezier(.4,0,.2,1),
                             top 0.4s cubic-bezier(.4,0,.2,1),
                             transform 0.12s,box-shadow 0.12s;"></div>

      <svg id="calib-svg" style="position:absolute;pointer-events:none;overflow:visible;"
           width="0" height="0">
        <circle id="calib-ring" cx="0" cy="0" r="18" fill="none"
          stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="113.1"
          stroke-dashoffset="113.1" stroke-linecap="round"/>
      </svg>

      <div id="calib-intro" style="position:absolute;inset:60px 0 0;
          display:flex;align-items:center;justify-content:center;pointer-events:none;">
        <div style="background:rgba(13,13,26,0.96);border:1px solid #2a2a3d;
             border-radius:16px;padding:2rem 2.5rem;text-align:center;max-width:400px;">
          <div style="font-size:2rem;margin-bottom:1rem;"></div>
          <div style="font-weight:700;color:#fff;margin-bottom:0.75rem;font-size:1.05rem;">
            How to calibrate</div>
          <div style="font-family:'DM Mono',monospace;font-size:0.75rem;
               color:#7a7a9a;line-height:1.8;">
            A dot appears in 9 positions across the screen.<br>
            <strong style="color:#38bdf8;">Look directly at each dot</strong>, then click it 5×.<br>
            Keep your head fairly still during calibration.<br><br>
            The webcam preview (bottom-left) shows whether your face is visible.
          </div>
        </div>
      </div>`;
    document.body.appendChild(ui);

    const dot    = ui.querySelector('#calib-dot');
    const ring   = ui.querySelector('#calib-ring');
    const svg    = ui.querySelector('#calib-svg');
    const prog   = ui.querySelector('#calib-prog');
    const title  = ui.querySelector('#calib-title');
    const intro  = ui.querySelector('#calib-intro');
    const RING_C = 113.1;

    function placeDot(idx) {
      const [px, py] = CALIB_POINTS[idx];
      const x = Math.max(50, Math.min(window.innerWidth  - 50, window.innerWidth  * px / 100));
      const y = Math.max(80, Math.min(window.innerHeight - 50, window.innerHeight * py / 100));
      dot.style.left = x + 'px';
      dot.style.top  = y + 'px';
      svg.style.left = x + 'px';
      svg.style.top  = y + 'px';
      calibClicks = 0;
      refreshRing();
      title.textContent = `Calibration...point ${idx + 1} of ${CALIB_POINTS.length}`;
      prog.style.width  = (idx / CALIB_POINTS.length * 100) + '%';
    }

    function refreshRing() {
      ring.style.strokeDashoffset = RING_C * (1 - calibClicks / CLICKS_PER_PT);
      ring.style.stroke = calibClicks >= CLICKS_PER_PT ? '#7cfc9f' : '#38bdf8';
    }

    function onDotClick() {
      if (intro) intro.style.display = 'none';
      calibClicks++;
      refreshRing();
      dot.style.transform = 'translate(-50%,-50%) scale(0.68)';
      dot.style.boxShadow = '0 0 0 18px rgba(56,189,248,0.28)';
      setTimeout(() => {
        dot.style.transform = 'translate(-50%,-50%) scale(1)';
        dot.style.boxShadow = '0 0 0 8px rgba(56,189,248,0.2)';
      }, 130);

      if (calibClicks >= CLICKS_PER_PT) {
        calibIdx++;
        if (calibIdx >= CALIB_POINTS.length) {
          finishCalib(ui, prog);
        } else {
          dot.style.opacity = '0.2';
          setTimeout(() => { dot.style.opacity = '1'; placeDot(calibIdx); }, 450);
        }
      }
    }

    dot.addEventListener('click', onDotClick);
    dot.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDotClick(); }
    });
    ui.querySelector('#calib-cancel').addEventListener('click', () => {
      ui.remove(); stopReal(); mode = 'off';
      restorePCursor(); syncNavBtn(false); syncDemoBtn(false);
    });

    placeDot(0);
  }

  function finishCalib(ui, prog) {
    prog.style.width = '100%';
    ui.querySelector('#calib-banner').innerHTML = `
      <div style="color:#7cfc9f;font-weight:800;font-size:1rem;">✓ Calibration complete!</div>
      <div style="font-family:'DM Mono',monospace;font-size:0.7rem;color:#7a7a9a;margin-top:0.3rem;">
        Starting eye tracking in 1.5 s…</div>`;
    setTimeout(() => {
      ui.remove();
      mode = 'real';
      showCursor(); hidePCursor();
      syncNavBtn(true); syncDemoBtn(true);
      window.showScrollZones?.();
      toast(`
        <strong style="color:#38bdf8;">Eye tracking active</strong><br>
        Look at any link or button for ~1.5 s to click it.<br>
        Gaze at top/bottom edge of screen to scroll.<br>
        <button onclick="window.GazeTracker.recalibrate()" style="
          margin-top:0.6rem;font-family:'DM Mono',monospace;font-size:0.65rem;
          color:#38bdf8;background:none;border:1px solid rgba(56,189,248,0.4);
          border-radius:6px;padding:0.25rem 0.6rem;cursor:pointer;">
          Recalibrate</button>
      `, 8000);
    }, 1500);
  }

  //  GAZE PREDICTION 
  function onGazePrediction(data) {
    if (!data) return;
    if (mode !== 'real' && mode !== 'calibrating') return;

    if (smoothX === null) { smoothX = data.x; smoothY = data.y; }
    smoothX += SMOOTH_K * (data.x - smoothX);
    smoothY += SMOOTH_K * (data.y - smoothY);

    moveCursor(smoothX, smoothY);
    if (mode === 'real') window.handleGazePoint?.(smoothX, smoothY);
  }

  function moveCursor(x, y) {
    if (gazeCursor) { gazeCursor.style.left = x + 'px'; gazeCursor.style.top = y + 'px'; }
  }

  function showCursor()    { if (gazeCursor) gazeCursor.style.display = 'block'; }
  function hideCursor()    { if (gazeCursor) gazeCursor.style.display = 'none'; window.clearDwell?.(); }
  function hidePCursor()   { if (cursor) cursor.style.opacity='0'; if (cursorTrail) cursorTrail.style.opacity='0'; }
  function restorePCursor(){ if (cursor) cursor.style.opacity='1'; if (cursorTrail) cursorTrail.style.opacity='1'; }

  function syncNavBtn(on) {
    const btn = document.getElementById('btn-gaze');
    if (btn) { btn.classList.toggle('active', on); btn.setAttribute('aria-pressed', String(on)); }
  }

  function syncDemoBtn(on) {
    const btn = document.getElementById('gaze-toggle-btn');
    if (!btn) return;
    btn.textContent = on ? 'Disable Eye Tracking' : 'Enable Eye Tracking';
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
    const sub = document.querySelector('.gaze-controls .subtitle');
    if (sub) sub.textContent = on
      ? (mode === 'real' ? 'WebGazer.js...webcam active' : 'Mouse simulation active')
      : 'Click to choose eye tracking mode';
  }

  function showBanner(msg) {
    hideBanner();
    const d = el('div','wg-banner');
    d.setAttribute('role','status'); d.setAttribute('aria-live','polite');
    d.style.cssText = `position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);
      background:#13131a;border:1px solid #2a2a3d;border-radius:12px;
      padding:1rem 2rem;font-family:'DM Mono',monospace;font-size:0.8rem;
      color:#38bdf8;z-index:10000;white-space:nowrap;
      box-shadow:0 0 30px rgba(56,189,248,0.15);`;
    d.textContent = msg;
    document.body.appendChild(d);
  }

  function hideBanner() { document.getElementById('wg-banner')?.remove(); }

  function showError(msg) {
    const d = document.createElement('div');
    d.setAttribute('role','alert');
    d.style.cssText = `position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);
      background:#1a0f0f;border:1px solid #f87171;border-radius:12px;
      padding:1rem 2rem;font-family:'DM Mono',monospace;font-size:0.78rem;
      color:#f87171;z-index:10000;max-width:90vw;text-align:center;`;
    d.textContent = '⚠ ' + msg;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 7000);
  }

  function toast(msg, duration = 4000) {
    const d = document.createElement('div');
    d.setAttribute('role','status'); d.setAttribute('aria-live','polite');
    d.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;
      background:#13131a;border:1px solid #2a2a3d;border-radius:12px;
      padding:0.85rem 1.25rem;font-family:'DM Mono',monospace;font-size:0.72rem;
      color:#7a7a9a;z-index:9000;max-width:280px;line-height:1.6;transition:opacity 0.5s;`;
    d.innerHTML = msg;
    document.body.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; }, duration);
    setTimeout(() => d.remove(), duration + 600);
  }

  function loadScript(src) {
    if (typeof webgazer !== 'undefined') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  function el(tag, id) {
    const e = document.createElement(tag);
    if (id) e.id = id;
    return e;
  }

  function recalibrate() {
    if (mode !== 'real') return;
    smoothX = null; smoothY = null;
    window.hideScrollZones?.();
    showCalibrationUI();
  }

  return { enable, disable, recalibrate, get mode() { return mode; } };
})();
