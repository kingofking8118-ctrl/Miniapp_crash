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
let userBalance = 10000; // موجودی اولیه
let hasBet = false;
let betMultiplier = 0; // ضریبی که کاربر شرط بسته

// عناصر صفحه
const multiplierValue = document.getElementById('multiplierValue');
const gameStatus = document.getElementById('gameStatus');
const betButton = document.getElementById('betButton');
const betInput = document.getElementById('betInput');
const resultMessage = document.getElementById('resultMessage');
const historyList = document.getElementById('historyList');
const canvas = document.getElementById('chartCanvas');
const ctx = canvas.getContext('2d');
const playersList = document.getElementById('playersList');
const balanceDisplay = document.getElementById('balanceDisplay');

// ==========================================
// تنظیمات سود سازنده (House Edge)
// ==========================================
const HOUSE_EDGE = 0.05; // ۵٪ سود سازنده

// ==========================================
// تولید نقطه سقوط با سود سازنده
// ==========================================
function generateCrashPoint() {
    // شانس سقوط زودهنگام برای سود سازنده
    const r = Math.random() * 100;
    
    // افزایش شانس سقوط زیر ۲ برای سود بیشتر
    if (r < 15) return 1.10 + Math.random() * 0.4;  // ۱۵٪ شانس زیر ۱.۵
    if (r < 30) return 1.50 + Math.random() * 0.5;  // ۱۵٪ شانس بین ۱.۵ تا ۲
    if (r < 50) return 2.00 + Math.random() * 1.0;  // ۲۰٪ شانس بین ۲ تا ۳
    if (r < 70) return 3.00 + Math.random() * 2.0;  // ۲۰٪ شانس بین ۳ تا ۵
    if (r < 85) return 5.00 + Math.random() * 3.0;  // ۱۵٪ شانس بین ۵ تا ۸
    return 8.00 + Math.random() * 7.0; // ۱۵٪ شانس بالای ۸
}

// ==========================================
// افزایش ضریب با سرعت تصاعدی (واقعی‌تر)
// ==========================================
function increaseMultiplier() {
    if (!isGameRunning) return;
    
    // سرعت افزایش: هرچی ضریب بالاتر، سرعت بیشتر (تصاعدی)
    const baseSpeed = 0.008;
    const exponentialFactor = Math.pow(multiplier, 0.5); // ریشه دوم برای افزایش تدریجی
    const speed = baseSpeed * exponentialFactor * (1 + Math.random() * 0.3);
    
    multiplier += speed;
    multiplier = Math.round(multiplier * 100) / 100;
    
    // به‌روزرسانی نمایش
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
    
    // بررسی سقوط
    if (multiplier >= crashPoint) {
        crashGame();
        return;
    }
    
    animationId = requestAnimationFrame(increaseMultiplier);
}

// ==========================================
// رسم نمودار (موشک/خط)
// ==========================================
function updateChart(currentMultiplier) {
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // پس‌زمینه
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, width, height);
    
    // محورها
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
    
    // رسم مسیر موشک
    const maxMultiplier = Math.max(currentMultiplier, 1.5);
    const scaleX = (width - 70) / 100;
    const scaleY = (height - 50) / maxMultiplier;
    
    // خط گرادیان
    const gradient = ctx.createLinearGradient(50, height - 30, width - 20, 20);
    gradient.addColorStop(0, '#4CAF50');
    gradient.addColorStop(0.3, '#ffd93d');
    gradient.addColorStop(0.6, '#ff9f43');
    gradient.addColorStop(1, '#ff0000');
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    // رسم مسیر از نقاط ذخیره شده
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
    
    // نمایش ضریب فعلی روی نمودار
    const lastPoint = points[points.length - 1];
    if (lastPoint) {
        const x = 50 + (lastPoint.time / 100) * (width - 70);
        const y = height - 30 - (lastPoint.value / maxMultiplier) * (height - 50);
        
        // دایره روی نقطه
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = currentMultiplier > 3 ? '#ff0000' : '#ffd93d';
        ctx.fill();
    }
}

// ==========================================
// ذخیره نقاط برای نمودار
// ==========================================
let chartHistory = [];

function getChartPoints(currentMultiplier) {
    // فقط ۱۰۰ نقطه آخر رو نگه دار
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
// نمایش بازیکنان و شرط‌هایشان
// ==========================================
function updatePlayers() {
    if (!playersList) return;
    
    playersList.innerHTML = '';
    
    // اضافه کردن کاربر فعلی
    const user = tg.initDataUnsafe?.user;
    if (user && hasBet) {
        players.push({
            name: user.first_name || 'شما',
            bet: userBet,
            multiplier: betMultiplier,
            isUser: true
        });
    }
    
    // مرتب‌سازی بر اساس شرط (بزرگ‌تر اول)
    players.sort((a, b) => b.bet - a.bet);
    
    // نمایش فقط ۵ نفر اول
    const topPlayers = players.slice(0, 5);
    
    topPlayers.forEach((p, index) => {
        const li = document.createElement('li');
        li.className = p.isUser ? 'user-bet' : 'other-bet';
        li.innerHTML = `
            <span>${index + 1}. ${p.name}</span>
            <span>💰 ${p.bet.toLocaleString()} تومان</span>
            <span>🎯 ${p.multiplier.toFixed(2)}x</span>
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
    
    // ثبت شرط
    userBet = bet;
    userBalance -= bet;
    hasBet = true;
    betMultiplier = multiplier;
    
    // به‌روزرسانی موجودی
    if (balanceDisplay) {
        balanceDisplay.textContent = userBalance.toLocaleString();
    }
    
    resultMessage.textContent = `✅ شرط ${bet.toLocaleString()} تومان بسته شد!`;
    resultMessage.style.color = '#4CAF50';
    betButton.disabled = true;
    
    // اضافه کردن به لیست بازیکنان
    const user = tg.initDataUnsafe?.user;
    if (user) {
        players.push({
            name: user.first_name || 'شما',
            bet: bet,
            multiplier: multiplier,
            isUser: true
        });
        updatePlayers();
    }
    
    // گوش دادن به سقوط
    const checkWin = setInterval(() => {
        if (isCrashed) {
            clearInterval(checkWin);
            
            // محاسبه برد یا باخت با احتساب سود سازنده
            if (multiplier > betMultiplier) {
                // برد
                const winAmount = Math.floor(bet * multiplier * (1 - HOUSE_EDGE));
                userBalance += winAmount;
                
                resultMessage.textContent = `🎉 برد! ${winAmount.toLocaleString()} تومان (ضریب ${multiplier.toFixed(2)}x)`;
                resultMessage.style.color = '#4CAF50';
                addHistory(`🟢 برد ${winAmount.toLocaleString()} تومان (x${multiplier.toFixed(2)})`, 'win');
            } else {
                // باخت
                resultMessage.textContent = `💔 باخت! ${bet.toLocaleString()} تومان (ضریب ${multiplier.toFixed(2)}x)`;
                resultMessage.style.color = '#f44336';
                addHistory(`🔴 باخت ${bet.toLocaleString()} تومان (x${multiplier.toFixed(2)})`, 'lose');
            }
            
            // به‌روزرسانی موجودی
            if (balanceDisplay) {
                balanceDisplay.textContent = userBalance.toLocaleString();
            }
            
            hasBet = false;
            betButton.disabled = false;
            players = [];
            updatePlayers();
        }
    }, 100);
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
    players = [];
    chartHistory = [];
    crashPoint = generateCrashPoint();
    
    multiplierValue.textContent = multiplier.toFixed(2);
    multiplierValue.className = '';
    gameStatus.textContent = '🎯 در حال بازی...';
    resultMessage.textContent = '';
    betButton.disabled = false;
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
    
    resultMessage.textContent = `💥 ضریب در ${multiplier.toFixed(2)}x سقوط کرد!`;
    resultMessage.style.color = '#ff0000';
    
    // نمایش سقوط روی نمودار
    updateChart(multiplier);
    
    addHistory(`💥 سقوط در ${multiplier.toFixed(2)}x`, 'crash');
    
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
