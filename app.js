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
        const li = document.createElement('div');
        li.className = 'history-item';
        li.innerHTML = item.text;
        if (item.type === 'win') li.style.color = '#4CAF50';
        else if (item.type === 'lose') li.style.color = '#ff4444';
        else li.style.color = '#ff8c00';
        list.appendChild(li);
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
// DRAW CHART WITH PLANE (پرک‌پرواز)
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
        ctx.fillText('✈️ Waiting for flight...', w/2, h/2);
        return;
    }

    const maxVal = Math.max(2, ...chartHistory);
    const minVal = 1;
    const range = maxVal - minVal || 1;
    const padding = { top: 20, bottom: 25, left: 30, right: 20 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Gradient line (طلایی-نارنجی)
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

    // ============================================================
    // ===== هواپیما با پرک‌پرواز (روی نوک خط) =====
    // ============================================================
    if (chartHistory.length > 0) {
        const lastIdx = chartHistory.length - 1;
        const px = padding.left + (lastIdx / 100) * chartW;
        const py = padding.top + chartH - ((chartHistory[lastIdx] - minVal) / range) * chartH;
        const clampedPy = Math.max(padding.top, Math.min(padding.top + chartH, py));

        // ===== گلو =====
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

        // ===== هواپیما (با زاویه متناسب با خط) =====
        ctx.save();
        ctx.translate(px, clampedPy);

        // زاویه هواپیما = زاویه خط (مشتق)
        let angle = -Math.PI / 2;
        if (chartHistory.length > 2) {
            const prev = chartHistory[chartHistory.length - 2];
            const curr = chartHistory[chartHistory.length - 1];
            const dx = 1;
            const dy = (curr - prev) / 100 * chartH / range;
            angle = Math.atan2(-dy, dx);
        }
        ctx.rotate(angle);

        // ===== سایه =====
        ctx.shadowColor = 'rgba(255,215,0,0.5)';
        ctx.shadowBlur = 20;

        // ===== بدنه اصلی =====
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.quadraticCurveTo(8, -10, 10, -4);
        ctx.quadraticCurveTo(12, 0, 10, 4);
        ctx.quadraticCurveTo(8, 10, 0, 13);
        ctx.quadraticCurveTo(-8, 10, -10, 4);
        ctx.quadraticCurveTo(-12, 0, -10, -4);
        ctx.quadraticCurveTo(-8, -10, 0, -16);
        ctx.closePath();
        const planeGrad = ctx.createLinearGradient(0, -16, 0, 13);
        planeGrad.addColorStop(0, '#ffd700');
        planeGrad.addColorStop(0.4, '#ffaa00');
        planeGrad.addColorStop(0.8, '#ff8c00');
        planeGrad.addColorStop(1, '#ff4500');
        ctx.fillStyle = planeGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // ===== بال بالا =====
        ctx.fillStyle = 'rgba(255,215,0,0.5)';
        ctx.beginPath();
        ctx.moveTo(-2, -2);
        ctx.lineTo(-14, -10);
        ctx.lineTo(-14, -5);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(2, -2);
        ctx.lineTo(14, -10);
        ctx.lineTo(14, -5);
        ctx.closePath();
        ctx.fill();

        // ===== بال پایین =====
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

        // ===== دم =====
        ctx.fillStyle = 'rgba(255,215,0,0.4)';
        ctx.beginPath();
        ctx.moveTo(-1, 10);
        ctx.lineTo(-7, 16);
        ctx.lineTo(0, 13);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(1, 10);
        ctx.lineTo(7, 16);
        ctx.lineTo(0, 13);
        ctx.closePath();
        ctx.fill();

        // ===== کابین خلبان =====
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(0, -7, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100,200,255,0.25)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100,200,255,0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // ===== نور چشمک‌زن (پرک‌پرواز) =====
        if (!isCrashed) {
            const blink = 0.3 + Math.sin(Date.now() / 150) * 0.3;
            ctx.shadowColor = 'rgba(255,255,100,0.6)';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.arc(0, -14, 3, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,100,${blink})`;
            ctx.fill();
            
            // نور دوم
            ctx.shadowColor = 'rgba(255,100,100,0.4)';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(-4, 5, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,100,100,${0.2 + Math.sin(Date.now() / 300) * 0.2})`;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        ctx.restore();
        ctx.shadowBlur = 0;

        // ===== افکت سقوط =====
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

    // ===== Axis labels =====
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
// CASH OUT (دستی)
// ==========================================
function cashOut() {
    if (!hasBet || isCashedOut || isCrashed || !isPlaying) {
        console.log('Cash Out blocked:', {hasBet, isCashedOut, isCrashed, isPlaying});
        return;
    }
    
    console.log('Cash Out triggered!');
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
// START GAME
// ==========================================
function startGame() {
    console.log('startGame called');
    isPlaying = true;
    isCrashed = false;
    multiplier = 1.00;
    crashPoint = generateCrashPoint();
    chartHistory = [];
    
    gameStatus.textContent = '✈️ Flying...';
    countdownDisplay.textContent = '';
    betBtn.textContent = '⏳ Betting...';
    betBtn.disabled = true;
    cancelBtn.classList.remove('show');
    
    updateUI();
    
    if (gameLoopId) clearInterval(gameLoopId);
    
    let lastTime = Date.now();
    gameLoopId = setInterval(function() {
        if (!isPlaying || isCrashed) {
            clearInterval(gameLoopId);
            gameLoopId = null;
            return;
        }
        
        const now = Date.now();
        const delta = (now - lastTime) / 1000;
        lastTime = now;
        
        const speed = getSpeed(multiplier);
        multiplier += speed * delta;
        multiplier = Math.round(multiplier * 100) / 100;
        
        updateUI();
        
        if (autoBetActive && hasBet && multiplier >= autoBetMultiplier) {
            cashOut();
        }
        
        if (multiplier >= crashPoint) {
            crashGame();
        }
    }, 50);
}

// ==========================================
// CRASH
// ==========================================
function crashGame() {
    if (isCrashed) return;
    isCrashed = true;
    isPlaying = false;
    
    if (gameLoopId) {
        clearInterval(gameLoopId);
        gameLoopId = null;
    }
    
    crashHistory.push(multiplier);
    localStorage.setItem(STORAGE_KEY_CRASHES, JSON.stringify(crashHistory));
    updateCrashHistoryBar();
    
    multiplierDisplay.className = 'multiplier crashed';
    gameStatus.textContent = '💥 CRASHED!';
    cashBtn.classList.remove('show');
    cancelBtn.classList.remove('show');
    drawChart(multiplier);
    
    if (hasBet && !isCashedOut) {
        const msg = '💔 Lost $' + betAmount.toFixed(2) + ' (' + multiplier.toFixed(2) + 'x)';
        resultEl.textContent = msg;
        resultEl.style.color = '#ff4444';
        addHistory(msg, 'lose');
        hasBet = false;
        betBtn.textContent = '🚀 Place Bet';
        betBtn.disabled = false;
    }
    
    addHistory('💥 Crashed at ' + multiplier.toFixed(2) + 'x', 'crash');
    
    setTimeout(function() {
        startCountdown();
    }, 1500);
}

// ==========================================
// COUNTDOWN
// ==========================================
function startCountdown() {
    if (gameLoopId) {
        clearInterval(gameLoopId);
        gameLoopId = null;
    }
    if (countdownLoopId) {
        clearInterval(countdownLoopId);
        countdownLoopId = null;
    }
    
    isWaiting = true;
    isPlaying = false;
    isCrashed = false;
    countdown = 10;
    multiplier = 1.00;
    hasBet = false;
    isCashedOut = false;
    chartHistory = [];
    
    multiplierDisplay.className = 'multiplier';
    gameStatus.textContent = '⏳ Place your bet! ' + countdown + 's';
    countdownDisplay.textContent = countdown;
    betBtn.textContent = '🚀 Place Bet';
    betBtn.disabled = false;
    cancelBtn.classList.remove('show');
    cashBtn.classList.remove('show');
    resultEl.textContent = '';
    updateUI();
    
    countdownLoopId = setInterval(function() {
        countdown--;
        if (countdown > 0) {
            countdownDisplay.textContent = countdown;
            gameStatus.textContent = '⏳ Place your bet! ' + countdown + 's';
        } else {
            clearInterval(countdownLoopId);
            countdownLoopId = null;
            countdownDisplay.textContent = '';
            isWaiting = false;
            startGame();
        }
    }, 1000);
}

// ==========================================
// BET
// ==========================================
betBtn.addEventListener('click', function() {
    console.log('Bet button clicked, isWaiting:', isWaiting, 'hasBet:', hasBet, 'isPlaying:', isPlaying, 'isCrashed:', isCrashed);
    
    if (!isWaiting) {
        if (isPlaying && hasBet && !isCashedOut) {
            console.log('Calling cashOut from bet button');
            cashOut();
            return;
        }
        return;
    }
    
    if (hasBet) return;
    
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
    cashBtn.classList.add('show'); // Cash Out همیشه بعد از شرط نشان داده میشه
    resultEl.textContent = '✅ Bet $' + bet.toFixed(2) + ' placed!';
    resultEl.style.color = '#4CAF50';
    updateStats();
    
    console.log('Bet placed:', betAmount, 'hasBet:', hasBet);
});

// ==========================================
// CANCEL BUTTON
// ==========================================
cancelBtn.addEventListener('click', function() {
    console.log('Cancel button clicked');
    cancelBet();
});

// ==========================================
// CASH BUTTON
// ==========================================
cashBtn.addEventListener('click', function() {
    console.log('Cash button clicked');
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
    if (!isWaiting && !isPlaying) {
        startCountdown();
    }
}

function stopGame() {
    if (gameLoopId) {
        clearInterval(gameLoopId);
        gameLoopId = null;
    }
    if (countdownLoopId) {
        clearInterval(countdownLoopId);
        countdownLoopId = null;
    }
    isPlaying = false;
    isWaiting = false;
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
startCountdown();
