// ---- Config -----------------------------------------------------------
// Point this at your backend. During local dev with the Vite/static server
// on a different port than the backend, set this explicitly.
const API_BASE = window.CRASH_API_BASE || 'http://localhost:3000';

// ---- Telegram WebApp bootstrap ----------------------------------------
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();
tg?.setHeaderColor?.('#0a0d13');
tg?.setBackgroundColor?.('#0a0d13');

// Fallback initData for testing outside Telegram (the backend will reject
// this in real use — see README "Testing without Telegram" section).
const initData = tg?.initData || '';

// ---- State --------------------------------------------------------------
let socket = null;
let userId = null;
let balance = 0;
let roundStatus = 'idle'; // idle | betting | running | crashed
let hasActiveBet = false;
let lastCrashPoints = [];

const el = {
  balance: document.getElementById('balance'),
  multiplier: document.getElementById('multiplier'),
  phaseLabel: document.getElementById('phase-label'),
  seedHash: document.getElementById('seed-hash'),
  betAmount: document.getElementById('bet-amount'),
  actionBtn: document.getElementById('action-btn'),
  statusLine: document.getElementById('status-line'),
  historyStrip: document.getElementById('history-strip'),
  gauge: document.getElementById('gauge'),
};

const ctx = el.gauge.getContext('2d');

// ---- Gauge rendering ------------------------------------------------------
const GAUGE_MAX = 20; // multiplier value at which the needle pins at max
const START_ANGLE = (3 / 4) * Math.PI; // 135°, bottom-left
const SWEEP = (3 / 2) * Math.PI; // 270°
const MAJOR_TICKS = [1, 2, 3, 5, 8, 10, 15, 20];

function setupCanvasScaling() {
  const dpr = window.devicePixelRatio || 1;
  const size = el.gauge.clientWidth || 340;
  el.gauge.width = size * dpr;
  el.gauge.height = size * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function fractionForMultiplier(m) {
  const clamped = Math.max(1, Math.min(m, GAUGE_MAX));
  return Math.log(clamped) / Math.log(GAUGE_MAX);
}

function drawGauge(multiplier, status) {
  const size = el.gauge.clientWidth || 340;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;

  ctx.clearRect(0, 0, size, size);

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, START_ANGLE, START_ANGLE + SWEEP, false);
  ctx.strokeStyle = '#232c3d';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Progress trail
  const frac = fractionForMultiplier(multiplier);
  const isCrashed = status === 'crashed';
  ctx.beginPath();
  ctx.arc(cx, cy, r, START_ANGLE, START_ANGLE + SWEEP * frac, false);
  ctx.strokeStyle = isCrashed ? '#e5484d' : '#ffb000';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.shadowColor = isCrashed ? 'rgba(229,72,77,0.55)' : 'rgba(255,176,0,0.55)';
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Major ticks + labels
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.fillStyle = '#8b93a7';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  MAJOR_TICKS.forEach((val) => {
    const f = fractionForMultiplier(val);
    const angle = START_ANGLE + SWEEP * f;
    const inner = r - 16;
    const outer = r - 6;
    const x1 = cx + Math.cos(angle) * inner;
    const y1 = cy + Math.sin(angle) * inner;
    const x2 = cx + Math.cos(angle) * outer;
    const y2 = cy + Math.sin(angle) * outer;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#3a4457';
    ctx.lineWidth = 2;
    ctx.stroke();

    const lx = cx + Math.cos(angle) * (r - 30);
    const ly = cy + Math.sin(angle) * (r - 30);
    ctx.fillText(`${val}×`, lx, ly);
  });

  // Needle
  const needleAngle = START_ANGLE + SWEEP * frac;
  const needleLen = r - 24;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needleAngle) * needleLen, cy + Math.sin(needleAngle) * needleLen);
  ctx.strokeStyle = isCrashed ? '#e5484d' : '#4fd1c5';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Hub
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = isCrashed ? '#e5484d' : '#4fd1c5';
  ctx.fill();
}

window.addEventListener('resize', () => {
  setupCanvasScaling();
  drawGauge(currentMultiplierDisplay(), roundStatus);
});

function currentMultiplierDisplay() {
  return parseFloat(el.multiplier.textContent) || 1.0;
}

// ---- UI helpers -----------------------------------------------------------
function setBalance(v) {
  balance = v;
  el.balance.textContent = v.toLocaleString('en-US');
}

function setMultiplier(m, status) {
  el.multiplier.textContent = `${m.toFixed(2)}×`;
  el.multiplier.classList.toggle('crashed', status === 'crashed');
  drawGauge(m, status);
}

function setStatus(text, kind) {
  el.statusLine.textContent = text;
  el.statusLine.className = 'status-line' + (kind ? ' ' + kind : '');
}

function pushHistory(crashPoint) {
  lastCrashPoints.unshift(crashPoint);
  lastCrashPoints = lastCrashPoints.slice(0, 15);
  el.historyStrip.innerHTML = '';
  lastCrashPoints.forEach((cp) => {
    const chip = document.createElement('div');
    chip.className = 'history-chip' + (cp >= 2 ? ' hot' : cp < 1.2 ? ' bust' : '');
    chip.textContent = `${cp.toFixed(2)}×`;
    el.historyStrip.appendChild(chip);
  });
}

function updateActionButton() {
  el.actionBtn.disabled = false;
  if (roundStatus === 'betting') {
    if (hasActiveBet) {
      el.actionBtn.textContent = 'Bet placed — waiting for takeoff';
      el.actionBtn.className = 'action-btn waiting';
      el.actionBtn.disabled = true;
    } else {
      el.actionBtn.textContent = 'Place Bet';
      el.actionBtn.className = 'action-btn place';
    }
  } else if (roundStatus === 'running') {
    if (hasActiveBet) {
      const m = currentMultiplierDisplay();
      const amount = parseInt(el.betAmount.value, 10) || 0;
      el.actionBtn.textContent = `Cash Out — ${Math.floor(amount * m).toLocaleString('en-US')} coins`;
      el.actionBtn.className = 'action-btn cashout';
    } else {
      el.actionBtn.textContent = 'In flight… betting closed';
      el.actionBtn.className = 'action-btn waiting';
      el.actionBtn.disabled = true;
    }
  } else if (roundStatus === 'crashed') {
    el.actionBtn.textContent = 'Crashed — waiting for next round';
    el.actionBtn.className = 'action-btn waiting';
    el.actionBtn.disabled = true;
  }
}

// ---- Bet amount controls ---------------------------------------------
document.querySelectorAll('.rocker').forEach((btn) => {
  btn.addEventListener('click', () => {
    const step = parseInt(btn.dataset.step, 10);
    const next = Math.max(10, (parseInt(el.betAmount.value, 10) || 0) + step);
    el.betAmount.value = next;
  });
});
document.querySelectorAll('.chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    el.betAmount.value = btn.dataset.amount;
  });
});

// ---- Main action button (place bet / cash out) -------------------------
el.actionBtn.addEventListener('click', () => {
  if (roundStatus === 'betting' && !hasActiveBet) {
    const amount = parseInt(el.betAmount.value, 10);
    if (!amount || amount <= 0) return setStatus('Invalid amount', 'danger');
    if (amount > balance) return setStatus('Insufficient balance', 'danger');

    socket.emit('place_bet', { amount }, (res) => {
      if (res.ok) {
        hasActiveBet = true;
        setBalance(res.balance);
        setStatus('Bet placed. Waiting for takeoff…', 'success');
        updateActionButton();
      } else {
        setStatus(res.error, 'danger');
      }
    });
  } else if (roundStatus === 'running' && hasActiveBet) {
    socket.emit('cash_out', {}, (res) => {
      if (res.ok) {
        hasActiveBet = false;
        setBalance(res.balance);
        setStatus(`Cashed out at ${res.multiplier.toFixed(2)}× — won ${res.payout.toLocaleString('en-US')} coins`, 'success');
        updateActionButton();
      } else {
        setStatus(res.error, 'danger');
      }
    });
  }
});

// ---- Boot: authenticate, then connect socket ----------------------------
async function boot() {
  setupCanvasScaling();
  drawGauge(1.0, 'idle');

  if (!initData) {
    setStatus('Running outside Telegram — open from inside the bot for a real test', 'danger');
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'auth failed');

    userId = data.user.id;
    setBalance(data.user.balance);

    socket = io(API_BASE, { transports: ['websocket'] });

    socket.on('connect', () => {
      socket.emit('identify', { initData }, (ack) => {
        if (ack.ok) setBalance(ack.balance);
      });
    });

    socket.on('state', (s) => {
      roundStatus = s.status;
      setMultiplier(s.multiplier, s.status);
      el.seedHash.textContent = s.serverSeedHash ? s.serverSeedHash.slice(0, 24) + '…' : '—';
      updateActionButton();
    });

    socket.on('betting_open', (p) => {
      roundStatus = 'betting';
      hasActiveBet = false;
      setMultiplier(1.0, 'betting');
      el.phaseLabel.textContent = 'Betting open…';
      el.seedHash.textContent = p.serverSeedHash.slice(0, 24) + '…';
      setStatus('', null);
      updateActionButton();
    });

    socket.on('round_started', () => {
      roundStatus = 'running';
      el.phaseLabel.textContent = 'In flight';
      updateActionButton();
    });

    socket.on('tick', (t) => {
      setMultiplier(t.multiplier, 'running');
      updateActionButton();
    });

    socket.on('crashed', (c) => {
      roundStatus = 'crashed';
      setMultiplier(c.crashPoint, 'crashed');
      el.phaseLabel.textContent = 'Crashed';
      pushHistory(c.crashPoint);
      if (hasActiveBet) {
        setStatus('Bet busted', 'danger');
        hasActiveBet = false;
      }
      updateActionButton();
    });

    socket.on('player_cashed_out', () => {
      // Could show a live feed of other players cashing out here.
    });
  } catch (err) {
    setStatus(`Connection error: ${err.message}`, 'danger');
  }
}

boot();
