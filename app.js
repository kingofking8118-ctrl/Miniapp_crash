// ==========================================
// اتصال به SDK تلگرام
// ==========================================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ==========================================
// دریافت اطلاعات کاربر و موجودی ذخیره‌شده
// ==========================================
const user = tg.initDataUnsafe?.user;
let userName = 'کاربر مهمان';
let userUsername = '';

if (user) {
    userName = user.first_name || 'کاربر';
    if (user.last_name) userName += ' ' + user.last_name;
    userUsername = user.username ? '@' + user.username : '';
}

document.getElementById('welcomeMessage').textContent = userName;
document.getElementById('userUsername').textContent = userUsername;
document.getElementById('userAvatar').textContent = userName.charAt(0).toUpperCase();

// ==========================================
// مدیریت موجودی با localStorage
// ==========================================
const STORAGE_KEY = 'crash_game_balance_' + (user?.id || 'guest');

function loadBalance() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        return parseInt(saved);
    }
    return 10000;
}

function saveBalance() {
    localStorage.setItem(STORAGE_KEY, userBalance.toString());
}

let userBalance = loadBalance();

// ==========================================
// متغیرهای اصلی بازی
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

// ==========================================
// عناصر
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
// به‌روزرسانی موجودی
// ==========================================
function updateBalanceDisplay() {
    balanceDisplay.textContent = userBalance.toLocaleString();
    gameBalanceDisplay.textContent = userBalance.toLocaleString();
    saveBalance();
}

updateBalanceDisplay();

// ==========================================
// دکمه افزایش موجودی
// ==========================================
document.getElementById('addMoneyBtn').addEventListener('click', () => {
    userBalance += 1000;
    updateBalanceDisplay();
    resultMessage.textContent = '💰 ۱۰۰۰ تومان اضافه شد!';
    resultMessage.style.color = '#4CAF50';
    setTimeout(() => { resultMessage.textContent = ''; }, 3000);
});

// ==========================================
// توابع سراسری
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
// تولید نقطه سقوط
// ==========================================
function generateCrashPoint() {
    const r = Math.random() * 100;
    if (r < 55) return 1.05 + Math.random() * 0.94;
    if (r < 75) return 2.00 + Math.random() * 1.0;
    if (r < 90) return 3.00 + Math.random() * 2.0;
    if (r < 97) return 5.00 + Math.random() * 3.0;
    return 8.00 + Math.random() * 7.0;
}

// ==========================================
// افزایش ضریب (خیلی آروم)
// ==========================================
function increaseMultiplier() {
    if (!isGameRunning || isCrashed) return;
    
    const elapsed = (Date.now() - roundStartTime) / 1000;
    
    // سرعت خیلی آروم
    let speed = 0.0015;
    
    // از ثانیه ۸ به بعد، آروم‌آروم تندتر
    if (elapsed > 8) {
        speed += (elapsed - 8) * 0.001;
    }
    
    speed = Math.min(speed, 0.035);
    speed *= (0.9 + Math.random() * 0.2);
    
    multiplier += speed;
    multiplier = Math.round(multiplier * 1000) / 1000;
    multiplier = Math.round(multiplier * 100) / 100;
    
    multiplierValue.textContent = multiplier.toFixed(2);
    updateChart(multiplier);
    
    // رنگ‌بندی زیبا
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
        cashOutButton.textContent = `💰 برداشت در ${multiplier.toFixed(2)}x`;
    }
    
    if (multiplier >= crashPoint) {
        crashGame();
        return;
    }
    
    animationId = requestAnimationFrame(increaseMultiplier);
}

// ==========================================
// شمارش معکوس
// ==========================================
function startCountdown() {
    isWaiting = true;
    countdownValue = 10;
    gameStatus.textContent = `⏳ شروع راند بعدی`;
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
        } else {
            clearInterval(countdownInterval);
            countdownInterval = null;
            countdownDisplay.textContent = '';
            startNewRound();
        }
    }, 1000);
}

// ==========================================
// شروع راند
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
    gameStatus.textContent = '🎯 در حال بازی';
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
// رسم نمودار
// ==========================================
let chartHistory = [];

function updateChart(currentMultiplier) {
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
    
    const maxMult = Math.max(currentMultiplier, 1.5);
    const scaleY = (h - 50) / maxMult;
    
    const grad = ctx.createLinearGradient(50, h - 30, w - 20, 20);
    grad.addColorStop(0, '#4CAF50');
    grad.addColorStop(0.3, '#ffd93d');
    grad.addColorStop(0.6, '#ff9f43');
    grad.addColorStop(1, '#ff0000');
    
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const pts = getChartPoints(currentMultiplier);
    for (let i = 0; i < pts.length; i++) {
        const x = 50 + (pts[i].time / 100) * (w - 70);
        const y = h - 30 - (pts[i].value / maxMult) * (h - 50);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    if (hasBet && isCashedOut) {
        const cy = h - 30 - (betMultiplier / maxMult) * (h - 50);
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(50, cy);
        ctx.lineTo(w - 20, cy);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function getChartPoints(v) {
    if (chartHistory.length > 100) chartHistory.shift();
    chartHistory.push({ time: chartHistory.length, value: v });
    return chartHistory;
}

// ==========================================
// بازیکنان
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
        li.innerHTML = `<span>${i+1}. ${p.name}</span><span>💰 ${p.bet.toLocaleString()}</span><span>🎯 ${p.multiplier.toFixed(2)}x ${status}</span>`;
        playersList.appendChild(li);
    });
}

// ==========================================
// شرط‌بندی
// ==========================================
betButton.addEventListener('click', () => {
    if (isWaiting) {
        resultMessage.textContent = '⏳ صبر کن تا راند شروع بشه';
        resultMessage.style.color = '#ffd93d';
        return;
    }
    if (!isGameRunning || isCrashed) {
        resultMessage.textContent = '⏳ منتظر راند بعدی باش';
        resultMessage.style.color = '#ffd93d';
        return;
    }
    if (hasBet) {
        resultMessage.textContent = '⏳ قبلاً شرط بستی';
        resultMessage.style.color = '#ffd93d';
        return;
    }
    
    const bet = parseInt(betInput.value);
    if (isNaN(bet) || bet < 100) {
        resultMessage.textContent = '⚠️ حداقل شرط ۱۰۰ تومانه';
        resultMessage.style.color = 'orange';
        return;
    }
    if (bet > userBalance) {
        resultMessage.textContent = '⚠️ موجودی کافی نیست';
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
    cashOutButton.textContent = `💰 برداشت در ${multiplier.toFixed(2)}x`;
    betButton.disabled = true;
    resultMessage.textContent = `✅ شرط ${bet.toLocaleString()} تومان بسته شد`;
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
    
    resultMessage.textContent = `🎉 برد ${winAmount.toLocaleString()} تومان (x${betMultiplier.toFixed(2)})`;
    resultMessage.style.color = '#4CAF50';
    cashOutButton.style.display = 'none';
    
    addHistory(`🟢 برد ${winAmount.toLocaleString()} تومان (x${betMultiplier.toFixed(2)})`, 'win');
    updatePlayers();
    hasBet = false;
    betButton.disabled = false;
});

// ==========================================
// تاریخچه
// ==========================================
function addHistory(text, type) {
    const li = document.createElement('li');
    li.textContent = text;
    li.className = type;
    historyList.prepend(li);
    if (historyList.children.length > 20) historyList.removeChild(historyList.lastChild);
}

// ==========================================
// سقوط
// ==========================================
function crashGame() {
    isGameRunning = false;
    isCrashed = true;
    
    multiplierValue.className = 'crashed';
    gameStatus.textContent = '💥 سقوط!';
    betButton.disabled = true;
    cashOutButton.style.display = 'none';
    
    if (hasBet && !isCashedOut) {
        resultMessage.textContent = `💔 باخت ${betAmount.toLocaleString()} تومان (x${multiplier.toFixed(2)})`;
        resultMessage.style.color = '#f44336';
        addHistory(`🔴 باخت ${betAmount.toLocaleString()} تومان (x${multiplier.toFixed(2)})`, 'lose');
        hasBet = false;
        betButton.disabled = false;
    }
    
    updateChart(multiplier);
    addHistory(`💥 سقوط در ${multiplier.toFixed(2)}x`, 'crash');
    updatePlayers();
    
    setTimeout(startCountdown, 1500);
}

// ==========================================
// دکمه اصلی تلگرام
// ==========================================
tg.MainButton.setText("❌ بستن");
tg.MainButton.show();
tg.MainButton.onClick(() => tg.close());

// ==========================================
// شروع
// ==========================================
startCountdown();
