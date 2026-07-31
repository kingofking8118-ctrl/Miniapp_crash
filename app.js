// ==========================================
// TELEGRAM
// ==========================================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const user = tg.initDataUnsafe?.user;
const userName = user?.first_name || 'Guest';
const userUsername = user?.username ? '@' + user.username : '';
const userId = user?.id || 'guest';

document.getElementById('lobbyName').textContent = userName;
document.getElementById('lobbyUsername').textContent = userUsername;
document.getElementById('lobbyAvatar').textContent = userName.charAt(0).toUpperCase();

// ==========================================
// STORAGE
// ==========================================
const STORAGE_KEY_BALANCE = 'crash_balance_' + userId;
const STORAGE_KEY_HISTORY = 'crash_history_' + userId;
const STORAGE_KEY_CRASHES = 'crash_crashes_' + userId;

// ==========================================
// BALANCE
// ==========================================
let balance = parseInt(localStorage.getItem(STORAGE_KEY_BALANCE)) || 1000;

function updateBalanceUI() {
    document.getElementById('lobbyBalance').textContent = '$' + balance;
    document.getElementById('gameBalance').textContent = '$' + balance;
    localStorage.setItem(STORAGE_KEY_BALANCE, balance);
}
updateBalanceUI();

// ==========================================
// DEPOSIT
// ==========================================
function depositTon(amount) {
    balance += amount * 1.25;
    updateBalanceUI();
    alert('✅ Deposited ' + amount + ' TON ($' + (amount * 1.25) + ')');
}

document.querySelectorAll('.ton-amount').forEach(btn => {
    btn.addEventListener('click', function() {
        depositTon(parseInt(this.dataset.amount));
        document.getElementById('depositModal').classList.add('hidden');
    });
});

function depositCustomTon() {
    const input = document.getElementById('customTonAmount');
    const amount = parseInt(input.value);
    if (amount && amount > 0) {
        depositTon(amount);
        input.value = '';
        document.getElementById('depositModal').classList.add('hidden');
    }
}

// ==========================================
// HISTORY
// ==========================================
let gameHistory = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)) || [];

function updateHistoryList() {
    const list = document.getElementById('historyList');
    if (!list) return;
    list.innerHTML = '';
    gameHistory.slice(0, 20).forEach(item => {
        const li = document.createElement('li');
        li.textContent = item.text;
        li.className = item.type;
        list.appendChild(li);
    });
}

function addHistory(text, type) {
    gameHistory.unshift({ text, type });
    if (gameHistory.length > 50) gameHistory.pop();
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(gameHistory));
    updateHistoryList();
}
updateHistoryList();

// ==========================================
// CRASH HISTORY
// ==========================================
let crashHistory = JSON.parse(localStorage.getItem(STORAGE_KEY_CRASHES)) || [];

function updateCrashHistory() {
    const el = document.getElementById('crashHistory');
    if (!el) return;
    el.innerHTML = '';
    const lastSix = crashHistory.slice(-6).reverse();
    lastSix.forEach(v => {
        const span = document.createElement('span');
        span.textContent = v.toFixed(2) + 'x';
        if (v < 1.5) span.style.color = '#4CAF50';
        else if (v < 2.5) span.style.color = '#ffd93d';
        else if (v < 4) span.style.color = '#ff9f43';
        else if (v < 6) span.style.color = '#ff6b6b';
        else span.style.color = '#ff0000';
        el.appendChild(span);
    });
}
updateCrashHistory();

// ==========================================
// ELEMENTS
// ==========================================
const multiplierDisplay = document.getElementById('multiplierDisplay');
const gameStatus = document.getElementById('gameStatus');
const countdownDisplay = document.getElementById('countdownDisplay');
const betBtn = document.getElementById('betBtn');
const cancelBtn = document.getElementById('cancelBtn');
const cashBtn = document.getElementById('cashBtn');
const betInput = document.getElementById('betInput');
const resultEl = document.getElementById('result');
const playersList = document.getElementById('playersList');
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
let betMultiplier = 1.00;
let isCashedOut = false;
let countdown = 10;
let isWaiting = false;
let gameLoopId = null;
let countdownLoopId = null;

// ==========================================
// SPEED
// ==========================================
function getSpeed(m) {
    if (m < 2) return 0.25;
    if (m < 3) return 0.33;
    if (m < 4) return 0.5;
    if (m < 5) return 0.67;
    return 0.67 + Math.log(m - 4) * 0.1;
}

// ==========================================
// GENERATE CRASH POINT
// ==========================================
function generateCrashPoint() {
    const r = Math.random() * 100;
    if (r < 31) return 1.00;
    if (r < 77) return 1.01 + ((r - 31) / 46) * 0.98;
    if (r < 88) return 2.00 + ((r - 77) / 11) * 0.99;
    if (r < 93) return 3.00 + ((r - 88) / 5) * 1.99;
    if (r < 96) return 5.00 + ((r - 93) / 3) * 4.99;
    if (r < 98) return 10.00 + ((r - 96) / 2) * 4.99;
    if (r < 99) return 15.00 + ((r - 98) / 1) * 4.99;
    if (r < 99.5) return 20.00 + ((r - 99) / 0.5) * 9.99;
    if (r < 99.8) return 30.00 + ((r - 99.5) / 0.3) * 19.99;
    return 50.00 + ((r - 99.8) / 0.2) * 49.99;
}

// ==========================================
// DRAW SPEEDOMETER - Ferrari Style
// ==========================================
function drawSpeedometer(value) {
    if (!canvas) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2, cy = h - 5;
    const radius = 170;
    const startAngle = Math.PI + 0.15;
    const endAngle = 2 * Math.PI - 0.15;

    const timePoints = [
        { value: 1, time: 0 }, { value: 2, time: 4 },
        { value: 3, time: 7 }, { value: 4, time: 9 },
        { value: 5, time: 10.5 }, { value: 10, time: 14 },
        { value: 20, time: 18 }, { value: 50, time: 24 },
        { value: 100, time: 30 }
    ];
    const maxTime = 30;

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

    // 1. BACKGROUND - CARBON STYLE
    const bgGrad = ctx.createRadialGradient(cx, cy - 30, 20, cx, cy, radius + 20);
    bgGrad.addColorStop(0, '#1a0a0a');
    bgGrad.addColorStop(0.5, '#0f0505');
    bgGrad.addColorStop(1, '#050202');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
    ctx.fill();

    // 2. OUTER GLOW - RED NEON
    const glowGrad = ctx.createRadialGradient(cx, cy, radius - 10, cx, cy, radius + 15);
    glowGrad.addColorStop(0, 'rgba(255,0,0,0)');
    glowGrad.addColorStop(0.7, 'rgba(255,0,0,0)');
    glowGrad.addColorStop(0.85, 'rgba(255,30,30,0.08)');
    glowGrad.addColorStop(1, 'rgba(255,0,0,0.15)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 15, 0, Math.PI * 2);
    ctx.fill();

    // 3. MAIN ARC
    const arcGrad = ctx.createLinearGradient(0, 0, w, 0);
    arcGrad.addColorStop(0, '#ff0000');
    arcGrad.addColorStop(0.2, '#ff2200');
    arcGrad.addColorStop(0.4, '#ff4400');
    arcGrad.addColorStop(0.6, '#ff6600');
    arcGrad.addColorStop(0.8, '#ffaa00');
    arcGrad.addColorStop(1, '#ffcc00');

    ctx.shadowColor = 'rgba(255,0,0,0.4)';
    ctx.shadowBlur = 20;

    const currentAngle = getAngle(Math.min(value, 100));
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, currentAngle);
    ctx.strokeStyle = arcGrad;
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 11, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(200,200,200,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4. TICK MARKS
    const majorTicks = [1, 2, 3, 4, 5, 10, 20, 50, 100];
    const minorTicks = [1.5, 2.5, 3.5, 4.5, 6, 7, 8, 9, 12, 15, 18, 25, 30, 40, 60, 70, 80, 90];

    majorTicks.forEach(tick => {
        const angle = getAngle(tick);
        const inner = radius - 22;
        const outer = radius + 2;
        const x1 = cx + Math.cos(angle) * inner, y1 = cy + Math.sin(angle) * inner;
        const x2 = cx + Math.cos(angle) * outer, y2 = cy + Math.sin(angle) * outer;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = tick <= value ? '#ff0000' : 'rgba(200,200,200,0.15)';
        ctx.lineWidth = tick <= value ? 4 : 2;
        ctx.shadowColor = tick <= value ? 'rgba(255,0,0,0.3)' : 'transparent';
        ctx.shadowBlur = tick <= value ? 8 : 0;
        ctx.stroke();
        ctx.shadowBlur = 0;

        const labelR = radius - 30;
        const lx = cx + Math.cos(angle) * labelR, ly = cy + Math.sin(angle) * labelR;
        ctx.fillStyle = tick <= value ? '#ffffff' : 'rgba(255,255,255,0.15)';
        ctx.font = tick <= 5 ? 'bold 11px Arial' : 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = tick <= value ? 'rgba(255,0,0,0.2)' : 'transparent';
        ctx.shadowBlur = tick <= value ? 6 : 0;
        ctx.fillText(tick + 'x', lx, ly);
        ctx.shadowBlur = 0;
    });

    minorTicks.forEach(tick => {
        if (majorTicks.includes(tick)) return;
        const angle = getAngle(tick);
        const inner = radius - 16;
        const outer = radius - 4;
        const x1 = cx + Math.cos(angle) * inner, y1 = cy + Math.sin(angle) * inner;
        const x2 = cx + Math.cos(angle) * outer, y2 = cy + Math.sin(angle) * outer;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = tick <= value ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.stroke();
    });

    // 5. NEEDLE - Ferrari Style
    const needleAngle = getAngle(Math.min(value, 100));
    const needleLength = radius - 14;
    const nx = cx + Math.cos(needleAngle) * needleLength;
    const ny = cy + Math.sin(needleAngle) * needleLength;

    ctx.shadowColor = 'rgba(255,0,0,0.6)';
    ctx.shadowBlur = 25;

    ctx.beginPath();
    ctx.moveTo(cx - 2, cy);
    ctx.lineTo(nx, ny - 2);
    ctx.lineTo(nx, ny + 2);
    ctx.closePath();
    ctx.fillStyle = isCrashed ? '#ff0000' : '#ff2200';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = isCrashed ? '#ff4444' : '#ff6644';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(255,0,0,0.8)';
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(nx, ny, 4, 0, Math.PI * 2);
    ctx.fillStyle = isCrashed ? '#ff0000' : '#ff2200';
    ctx.shadowColor = 'rgba(255,0,0,0.8)';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 6. CENTER - Ferrari Style
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    const centerRing = ctx.createRadialGradient(cx - 2, cy - 2, 2, cx, cy, 14);
    centerRing.addColorStop(0, '#333');
    centerRing.addColorStop(0.5, '#222');
    centerRing.addColorStop(1, '#111');
    ctx.fillStyle = centerRing;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    const innerRing = ctx.createRadialGradient(cx - 1, cy - 1, 1, cx, cy, 10);
    innerRing.addColorStop(0, '#ff2200');
    innerRing.addColorStop(0.5, '#cc0000');
    innerRing.addColorStop(1, '#880000');
    ctx.fillStyle = innerRing;
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,0,0,0.4)';
    ctx.shadowBlur = 10;
    ctx.fillText('🏎️', cx, cy - 1);
    ctx.shadowBlur = 0;

    // 7. GLOW EFFECT
    if (!isCrashed && value > 1) {
        const intensity = Math.min((value - 1) / 5, 1);
        const glow = ctx.createRadialGradient(cx, cy, radius - 15, cx, cy, radius + 25);
        glow.addColorStop(0, 'rgba(255,0,0,0)');
        glow.addColorStop(0.7, 'rgba(255,0,0,0)');
        glow.addColorStop(0.85, `rgba(255,0,0,${0.02 * intensity})`);
        glow.addColorStop(1, `rgba(255,0,0,${0.05 * intensity})`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 25, 0, Math.PI * 2);
        ctx.fill();
    }

    // 8. CRASH EFFECT
    if (isCrashed) {
        const flash = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius + 20);
        flash.addColorStop(0, 'rgba(255,0,0,0.3)');
        flash.addColorStop(0.5, 'rgba(255,0,0,0.1)');
        flash.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 20, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const len = 20 + Math.random() * 30;
            const x1 = cx + Math.cos(a) * (radius + 5);
            const y1 = cy + Math.sin(a) * (radius + 5);
            const x2 = cx + Math.cos(a) * (radius + 5 + len);
            const y2 = cy + Math.sin(a) * (radius + 5 + len);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = `rgba(255,0,0,${0.3 + Math.random() * 0.3})`;
            ctx.lineWidth = 2 + Math.random() * 2;
            ctx.shadowColor = 'rgba(255,0,0,0.5)';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    // 9. GLASS OVERLAY
    const glassGrad = ctx.createRadialGradient(cx - 20, cy - 40, 10, cx, cy, radius);
    glassGrad.addColorStop(0, 'rgba(255,255,255,0.03)');
    glassGrad.addColorStop(0.5, 'rgba(255,255,255,0.01)');
    glassGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // 10. BORDER
    const borderGrad = ctx.createLinearGradient(0, 0, w, 0);
    borderGrad.addColorStop(0, 'rgba(255,0,0,0)');
    borderGrad.addColorStop(0.3, 'rgba(255,0,0,0.3)');
    borderGrad.addColorStop(0.5, 'rgba(255,100,0,0.5)');
    borderGrad.addColorStop(0.7, 'rgba(255,0,0,0.3)');
    borderGrad.addColorStop(1, 'rgba(255,0,0,0)');

    ctx.beginPath();
    ctx.arc(cx, cy, radius + 10, startAngle - 0.1, endAngle + 0.1);
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(255,0,0,0.2)';
    ctx.shadowBlur = 5;
    ctx.stroke();
    ctx.shadowBlur = 0;
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
    
    if (hasBet && !isCashedOut && isPlaying && !isCrashed) {
        cashBtn.classList.add('show');
        cashBtn.textContent = '💰 Cash Out at ' + multiplier.toFixed(2) + 'x';
    } else {
        cashBtn.classList.remove('show');
    }
    
    updatePlayers();
}

// ==========================================
// UPDATE PLAYERS
// ==========================================
function updatePlayers() {
    playersList.innerHTML = '';
    
    if (hasBet) {
        const li = document.createElement('li');
        li.className = 'user-bet';
        li.innerHTML = `<span>🏎️ ${userName}</span><span>💰 $${betAmount}</span><span>🎯 ${multiplier.toFixed(2)}x</span>`;
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
// CASH OUT
// ==========================================
function cashOut() {
    if (!hasBet || isCashedOut || isCrashed || !isPlaying) return;
    
    isCashedOut = true;
    const winAmount = Math.floor(betAmount * multiplier);
    balance += winAmount;
    updateBalanceUI();
    
    resultEl.textContent = '🏎️ Won $' + winAmount + ' (' + multiplier.toFixed(2) + 'x)';
    resultEl.style.color = '#4CAF50';
    cashBtn.classList.remove('show');
    addHistory('🏎️ Won $' + winAmount + ' (' + multiplier.toFixed(2) + 'x)', 'win');
    
    hasBet = false;
    betBtn.disabled = false;
    cancelBtn.style.display = 'none';
    updatePlayers();
}

// ==========================================
// CANCEL BET
// ==========================================
function cancelBet() {
    if (!hasBet || !isWaiting) return;
    
    balance += betAmount;
    updateBalanceUI();
    hasBet = false;
    betBtn.disabled = false;
    cancelBtn.style.display = 'none';
    resultEl.textContent = '🔄 Bet cancelled!';
    resultEl.style.color = '#ff6600';
    updatePlayers();
}

// ==========================================
// START GAME
// ==========================================
function startGame() {
    isPlaying = true;
    isCrashed = false;
    multiplier = 1.00;
    crashPoint = generateCrashPoint();
    
    gameStatus.textContent = '🏎️ Playing...';
    countdownDisplay.textContent = '';
    betBtn.disabled = true;
    
    updateUI();
    
    if (gameLoopId) {
        clearInterval(gameLoopId);
        gameLoopId = null;
    }
    
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
    
    crashHistory.push(multiplier);
    localStorage.setItem(STORAGE_KEY_CRASHES, JSON.stringify(crashHistory));
    updateCrashHistory();
    
    multiplierDisplay.className = 'multiplier crashed';
    gameStatus.textContent = '💥 CRASHED!';
    cashBtn.classList.remove('show');
    drawSpeedometer(multiplier);
    
    if (hasBet && !isCashedOut) {
        resultEl.textContent = '💔 Lost $' + betAmount + ' (' + multiplier.toFixed(2) + 'x)';
        resultEl.style.color = '#ff0000';
        addHistory('💔 Lost $' + betAmount + ' (' + multiplier.toFixed(2) + 'x)', 'lose');
        hasBet = false;
        betBtn.disabled = false;
        cancelBtn.style.display = 'none';
    }
    
    addHistory('💥 Crashed at ' + multiplier.toFixed(2) + 'x', 'crash');
    updatePlayers();
    
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
    betAmount = 0;
    betMultiplier = 1.00;
    
    multiplierDisplay.className = 'multiplier';
    gameStatus.textContent = '⏳ Place your bet! ' + countdown + 's';
    countdownDisplay.textContent = countdown;
    betBtn.disabled = false;
    cancelBtn.style.display = 'none';
    cashBtn.classList.remove('show');
    resultEl.textContent = '';
    updateUI();
    updatePlayers();
    
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
    if (!isWaiting) {
        resultEl.textContent = '⏳ Wait for betting phase!';
        resultEl.style.color = '#ff6600';
        return;
    }
    if (hasBet) {
        resultEl.textContent = '⏳ You already bet!';
        resultEl.style.color = '#ff6600';
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
    cancelBtn.style.display = 'block';
    resultEl.textContent = '✅ Bet $' + bet + ' placed!';
    resultEl.style.color = '#4CAF50';
    updatePlayers();
});

// ==========================================
// CANCEL BUTTON
// ==========================================
cancelBtn.addEventListener('click', cancelBet);

// ==========================================
// CASH BUTTON
// ==========================================
cashBtn.addEventListener('click', cashOut);

// ==========================================
// QUICK BETS
// ==========================================
document.querySelectorAll('.quick-bets button').forEach(function(btn) {
    btn.addEventListener('click', function() {
        betInput.value = this.dataset.amount;
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
    if (gameLoopId) {
        clearInterval(gameLoopId);
        gameLoopId = null;
    }
    if (countdownLoopId) {
        clearInterval(countdownLoopId);
        countdownLoopId = null;
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
// START
// ==========================================
startCountdown();
