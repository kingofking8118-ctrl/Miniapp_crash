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
let balance = parseInt(localStorage.getItem(STORAGE_KEY_BALANCE)) || 1000;

function updateBalanceUI() {
    document.getElementById('lobbyBalance').textContent = '$' + balance;
    document.getElementById('gameBalance').textContent = '$' + balance;
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
        const li = document.createElement('li');
        li.textContent = item.text;
        li.className = item.type;
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
        else if (v < 2.5) span.style.color = '#ffd93d';
        else if (v < 4) span.style.color = '#ff9f43';
        else if (v < 6) span.style.color = '#ff6b6b';
        else span.style.color = '#ff0000';
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
// DRAW CHART WITH PLANE
// ==========================================
function drawChart(value) {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 5; i++) {
        const y = 30 + i * 35;
        ctx.beginPath();
        ctx.moveTo(20, y);
        ctx.lineTo(w - 20, y);
        ctx.stroke();
    }

    // Chart data
    chartHistory.push(value);
    if (chartHistory.length > 100) chartHistory.shift();

    if (chartHistory.length < 2) {
        // Draw empty state
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

    // Gradient line
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#4CAF50');
    grad.addColorStop(0.3, '#ffd93d');
    grad.addColorStop(0.6, '#ff9f43');
    grad.addColorStop(0.85, '#ff6b6b');
    grad.addColorStop(1, '#ff0000');

    // Draw line
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

    // ==========================================
    // PLANE ✈️ on the last point
    // ==========================================
    if (chartHistory.length > 0) {
        const lastIdx = chartHistory.length - 1;
        const lastX = padding.left + (lastIdx / 100) * chartW;
        const lastY = padding.top + chartH - ((chartHistory[lastIdx] - minVal) / range) * chartH;
        const clampedY = Math.max(padding.top, Math.min(padding.top + chartH, lastY));

        // Glow
        const glow = ctx.createRadialGradient(lastX, clampedY, 2, lastX, clampedY, 20);
        if (isCrashed) {
            glow.addColorStop(0, 'rgba(255,0,0,0.3)');
            glow.addColorStop(1, 'rgba(255,0,0,0)');
        } else {
            glow.addColorStop(0, 'rgba(255,215,0,0.3)');
            glow.addColorStop(1, 'rgba(255,215,0,0)');
        }
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(lastX, clampedY, 20, 0, Math.PI * 2);
        ctx.fill();

        // Plane body
        ctx.save();
        ctx.translate(lastX, clampedY);
        ctx.rotate(-Math.PI / 2);

        // Shadow
        ctx.shadowColor = 'rgba(255,200,0,0.4)';
        ctx.shadowBlur = 15;

        // Body
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.quadraticCurveTo(7, -8, 9, -3);
        ctx.quadraticCurveTo(11, 0, 9, 3);
        ctx.quadraticCurveTo(7, 8, 0, 11);
        ctx.quadraticCurveTo(-7, 8, -9, 3);
        ctx.quadraticCurveTo(-11, 0, -9, -3);
        ctx.quadraticCurveTo(-7, -8, 0, -14);
        ctx.closePath();
        const planeGrad = ctx.createLinearGradient(0, -14, 0, 11);
        planeGrad.addColorStop(0, '#ffdd44');
        planeGrad.addColorStop(0.5, '#ffaa00');
        planeGrad.addColorStop(1, '#ff6600');
        ctx.fillStyle = planeGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Wings
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

        // Tail
        ctx.fillStyle = 'rgba(255,200,100,0.4)';
        ctx.beginPath();
        ctx.moveTo(-1, 8);
        ctx.lineTo(-6, 13);
        ctx.lineTo(0, 11);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(1, 8);
        ctx.lineTo(6, 13);
        ctx.lineTo(0, 11);
        ctx.closePath();
        ctx.fill();

        // Cockpit
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(0, -5, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(100,200,255,0.2)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100,200,255,0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Blinking light
        if (!isCrashed) {
            ctx.beginPath();
            ctx.arc(0, -12, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,100,${0.3 + Math.sin(Date.now() / 200) * 0.3})`;
            ctx.fill();
        }

        ctx.restore();
        ctx.shadowBlur = 0;

        // Crash effect
        if (isCrashed) {
            for (let i = 0; i < 6; i++) {
                const a = Math.random() * Math.PI * 2;
                const len = 10 + Math.random() * 20;
                const x1 = lastX + Math.cos(a) * 5;
                const y1 = clampedY + Math.sin(a) * 5;
                const x2 = lastX + Math.cos(a) * (5 + len);
                const y2 = clampedY + Math.sin(a) * (5 + len);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = `rgba(255,0,0,${0.2 + Math.random() * 0.3})`;
                ctx.lineWidth = 2;
                ctx.shadowColor = 'rgba(255,0,0,0.2)';
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
    
    if (multiplier < 1.5) multiplierDisplay.style.color = '#ff2200';
    else if (multiplier < 2.5) multiplierDisplay.style.color = '#ff4400';
    else if (multiplier < 4) multiplierDisplay.style.color = '#ff6600';
    else if (multiplier < 6) multiplierDisplay.style.color = '#ff8800';
    else if (multiplier < 10) multiplierDisplay.style.color = '#ffaa00';
    else multiplierDisplay.style.color = '#ff0000';
    
    drawChart(multiplier);
}

// ==========================================
// CASH OUT
// ==========================================
function cashOut() {
    if (!hasBet || isCashedOut || isCrashed || !isPlaying) return;
    
    isCashedOut = true;
    const winAmount = Math.floor(betAmount * multiplier);
    balance += winAmount;
    updateBalanceUI();
    
    const msg = '🎉 Won $' + winAmount + ' (' + multiplier.toFixed(2) + 'x)';
    resultEl.textContent = msg;
    resultEl.style.color = '#4CAF50';
    cashBtn.classList.remove('show');
    addHistory(msg, 'win');
    
    hasBet = false;
    betBtn.textContent = '🚀 Place Bet';
    betBtn.disabled = false;
    cancelBtn.classList.remove('show');
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
    betBtn.textContent = '🚀 Place Bet';
    betBtn.disabled = false;
    resultEl.textContent = '🔄 Bet cancelled!';
    resultEl.style.color = '#ff6600';
}

// ==========================================
// START GAME
// ==========================================
function startGame() {
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
    drawChart(multiplier);
    
    if (hasBet && !isCashedOut) {
        const msg = '💔 Lost $' + betAmount + ' (' + multiplier.toFixed(2) + 'x)';
        resultEl.textContent = msg;
        resultEl.style.color = '#ff0000';
        addHistory(msg, 'lose');
        hasBet = false;
        betBtn.textContent = '🚀 Place Bet';
        betBtn.disabled = false;
        cancelBtn.classList.remove('show');
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
    if (isCrashed || isPlaying) {
        if (isPlaying && hasBet && !isCashedOut) {
            cashOut();
            return;
        }
        return;
    }
    
    if (!isWaiting || hasBet) return;
    
    let bet = 100;
    const activeQuick = document.querySelector('.quick-bets button.active');
    if (activeQuick) {
        bet = parseInt(activeQuick.dataset.amount);
    }
    
    if (bet > balance) return;
    
    betAmount = bet;
    balance -= bet;
    hasBet = true;
    isCashedOut = false;
    
    updateBalanceUI();
    betBtn.disabled = true;
    cancelBtn.classList.add('show');
    cashBtn.classList.add('show');
    resultEl.textContent = '✅ Bet $' + bet + ' placed!';
    resultEl.style.color = '#4CAF50';
});

// ==========================================
// CANCEL BUTTON
// ==========================================
cancelBtn.addEventListener('click', cancelBet);

// ==========================================
// CASH BUTTON
// ==========================================
cashBtn.addEventListener('click', cashOut);

// ==========================================
// QUICK BETS
// ==========================================
document.querySelectorAll('.quick-bets button').forEach(function(btn) {
    btn.addEventListener('click', function() {
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
