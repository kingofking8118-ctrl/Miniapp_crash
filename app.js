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

// ==========================================
// BALANCE
// ==========================================
let balance = 1000;
function updateBalanceUI() {
    document.getElementById('lobbyBalance').textContent = '$' + balance;
    document.getElementById('gameBalance').textContent = '$' + balance;
}
updateBalanceUI();

function addFunds() {
    balance += 100;
    updateBalanceUI();
    document.getElementById('result').textContent = '✅ +$100 added!';
    document.getElementById('result').style.color = '#4CAF50';
    setTimeout(() => document.getElementById('result').textContent = '', 2000);
}

// ==========================================
// ELEMENTS
// ==========================================
const multiplierEl = document.getElementById('multiplier');
const statusEl = document.getElementById('status');
const countdownEl = document.getElementById('countdown');
const betBtn = document.getElementById('betBtn');
const cashBtn = document.getElementById('cashBtn');
const betInput = document.getElementById('betInput');
const resultEl = document.getElementById('result');
const canvas = document.getElementById('chartCanvas');
const ctx = canvas.getContext('2d');
const playersList = document.getElementById('playersList');
const crashHistoryEl = document.getElementById('crashHistory');
const crashHistoryBox = document.getElementById('crashHistoryBox');

// ==========================================
// GAME STATE
// ==========================================
let multiplier = 1.00;
let isPlaying = false;
let isCrashed = false;
let gameInterval = null;
let crashPoint = 0;
let hasBet = false;
let betAmount = 0;
let betMultiplier = 0;
let isCashedOut = false;
let chartData = [];
let crashHistory = [];
let countdown = 10;
let countdownInterval = null;
let isWaiting = false;

cashBtn.classList.add('hidden');

// ==========================================
// DRAW CHART
// ==========================================
function drawChart() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);
    
    if (chartData.length < 2) return;
    
    const maxVal = Math.max(2, ...chartData);
    const grad = ctx.createLinearGradient(50, h-30, w-20, 20);
    grad.addColorStop(0, '#4CAF50');
    grad.addColorStop(0.5, '#ffd93d');
    grad.addColorStop(1, '#ff0000');
    
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < chartData.length; i++) {
        const x = 50 + (i / 100) * (w - 70);
        const y = h - 30 - (chartData[i] / maxVal) * (h - 50);
        const cy = Math.max(20, Math.min(h - 30, y));
        if (i === 0) ctx.moveTo(x, cy);
        else ctx.lineTo(x, cy);
    }
    ctx.stroke();
    
    const last = chartData[chartData.length - 1];
    const lx = 50 + ((chartData.length - 1) / 100) * (w - 70);
    const ly = h - 30 - (last / maxVal) * (h - 50);
    const cy = Math.max(20, Math.min(h - 30, ly));
    ctx.beginPath();
    ctx.arc(lx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = isCrashed ? '#ff0000' : '#ffd93d';
    ctx.fill();
}

// ==========================================
// UPDATE CRASH HISTORY
// ==========================================
function updateCrashHistory() {
    const lastSix = crashHistory.slice(-6).reverse();
    crashHistoryEl.innerHTML = '';
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
    if (crashHistory.length > 0) crashHistoryBox.classList.remove('hidden');
}

// ==========================================
// START GAME - MULTIPLIER GOES UP
// ==========================================
function startGame() {
    isPlaying = true;
    isCrashed = false;
    multiplier = 1.00;
    chartData = [];
    crashPoint = 1.00 + Math.random() * 8;
    
    multiplierEl.textContent = '1.00';
    multiplierEl.style.color = '#4CAF50';
    multiplierEl.className = '';
    statusEl.textContent = '🚀 Playing...';
    countdownEl.textContent = '';
    betBtn.disabled = true;
    cashBtn.classList.add('hidden');
    resultEl.textContent = '';
    
    if (hasBet && !isCashedOut) {
        cashBtn.classList.remove('hidden');
        cashBtn.textContent = '💰 Cash Out at 1.00x';
    }
    
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(() => {
        if (!isPlaying || isCrashed) {
            clearInterval(gameInterval);
            gameInterval = null;
            return;
        }
        
        multiplier += 0.00006;
        multiplier = Math.round(multiplier * 100) / 100;
        
        multiplierEl.textContent = multiplier.toFixed(2);
        
        if (multiplier < 1.5) multiplierEl.style.color = '#4CAF50';
        else if (multiplier < 2.5) multiplierEl.style.color = '#ffd93d';
        else if (multiplier < 4) multiplierEl.style.color = '#ff9f43';
        else if (multiplier < 6) multiplierEl.style.color = '#ff6b6b';
        else multiplierEl.style.color = '#ff0000';
        
        chartData.push(multiplier);
        if (chartData.length > 100) chartData.shift();
        drawChart();
        
        if (hasBet && !isCashedOut) {
            betMultiplier = multiplier;
            cashBtn.textContent = '💰 Cash Out at ' + multiplier.toFixed(2) + 'x';
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
    
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    
    multiplierEl.className = 'crashed';
    statusEl.textContent = '💥 CRASHED!';
    cashBtn.classList.add('hidden');
    
    crashHistory.push(multiplier);
    updateCrashHistory();
    
    if (hasBet && !isCashedOut) {
        resultEl.textContent = '💔 Lost $' + betAmount + ' (' + multiplier.toFixed(2) + 'x)';
        resultEl.style.color = '#f44336';
        hasBet = false;
        betBtn.disabled = false;
    }
    
    drawChart();
    updatePlayers();
    
    setTimeout(() => {
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
    
    resultEl.textContent = '🎉 Won $' + winAmount + ' (' + betMultiplier.toFixed(2) + 'x)';
    resultEl.style.color = '#4CAF50';
    cashBtn.classList.add('hidden');
    
    hasBet = false;
    betBtn.disabled = false;
    updatePlayers();
}
cashBtn.addEventListener('click', cashOut);

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
    if (isNaN(bet) || bet < 1) {
        resultEl.textContent = '⚠️ Minimum bet is $1';
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
// PLAYERS
// ==========================================
let players = [];

function updatePlayers() {
    playersList.innerHTML = '';
    if (hasBet) {
        const existing = players.find(p => p.name === userName);
        if (!existing) {
            players.push({ name: userName, bet: betAmount, multiplier: betMultiplier, isUser: true });
        } else {
            existing.bet = betAmount;
            existing.multiplier = betMultiplier;
        }
    }
    if (players.length === 0) {
        const li = document.createElement('li');
        li.style.textAlign = 'center';
        li.style.color = '#666';
        li.textContent = 'No players yet';
        playersList.appendChild(li);
        return;
    }
    players.forEach((p, i) => {
        const li = document.createElement('li');
        li.className = p.isUser ? 'user-bet' : '';
        li.innerHTML = `<span>${i+1}. ${p.name}</span><span>💰 $${p.bet}</span><span>🎯 ${p.multiplier.toFixed(2)}x</span>`;
        playersList.appendChild(li);
    });
}

// ==========================================
// COUNTDOWN
// ==========================================
function startCountdown() {
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    isWaiting = true;
    isPlaying = false;
    isCrashed = false;
    countdown = 10;
    hasBet = false;
    isCashedOut = false;
    chartData = [];
    players = [];
    
    multiplierEl.textContent = '1.00';
    multiplierEl.className = '';
    multiplierEl.style.color = '#4CAF50';
    statusEl.textContent = '⏳ Place your bet! ' + countdown + 's';
    countdownEl.textContent = countdown;
    betBtn.disabled = false;
    cashBtn.classList.add('hidden');
    resultEl.textContent = '';
    drawChart();
    updatePlayers();
    
    countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            countdownEl.textContent = countdown;
            statusEl.textContent = '⏳ Place your bet! ' + countdown + 's';
        } else {
            clearInterval(countdownInterval);
            countdownInterval = null;
            countdownEl.textContent = '';
            isWaiting = false;
            startGame();
        }
    }, 1000);
}

// ==========================================
// QUICK BET BUTTONS
// ==========================================
document.querySelectorAll('.quick-bets button').forEach(btn => {
    btn.addEventListener('click', () => {
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
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    isPlaying = false;
    isWaiting = false;
}

// ==========================================
// TELEGRAM BUTTON
// ==========================================
tg.MainButton.setText("❌ Close");
tg.MainButton.show();
tg.MainButton.onClick(() => tg.close());

// ==========================================
// START
// ==========================================
startCountdown();
