// ==========================================
// AVIATOR CRASH - GLOBAL SYNC VERSION
// ==========================================

// ==========================================
// TELEGRAM
// ==========================================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const user = tg.initDataUnsafe?.user;
const userName = user?.first_name || 'Guest';
const userUsername = user?.username ? '@' + user.username : '';
const userId = user?.id || 'guest';

document.getElementById('lobbyName').textContent = userName;
document.getElementById('lobbyUsername').textContent = userUsername;
document.getElementById('lobbyAvatar').textContent = userName.charAt(0).toUpperCase();

// ==========================================
// STORAGE KEYS
// ==========================================
const STORAGE_KEY_BALANCE = 'aviator_balance_' + userId;
const STORAGE_KEY_HISTORY = 'aviator_history_' + userId;
const STORAGE_KEY_CRASHES = 'aviator_crashes_global'; // <- تغییر: جهانی شد

// ==========================================
// BALANCE (مخصوص هر کاربر)
// ==========================================
let balance = parseFloat(localStorage.getItem(STORAGE_KEY_BALANCE)) || 1000;

function updateBalanceUI() {
    document.getElementById('lobbyBalance').textContent = '$' + balance.toFixed(2);
    document.getElementById('gameBalance').textContent = '$' + balance.toFixed(2);
    localStorage.setItem(STORAGE_KEY_BALANCE, balance);
}
updateBalanceUI();

// ==========================================
// DEPOSIT
// ==========================================
function depositTon(amount) {
    const usdAmount = amount * 1.25;
    balance += usdAmount;
    updateBalanceUI();
    alert('✅ Deposited ' + amount + ' TON ($' + usdAmount.toFixed(2) + ')');
}

document.querySelectorAll('.ton-amount').forEach(btn => {
    btn.addEventListener('click', function() {
        depositTon(parseInt(this.dataset.amount));
        document.getElementById('depositModal').classList.add('hidden');
    });
});

function depositCustomTon() {
    const input = document.getElementById('customTonAmount');
    const amount = parseInt(input.value);
    if (amount && amount > 0) {
        depositTon(amount);
        input.value = '';
        document.getElementById('depositModal').classList.add('hidden');
    }
}

document.getElementById('depositBtn').addEventListener('click', function() {
    document.getElementById('depositModal').classList.remove('hidden');
});

// ==========================================
// HISTORY (مخصوص هر کاربر)
// ==========================================
let gameHistory = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)) || [];

function updateHistoryList() {
    const list = document.getElementById('historyList');
    if (!list) return;
    list.innerHTML = '';
    gameHistory.slice(0, 20).forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = item.text;
        if (item.type === 'win') div.style.color = '#4CAF50';
        else if (item.type === 'lose') div.style.color = '#ff4444';
        else div.style.color = '#ff8c00';
        list.appendChild(div);
    });
}

function addHistory(text, type) {
    gameHistory.unshift({ text, type });
    if (gameHistory.length > 50) gameHistory.pop();
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(gameHistory));
    updateHistoryList();
}
updateHistoryList();

// ==========================================
// CRASH HISTORY (GLOBAL - برای همه یکسان)
// ==========================================
let crashHistory = JSON.parse(localStorage.getItem(STORAGE_KEY_CRASHES)) || [];

function updateCrashHistoryBar() {
    const el = document.getElementById('crashHistoryList');
    if (!el) return;
    el.innerHTML = '';
    const lastFive = crashHistory.slice(-5).reverse();
    lastFive.forEach(v => {
        const span = document.createElement('span');
        span.textContent = v.toFixed(2) + 'x';
        if (v < 1.5) span.style.color = '#4CAF50';
        else if (v < 2.5) span.style.color = '#ffd700';
        else if (v < 4) span.style.color = '#ff8c00';
        else if (v < 6) span.style.color = '#ff6b6b';
        else span.style.color = '#ff4444';
        el.appendChild(span);
    });
}
updateCrashHistoryBar();

// ==========================================
// ELEMENTS
// ==========================================
const multiplierDisplay = document.getElementById('multiplierDisplay');
const gameStatus = document.getElementById('gameStatus');
const countdownDisplay = document.getElementById('countdownDisplay');
const betBtn = document.getElementById('betBtn');
const cancelBtn = document.getElementById('cancelBtn');
const cashBtn = document.getElementById('cashBtn');
const betInput = document.getElementById('betInput');
const resultEl = document.getElementById('result');
const canvas = document.getElementById('chartCanvas');
const ctx = canvas.getContext('2d');

// ==========================================
// GLOBAL GAME STATE (مشترک برای همه)
// ==========================================
let globalGameState = {
    multiplier: 1.00,
    isPlaying: false,
    isCrashed: false,
    crashPoint: 0,
    phase: 'countdown', // 'countdown' | 'playing' | 'crashed'
    countdown: 10,
    roundStartTime: 0,
    chartHistory: [],
    roundId: 0
};

// ==========================================
// LOCAL STATE (مخصوص هر کاربر)
// ==========================================
let hasBet = false;
let betAmount = 0;
let isCashedOut = false;
let totalBets = 0;
let totalWins = 0;
let totalBetAmount = 0;
let autoBetActive = false;
let autoBetMultiplier = 2.00;
let chartHistory = [];

// ==========================================
// SPEED CONFIG
// ==========================================
function getSpeed(m) {
    if (m < 2) return 1/6;
    if (m < 3) return 1/4;
    if (m < 4) return 1/3;
    if (m < 5) return 1/2;
    return 0.5 + Math.log(m - 4) * 0.08;
}

// ==========================================
// GENERATE CRASH POINT
// ==========================================
function generateCrashPoint() {
    const r = Math.random() * 100;
    if (r < 20) return 1.00;
    if (r < 60) return 1.01 + ((r - 20) / 40) * 0.98;
    if (r < 80) return 2.00 + ((r - 60) / 20) * 0.99;
    if (r < 90) return 3.00 + ((r - 80) / 10) * 2.99;
    if (r < 95) return 6.00 + ((r - 90) / 5) * 3.99;
    if (r < 98) return 10.00 + ((r - 95) / 3) * 4.99;
    if (r < 99.8) return 15.00 + ((r - 98) / 1.8) * 9.99;
    return 25.00 + ((r - 99.8) / 0.2) * 74.99;
}

// ==========================================
// DRAW CHART (با داده‌های جهانی)
// ==========================================
function drawChart(value) {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0d0d2b');
    bgGrad.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
        const y = 20 + i * 38;
        ctx.beginPath();
        ctx.moveTo(30, y);
        ctx.lineTo(w - 15, y);
        ctx.stroke();
    }

    // استفاده از chartHistory جهانی
    const globalChart = globalGameState.chartHistory;
    if (globalChart.length < 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✈️ Waiting for flight...', w/2, h/2);
        return;
    }

    const maxVal = Math.max(2, ...globalChart);
    const minVal = 1;
    const range = maxVal - minVal || 1;
    const padding = { top: 20, bottom: 30, left: 35, right: 25 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Main line
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#ffd700');
    grad.addColorStop(0.4, '#ffaa00');
    grad.addColorStop(0.7, '#ff8c00');
    grad.addColorStop(1, '#ff4500');

    ctx.beginPath();
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const points = [];
    for (let i = 0; i < globalChart.length; i++) {
        const x = padding.left + (i / 100) * chartW;
        const y = padding.top + chartH - ((globalChart[i] - minVal) / range) * chartH;
        const clampedY = Math.max(padding.top, Math.min(padding.top + chartH, y));
        points.push({ x, y: clampedY });
        if (i === 0) ctx.moveTo(x, clampedY);
        else ctx.lineTo(x, clampedY);
    }
    ctx.stroke();

    // Fill under line
    const lastPoint = points[points.length - 1];
    ctx.lineTo(lastPoint.x, padding.top + chartH);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    fillGrad.addColorStop(0, 'rgba(255,215,0,0.12)');
    fillGrad.addColorStop(0.5, 'rgba(255,215,0,0.05)');
    fillGrad.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Display points and multipliers
    const step = Math.max(1, Math.floor(globalChart.length / 12));
    for (let i = step; i < globalChart.length; i += step) {
        const x = padding.left + (i / 100) * chartW;
        const y = padding.top + chartH - ((globalChart[i] - minVal) / range) * chartH;
        const clampedY = Math.max(padding.top, Math.min(padding.top + chartH, y));
        
        ctx.beginPath();
        ctx.arc(x, clampedY, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = 'rgba(255,215,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        const label = globalChart[i].toFixed(2) + 'x';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, x, clampedY - 6);
    }

    // Last point
    if (points.length > 0) {
        const lastP = points[points.length - 1];
        ctx.beginPath();
        ctx.arc(lastP.x, lastP.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = 'rgba(255,215,0,0.5)';
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        const lastLabel = globalChart[globalChart.length - 1].toFixed(2) + 'x';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(lastLabel, lastP.x, lastP.y - 10);
    }

    // ===== PLANE =====
    if (points.length > 0) {
        const lastP = points[points.length - 1];
        const px = lastP.x;
        const py = lastP.y;

        // Glow
        const glow = ctx.createRadialGradient(px, py, 2, px, py, 35);
        if (globalGameState.isCrashed) {
            glow.addColorStop(0, 'rgba(255,50,50,0.25)');
            glow.addColorStop(1, 'rgba(255,50,50,0)');
        } else {
            glow.addColorStop(0, 'rgba(255,215,0,0.2)');
            glow.addColorStop(1, 'rgba(255,215,0,0)');
        }
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, 35, 0, Math.PI * 2);
        ctx.fill();

        // Plane
        ctx.save();
        ctx.translate(px, py);

        let angle = -Math.PI / 2;
        if (points.length > 2) {
            const prev = points[points.length - 2];
            const curr = points[points.length - 1];
            const dx = curr.x - prev.x || 1;
            const dy = curr.y - prev.y;
            angle = Math.atan2(-dy, dx);
        }
        ctx.rotate(angle);

        ctx.shadowColor = 'rgba(255,215,0,0.3)';
        ctx.shadowBlur = 15;

        // Body
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.bezierCurveTo(6, -12, 9, -6, 10, 0);
        ctx.bezierCurveTo(9, 6, 6, 12, 0, 14);
        ctx.bezierCurveTo(-6, 12, -9, 6, -10, 0);
        ctx.bezierCurveTo(-9, -6, -6, -12, 0, -16);
        ctx.closePath();
        const planeGrad = ctx.createLinearGradient(0, -16, 0, 14);
        planeGrad.addColorStop(0, '#ffd700');
        planeGrad.addColorStop(0.3, '#ffb800');
        planeGrad.addColorStop(0.6, '#ff9500');
        planeGrad.addColorStop(0.8, '#ff6a00');
        planeGrad.addColorStop(1, '#ff4500');
        ctx.fillStyle = planeGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Wings
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,200,100,0.5)';
        ctx.beginPath();
        ctx.moveTo(-2, -3);
        ctx.lineTo(-14, -10);
        ctx.lineTo(-14, -6);
        ctx.lineTo(-3, -2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(2, -3);
        ctx.lineTo(14, -10);
        ctx.lineTo(14, -6);
        ctx.lineTo(3, -2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(255,180,100,0.25)';
        ctx.beginPath();
        ctx.moveTo(-2, 3);
        ctx.lineTo(-10, 8);
        ctx.lineTo(-10, 5);
        ctx.lineTo(-2, 2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(2, 3);
        ctx.lineTo(10, 8);
        ctx.lineTo(10, 5);
        ctx.lineTo(2, 2);
        ctx.closePath();
        ctx.fill();

        // Tail
        ctx.fillStyle = 'rgba(255,200,100,0.4)';
        ctx.beginPath();
        ctx.moveTo(-1, 10);
        ctx.lineTo(-5, 15);
        ctx.lineTo(0, 12);
        ctx.lineTo(0, 10);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(1, 10);
        ctx.lineTo(5, 15);
        ctx.lineTo(0, 12);
        ctx.lineTo(0, 10);
        ctx.closePath();
        ctx.fill();

        // Cockpit
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(0, -5, 4, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100,200,255,0.2)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100,200,255,0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Front window
        ctx.beginPath();
        ctx.ellipse(0, -3, 2.5, 3, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100,200,255,0.15)';
        ctx.fill();

        // Lights
        if (!globalGameState.isCrashed) {
            const blink1 = 0.3 + Math.sin(Date.now() / 200) * 0.3;
            ctx.shadowColor = 'rgba(255,50,50,0.6)';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(-7, -4, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,0,0,${blink1})`;
            ctx.fill();
            
            const blink2 = 0.3 + Math.sin(Date.now() / 200 + 1) * 0.3;
            ctx.shadowColor = 'rgba(50,255,50,0.6)';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(7, -4, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0,255,0,${blink2})`;
            ctx.fill();

            // Fire
            ctx.shadowBlur = 0;
            const fireLen = 4 + Math.sin(Date.now() / 80) * 2;
            ctx.shadowColor = 'rgba(255,100,0,0.4)';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(-3, 13);
            ctx.quadraticCurveTo(0, 13 + fireLen, 3, 13);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,100,0,0.4)';
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(-2, 12);
            ctx.quadraticCurveTo(0, 12 + fireLen * 0.6, 2, 12);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,200,50,0.25)';
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        ctx.restore();

        // Crash effect
        if (globalGameState.isCrashed) {
            for (let i = 0; i < 14; i++) {
                const a = Math.random() * Math.PI * 2;
                const len = 8 + Math.random() * 30;
                const x1 = px + Math.cos(a) * 4;
                const y1 = py + Math.sin(a) * 4;
                const x2 = px + Math.cos(a) * (4 + len);
                const y2 = py + Math.sin(a) * (4 + len);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = `rgba(255,50,50,${0.15 + Math.random() * 0.3})`;
                ctx.lineWidth = 1.5 + Math.random() * 2;
                ctx.shadowColor = 'rgba(255,50,50,0.15)';
                ctx.shadowBlur = 8;
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }
    }

    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Time', w/2, h - 18);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('x', 12, padding.top + 10);
}

// ==========================================
// UPDATE UI (با داده‌های جهانی)
// ==========================================
function updateUIFromGlobalState() {
    const state = globalGameState;
    const multiplier = state.multiplier;
    
    multiplierDisplay.innerHTML = multiplier.toFixed(2) + '<span class="unit">x</span>';
    
    if (multiplier < 1.5) multiplierDisplay.style.color = '#4CAF50';
    else if (multiplier < 2.5) multiplierDisplay.style.color = '#ffd700';
    else if (multiplier < 4) multiplierDisplay.style.color = '#ff8c00';
    else if (multiplier < 6) multiplierDisplay.style.color = '#ff6b6b';
    else multiplierDisplay.style.color = '#ff4444';
    
    if (state.phase === 'countdown') {
        multiplierDisplay.className = 'multiplier';
        gameStatus.textContent = '⏳ Place your bet! ' + state.countdown + 's';
        countdownDisplay.textContent = state.countdown;
        betBtn.style.display = 'block';
        cancelBtn.style.display = hasBet ? 'block' : 'none';
        cashBtn.style.display = 'none';
    } else if (state.phase === 'playing') {
        gameStatus.textContent = '✈️ Flying...';
        countdownDisplay.textContent = '';
        betBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        cashBtn.style.display = (hasBet && !isCashedOut) ? 'block' : 'none';
        if (hasBet && !isCashedOut) {
            cashBtn.textContent = '💰 Cash Out at ' + multiplier.toFixed(2) + 'x';
        }
    } else if (state.phase === 'crashed') {
        multiplierDisplay.className = 'multiplier crashed';
        gameStatus.textContent = '💥 CRASHED!';
        countdownDisplay.textContent = '';
        betBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        cashBtn.style.display = 'none';
    }
    
    drawChart(multiplier);
    updatePlayers();
}

// ==========================================
// UPDATE PLAYERS
// ==========================================
function updatePlayers() {
    const playersList = document.getElementById('playersList');
    if (!playersList) return;
    playersList.innerHTML = '';
    
    if (hasBet) {
        const li = document.createElement('div');
        li.className = 'history-item user-bet';
        li.innerHTML = `<span>👤 ${userName}</span><span>💰 $${betAmount.toFixed(2)}</span><span>🎯 ${globalGameState.multiplier.toFixed(2)}x</span>`;
        playersList.appendChild(li);
    } else {
        const li = document.createElement('div');
        li.style.textAlign = 'center';
        li.style.color = '#666';
        li.style.padding = '4px';
        li.textContent = 'No players yet';
        playersList.appendChild(li);
    }
}

// ==========================================
// UPDATE STATS
// ==========================================
function updateStats() {
    document.getElementById('totalBets').textContent = totalBets.toLocaleString();
    document.getElementById('totalWins').textContent = '$' + totalWins.toFixed(2);
    document.getElementById('totalBetAmount').textContent = '$' + totalBetAmount.toFixed(2);
}

// ==========================================
// CASH OUT
// ==========================================
function cashOut() {
    if (!hasBet || isCashedOut || globalGameState.isCrashed || globalGameState.phase !== 'playing') {
        resultEl.textContent = '⚠️ Cannot cash out now!';
        resultEl.style.color = '#ff8c00';
        return;
    }
    
    isCashedOut = true;
    const winAmount = betAmount * globalGameState.multiplier;
    balance += winAmount;
    totalWins += winAmount;
    updateBalanceUI();
    
    const msg = '🎉 Won $' + winAmount.toFixed(2) + ' (' + globalGameState.multiplier.toFixed(2) + 'x)';
    resultEl.textContent = msg;
    resultEl.style.color = '#4CAF50';
    cashBtn.style.display = 'none';
    addHistory(msg, 'win');
    updateStats();
    
    hasBet = false;
    betAmount = 0;
    isCashedOut = false;
    betBtn.style.display = 'block';
    updatePlayers();
}

// ==========================================
// CANCEL BET
// ==========================================
function cancelBet() {
    if (!hasBet || globalGameState.phase !== 'countdown') {
        resultEl.textContent = '⚠️ Cannot cancel now!';
        resultEl.style.color = '#ff8c00';
        return;
    }
    
    balance += betAmount;
    updateBalanceUI();
    hasBet = false;
    betAmount = 0;
    cancelBtn.style.display = 'none';
    betBtn.style.display = 'block';
    resultEl.textContent = '🔄 Bet cancelled!';
    resultEl.style.color = '#ff8c00';
    updatePlayers();
}

// ==========================================
// PLACE BET
// ==========================================
function placeBet() {
    if (globalGameState.phase !== 'countdown') {
        resultEl.textContent = '⏳ Wait for betting phase!';
        resultEl.style.color = '#ff8c00';
        return;
    }
    if (hasBet) {
        resultEl.textContent = '⏳ You already bet!';
        resultEl.style.color = '#ff8c00';
        return;
    }
    
    let bet = parseFloat(betInput.value);
    if (isNaN(bet) || bet < 0.1) {
        resultEl.textContent = '⚠️ Minimum bet is $0.1';
        resultEl.style.color = '#ff8c00';
        return;
    }
    if (bet > balance) {
        resultEl.textContent = '⚠️ Insufficient balance!';
        resultEl.style.color = '#ff4444';
        return;
    }
    
    betAmount = bet;
    balance -= bet;
    totalBetAmount += bet;
    hasBet = true;
    isCashedOut = false;
    
    updateBalanceUI();
    betBtn.style.display = 'none';
    cancelBtn.style.display = 'block';
    cashBtn.style.display = 'none';
    resultEl.textContent = '✅ Bet $' + bet.toFixed(2) + ' placed!';
    resultEl.style.color = '#4CAF50';
    updateStats();
    updatePlayers();
}

// ==========================================
// GLOBAL GAME LOOP (همگام برای همه)
// ==========================================
function globalGameLoop() {
    // ===== COUNTDOWN =====
    if (globalGameState.phase === 'countdown') {
        globalGameState.countdown--;
        if (globalGameState.countdown <= 0) {
            globalGameState.phase = 'playing';
            globalGameState.multiplier = 1.00;
            globalGameState.crashPoint = generateCrashPoint();
            globalGameState.roundStartTime = Date.now();
            globalGameState.isPlaying = true;
            globalGameState.isCrashed = false;
            globalGameState.chartHistory = [];
            globalGameState.roundId++;
            
            // Auto bet
            if (autoBetActive && !hasBet) {
                const autoBetAmount = parseFloat(betInput.value) || 10;
                if (autoBetAmount <= balance) {
                    betAmount = autoBetAmount;
                    balance -= betAmount;
                    totalBetAmount += betAmount;
                    hasBet = true;
                    isCashedOut = false;
                    updateBalanceUI();
                }
            }
        }
        return;
    }
    
    // ===== PLAYING =====
    if (globalGameState.phase === 'playing') {
        const elapsed = (Date.now() - globalGameState.roundStartTime) / 1000;
        const speed = getSpeed(globalGameState.multiplier);
        globalGameState.multiplier += speed * 0.05;
        globalGameState.multiplier = Math.round(globalGameState.multiplier * 100) / 100;
        globalGameState.chartHistory.push(globalGameState.multiplier);
        if (globalGameState.chartHistory.length > 100) globalGameState.chartHistory.shift();
        
        // Auto cash out
        if (autoBetActive && hasBet && !isCashedOut && globalGameState.multiplier >= autoBetMultiplier) {
            cashOut();
        }
        
        // Check crash
        if (globalGameState.multiplier >= globalGameState.crashPoint) {
            // ===== CRASHED =====
            globalGameState.phase = 'crashed';
            globalGameState.isCrashed = true;
            globalGameState.isPlaying = false;
            crashHistory.push(globalGameState.multiplier);
            localStorage.setItem(STORAGE_KEY_CRASHES, JSON.stringify(crashHistory));
            updateCrashHistoryBar();
            
            // Process losing bet
            if (hasBet && !isCashedOut) {
                const msg = '💔 Lost $' + betAmount.toFixed(2) + ' (' + globalGameState.multiplier.toFixed(2) + 'x)';
                resultEl.textContent = msg;
                resultEl.style.color = '#ff4444';
                addHistory(msg, 'lose');
                hasBet = false;
                betAmount = 0;
                isCashedOut = false;
            }
            
            // ===== WAIT 1.5 SECONDS THEN COUNTDOWN =====
            setTimeout(() => {
                globalGameState.phase = 'countdown';
                globalGameState.countdown = 10;
                globalGameState.isCrashed = false;
                globalGameState.chartHistory = [];
                if (!hasBet) betBtn.style.display = 'block';
                cancelBtn.style.display = 'none';
                cashBtn.style.display = 'none';
                updatePlayers();
                
                setTimeout(() => {
                    if (resultEl.textContent.includes('Lost') || resultEl.textContent.includes('CRASHED')) {
                        resultEl.textContent = '';
                    }
                }, 2000);
                
            }, 1500);
        }
    }
}

// ==========================================
// START
// ==========================================
function startGlobalGame() {
    globalGameState.phase = 'countdown';
    globalGameState.countdown = 10;
    globalGameState.multiplier = 1.00;
    globalGameState.isPlaying = false;
    globalGameState.isCrashed = false;
    globalGameState.chartHistory = [];
    
    setInterval(globalGameLoop, 100);
    setInterval(updateUIFromGlobalState, 100);
}

// ==========================================
// BUTTONS
// ==========================================
betBtn.addEventListener('click', placeBet);
cancelBtn.addEventListener('click', cancelBet);
cashBtn.addEventListener('click', cashOut);

// ==========================================
// QUICK BETS
// ==========================================
document.querySelectorAll('.quick-bets button').forEach(function(btn) {
    btn.addEventListener('click', function() {
        betInput.value = this.dataset.amount;
        document.querySelectorAll('.quick-bets button').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
    });
});

// ==========================================
// AUTO BET
// ==========================================
document.getElementById('autoBetBtn').addEventListener('click', function() {
    const input = document.getElementById('autoBetInput');
    const val = parseFloat(input.value);
    if (val > 1.00) {
        autoBetMultiplier = val;
        autoBetActive = !autoBetActive;
        this.textContent = autoBetActive ? '⏹ Stop' : '▶ Start';
        this.classList.toggle('active');
    }
});

// ==========================================
// LOBBY
// ==========================================
function startGameFromLobby() {}
function stopGame() {}

// ==========================================
// TELEGRAM
// ==========================================
tg.MainButton.setText("❌ Close");
tg.MainButton.show();
tg.MainButton.onClick(function() {
    tg.close();
});

// ==========================================
// INIT
// ==========================================
startGlobalGame();
updateHistoryList();
