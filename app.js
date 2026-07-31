// ==========================================
// VERY SIMPLE CRASH GAME - FROM SCRATCH
// ==========================================

// Telegram
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// User info
const user = tg.initDataUnsafe?.user;
let userName = user?.first_name || 'Guest';

document.getElementById('welcomeMessage').textContent = userName;
document.getElementById('userUsername').textContent = user?.username ? '@' + user.username : '';
document.getElementById('userAvatar').textContent = userName.charAt(0).toUpperCase();

// Balance
let userBalance = 1000;
document.getElementById('balanceDisplay').textContent = '$' + userBalance;
document.getElementById('gameBalanceDisplay').textContent = '$' + userBalance;

// ==========================================
// GAME STATE
// ==========================================
let multiplier = 1.00;
let isPlaying = false;
let isCrashed = false;
let intervalId = null;
let crashPoint = 0;
let hasBet = false;
let betAmount = 0;
let betMultiplier = 0;
let isCashedOut = false;
let chartData = [];
let countdown = 10;
let countdownId = null;

// Elements
const multiplierEl = document.getElementById('multiplierValue');
const statusEl = document.getElementById('gameStatus');
const countdownEl = document.getElementById('countdownDisplay');
const betBtn = document.getElementById('betButton');
const cashBtn = document.getElementById('cashOutButton');
const betInput = document.getElementById('betInput');
const resultEl = document.getElementById('resultMessage');
const canvas = document.getElementById('chartCanvas');
const ctx = canvas.getContext('2d');
const playersList = document.getElementById('playersList');

cashBtn.style.display = 'none';

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function updateBalance() {
    document.getElementById('balanceDisplay').textContent = '$' + userBalance;
    document.getElementById('gameBalanceDisplay').textContent = '$' + userBalance;
}

function addMoney() {
    userBalance += 100;
    updateBalance();
    resultEl.textContent = '✅ +$100 added!';
    resultEl.style.color = '#4CAF50';
    setTimeout(() => resultEl.textContent = '', 2000);
}
document.getElementById('addMoneyBtn').addEventListener('click', addMoney);

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
    
    // Last point
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
// START THE GAME - THE MULTIPLIER GOES UP
// ==========================================
function startGame() {
    // Reset
    isPlaying = true;
    isCrashed = false;
    multiplier = 1.00;
    chartData = [];
    crashPoint = 1.00 + Math.random() * 8;
    
    // Update UI
    multiplierEl.textContent = '1.00';
    multiplierEl.style.color = '#4CAF50';
    statusEl.textContent = '🚀 Playing...';
    countdownEl.textContent = '';
    betBtn.disabled = true;
    cashBtn.style.display = 'none';
    resultEl.textContent = '';
    
    // If user has bet, show cash out button
    if (hasBet && !isCashedOut) {
        cashBtn.style.display = 'block';
        cashBtn.textContent = '💰 Cash Out at 1.00x';
    }
    
    // Start multiplier loop
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => {
        // Check if game is over
        if (!isPlaying || isCrashed) {
            clearInterval(intervalId);
            intervalId = null;
            return;
        }
        
        // Increase multiplier - VERY SLOW
        multiplier += 0.00006;
        multiplier = Math.round(multiplier * 100) / 100;
        
        // Update display
        multiplierEl.textContent = multiplier.toFixed(2);
        
        // Color
        if (multiplier < 1.5) multiplierEl.style.color = '#4CAF50';
        else if (multiplier < 2.5) multiplierEl.style.color = '#ffd93d';
        else if (multiplier < 4) multiplierEl.style.color = '#ff9f43';
        else if (multiplier < 6) multiplierEl.style.color = '#ff6b6b';
        else multiplierEl.style.color = '#ff0000';
        
        // Update chart
        chartData.push(multiplier);
        if (chartData.length > 100) chartData.shift();
        drawChart();
        
        // Update cash out button
        if (hasBet && !isCashedOut) {
            betMultiplier = multiplier;
            cashBtn.textContent = '💰 Cash Out at ' + multiplier.toFixed(2) + 'x';
        }
        
        // Check crash
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
    
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    
    multiplierEl.className = 'crashed';
    statusEl.textContent = '💥 CRASHED!';
    cashBtn.style.display = 'none';
    
    if (hasBet && !isCashedOut) {
        resultEl.textContent = '💔 Lost $' + betAmount + ' (' + multiplier.toFixed(2) + 'x)';
        resultEl.style.color = '#f44336';
        hasBet = false;
        betBtn.disabled = false;
    }
    
    drawChart();
    
    // Next round after 1.5s
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
    userBalance += winAmount;
    updateBalance();
    
    resultEl.textContent = '🎉 Won $' + winAmount + ' (' + betMultiplier.toFixed(2) + 'x)';
    resultEl.style.color = '#4CAF50';
    cashBtn.style.display = 'none';
    
    hasBet = false;
    betBtn.disabled = false;
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
    if (bet > userBalance) {
        resultEl.textContent = '⚠️ Not enough balance!';
        resultEl.style.color = 'orange';
        return;
    }
    
    betAmount = bet;
    userBalance -= bet;
    hasBet = true;
    isCashedOut = false;
    betMultiplier = 1.00;
    
    updateBalance();
    betBtn.disabled = true;
    resultEl.textContent = '✅ Bet $' + bet + ' placed!';
    resultEl.style.color = '#4CAF50';
    
    // Show cash out button
    cashBtn.style.display = 'block';
    cashBtn.textContent = '💰 Cash Out at 1.00x';
});

// ==========================================
// COUNTDOWN (10 seconds to bet)
// ==========================================
let isWaiting = false;

function startCountdown() {
    // Stop everything
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
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
    chartData = [];
    players = [];
    
    multiplierEl.textContent = '1.00';
    multiplierEl.className = '';
    multiplierEl.style.color = '#4CAF50';
    statusEl.textContent = '⏳ Place your bet! ' + countdown + 's';
    countdownEl.textContent = countdown;
    betBtn.disabled = false;
    cashBtn.style.display = 'none';
    resultEl.textContent = '';
    drawChart();
    updatePlayers();
    
    countdownId = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            countdownEl.textContent = countdown;
            statusEl.textContent = '⏳ Place your bet! ' + countdown + 's';
        } else {
            clearInterval(countdownId);
            countdownId = null;
            countdownEl.textContent = '';
            isWaiting = false;
            // START GAME IMMEDIATELY
            startGame();
        }
    }, 1000);
}

// ==========================================
// PLAYERS (fake for demo)
// ==========================================
let players = [];

function updatePlayers() {
    playersList.innerHTML = '';
    if (hasBet) {
        players.push({ name: userName, bet: betAmount, multiplier: betMultiplier, isUser: true });
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
        li.className = p.isUser ? 'user-bet' : 'other-bet';
        li.innerHTML = `<span>${i+1}. ${p.name}</span><span>💰 $${p.bet}</span><span>🎯 ${p.multiplier.toFixed(2)}x</span>`;
        playersList.appendChild(li);
    });
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
