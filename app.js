// ==========================================
// Connect to Telegram SDK
// ==========================================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ==========================================
// Get user info and saved balance
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
// Balance management with localStorage
// ==========================================
const STORAGE_KEY = 'crash_game_balance_' + (user?.id || 'guest');

function loadBalance() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        return parseInt(saved);
    }
    return 1000; // Start with $1000
}

function saveBalance() {
    localStorage.setItem(STORAGE_KEY, userBalance.toString());
}

let userBalance = loadBalance();

// ==========================================
// Game variables
// ==========================================
let multiplier = 1.00;
let isGameRunning = false;
let isCrashed = false;
let isWaiting = true;
let animationId = null;
let crashPoint = 0;
let players = [];
let hasBet = false;
let betMultiplier = 0;
let isCashedOut = false;
let betAmount = 0;
let roundStartTime = 0;
let countdownValue = 10;
let countdownInterval = null;
let chartHistory = [];

// ==========================================
// Elements
// ==========================================
const multiplierValue = document.getElementById('multiplierValue');
const gameStatus = document.getElementById('gameStatus');
const betButton = document.getElementById('betButton');
const cashOutButton = document.getElementById('cashOutButton');
const betInput = document.getElementById('betInput');
const resultMessage = document.getElementById('resultMessage');
const historyList = document.getElementById('historyList');
const canvas = document.getElementById('chartCanvas');
const ctx = canvas.getContext('2d');
const playersList = document.getElementById('playersList');
const balanceDisplay = document.getElementById('balanceDisplay');
const gameBalanceDisplay = document.getElementById('gameBalanceDisplay');
const countdownDisplay = document.getElementById('countdownDisplay');

cashOutButton.style.display = 'none';

// ==========================================
// Update balance display
// ==========================================
function updateBalanceDisplay() {
    balanceDisplay.textContent = '$' + userBalance.toLocaleString();
    gameBalanceDisplay.textContent = '$' + userBalance.toLocaleString();
    saveBalance();
}

updateBalanceDisplay();

// ==========================================
// Add money button (demo)
// ==========================================
document.getElementById('addMoneyBtn').addEventListener('click', () => {
    userBalance += 100;
    updateBalanceDisplay();
    resultMessage.textContent = '✅ +$100 added!';
    resultMessage.style.color = '#4CAF50';
    setTimeout(() => { resultMessage.textContent = ''; }, 3000);
});

// ==========================================
// Global functions
// ==========================================
function startGameFromLobby() {
    if (isGameRunning || isWaiting) return;
    startCountdown();
}

function stopGame() {
    if (animationId) cancelAnimationFrame(animationId);
    if (countdownInterval) clearInterval(countdownInterval);
    isGameRunning = false;
    isWaiting = true;
}

// ==========================================
// Generate crash point (NEW PROBABILITY)
// ==========================================
function generateCrashPoint() {
    const r = Math.random() * 100;
    
    // 20% chance: exactly 1.00 (instant crash)
    if (r < 20) {
        return 1.00;
    }
    // 60% chance: 1.01 to 1.99
    if (r < 80) {
        return 1.01 + Math.random() * 0.98;
    }
    // 10% chance: 2.00 to 2.99
    if (r < 90) {
        return 2.00 + Math.random() * 0.99;
    }
    // 7% chance: 3.00 to 5.99
    if (r < 97) {
        return 3.00 + Math.random() * 2.99;
    }
    // 3% chance: 6.00 and above
    return 6.00 + Math.random() * 8.99;
}

// ==========================================
// Increase multiplier (VERY SLOW)
// ==========================================
function increaseMultiplier() {
    if (!isGameRunning || isCrashed) return;
    
    const elapsed = (Date.now() - roundStartTime) / 1000;
    
    // Extremely slow speed
    let speed = 0.0008;
    
    // After 12 seconds, slightly faster
    if (elapsed > 12) {
        speed += (elapsed - 12) * 0.0005;
    }
    
    // Max speed very low
    speed = Math.min(speed, 0.018);
    speed *= (0.9 + Math.random() * 0.2);
    
    multiplier += speed;
    multiplier = Math.round(multiplier * 1000) / 1000;
    multiplier = Math.round(multiplier * 100) / 100;
    
    multiplierValue.textContent = multiplier.toFixed(2);
    updateChart(multiplier);
    
    // Color coding
    if (multiplier < 1.5) {
        multiplierValue.style.color = '#4CAF50';
    } else if (multiplier < 2.5) {
        multiplierValue.style.color = '#ffd93d';
    } else if (multiplier < 4) {
        multiplierValue.style.color = '#ff9f43';
    } else if (multiplier < 6) {
        multiplierValue.style.color = '#ff6b6b';
    } else {
        multiplierValue.style.color = '#ff0000';
    }
    
    if (hasBet && !isCashedOut) {
        betMultiplier = multiplier;
        cashOutButton.textContent = `💰 Cash Out at ${multiplier.toFixed(2)}x`;
    }
    
    // Check crash
    if (multiplier >= crashPoint) {
        crashGame();
        return;
    }
    
    animationId = requestAnimationFrame(increaseMultiplier);
}

// ==========================================
// Countdown
// ==========================================
function startCountdown() {
    isWaiting = true;
    countdownValue = 10;
    gameStatus.textContent = `⏳ Next round in ${countdownValue}s...`;
    countdownDisplay.textContent = countdownValue;
    betButton.disabled = true;
    cashOutButton.style.display = 'none';
    resultMessage.textContent = '';
    
    chartHistory = [];
    updateChart(1);
    
    if (countdownInterval) clearInterval(countdownInterval);
    
    countdownInterval = setInterval(() => {
        countdownValue--;
        if (countdownValue > 0) {
            countdownDisplay.textContent = countdownValue;
            gameStatus.textContent = `⏳ Next round in ${countdownValue}s...`;
        } else {
            clearInterval(countdownInterval);
            countdownInterval = null;
            countdownDisplay.textContent = '';
            startNewRound();
        }
    }, 1000);
}

// ==========================================
// Start new round
// ==========================================
function startNewRound() {
    isWaiting = false;
    multiplier = 1.00;
    isCrashed = false;
    isGameRunning = true;
    hasBet = false;
    isCashedOut = false;
    players = [];
    chartHistory = [];
    crashPoint = generateCrashPoint();
    roundStartTime = Date.now();
    
    multiplierValue.textContent = multiplier.toFixed(2);
    multiplierValue.className = '';
    gameStatus.textContent = '🎯 Playing...';
    countdownDisplay.textContent = '';
    resultMessage.textContent = '';
    betButton.disabled = false;
    cashOutButton.style.display = 'none';
    updateChart(1);
    updatePlayers();
    
    if (animationId) cancelAnimationFrame(animationId);
    increaseMultiplier();
}

// ==========================================
// Draw chart (FIXED)
// ==========================================
function updateChart(currentMultiplier) {
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);
    
    // Horizontal axis
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, h - 30);
    ctx.lineTo(w - 20, h - 30);
    ctx.stroke();
    
    // Vertical axis
    ctx.beginPath();
    ctx.moveTo(50, h - 30);
    ctx.lineTo(50, 20);
    ctx.stroke();
    
    // Labels
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('0', 50, h - 15);
    ctx.fillText('Time', w - 20, h - 15);
    
    const maxMult = Math.max(currentMultiplier, 2);
    const scaleY = (h - 50) / maxMult;
    
    // Add point to history
    chartHistory.push({
        time: chartHistory.length,
        value: currentMultiplier
    });
    
    if (chartHistory.length > 120) {
        chartHistory.shift();
    }
    
    if (chartHistory.length < 2) return;
    
    // Gradient line
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
        
        if (i === 0) {
            ctx.moveTo(x, clampedY);
        } else {
            ctx.lineTo(x, clampedY);
        }
    }
    ctx.stroke();
    
    // Crash line
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
    
    // Cash out line
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
    
    // Rocket point
    if (chartHistory.length > 0) {
        const last = chartHistory[chartHistory.length - 1];
        const lastX = 50 + ((chartHistory.length - 1) / 120) * (w - 70);
        const lastY = h - 30 - (last.value / maxMult) * (h - 50);
        const clampedY = Math.max(20, Math.min(h - 30, lastY));
        
        // Glow
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
        
        // Main point
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
// Update players
// ==========================================
function updatePlayers() {
    if (!playersList) return;
    playersList.innerHTML = '';
    
    if (hasBet) {
        const existing = players.find(p => p.isUser);
        if (!existing) {
            players.push({ name: userName, bet: betAmount, multiplier: betMultiplier, isUser: true, cashedOut: isCashedOut });
        } else {
            existing.multiplier = betMultiplier;
            existing.cashedOut = isCashedOut;
        }
    }
    
    players.sort((a, b) => b.bet - a.bet);
    players.slice(0, 5).forEach((p, i) => {
        const li = document.createElement('li');
        li.className = p.isUser ? 'user-bet' : 'other-bet';
        const status = p.cashedOut ? '✅' : (isCrashed ? '💥' : '⏳');
        li.innerHTML = `<span>${i+1}. ${p.name}</span><span>💰 $${p.bet.toLocaleString()}</span><span>🎯 ${p.multiplier.toFixed(2)}x ${status}</span>`;
        playersList.appendChild(li);
    });
}

// ==========================================
// Place bet
// ==========================================
betButton.addEventListener('click', () => {
    if (isWaiting) {
        resultMessage.textContent = '⏳ Wait for round to start';
        resultMessage.style.color = '#ffd93d';
        return;
    }
    if (!isGameRunning || isCrashed) {
        resultMessage.textContent = '⏳ Wait for next round';
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
    
    betAmount = bet;
    userBalance -= bet;
    hasBet = true;
    isCashedOut = false;
    betMultiplier = multiplier;
    
    updateBalanceDisplay();
    
    cashOutButton.style.display = 'block';
    cashOutButton.textContent = `💰 Cash Out at ${multiplier.toFixed(2)}x`;
    betButton.disabled = true;
    resultMessage.textContent = `✅ Bet $${bet.toLocaleString()} placed!`;
    resultMessage.style.color = '#4CAF50';
    
    players.push({ name: userName, bet: bet, multiplier: multiplier, isUser: true, cashedOut: false });
    updatePlayers();
});

// ==========================================
// Cash Out
// ==========================================
cashOutButton.addEventListener('click', () => {
    if (!hasBet || isCashedOut || isCrashed || isWaiting) return;
    
    isCashedOut = true;
    const winAmount = Math.floor(betAmount * betMultiplier);
    userBalance += winAmount;
    updateBalanceDisplay();
    
    resultMessage.textContent = `🎉 Won $${winAmount.toLocaleString()} (${betMultiplier.toFixed(2)}x)`;
    resultMessage.style.color = '#4CAF50';
    cashOutButton.style.display = 'none';
    
    addHistory(`🟢 Won $${winAmount.toLocaleString()} (${betMultiplier.toFixed(2)}x)`, 'win');
    updatePlayers();
    hasBet = false;
    betButton.disabled = false;
});

// ==========================================
// History
// ==========================================
function addHistory(text, type) {
    const li = document.createElement('li');
    li.textContent = text;
    li.className = type;
    historyList.prepend(li);
    if (historyList.children.length > 20) historyList.removeChild(historyList.lastChild);
}

// ==========================================
// Crash
// ==========================================
function crashGame() {
    isGameRunning = false;
    isCrashed = true;
    
    multiplierValue.className = 'crashed';
    gameStatus.textContent = '💥 CRASHED!';
    betButton.disabled = true;
    cashOutButton.style.display = 'none';
    
    if (hasBet && !isCashedOut) {
        resultMessage.textContent = `💔 Lost $${betAmount.toLocaleString()} (${multiplier.toFixed(2)}x)`;
        resultMessage.style.color = '#f44336';
        addHistory(`🔴 Lost $${betAmount.toLocaleString()} (${multiplier.toFixed(2)}x)`, 'lose');
        hasBet = false;
        betButton.disabled = false;
    }
    
    updateChart(multiplier);
    addHistory(`💥 Crashed at ${multiplier.toFixed(2)}x`, 'crash');
    updatePlayers();
    
    setTimeout(startCountdown, 1500);
}

// ==========================================
// Telegram main button
// ==========================================
tg.MainButton.setText("❌ Close");
tg.MainButton.show();
tg.MainButton.onClick(() => tg.close());

// ==========================================
// Start
// ==========================================
startCountdown();
