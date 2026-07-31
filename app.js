// ==========================================
// Connect to Telegram SDK
// ==========================================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ==========================================
// Get user info
// ==========================================
const user = tg.initDataUnsafe?.user;
let userName = 'Guest';
let userUsername = '';

if (user) {
    userName = user.first_name || 'Guest';
    if (user.last_name) userName += ' ' + user.last_name;
    userUsername = user.username ? '@' + user.username : '';
}

document.getElementById('welcomeMessage').textContent = userName;
document.getElementById('userUsername').textContent = userUsername;
document.getElementById('userAvatar').textContent = userName.charAt(0).toUpperCase();

// ==========================================
// Balance
// ==========================================
const STORAGE_KEY = 'crash_game_balance_' + (user?.id || 'guest');
const HISTORY_KEY = 'crash_game_history_' + (user?.id || 'guest');
const CRASH_HISTORY_KEY = 'crash_game_crash_history_' + (user?.id || 'guest');

function loadBalance() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseInt(saved) : 1000;
}

function saveBalance() {
    localStorage.setItem(STORAGE_KEY, userBalance.toString());
}

function loadHistory() {
    const saved = localStorage.getItem(HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
}

function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function loadCrashHistory() {
    const saved = localStorage.getItem(CRASH_HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
}

function saveCrashHistory(history) {
    localStorage.setItem(CRASH_HISTORY_KEY, JSON.stringify(history));
}

let userBalance = loadBalance();
let gameHistory = loadHistory();
let crashHistory = loadCrashHistory();

// ==========================================
// Game variables
// ==========================================
let multiplier = 1.00;
let isGameRunning = false;
let isCrashed = false;
let isWaiting = true;
let gameInterval = null;
let crashPoint = 0;
let players = [];
let hasBet = false;
let betMultiplier = 0;
let isCashedOut = false;
let betAmount = 0;
let countdownValue = 10;
let countdownInterval = null;
let chartHistory = [];
let autoCashOutMultiplier = 0;
let autoCashOutEnabled = false;
let isCountdownRunning = false;

// ==========================================
// Elements
// ==========================================
const multiplierValue = document.getElementById('multiplierValue');
const gameStatus = document.getElementById('gameStatus');
const betButton = document.getElementById('betButton');
const cashOutButton = document.getElementById('cashOutButton');
const betInput = document.getElementById('betInput');
const autoCashOutInput = document.getElementById('autoCashOutInput');
const resultMessage = document.getElementById('resultMessage');
const historyList = document.getElementById('historyList');
const canvas = document.getElementById('chartCanvas');
const ctx = canvas.getContext('2d');
const playersList = document.getElementById('playersList');
const balanceDisplay = document.getElementById('balanceDisplay');
const gameBalanceDisplay = document.getElementById('gameBalanceDisplay');
const countdownDisplay = document.getElementById('countdownDisplay');
const crashHistoryList = document.getElementById('crashHistoryList');

cashOutButton.style.display = 'none';

// ==========================================
// Update balance
// ==========================================
function updateBalanceDisplay() {
    balanceDisplay.textContent = '$' + userBalance.toLocaleString();
    gameBalanceDisplay.textContent = '$' + userBalance.toLocaleString();
    saveBalance();
}

updateBalanceDisplay();

// ==========================================
// History
// ==========================================
function loadAndDisplayHistory() {
    historyList.innerHTML = '';
    gameHistory.slice(0, 20).forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        if (item.includes('Won')) li.className = 'win';
        else if (item.includes('Lost')) li.className = 'lose';
        else if (item.includes('Crashed')) li.className = 'crash';
        historyList.appendChild(li);
    });
    updateCrashHistory();
}

function updateCrashHistory() {
    if (!crashHistoryList) return;
    crashHistoryList.innerHTML = '';
    const lastSix = crashHistory.slice(-6).reverse();
    lastSix.forEach((value) => {
        const li = document.createElement('li');
        li.textContent = value.toFixed(2) + 'x';
        if (value < 1.5) li.style.color = '#4CAF50';
        else if (value < 2.5) li.style.color = '#ffd93d';
        else if (value < 4) li.style.color = '#ff9f43';
        else if (value < 6) li.style.color = '#ff6b6b';
        else li.style.color = '#ff0000';
        crashHistoryList.appendChild(li);
    });
}

function addHistory(text, type) {
    gameHistory.unshift(text);
    if (gameHistory.length > 50) gameHistory.pop();
    saveHistory(gameHistory);
    loadAndDisplayHistory();
}

// ==========================================
// Add money
// ==========================================
document.getElementById('addMoneyBtn').addEventListener('click', () => {
    userBalance += 100;
    updateBalanceDisplay();
    resultMessage.textContent = '✅ +$100 added!';
    resultMessage.style.color = '#4CAF50';
    setTimeout(() => { resultMessage.textContent = ''; }, 3000);
});

// ==========================================
// Generate crash point
// ==========================================
function generateCrashPoint() {
    const r = Math.random() * 100;
    if (r < 20) return 1.00;
    if (r < 80) return 1.01 + Math.random() * 0.98;
    if (r < 90) return 2.00 + Math.random() * 0.99;
    if (r < 97) return 3.00 + Math.random() * 2.99;
    return 6.00 + Math.random() * 8.99;
}

// ==========================================
// INCREASE MULTIPLIER - USING setInterval
// ==========================================
function startMultiplierLoop() {
    // Clear any existing interval
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    
    // Start new interval - update every 50ms (20 times per second)
    gameInterval = setInterval(() => {
        // Check if game should stop
        if (!isGameRunning || isCrashed) {
            if (gameInterval) {
                clearInterval(gameInterval);
                gameInterval = null;
            }
            return;
        }
        
        // Increase multiplier - VERY SLOW
        const speed = 0.00006;
        multiplier = multiplier + speed;
        multiplier = Math.round(multiplier * 100) / 100;
        
        // Update display
        multiplierValue.textContent = multiplier.toFixed(2);
        
        // Color
        if (multiplier < 1.5) multiplierValue.style.color = '#4CAF50';
        else if (multiplier < 2.5) multiplierValue.style.color = '#ffd93d';
        else if (multiplier < 4) multiplierValue.style.color = '#ff9f43';
        else if (multiplier < 6) multiplierValue.style.color = '#ff6b6b';
        else multiplierValue.style.color = '#ff0000';
        
        // Update chart
        chartHistory.push({ time: chartHistory.length, value: multiplier });
        if (chartHistory.length > 120) chartHistory.shift();
        drawChart(multiplier);
        
        // Cash out button
        if (hasBet && !isCashedOut) {
            betMultiplier = multiplier;
            cashOutButton.style.display = 'block';
            cashOutButton.textContent = `💰 Cash Out at ${multiplier.toFixed(2)}x`;
            
            // Auto cash out
            if (autoCashOutEnabled && autoCashOutMultiplier > 0 && multiplier >= autoCashOutMultiplier) {
                doCashOut();
            }
        }
        
        // Check crash
        if (multiplier >= crashPoint) {
            crashGame();
        }
    }, 50); // 50ms = 20fps
}

// ==========================================
// START GAME
// ==========================================
function startGame() {
    // Reset game state
    isWaiting = false;
    isGameRunning = true;
    isCrashed = false;
    multiplier = 1.00;
    chartHistory = [];
    crashPoint = generateCrashPoint();
    
    // Update display
    multiplierValue.textContent = '1.00';
    multiplierValue.className = '';
    gameStatus.textContent = '🚀 Playing...';
    countdownDisplay.textContent = '';
    resultMessage.textContent = '';
    betButton.disabled = true;
    cashOutButton.style.display = 'none';
    drawChart(1);
    updatePlayers();
    
    // Start multiplier loop
    startMultiplierLoop();
}

// ==========================================
// DRAW CHART
// ==========================================
function drawChart(currentMultiplier) {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);
    
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, h - 30);
    ctx.lineTo(w - 20, h - 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(50, h - 30);
    ctx.lineTo(50, 20);
    ctx.stroke();
    
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('0', 50, h - 15);
    ctx.fillText('Time', w - 20, h - 15);
    
    const maxMult = Math.max(currentMultiplier, 2);
    const scaleY = (h - 50) / maxMult;
    
    if (chartHistory.length < 2) return;
    
    const grad = ctx.createLinearGradient(50, h - 30, w - 20, 20);
    grad.addColorStop(0, '#4CAF50');
    grad.addColorStop(0.3, '#ffd93d');
    grad.addColorStop(0.6, '#ff9f43');
    grad.addColorStop(1, '#ff0000');
    
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    
    for (let i = 0; i < chartHistory.length; i++) {
        const x = 50 + (i / 120) * (w - 70);
        const y = h - 30 - (chartHistory[i].value / maxMult) * (h - 50);
        const clampedY = Math.max(20, Math.min(h - 30, y));
        if (i === 0) ctx.moveTo(x, clampedY);
        else ctx.lineTo(x, clampedY);
    }
    ctx.stroke();
    
    if (isCrashed) {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        const lastX = 50 + ((chartHistory.length - 1) / 120) * (w - 70);
        ctx.moveTo(lastX, h - 30);
        ctx.lineTo(lastX, 20);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    if (hasBet && isCashedOut) {
        const cashOutY = h - 30 - (betMultiplier / maxMult) * (h - 50);
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(50, cashOutY);
        ctx.lineTo(w - 20, cashOutY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = '#4CAF50';
        ctx.font = '11px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`💰 ${betMultiplier.toFixed(2)}x`, w - 25, cashOutY - 5);
    }
    
    if (chartHistory.length > 0) {
        const last = chartHistory[chartHistory.length - 1];
        const lastX = 50 + ((chartHistory.length - 1) / 120) * (w - 70);
        const lastY = h - 30 - (last.value / maxMult) * (h - 50);
        const clampedY = Math.max(20, Math.min(h - 30, lastY));
        
        const gradient = ctx.createRadialGradient(lastX, clampedY, 2, lastX, clampedY, 12);
        if (isCrashed) {
            gradient.addColorStop(0, 'rgba(255,0,0,0.8)');
            gradient.addColorStop(1, 'rgba(255,0,0,0)');
        } else {
            gradient.addColorStop(0, 'rgba(255,215,0,0.8)');
            gradient.addColorStop(1, 'rgba(255,215,0,0)');
        }
        ctx.beginPath();
        ctx.arc(lastX, clampedY, 12, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(lastX, clampedY, 5, 0, Math.PI * 2);
        ctx.fillStyle = isCrashed ? '#ff0000' : '#ffd93d';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// ==========================================
// PLAYERS
// ==========================================
function updatePlayers() {
    if (!playersList) return;
    playersList.innerHTML = '';
    
    const allPlayers = [...players];
    if (hasBet) {
        const existing = allPlayers.find(p => p.isUser);
        if (!existing) {
            allPlayers.push({ name: userName, bet: betAmount, multiplier: betMultiplier, isUser: true, cashedOut: isCashedOut });
        } else {
            existing.multiplier = betMultiplier;
            existing.cashedOut = isCashedOut;
        }
    }
    
    allPlayers.sort((a, b) => b.bet - a.bet);
    
    allPlayers.forEach((p, i) => {
        const li = document.createElement('li');
        li.className = p.isUser ? 'user-bet' : 'other-bet';
        let status = '⏳';
        if (p.cashedOut) status = '✅';
        else if (isCrashed) status = '💥';
        li.innerHTML = `<span>${i+1}. ${p.name}</span><span>💰 $${p.bet.toLocaleString()}</span><span>🎯 ${p.multiplier.toFixed(2)}x ${status}</span>`;
        playersList.appendChild(li);
    });
    
    if (allPlayers.length === 0) {
        const li = document.createElement('li');
        li.style.textAlign = 'center';
        li.style.color = '#666';
        li.textContent = 'No players yet';
        playersList.appendChild(li);
    }
}

// ==========================================
// CASH OUT
// ==========================================
function doCashOut() {
    if (!hasBet || isCashedOut || isCrashed || isWaiting) return;
    
    isCashedOut = true;
    const winAmount = Math.floor(betAmount * betMultiplier);
    userBalance += winAmount;
    updateBalanceDisplay();
    
    const msg = `🎉 Won $${winAmount.toLocaleString()} (${betMultiplier.toFixed(2)}x)`;
    resultMessage.textContent = msg;
    resultMessage.style.color = '#4CAF50';
    cashOutButton.style.display = 'none';
    
    addHistory(msg, 'win');
    updatePlayers();
    hasBet = false;
    betButton.disabled = false;
}

// ==========================================
// CRASH
// ==========================================
function crashGame() {
    isGameRunning = false;
    isCrashed = true;
    
    // Stop interval
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    
    crashHistory.push(multiplier);
    if (crashHistory.length > 50) crashHistory.shift();
    saveCrashHistory(crashHistory);
    updateCrashHistory();
    
    multiplierValue.className = 'crashed';
    gameStatus.textContent = '💥 CRASHED!';
    betButton.disabled = true;
    cashOutButton.style.display = 'none';
    
    if (hasBet && !isCashedOut) {
        const msg = `💔 Lost $${betAmount.toLocaleString()} (${multiplier.toFixed(2)}x)`;
        resultMessage.textContent = msg;
        resultMessage.style.color = '#f44336';
        addHistory(msg, 'lose');
        hasBet = false;
        betButton.disabled = false;
    }
    
    drawChart(multiplier);
    addHistory(`💥 Crashed at ${multiplier.toFixed(2)}x`, 'crash');
    updatePlayers();
    
    // Wait 1.5 seconds then start betting phase
    setTimeout(() => {
        startBettingPhase();
    }, 1500);
}

// ==========================================
// START BETTING PHASE (10 second countdown)
// ==========================================
function startBettingPhase() {
    // Clear everything
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    isWaiting = true;
    isCountdownRunning = true;
    countdownValue = 10;
    multiplier = 1.00;
    isCrashed = false;
    isGameRunning = false;
    hasBet = false;
    isCashedOut = false;
    players = [];
    chartHistory = [];
    
    // Update display
    multiplierValue.textContent = '1.00';
    multiplierValue.className = '';
    gameStatus.textContent = `⏳ Place your bet! ${countdownValue}s`;
    countdownDisplay.textContent = countdownValue;
    betButton.disabled = false;
    cashOutButton.style.display = 'none';
    resultMessage.textContent = '';
    drawChart(1);
    updatePlayers();
    
    // Start countdown
    countdownInterval = setInterval(() => {
        countdownValue--;
        if (countdownValue > 0) {
            countdownDisplay.textContent = countdownValue;
            gameStatus.textContent = `⏳ Place your bet! ${countdownValue}s`;
        } else {
            clearInterval(countdownInterval);
            countdownInterval = null;
            countdownDisplay.textContent = '';
            isCountdownRunning = false;
            // START GAME IMMEDIATELY
            startGame();
        }
    }, 1000);
}

// ==========================================
// PLACE BET
// ==========================================
betButton.addEventListener('click', () => {
    if (!isWaiting || !isCountdownRunning) {
        resultMessage.textContent = '⏳ Betting phase is over!';
        resultMessage.style.color = '#ffd93d';
        return;
    }
    
    if (hasBet) {
        resultMessage.textContent = '⏳ You already bet';
        resultMessage.style.color = '#ffd93d';
        return;
    }
    
    const bet = parseInt(betInput.value);
    if (isNaN(bet) || bet < 1) {
        resultMessage.textContent = '⚠️ Minimum bet is $1';
        resultMessage.style.color = 'orange';
        return;
    }
    if (bet > userBalance) {
        resultMessage.textContent = '⚠️ Insufficient balance';
        resultMessage.style.color = 'orange';
        return;
    }
    
    const autoCashOut = parseFloat(autoCashOutInput.value);
    if (!isNaN(autoCashOut) && autoCashOut > 1.00) {
        autoCashOutMultiplier = autoCashOut;
        autoCashOutEnabled = true;
    } else {
        autoCashOutEnabled = false;
        autoCashOutMultiplier = 0;
    }
    
    betAmount = bet;
    userBalance -= bet;
    hasBet = true;
    isCashedOut = false;
    betMultiplier = 1.00;
    
    updateBalanceDisplay();
    betButton.disabled = true;
    resultMessage.textContent = `✅ Bet $${bet.toLocaleString()} placed!`;
    resultMessage.style.color = '#4CAF50';
    cashOutButton.style.display = 'none';
    
    players.push({ name: userName, bet: bet, multiplier: 1.00, isUser: true, cashedOut: false });
    updatePlayers();
});

// ==========================================
// CASH OUT BUTTON
// ==========================================
cashOutButton.addEventListener('click', doCashOut);

// ==========================================
// QUICK BET BUTTONS
// ==========================================
document.querySelectorAll('.quick-bet').forEach(btn => {
    btn.addEventListener('click', () => {
        betInput.value = btn.dataset.amount;
    });
});

// ==========================================
// AUTO CASH OUT INPUT
// ==========================================
autoCashOutInput.addEventListener('input', () => {
    const val = parseFloat(autoCashOutInput.value);
    if (!isNaN(val) && val > 1.00) {
        autoCashOutMultiplier = val;
        autoCashOutEnabled = true;
    } else {
        autoCashOutEnabled = false;
        autoCashOutMultiplier = 0;
    }
});

// ==========================================
// TELEGRAM BUTTON
// ==========================================
tg.MainButton.setText("❌ Close");
tg.MainButton.show();
tg.MainButton.onClick(() => tg.close());

// ==========================================
// INITIALIZE
// ==========================================
loadAndDisplayHistory();
startBettingPhase();
