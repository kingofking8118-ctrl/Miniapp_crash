// ==========================================
// TELEGRAM
// ==========================================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const user = tg.initDataUnsafe?.user;
const userName = user?.first_name || 'Guest';
const userUsername = user?.username ? '@' + user.username : '';

document.getElementById('lobbyName').textContent = userName;
document.getElementById('lobbyUsername').textContent = userUsername;
document.getElementById('lobbyAvatar').textContent = userName.charAt(0).toUpperCase();

// ==========================================
// BALANCE
// ==========================================
let balance = 1000;
document.getElementById('balanceDisplay').textContent = '$' + balance;

// ==========================================
// ELEMENTS
// ==========================================
const multiplierDisplay = document.getElementById('multiplierDisplay');
const gameStatus = document.getElementById('gameStatus');
const countdownDisplay = document.getElementById('countdownDisplay');
const betBtn = document.getElementById('betBtn');
const canvas = document.getElementById('speedometerCanvas');
const ctx = canvas.getContext('2d');
const historyList = document.getElementById('historyList');

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
let totalBets = 0;
let totalWins = 0;
let totalBetAmount = 0;
let historyData = [];

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
// GENERATE CRASH POINT - با ضرایب جدید
// ==========================================
function generateCrashPoint() {
    const r = Math.random() * 100;
    
    if (r < 20) return 1.00;
    if (r < 60) return 1.01 + ((r - 20) / 40) * 0.98;     // 1.01 to 1.99
    if (r < 80) return 2.00 + ((r - 60) / 20) * 0.99;     // 2.00 to 2.99
    if (r < 90) return 3.00 + ((r - 80) / 10) * 2.99;     // 3.00 to 5.99
    if (r < 95) return 6.00 + ((r - 90) / 5) * 3.99;      // 6.00 to 9.99
    if (r < 98) return 10.00 + ((r - 95) / 3) * 4.99;     // 10.00 to 14.99
    if (r < 99.8) return 15.00 + ((r - 98) / 1.8) * 9.99;  // 15.00 to 24.99
    return 25.00 + ((r - 99.8) / 0.2) * 74.99;             // 25.00 to 99.99
}

// ==========================================
// DRAW SPEEDOMETER (Ferrari Style)
// ==========================================
function drawSpeedometer(value) {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2, cy = h - 5, radius = 155;
    const startAngle = Math.PI + 0.15, endAngle = 2 * Math.PI - 0.15;

    const timePoints = [
        { value: 1, time: 0 }, { value: 2, time: 6 },
        { value: 3, time: 10 }, { value: 4, time: 13 },
        { value: 5, time: 15 }, { value: 10, time: 18 },
        { value: 20, time: 22 }, { value: 50, time: 28 },
        { value: 100, time: 34 }
    ];
    const maxTime = 34;

    function getAngle(m) {
        let minP = timePoints[0], maxP = timePoints[timePoints.length - 1];
        for (let i = 0; i < timePoints.length - 1; i++) {
            if (m >= timePoints[i].value && m <= timePoints[i + 1].value) {
                minP = timePoints[i]; maxP = timePoints[i + 1];
                break;
            }
        }
        if (m > maxP.value) {
            const progress = Math.min((maxP.time + Math.log(m / maxP.value) * 3) / maxTime, 1);
            return startAngle + (endAngle - startAngle) * progress;
        }
        const ratio = (m - minP.value) / (maxP.value - minP.value);
        const time = minP.time + (maxP.time - minP.time) * ratio;
        return startAngle + (endAngle - startAngle) * Math.min(time / maxTime, 1);
    }

    // Background
    const bgGrad = ctx.createRadialGradient(cx, cy - 30, 20, cx, cy, radius + 20);
    bgGrad.addColorStop(0, '#1a0a0a');
    bgGrad.addColorStop(0.5, '#0f0505');
    bgGrad.addColorStop(1, '#050202');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    const glowGrad = ctx.createRadialGradient(cx, cy, radius - 10, cx, cy, radius + 15);
    glowGrad.addColorStop(0, 'rgba(255,0,0,0)');
    glowGrad.addColorStop(0.85, 'rgba(255,30,30,0.05)');
    glowGrad.addColorStop(1, 'rgba(255,0,0,0.1)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 15, 0, Math.PI * 2);
    ctx.fill();

    // Main arc
    const arcGrad = ctx.createLinearGradient(0, 0, w, 0);
    arcGrad.addColorStop(0, '#ff0000');
    arcGrad.addColorStop(0.3, '#ff2200');
    arcGrad.addColorStop(0.6, '#ff6600');
    arcGrad.addColorStop(0.8, '#ffaa00');
    arcGrad.addColorStop(1, '#ffcc00');

    const currentAngle = getAngle(Math.min(value, 100));
    ctx.shadowColor = 'rgba(255,0,0,0.3)';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, currentAngle);
    ctx.strokeStyle = arcGrad;
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Ticks
    const ticks = [1, 2, 3, 4, 5, 10, 20, 50, 100];
    ticks.forEach(tick => {
        const angle = getAngle(tick);
        const isMajor = tick <= 5 || tick === 10 || tick === 20 || tick === 50 || tick === 100;
        const inner = isMajor ? radius - 16 : radius - 10;
        const outer = radius + 2;
        const x1 = cx + Math.cos(angle) * inner, y1 = cy + Math.sin(angle) * inner;
        const x2 = cx + Math.cos(angle) * outer, y2 = cy + Math.sin(angle) * outer;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = tick <= value ? '#ff0000' : 'rgba(200,200,200,0.12)';
        ctx.lineWidth = isMajor ? 3 : 1.5;
        ctx.stroke();

        const labelR = isMajor ? radius - 24 : radius - 18;
        const lx = cx + Math.cos(angle) * labelR, ly = cy + Math.sin(angle) * labelR;
        ctx.fillStyle = tick <= value ? '#ffffff' : 'rgba(255,255,255,0.12)';
        ctx.font = isMajor ? 'bold 9px Arial' : '7px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tick + 'x', lx, ly);
    });

    // Needle + Plane
    const needleAngle = getAngle(Math.min(value, 100));
    const needleLength = radius - 14;
    const nx = cx + Math.cos(needleAngle) * needleLength;
    const ny = cy + Math.sin(needleAngle) * needleLength - 4;

    // مسیر پرواز
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    ctx.setLineDash([]);

    // عقربه
    ctx.shadowColor = 'rgba(255,0,0,0.5)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy - 2);
    ctx.lineTo(nx, ny - 2);
    ctx.lineTo(nx, ny + 2);
    ctx.lineTo(cx + 2, cy - 2);
    ctx.closePath();
    ctx.fillStyle = isCrashed ? '#ff0000' : '#ff2200';
    ctx.fill();

    // هواپیما
    const planeX = nx;
    const planeY = ny + 4;
    const angleRot = needleAngle + Math.PI / 2;

    ctx.save();
    ctx.translate(planeX, planeY);
    ctx.rotate(angleRot);

    ctx.shadowColor = 'rgba(255,200,0,0.6)';
    ctx.shadowBlur = 20;

    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.quadraticCurveTo(6, -8, 8, -4);
    ctx.quadraticCurveTo(10, 0, 8, 4);
    ctx.quadraticCurveTo(6, 8, 0, 10);
    ctx.quadraticCurveTo(-6, 8, -8, 4);
    ctx.quadraticCurveTo(-10, 0, -8, -4);
    ctx.quadraticCurveTo(-6, -8, 0, -12);
    ctx.closePath();
    const planeGrad = ctx.createLinearGradient(0, -12, 0, 10);
    planeGrad.addColorStop(0, '#ffdd44');
    planeGrad.addColorStop(0.5, '#ffaa00');
    planeGrad.addColorStop(1, '#ff6600');
    ctx.fillStyle = planeGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // بال‌ها
    ctx.fillStyle = 'rgba(255,200,100,0.6)';
    ctx.beginPath();
    ctx.moveTo(-3, -3);
    ctx.lineTo(-14, -10);
    ctx.lineTo(-14, -6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(3, -3);
    ctx.lineTo(14, -10);
    ctx.lineTo(14, -6);
    ctx.closePath();
    ctx.fill();

    // دم
    ctx.fillStyle = 'rgba(255,200,100,0.5)';
    ctx.beginPath();
    ctx.moveTo(-2, 8);
    ctx.lineTo(-8, 14);
    ctx.lineTo(0, 12);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2, 8);
    ctx.lineTo(8, 14);
    ctx.lineTo(0, 12);
    ctx.closePath();
    ctx.fill();

    // کابین
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, -6, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100,200,255,0.3)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,200,255,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // نور چشمک‌زن
    if (!isCrashed && value > 1) {
        ctx.beginPath();
        ctx.arc(0, -10, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,100,${0.3 + Math.sin(Date.now() / 200) * 0.3})`;
        ctx.fill();
    }

    ctx.restore();
    ctx.shadowBlur = 0;

    // Center
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 10, 0, Math.PI * 2);
    const centerRing = ctx.createRadialGradient(cx - 2, cy - 4, 2, cx, cy - 2, 10);
    centerRing.addColorStop(0, '#333');
    centerRing.addColorStop(0.5, '#222');
    centerRing.addColorStop(1, '#111');
    ctx.fillStyle = centerRing;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚀', cx, cy - 1);

    // Crash Effect
    if (isCrashed) {
        const flash = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius + 20);
        flash.addColorStop(0, 'rgba(255,0,0,0.15)');
        flash.addColorStop(0.5, 'rgba(255,0,0,0.05)');
        flash.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 20, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
            const len = 15 + Math.random() * 25;
            const x1 = cx + Math.cos(a) * (radius + 5);
            const y1 = cy + Math.sin(a) * (radius + 5);
            const x2 = cx + Math.cos(a) * (radius + 5 + len);
            const y2 = cy + Math.sin(a) * (radius + 5 + len);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = `rgba(255,0,0,${0.2 + Math.random() * 0.3})`;
            ctx.lineWidth = 2 + Math.random() * 2;
            ctx.shadowColor = 'rgba(255,0,0,0.3)';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }
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
    
    drawSpeedometer(multiplier);
}

// ==========================================
// ADD HISTORY
// ==========================================
function generateId() {
    const chars = '0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}

function addHistory(multiplier, amount, type) {
    const id = generateId();
    historyData.unshift({ id, multiplier, amount, type });
    if (historyData.length > 50) historyData.pop();
    renderHistory();
}

function renderHistory() {
    historyList.innerHTML = '';
    historyData.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        const multiplierClass = item.type === 'win' ? 'win' : item.type === 'lose' ? 'lose' : 'crash';
        const statusText = item.type === 'win' ? '✅' : item.type === 'lose' ? '❌' : '💥';
        div.innerHTML = `
            <span class="h-id">${item.id}</span>
            <span class="h-multiplier ${multiplierClass}">${item.multiplier.toFixed(2)}x</span>
            <span class="h-amount">${item.amount > 0 ? '$' + item.amount : '--'}</span>
            <span class="h-status">${statusText}</span>
        `;
        historyList.appendChild(div);
    });
}

// ==========================================
// UPDATE STATS
// ==========================================
function updateStats() {
    document.getElementById('totalBets').textContent = totalBets.toLocaleString();
    document.getElementById('totalWins').textContent = '$' + totalWins.toLocaleString();
    document.getElementById('totalBetAmount').textContent = '$' + totalBetAmount.toLocaleString();
}

// ==========================================
// CASH OUT
// ==========================================
function cashOut() {
    if (!hasBet || isCashedOut || isCrashed || !isPlaying) return;
    
    isCashedOut = true;
    const winAmount = Math.floor(betAmount * multiplier);
    balance += winAmount;
    totalWins += winAmount;
    document.getElementById('balanceDisplay').textContent = '$' + balance;
    
    addHistory(multiplier, winAmount, 'win');
    updateStats();
    
    hasBet = false;
    betBtn.textContent = '🚀 Place Bet';
    betBtn.className = 'bet-btn-main';
}

// ==========================================
// START GAME
// ==========================================
function startGame() {
    isPlaying = true;
    isCrashed = false;
    multiplier = 1.00;
    crashPoint = generateCrashPoint();
    
    gameStatus.textContent = '✈️ Flying...';
    countdownDisplay.textContent = '';
    betBtn.textContent = '⏳ Betting...';
    betBtn.disabled = true;
    
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
    
    multiplierDisplay.className = 'multiplier crashed';
    gameStatus.textContent = '💥 CRASHED!';
    drawSpeedometer(multiplier);
    
    if (hasBet && !isCashedOut) {
        addHistory(multiplier, 0, 'lose');
        hasBet = false;
        betBtn.textContent = '🚀 Place Bet';
        betBtn.className = 'bet-btn-main';
        betBtn.disabled = false;
        updateStats();
    } else {
        addHistory(multiplier, 0, 'crash');
    }
    
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
    
    multiplierDisplay.className = 'multiplier';
    gameStatus.textContent = '⏳ Place your bet! ' + countdown + 's';
    countdownDisplay.textContent = countdown;
    betBtn.textContent = '🚀 Place Bet';
    betBtn.className = 'bet-btn-main';
    betBtn.disabled = false;
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
    totalBetAmount += bet;
    hasBet = true;
    isCashedOut = false;
    
    document.getElementById('balanceDisplay').textContent = '$' + balance;
    betBtn.textContent = '💰 Cash Out';
    betBtn.className = 'bet-btn-main cash-out';
    updateStats();
});

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
// START
// ==========================================
startCountdown();
