// ==========================================
// TELEGRAM
// ==========================================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const user = tg.initDataUnsafe?.user;
let userName = user?.first_name || 'Guest';
let userUsername = user?.username ? '@' + user.username : '';

document.getElementById('lobbyName').textContent = userName;
document.getElementById('lobbyUsername').textContent = userUsername;
document.getElementById('lobbyAvatar').textContent = userName.charAt(0).toUpperCase();

// ==========================================
// BALANCE
// ==========================================
let balance = 1000;

function updateBalanceUI() {
    document.getElementById('lobbyBalance').textContent = '$' + balance;
    document.getElementById('gameBalance').textContent = '$' + balance;
}
updateBalanceUI();

// ==========================================
// ELEMENTS
// ==========================================
const multiplierDisplay = document.getElementById('multiplierDisplay');
const gameStatus = document.getElementById('gameStatus');
const countdownDisplay = document.getElementById('countdownDisplay');
const betBtn = document.getElementById('betBtn');
const cashBtn = document.getElementById('cashBtn');
const betInput = document.getElementById('betInput');
const resultEl = document.getElementById('result');
const playersList = document.getElementById('playersList');
const crashHistoryEl = document.getElementById('crashHistory');
const historyList = document.getElementById('historyList');
const canvas = document.getElementById('speedometerCanvas');
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
let betMultiplier = 0;
let isCashedOut = false;
let crashHistory = [];
let countdown = 10;
let isWaiting = false;
let gameHistory = [];
let loopId = null;
let countdownId = null;

// ==========================================
// CONSTANTS
// ==========================================
const MIN_BET = 1;
const MAX_MULTIPLIER = 100;

// ==========================================
// DRAW SPEEDOMETER
// ==========================================
function drawSpeedometer(value) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h - 10;
    const radius = 170;
    const startAngle = Math.PI + 0.2;
    const endAngle = 2 * Math.PI - 0.2;

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 20;
    ctx.stroke();

    // Gradient arc
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#4CAF50');
    grad.addColorStop(0.3, '#ffd93d');
    grad.addColorStop(0.6, '#ff9f43');
    grad.addColorStop(0.8, '#ff6b6b');
    grad.addColorStop(1, '#ff0000');

    const progress = Math.min(value / MAX_MULTIPLIER, 1);
    const currentAngle = startAngle + (endAngle - startAngle) * progress;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, currentAngle);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Tick marks
    const ticks = [1, 2, 3, 5, 10, 20, 50, 100];
    ticks.forEach(tick => {
        const p = tick / MAX_MULTIPLIER;
        const angle = startAngle + (endAngle - startAngle) * p;
        const inner = radius - 20;
        const outer = radius + 5;
        const x1 = cx + Math.cos(angle) * inner;
        const y1 = cy + Math.sin(angle) * inner;
        const x2 = cx + Math.cos(angle) * outer;
        const y2 = cy + Math.sin(angle) * outer;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = tick <= value ? '#fff' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = tick <= value ? 3 : 2;
        ctx.stroke();

        // Labels
        const labelR = radius - 30;
        const lx = cx + Math.cos(angle) * labelR;
        const ly = cy + Math.sin(angle) * labelR;
        ctx.fillStyle = tick <= value ? '#fff' : 'rgba(255,255,255,0.3)';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tick + 'x', lx, ly);
    });

    // Needle
    const needleAngle = startAngle + (endAngle - startAngle) * progress;
    const needleLength = radius - 10;
    const nx = cx + Math.cos(needleAngle) * needleLength;
    const ny = cy + Math.sin(needleAngle) * needleLength;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = isCrashed ? '#ff0000' : '#ffffff';
    ctx.lineWidth = 3;
    ctx.shadowColor = isCrashed ? 'rgba(255,0,0,0.5)' : 'rgba(255,255,255,0.5)';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = isCrashed ? '#ff0000' : '#ffd93d';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
}

// ==========================================
// UPDATE CRASH HISTORY
// ==========================================
function updateCrashHistory() {
    crashHistoryEl.innerHTML = '';
    const lastSix = crashHistory.slice(-6).reverse();
    lastSix.forEach(v => {
        const span = document.createElement('span');
        span.textContent = v.toFixed(2) + 'x';
        if (v < 1.5) span.style.color = '#4CAF50';
        else if (v < 2.5) span.style.color = '#ffd93d';
        else if (v < 4) span.style.color = '#ff9f43';
        else if (v < 6) span.style.color = '#ff6b6b';
        else span.style.color = '#ff0000';
        crashHistoryEl.appendChild(span);
    });
}

// ==========================================
// UPDATE HISTORY LIST
// ==========================================
function updateHistoryList() {
    historyList.innerHTML = '';
    gameHistory.slice(0, 20).forEach(item => {
        const li = document.createElement('li');
        li.textContent = item.text;
        li.className = item.type;
        historyList.appendChild(li);
    });
}

function addHistory(text, type) {
    gameHistory.unshift({ text, type });
    if (gameHistory.length > 50) gameHistory.pop();
    updateHistoryList();
}

// ==========================================
// UPDATE PLAYERS
// ==========================================
function updatePlayers() {
    playersList.innerHTML = '';
    if (hasBet) {
        const li = document.createElement('li');
        li.className = 'user-bet';
        li.innerHTML = `<span>👤 ${userName}</span><span>💰 $${betAmount}</span><span>🎯 ${betMultiplier.toFixed(2)}x</span>`;
        playersList.appendChild(li);
    } else {
        const li = document.createElement('li');
        li.style.textAlign = 'center';
        li.style.color = '#666';
        li.textContent = 'No players yet';
        playersList.appendChild(li);
    }
}

// ==========================================
// GENERATE CRASH POINT
// ==========================================
function generateCrashPoint() {
    const r = Math.random() * 100;
    if (r < 20) return 1.00;
    if (r < 70) return 1.01 + ((r - 20) / 50) * 0.99;
    if (r < 85) return 2.01 + ((r - 70) / 15) * 2.99;
    if (r < 95) return 5.01 + ((r - 85) / 10) * 9.99;
    if (r < 98) return 15.01 + ((r - 95) / 3) * 34.99;
    return 50.01 + ((r - 98) / 2) * 949.99;
}

// ==========================================
// UPDATE MULTIPLIER
// ==========================================
function updateMultiplier() {
    if (!isPlaying || isCrashed) {
        return;
    }

    const baseSpeed = 0.00006;
    const logFactor = Math.log(multiplier + 0.5) / Math.log(10);
    const speed = baseSpeed * (1 + logFactor * 1.5);
    
    multiplier += speed;
    multiplier = Math.round(multiplier * 100) / 100;

    multiplierDisplay.innerHTML = multiplier.toFixed(2) + '<span class="unit">x</span>';
    drawSpeedometer(multiplier);

    if (multiplier < 1.5) multiplierDisplay.style.color = '#4CAF50';
    else if (multiplier < 2.5) multiplierDisplay.style.color = '#ffd93d';
    else if (multiplier < 4) multiplierDisplay.style.color = '#ff9f43';
    else if (multiplier < 6) multiplierDisplay.style.color = '#ff6b6b';
    else if (multiplier < 10) multiplierDisplay.style.color = '#ff4500';
    else multiplierDisplay.style.color = '#ff0000';

    if (hasBet && !isCashedOut) {
        betMultiplier = multiplier;
        cashBtn.textContent = '💰 Cash Out at ' + multiplier.toFixed(2) + 'x';
        cashBtn.classList.add('show');
    }

    if (multiplier >= crashPoint) {
        crashGame();
        return;
    }

    loopId = setTimeout(updateMultiplier, 50);
}

// ==========================================
// START GAME
// ==========================================
function startGame() {
    isPlaying = true;
    isCrashed = false;
    multiplier = 1.00;
    crashPoint = generateCrashPoint();

    multiplierDisplay.innerHTML = '1.00<span class="unit">x</span>';
    multiplierDisplay.className = 'multiplier';
    gameStatus.textContent = '🚀 Playing...';
    countdownDisplay.textContent = '';
    betBtn.disabled = true;
    cashBtn.classList.remove('show');
    resultEl.textContent = '';
    drawSpeedometer(1);

    if (hasBet && !isCashedOut) {
        cashBtn.classList.add('show');
        cashBtn.textContent = '💰 Cash Out at 1.00x';
    }

    if (loopId) clearTimeout(loopId);
    updateMultiplier();
}

// ==========================================
// CRASH
// ==========================================
function crashGame() {
    if (isCrashed) return;
    isCrashed = true;
    isPlaying = false;

    if (loopId) {
        clearTimeout(loopId);
        loopId = null;
    }

    crashHistory.push(multiplier);
    updateCrashHistory();

    multiplierDisplay.className = 'multiplier crashed';
    gameStatus.textContent = '💥 CRASHED!';
    cashBtn.classList.remove('show');
    drawSpeedometer(multiplier);

    if (hasBet && !isCashedOut) {
        const msg = '💔 Lost $' + betAmount + ' (' + multiplier.toFixed(2) + 'x)';
        resultEl.textContent = msg;
        resultEl.style.color = '#f44336';
        addHistory(msg, 'lose');
        hasBet = false;
        betBtn.disabled = false;
    }

    addHistory('💥 Crashed at ' + multiplier.toFixed(2) + 'x', 'crash');
    updatePlayers();

    setTimeout(function() {
        startCountdown();
    }, 1500);
}

// ==========================================
// CASH OUT
// ==========================================
function cashOut() {
    if (!hasBet || isCashedOut || isCrashed || !isPlaying) return;

    isCashedOut = true;
    const winAmount = Math.floor(betAmount * betMultiplier);
    balance += winAmount;
    updateBalanceUI();

    const msg = '🎉 Won $' + winAmount + ' (' + betMultiplier.toFixed(2) + 'x)';
    resultEl.textContent = msg;
    resultEl.style.color = '#4CAF50';
    cashBtn.classList.remove('show');
    addHistory(msg, 'win');

    hasBet = false;
    betBtn.disabled = false;
    updatePlayers();
}

// ==========================================
// COUNTDOWN
// ==========================================
function startCountdown() {
    if (loopId) {
        clearTimeout(loopId);
        loopId = null;
    }
    if (countdownId) {
        clearInterval(countdownId);
        countdownId = null;
    }

    isWaiting = true;
    isPlaying = false;
    isCrashed = false;
    countdown = 10;
    hasBet = false;
    isCashedOut = false;
    multiplier = 1.00;

    multiplierDisplay.innerHTML = '1.00<span class="unit">x</span>';
    multiplierDisplay.className = 'multiplier';
    gameStatus.textContent = '⏳ Place your bet! ' + countdown + 's';
    countdownDisplay.textContent = countdown;
    betBtn.disabled = false;
    cashBtn.classList.remove('show');
    resultEl.textContent = '';
    drawSpeedometer(1);
    updatePlayers();

    countdownId = setInterval(function() {
        countdown--;
        if (countdown > 0) {
            countdownDisplay.textContent = countdown;
            gameStatus.textContent = '⏳ Place your bet! ' + countdown + 's';
        } else {
            clearInterval(countdownId);
            countdownId = null;
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
    if (!isWaiting) {
        resultEl.textContent = '⏳ Wait for betting phase!';
        resultEl.style.color = '#ffd93d';
        return;
    }
    if (hasBet) {
        resultEl.textContent = '⏳ You already bet!';
        resultEl.style.color = '#ffd93d';
        return;
    }

    const bet = parseInt(betInput.value);
    if (isNaN(bet) || bet < MIN_BET) {
        resultEl.textContent = '⚠️ Minimum bet is $' + MIN_BET;
        resultEl.style.color = 'orange';
        return;
    }
    if (bet > balance) {
        resultEl.textContent = '⚠️ Not enough balance!';
        resultEl.style.color = 'orange';
        return;
    }

    betAmount = bet;
    balance -= bet;
    hasBet = true;
    isCashedOut = false;
    betMultiplier = 1.00;

    updateBalanceUI();
    betBtn.disabled = true;
    resultEl.textContent = '✅ Bet $' + bet + ' placed!';
    resultEl.style.color = '#4CAF50';
    updatePlayers();
});

// ==========================================
// CASH BUTTON
// ==========================================
cashBtn.addEventListener('click', cashOut);

// ==========================================
// QUICK BETS
// ==========================================
document.querySelectorAll('.quick-bets button').forEach(function(btn) {
    btn.addEventListener('click', function() {
        betInput.value = btn.dataset.amount;
    });
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
    if (loopId) {
        clearTimeout(loopId);
        loopId = null;
    }
    if (countdownId) {
        clearInterval(countdownId);
        countdownId = null;
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
// INIT
// ==========================================
updateHistoryList();
startCountdown();
