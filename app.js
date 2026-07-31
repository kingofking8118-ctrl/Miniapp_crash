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
// STORAGE
// ==========================================
const STORAGE_KEY_BALANCE = 'crash_balance_' + userId;
const STORAGE_KEY_HISTORY = 'crash_history_' + userId;
const STORAGE_KEY_CRASHES = 'crash_crashes_' + userId;

// ==========================================
// BALANCE
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
// HISTORY
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
// CRASH HISTORY (5 last)
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
// GAME STATE
// ==========================================
let multiplier = 1.00;
let isPlaying = false;
let isCrashed = false;
let crashPoint = 0;
let hasBet = false;
let betAmount = 0;
let isCashedOut = false;
let countdown = 10;
let isWaiting = false;
let gameLoopId = null;
let countdownLoopId = null;
let autoBetActive = false;
let autoBetMultiplier = 2.00;
let chartHistory = [];
let totalBets = 0;
let totalWins = 0;
let totalBetAmount = 0;

// ==========================================
// SPEED CONFIG - 1→2: 6s, 2→3: 4s, 3→4: 3s, 4→5: 2s
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
// DRAW CHART WITH ROCKET
// ==========================================
function drawChart(value) {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255,215,0,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
        const y = 30 + i * 35;
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(w - 20, y);
        ctx.stroke();
    }

    chartHistory.push(value);
    if (chartHistory.length > 100) chartHistory.shift();

    if (chartHistory.length < 2) {
        ctx.fillStyle = '#444';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🚀 Waiting for flight...', w/2, h/2);
        return;
    }

    const maxVal = Math.max(2, ...chartHistory);
    const minVal = 1;
    const range = maxVal - minVal || 1;
    const padding = { top: 20, bottom: 25, left: 30, right: 20 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Gradient line
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#ffd700');
    grad.addColorStop(0.5, '#ff8c00');
    grad.addColorStop(1, '#ff4500');

    ctx.beginPath();
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = 0; i < chartHistory.length; i++) {
        const x = padding.left + (i / 100) * chartW;
        const y = padding.top + chartH - ((chartHistory[i] - minVal) / range) * chartH;
        const clampedY = Math.max(padding.top, Math.min(padding.top + chartH, y));
        if (i === 0) ctx.moveTo(x, clampedY);
        else ctx.lineTo(x, clampedY);
    }
    ctx.stroke();

    // Fill under line
    const lastX = padding.left + ((chartHistory.length - 1) / 100) * chartW;
    const lastY = padding.top + chartH - ((chartHistory[chartHistory.length - 1] - minVal) / range) * chartH;
    const clampedLastY = Math.max(padding.top, Math.min(padding.top + chartH, lastY));
    
    ctx.lineTo(lastX, padding.top + chartH);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    fillGrad.addColorStop(0, 'rgba(255,215,0,0.1)');
    fillGrad.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // ===== ROCKET 🚀 =====
    if (chartHistory.length > 0) {
        const lastIdx = chartHistory.length - 1;
        const px = padding.left + (lastIdx / 100) * chartW;
        const py = padding.top + chartH - ((chartHistory[lastIdx] - minVal) / range) * chartH;
        const clampedPy = Math.max(padding.top, Math.min(padding.top + chartH, py));

        // Glow
        const glow = ctx.createRadialGradient(px, clampedPy, 2, px, clampedPy, 30);
        if (isCrashed) {
            glow.addColorStop(0, 'rgba(255,68,68,0.3)');
            glow.addColorStop(1, 'rgba(255,68,68,0)');
        } else {
            glow.addColorStop(0, 'rgba(255,215,0,0.4)');
            glow.addColorStop(1, 'rgba(255,215,0,0)');
        }
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, clampedPy, 30, 0, Math.PI * 2);
        ctx.fill();

        // Rocket angle
        ctx.save();
        ctx.translate(px, clampedPy);

        let angle = -Math.PI / 2;
        if (chartHistory.length > 2) {
            const prev = chartHistory[chartHistory.length - 2];
            const curr = chartHistory[chartHistory.length - 1];
            const dx = 1;
            const dy = (curr - prev) / 100 * chartH / range;
            angle = Math.atan2(-dy, dx);
        }
        ctx.rotate(angle);

        // Shadow
        ctx.shadowColor = 'rgba(255,215,0,0.5)';
        ctx.shadowBlur = 20;

        // Rocket Body
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.quadraticCurveTo(8, -12, 10, -5);
        ctx.quadraticCurveTo(12, 0, 10, 5);
        ctx.quadraticCurveTo(8, 12, 0, 15);
        ctx.quadraticCurveTo(-8, 12, -10, 5);
        ctx.quadraticCurveTo(-12, 0, -10, -5);
        ctx.quadraticCurveTo(-8, -12, 0, -18);
        ctx.closePath();
        const rocketGrad = ctx.createLinearGradient(0, -18, 0, 15);
        rocketGrad.addColorStop(0, '#ffd700');
        rocketGrad.addColorStop(0.3, '#ffaa00');
        rocketGrad.addColorStop(0.7, '#ff8c00');
        rocketGrad.addColorStop(1, '#ff4500');
        ctx.fillStyle = rocketGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Fins
        ctx.fillStyle = 'rgba(255,200,100,0.5)';
        ctx.beginPath();
        ctx.moveTo(-2, -2);
        ctx.lineTo(-12, -8);
        ctx.lineTo(-12, -4);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(2, -2);
        ctx.lineTo(12, -8);
        ctx.lineTo(12, -4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(255,200,100,0.3)';
        ctx.beginPath();
        ctx.moveTo(-2, 2);
        ctx.lineTo(-10, 8);
        ctx.lineTo(-10, 4);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(2, 2);
        ctx.lineTo(10, 8);
        ctx.lineTo(10, 4);
        ctx.closePath();
        ctx.fill();

        // Tail (exhaust)
        ctx.fillStyle = 'rgba(255,215,0,0.3)';
        ctx.beginPath();
        ctx.moveTo(-1, 10);
        ctx.lineTo(-5, 16);
        ctx.lineTo(0, 13);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(1, 10);
        ctx.lineTo(5, 16);
        ctx.lineTo(0, 13);
        ctx.closePath();
        ctx.fill();

        // Window
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(0, -6, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100,200,255,0.25)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100,200,255,0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Exhaust fire
        if (!isCrashed) {
            const fireLength = 6 + Math.sin(Date.now() / 100) * 3;
            ctx.shadowColor = 'rgba(255,100,0,0.6)';
            ctx.shadowBlur = 20;
            
            ctx.beginPath();
            ctx.moveTo(-4, 14);
            ctx.quadraticCurveTo(0, 14 + fireLength, 4, 14);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,100,0,0.6)';
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(-3, 13);
            ctx.quadraticCurveTo(0, 13 + fireLength * 0.7, 3, 13);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,200,50,0.4)';
            ctx.fill();
            
            // Blinking light
            ctx.shadowColor = 'rgba(255,255,100,0.6)';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(0, -14, 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,100,${0.3 + Math.sin(Date.now() / 150) * 0.3})`;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        ctx.restore();
        ctx.shadowBlur = 0;

        // Crash effect
        if (isCrashed) {
            for (let i = 0; i < 12; i++) {
                const a = Math.random() * Math.PI * 2;
                const len = 10 + Math.random() * 30;
                const x1 = px + Math.cos(a) * 6;
                const y1 = clampedPy + Math.sin(a) * 6;
                const x2 = px + Math.cos(a) * (6 + len);
                const y2 = clampedPy + Math.sin(a) * (6 + len);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = `rgba(255,68,68,${0.2 + Math.random() * 0.4})`;
                ctx.lineWidth = 2 + Math.random() * 2;
                ctx.shadowColor = 'rgba(255,68,68,0.2)';
                ctx.shadowBlur = 10;
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }
    }

    // Axis labels
    ctx.fillStyle = '#444';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Time', w/2, h - 18);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('x', 15, padding.top + 10);
}

// ==========================================
// UPDATE UI
// ==========================================
function updateUI() {
    multiplierDisplay.innerHTML = multiplier.toFixed(2) + '<span class="unit">x</span>';
    
    if (multiplier < 1.5) multiplierDisplay.style.color = '#4CAF50';
    else if (multiplier < 2.5) multiplierDisplay.style.color = '#ffd700';
    else if (multiplier < 4) multiplierDisplay.style.color = '#ff8c00';
    else if (multiplier < 6) multiplierDisplay.style.color = '#ff6b6b';
    else multiplierDisplay.style.color = '#ff4444';
    
    drawChart(multiplier);
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
    if (!hasBet || isCashedOut || isCrashed || !isPlaying) return;
    
    isCashedOut = true;
    const winAmount = betAmount * multiplier;
    balance += winAmount;
    totalWins += winAmount;
    updateBalanceUI();
    
    const msg = '🎉 Won $' + winAmount.toFixed(2) + ' (' + multiplier.toFixed(2) + 'x)';
    resultEl.textContent = msg;
    resultEl.style.color = '#4CAF50';
    cashBtn.classList.remove('show');
    cancelBtn.classList.remove('show');
    addHistory(msg, 'win');
    updateStats();
    
    hasBet = false;
    betBtn.textContent = '🚀 Place Bet';
    betBtn.disabled = false;
}

// ==========================================
// CANCEL BET
// ==========================================
function cancelBet() {
    if (!hasBet || !isWaiting) return;
    
    balance += betAmount;
    updateBalanceUI();
    hasBet = false;
    betAmount = 0;
    cancelBtn.classList.remove('show');
    cashBtn.classList.remove('show');
    betBtn.textContent = '🚀 Place Bet';
    betBtn.disabled = false;
    resultEl.textContent = '🔄 Bet cancelled!';
    resultEl.style.color = '#ff8c00';
}

// ==========================================
// GLOBAL GAME STATE (24/7)
// ==========================================
let globalGameState = {
    multiplier: 1.00,
    isPlaying: false,
    isCrashed: false,
    crashPoint: 0,
    phase: 'countdown',
    countdown: 10,
    roundStartTime: 0,
    chartHistory: []
};

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
// GLOBAL GAME LOOP (24/7)
// ==========================================
function globalGameLoop() {
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
        }
        return;
    }
    
    if (globalGameState.phase === 'playing') {
        const elapsed = (Date.now() - globalGameState.roundStartTime) / 1000;
        const speed = getSpeed(globalGameState.multiplier);
        globalGameState.multiplier += speed * 0.05;
        globalGameState.multiplier = Math.round(globalGameState.multiplier * 100) / 100;
        globalGameState.chartHistory.push(globalGameState.multiplier);
        if (globalGameState.chartHistory.length > 100) globalGameState.chartHistory.shift();
        
        if (globalGameState.multiplier >= globalGameState.crashPoint) {
            globalGameState.phase = 'crashed';
            globalGameState.isCrashed = true;
            globalGameState.isPlaying = false;
            crashHistory.push(globalGameState.multiplier);
            localStorage.setItem(STORAGE_KEY_CRASHES, JSON.stringify(crashHistory));
            updateCrashHistoryBar();
            setTimeout(() => {
                globalGameState.phase = 'countdown';
                globalGameState.countdown = 10;
                globalGameState.isCrashed = false;
            }, 1500);
        }
    }
}

// ==========================================
// UPDATE UI FROM GLOBAL STATE
// ==========================================
function updateUIFromGlobalState() {
    const state = globalGameState;
    
    if (state.phase === 'countdown') {
        multiplierDisplay.className = 'multiplier';
        multiplierDisplay.innerHTML = '1.00<span class="unit">x</span>';
        gameStatus.textContent = '⏳ Place your bet! ' + state.countdown + 's';
        countdownDisplay.textContent = state.countdown;
        betBtn.disabled = false;
        cancelBtn.classList.remove('show');
        cashBtn.classList.remove('show');
    } else if (state.phase === 'playing') {
        multiplier = state.multiplier;
        multiplierDisplay.innerHTML = multiplier.toFixed(2) + '<span class="unit">x</span>';
        gameStatus.textContent = '🚀 Flying...';
        countdownDisplay.textContent = '';
        betBtn.disabled = true;
        
        if (multiplier < 1.5) multiplierDisplay.style.color = '#4CAF50';
        else if (multiplier < 2.5) multiplierDisplay.style.color = '#ffd700';
        else if (multiplier < 4) multiplierDisplay.style.color = '#ff8c00';
        else if (multiplier < 6) multiplierDisplay.style.color = '#ff6b6b';
        else multiplierDisplay.style.color = '#ff4444';
        
        if (hasBet && !isCashedOut) {
            cashBtn.classList.add('show');
            cashBtn.textContent = '💰 Cash Out at ' + multiplier.toFixed(2) + 'x';
        }
        
        if (autoBetActive && hasBet && multiplier >= autoBetMultiplier) {
            cashOut();
        }
        
        drawChart(multiplier);
        updatePlayers();
        
    } else if (state.phase === 'crashed') {
        multiplierDisplay.className = 'multiplier crashed';
        gameStatus.textContent = '💥 CRASHED!';
        countdownDisplay.textContent = '';
        betBtn.disabled = true;
        cashBtn.classList.remove('show');
        drawChart(multiplier);
        
        if (hasBet && !isCashedOut) {
            const msg = '💔 Lost $' + betAmount.toFixed(2) + ' (' + multiplier.toFixed(2) + 'x)';
            resultEl.textContent = msg;
            resultEl.style.color = '#ff4444';
            addHistory(msg, 'lose');
            hasBet = false;
            betBtn.textContent = '🚀 Place Bet';
            betBtn.disabled = false;
            cancelBtn.classList.remove('show');
            cashBtn.classList.remove('show');
        }
        
        updatePlayers();
    }
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
        li.innerHTML = `<span>👤 ${userName}</span><span>💰 $${betAmount.toFixed(2)}</span><span>🎯 ${multiplier.toFixed(2)}x</span>`;
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
// START GLOBAL GAME (24/7)
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
// BET
// ==========================================
betBtn.addEventListener('click', function() {
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
    betBtn.disabled = true;
    cancelBtn.classList.add('show');
    cashBtn.classList.add('show');
    resultEl.textContent = '✅ Bet $' + bet.toFixed(2) + ' placed!';
    resultEl.style.color = '#4CAF50';
    updateStats();
    updatePlayers();
});

// ==========================================
// CANCEL BUTTON
// ==========================================
cancelBtn.addEventListener('click', function() {
    if (!hasBet || globalGameState.phase !== 'countdown') {
        resultEl.textContent = '⚠️ Cannot cancel now!';
        resultEl.style.color = '#ff8c00';
        return;
    }
    cancelBet();
});

// ==========================================
// CASH BUTTON
// ==========================================
cashBtn.addEventListener('click', function() {
    if (globalGameState.phase !== 'playing') {
        resultEl.textContent = '⏳ Wait for game to start!';
        resultEl.style.color = '#ff8c00';
        return;
    }
    cashOut();
});

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
// LOBBY FUNCTIONS
// ==========================================
function startGameFromLobby() {
    // Game is already running 24/7
}

function stopGame() {
    // Game continues 24/7
}

// ==========================================
// TELEGRAM
// ==========================================
tg.MainButton.setText("❌ Close");
tg.MainButton.show();
tg.MainButton.onClick(function() {
    tg.close();
});

// ==========================================
// START
// ==========================================
startGlobalGame();
updateHistoryList();
