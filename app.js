// ==========================================
// اتصال به SDK تلگرام
// ==========================================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// ==========================================
// متغیرهای اصلی بازی
// ==========================================
let multiplier = 1.00;
let isGameRunning = false;
let isCrashed = false;
let animationId = null;
let crashPoint = 0;
let gameHistory = [];
let players = [];
let userBet = 0;
let userBalance = 10000;
let hasBet = false;
let betMultiplier = 0;
let isCashedOut = false;
let betAmount = 0;
let roundStartTime = 0;

// عناصر صفحه
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

// ==========================================
// دکمه Cash Out رو مخفی کن
// ==========================================
cashOutButton.style.display = 'none';

// ==========================================
// تولید نقطه سقوط (۵۵٪ شانس زیر ۲)
// ==========================================
function generateCrashPoint() {
    const r = Math.random() * 100;
    
    // ۵۵٪ شانس سقوط زیر ۲ (سود سازنده بالا)
    if (r < 55) {
        return 1.05 + Math.random() * 0.94; // ۱.۰۵ تا ۱.۹۹
    }
    
    // ۲۰٪ شانس بین ۲ تا ۳
    if (r < 75) {
        return 2.00 + Math.random() * 1.0; // ۲.۰۰ تا ۲.۹۹
    }
    
    // ۱۵٪ شانس بین ۳ تا ۵
    if (r < 90) {
        return 3.00 + Math.random() * 2.0; // ۳.۰۰ تا ۴.۹۹
    }
    
    // ۷٪ شانس بین ۵ تا ۸
    if (r < 97) {
        return 5.00 + Math.random() * 3.0; // ۵.۰۰ تا ۷.۹۹
    }
    
    // ۳٪ شانس بالای ۸ (شانس نادر برای بردهای بزرگ)
    return 8.00 + Math.random() * 7.0; // ۸.۰۰ تا ۱۴.۹۹
}

// ==========================================
// افزایش ضریب با سرعت آروم و سپس تصاعدی
// ==========================================
function increaseMultiplier() {
    if (!isGameRunning) return;
    
    // محاسبه زمان سپری شده از شروع دور (به ثانیه)
    const elapsedTime = (Date.now() - roundStartTime) / 1000;
    
    // سرعت پایه: بسیار آروم در ابتدا
    let speed = 0.003;
    
    // افزایش تدریجی سرعت بر اساس زمان
    if (elapsedTime > 3) {
        const timeFactor = Math.pow(elapsedTime - 2, 1.5) / 10;
        speed = 0.003 + timeFactor * 0.015;
    }
    
    // محدود کردن سرعت تا از کنترل خارج نشه
    speed = Math.min(speed, 0.12);
    speed *= (0.9 + Math.random() * 0.2);
    
    multiplier += speed;
    multiplier = Math.round(multiplier * 100) / 100;
    
    multiplierValue.textContent = multiplier.toFixed(2);
    updateChart(multiplier);
    
    // تغییر رنگ بر اساس ضریب
    if (multiplier < 1.5) {
        multiplierValue.style.color = '#4CAF50';
    } else if (multiplier < 3) {
        multiplierValue.style.color = '#ffd93d';
    } else if (multiplier < 5) {
        multiplierValue.style.color = '#ff9f43';
    } else if (multiplier < 8) {
        multiplierValue.style.color = '#ff6b6b';
    } else {
        multiplierValue.style.color = '#ff0000';
    }
    
    // به‌روزرسانی ضریب شرط کاربر
    if (hasBet && !isCashedOut) {
        betMultiplier = multiplier;
        cashOutButton.textContent = `💰 برداشت در ${multiplier.toFixed(2)}x`;
    }
    
    // بررسی سقوط
    if (multiplier >= crashPoint) {
        crashGame();
        return;
    }
    
    animationId = requestAnimationFrame(increaseMultiplier);
}

// ==========================================
// رسم نمودار
// ==========================================
let chartHistory = [];

function updateChart(currentMultiplier) {
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, height - 30);
    ctx.lineTo(width - 20, height - 30);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(50, height - 30);
    ctx.lineTo(50, 20);
    ctx.stroke();
    
    const maxMultiplier = Math.max(currentMultiplier, 1.5);
    const scaleX = (width - 70) / 100;
    const scaleY = (height - 50) / maxMultiplier;
    
    const gradient = ctx.createLinearGradient(50, height - 30, width - 20, 20);
    gradient.addColorStop(0, '#4CAF50');
    gradient.addColorStop(0.3, '#ffd93d');
    gradient.addColorStop(0.6, '#ff9f43');
    gradient.addColorStop(1, '#ff0000');
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    const points = getChartPoints(currentMultiplier);
    for (let i = 0; i < points.length; i++) {
        const x = 50 + (points[i].time / 100) * (width - 70);
        const y = height - 30 - (points[i].value / maxMultiplier) * (height - 50);
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();
    
    // خط Cash Out کاربر
    if (hasBet && isCashedOut) {
        const cashOutY = height - 30 - (betMultiplier / maxMultiplier) * (height - 50);
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(50, cashOutY);
        ctx.lineTo(width - 20, cashOutY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = '#4CAF50';
        ctx.font = '12px Arial';
        ctx.fillText(`💰 ${betMultiplier.toFixed(2)}x`, width - 100, cashOutY - 5);
    }
    
    const lastPoint = points[points.length - 1];
    if (lastPoint) {
        const x = 50 + (lastPoint.time / 100) * (width - 70);
        const y = height - 30 - (lastPoint.value / maxMultiplier) * (height - 50);
        
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = currentMultiplier > 3 ? '#ff0000' : '#ffd93d';
        ctx.fill();
    }
}

function getChartPoints(currentMultiplier) {
    if (chartHistory.length > 100) {
        chartHistory.shift();
    }
    
    chartHistory.push({
        time: chartHistory.length,
        value: currentMultiplier
    });
    
    return chartHistory;
}

// ==========================================
// نمایش بازیکنان
// ==========================================
function updatePlayers() {
    if (!playersList) return;
    
    playersList.innerHTML = '';
    
    const user = tg.initDataUnsafe?.user;
    if (user && hasBet) {
        const existingUser = players.find(p => p.isUser);
        if (!existingUser) {
            players.push({
                name: user.first_name || 'شما',
                bet: betAmount,
                multiplier: betMultiplier,
                isUser: true,
                cashedOut: isCashedOut
            });
        } else {
            existingUser.multiplier = betMultiplier;
            existingUser.cashedOut = isCashedOut;
        }
    }
    
    players.sort((a, b) => b.bet - a.bet);
    const topPlayers = players.slice(0, 5);
    
    topPlayers.forEach((p, index) => {
        const li = document.createElement('li');
        li.className = p.isUser ? 'user-bet' : 'other-bet';
        let status = '⏳';
        if (p.cashedOut) status = '✅';
        else if (isCrashed) status = '💥';
        
        li.innerHTML = `
            <span>${index + 1}. ${p.name}</span>
            <span>💰 ${p.bet.toLocaleString()}</span>
            <span>🎯 ${p.multiplier.toFixed(2)}x ${status}</span>
        `;
        playersList.appendChild(li);
    });
}

// ==========================================
// شرط‌بندی کاربر
// ==========================================
betButton.addEventListener('click', () => {
    if (!isGameRunning || isCrashed) {
        resultMessage.textContent = '⏳ منتظر شروع دور بعدی باش...';
        resultMessage.style.color = '#ffd93d';
        return;
    }
    
    if (hasBet) {
        resultMessage.textContent = '⏳ شما قبلاً شرط بسته‌اید!';
        resultMessage.style.color = '#ffd93d';
        return;
    }
    
    let bet = parseInt(betInput.value);
    if (isNaN(bet) || bet < 100) {
        resultMessage.textContent = '⚠️ حداقل شرط ۱۰۰ تومانه!';
        resultMessage.style.color = 'orange';
        return;
    }
    
    if (bet > userBalance) {
        resultMessage.textContent = '⚠️ موجودی کافی نیست!';
        resultMessage.style.color = 'orange';
        return;
    }
    
    betAmount = bet;
    userBet = bet;
    userBalance -= bet;
    hasBet = true;
    isCashedOut = false;
    betMultiplier = multiplier;
    
    balanceDisplay.textContent = userBalance.toLocaleString();
    
    cashOutButton.style.display = 'block';
    cashOutButton.textContent = `💰 برداشت در ${multiplier.toFixed(2)}x`;
    
    betButton.disabled = true;
    resultMessage.textContent = `✅ شرط ${bet.toLocaleString()} تومان بسته شد!`;
    resultMessage.style.color = '#4CAF50';
    
    const user = tg.initDataUnsafe?.user;
    if (user) {
        players.push({
            name: user.first_name || 'شما',
            bet: bet,
            multiplier: multiplier,
            isUser: true,
            cashedOut: false
        });
        updatePlayers();
    }
});

// ==========================================
// دکمه Cash Out (برداشت دستی)
// ==========================================
cashOutButton.addEventListener('click', () => {
    if (!hasBet || isCashedOut || isCrashed) return;
    
    isCashedOut = true;
    
    // محاسبه برد: کل مبلغ شرط + سود (همش برای خودش)
    const winAmount = Math.floor(betAmount * betMultiplier);
    userBalance += winAmount;
    
    balanceDisplay.textContent = userBalance.toLocaleString();
    
    resultMessage.textContent = `🎉 برد! ${winAmount.toLocaleString()} تومان (ضریب ${betMultiplier.toFixed(2)}x)`;
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
    
    if (historyList.children.length > 20) {
        historyList.removeChild(historyList.lastChild);
    }
}

// ==========================================
// شروع بازی
// ==========================================
function startNewRound() {
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
    gameStatus.textContent = '🎯 در حال بازی...';
    resultMessage.textContent = '';
    betButton.disabled = false;
    cashOutButton.style.display = 'none';
    updateChart(1);
    updatePlayers();
    
    if (animationId) cancelAnimationFrame(animationId);
    increaseMultiplier();
}

function crashGame() {
    isGameRunning = false;
    isCrashed = true;
    
    multiplierValue.className = 'crashed';
    multiplierValue.style.color = '#ff0000';
    gameStatus.textContent = '💥 سقوط!';
    betButton.disabled = true;
    cashOutButton.style.display = 'none';
    
    // اگه کاربر شرط بسته و خارج نشده، باخت (پول میره برای سازنده)
    if (hasBet && !isCashedOut) {
        resultMessage.textContent = `💔 باخت! ${betAmount.toLocaleString()} تومان (ضریب ${multiplier.toFixed(2)}x)`;
        resultMessage.style.color = '#f44336';
        addHistory(`🔴 باخت ${betAmount.toLocaleString()} تومان (x${multiplier.toFixed(2)})`, 'lose');
        hasBet = false;
        betButton.disabled = false;
    }
    
    updateChart(multiplier);
    addHistory(`💥 سقوط در ${multiplier.toFixed(2)}x`, 'crash');
    updatePlayers();
    
    setTimeout(() => {
        startNewRound();
    }, 3000);
}

// ==========================================
// دکمه اصلی تلگرام
// ==========================================
tg.MainButton.setText("❌ بستن");
tg.MainButton.show();
tg.MainButton.onClick(() => {
    tg.close();
});

// ==========================================
// شروع بازی
// ==========================================
setTimeout(() => {
    startNewRound();
}, 500);
