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
let chartHistory = [];

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
// تولید نقطه سقوط (۷۰٪ زیر ۲)
// ==========================================
function generateCrashPoint() {
    const r = Math.random() * 100;
    
    // ۷۰٪ شانس زیر ۲
    if (r < 70) {
        return 1.05 + Math.random() * 0.94; // ۱.۰۵ تا ۱.۹۹
    }
    // ۱۵٪ شانس بین ۲ تا ۳
    if (r < 85) {
        return 2.00 + Math.random() * 0.99; // ۲.۰۰ تا ۲.۹۹
    }
    // ۱۰٪ شانس بین ۳ تا ۶
    if (r < 95) {
        return 3.00 + Math.random() * 2.99; // ۳.۰۰ تا ۵.۹۹
    }
    // ۵٪ شانس ۶ به بالا
    return 6.00 + Math.random() * 8.99; // ۶.۰۰ تا ۱۴.۹۹
}

// ==========================================
// افزایش ضریب (خیلی خیلی آروم)
// ==========================================
function increaseMultiplier() {
    if (!isGameRunning || isCrashed) return;
    
    const elapsed = (Date.now() - roundStartTime) / 1000;
    
    // سرعت بسیار بسیار آروم
    let speed = 0.001;
    
    // از ثانیه ۱۰ به بعد، بسیار آروم تندتر میشه
    if (elapsed > 10) {
        speed += (elapsed - 10) * 0.0008;
    }
    
    // حداکثر سرعت بسیار پایین
    speed = Math.min(speed, 0.025);
    speed *= (0.9 + Math.random() * 0.2);
    
    multiplier += speed;
    multiplier = Math.round(multiplier * 1000) / 1000;
    multiplier = Math.round(multiplier * 100) / 100;
    
    multiplierValue.textContent = multiplier.toFixed(2);
    updateChart(multiplier);
    
    // رنگ‌بندی
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
    
    // ریست نمودار
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
// رسم نمودار (تصحیح‌شده)
// ==========================================
function updateChart(currentMultiplier) {
    const w = canvas.width;
    const h = canvas.height;
    
    // پاک کردن
    ctx.clearRect(0, 0, w, h);
    
    // پس‌زمینه
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, w, h);
    
    // محور افقی (زمان)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, h - 30);
    ctx.lineTo(w - 20, h - 30);
    ctx.stroke();
    
    // محور عمودی (ضریب)
    ctx.beginPath();
    ctx.moveTo(50, h - 30);
    ctx.lineTo(50, 20);
    ctx.stroke();
    
    // برچسب‌های محور
    ctx.fillStyle = '#666';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('0', 50, h - 15);
    ctx.fillText('زمان', w - 20, h - 15);
    
    // مقدار حداکثر برای مقیاس
    const maxMult = Math.max(currentMultiplier, 2);
    const scaleY = (h - 50) / maxMult;
    
    // اضافه کردن نقاط به تاریخچه
    chartHistory.push({
        time: chartHistory.length,
        value: currentMultiplier
    });
    
    // محدود کردن تعداد نقاط
    if (chartHistory.length > 120) {
        chartHistory.shift();
    }
    
    // اگر کمتر از ۲ نقطه داریم، رسم نکن
    if (chartHistory.length < 2) return;
    
    // رسم خط گرادیان
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
    
    // رسم نقاط
    for (let i = 0; i < chartHistory.length; i++) {
        const x = 50 + (i / 120) * (w - 70);
        const y = h - 30 - (chartHistory[i].value / maxMult) * (h - 50);
        
        // محدود کردن y به محدوده
        const clampedY = Math.max(20, Math.min(h - 30, y));
        
        if (i === 0) {
            ctx.moveTo(x, clampedY);
        } else {
            ctx.lineTo(x, clampedY);
        }
    }
    ctx.stroke();
    
    // اگر سقوط کرده، خط قرمز بکش
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
    
    // اگر کاربر برداشت کرده، خط سبز بکش
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
        
        // برچسب
        ctx.fillStyle = '#4CAF50';
        ctx.font = '11px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`💰 ${betMultiplier.toFixed(2)}x`, w - 25, cashOutY - 5);
    }
    
    // نقطه آخر (موشک)
    if (chartHistory.length > 0) {
        const last = chartHistory[chartHistory.length - 1];
        const lastX = 50 + ((chartHistory.length - 1) / 120) * (w - 70);
        const lastY = h - 30 - (last.value / maxMult) * (h - 50);
        const clampedY = Math.max(20, Math.min(h - 30, lastY));
        
        // دایره بزرگتر
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
        
        // نقطه اصلی
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
