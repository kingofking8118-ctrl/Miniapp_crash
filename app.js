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
// STORAGE KEYS
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
// GAME STATE - مشترک برای همه
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
let countdown = 10;
let countdownInterval = null;
let isWaiting = false;
let isCancelled = false;

// ==========================================
// SPEED CONFIG
// ==========================================
function getSpeed(m) {
    if (m < 2) return 0.25;
    if (m < 3) return 0.33;
    if (m < 4) return 0.5;
    if (m < 5) return 0.67;
    return 0.67 + Math.log(m - 4) * 0.1;
}

// ==========================================
// GENERATE CRASH POINT (طبق جدول نهایی)
// ==========================================
function generateCrashPoint() {
    const r = Math.random() * 100;
    if (r < 20.5) return 1.00;
    if (r < 61.5) return 1.01 + ((r - 20.5) / 41) * 0.98;
    if (r < 76.88) return 2.00 + ((r - 61.5) / 15.38) * 0.99;
    if (r < 87.13) return 3.00 + ((r - 76.88) / 10.25) * 1.99;
    if (r < 92.26) return 5.00 + ((r - 87.13) / 5.13) * 3.99;
    if (r < 95.33) return 9.00 + ((r - 92.26) / 3.07) * 4.99;
    if (r < 97.38) return 14.00 + ((r - 95.33) / 2.05) * 10.99;
    if (r < 98.41) return 25.00 + ((r - 97.38) / 1.03) * 14.99;
    if (r < 98.92) return 40.00 + ((r - 98.41) / 0.51) * 9.99;
    if (r < 99.33) return 50.00 + ((r - 98.92) / 0.41) * 4.99;
    if (r < 99.64) return 55.00 + ((r - 99.33) / 0.31) * 4.99;
    if (r < 99.845) return 60.00 + ((r - 99.64) / 0.205) * 9.99;
    return 70.00 + ((r - 99.845) / 0.105) * 29.99;
}

// ==========================================
// DRAW SPEEDOMETER
// ==========================================
function drawSpeedometer(value) {
    if (!canvas) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2, cy = h - 10, radius = 165;
    const startAngle = Math.PI + 0.2, endAngle = 2 * Math.PI - 0.2;

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

    // Background
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 18;
    ctx.stroke();

    // Gradient arc
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#4CAF50');
    grad.addColorStop(0.3, '#ffd93d');
    grad.addColorStop(0.6, '#ff9f43');
    grad.addColorStop(0.85, '#ff6b6b');
    grad.addColorStop(1, '#ff0000');

    const currentAngle = getAngle(Math.min(value, 100));
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, currentAngle);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Ticks
    const ticks = [1, 2, 3, 4, 5, 10, 20, 50, 100];
    ticks.forEach(tick => {
        const angle = getAngle(tick);
        const isMajor = tick <= 5 || tick === 10 || tick === 20 || tick === 50 || tick === 100;
        const inner = isMajor ? radius - 18 : radius - 12;
        const outer = radius + 5;
        const x1 = cx + Math.cos(angle) * inner, y1 = cy + Math.sin(angle) * inner;
        const x2 = cx + Math.cos(angle) * outer, y2 = cy + Math.sin(angle) * outer;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = tick <= value ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = isMajor ? 3 : 1.5;
        ctx.stroke();

        const labelR = isMajor ? radius - 28 : radius - 22;
        const lx = cx + Math.cos(angle) * labelR, ly = cy + Math.sin(angle) * labelR;
        ctx.fillStyle = tick <= value ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.2)';
        ctx.font = isMajor ? '10px Arial' : '8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tick + 'x', lx, ly);
    });

    // Small ticks
    for (let i = 1; i < 5; i += 0.5) {
        if (i === 1 || i === 2 || i === 3 || i === 4 || i === 5) continue;
        const angle = getAngle(i);
        const inner = radius - 10, outer = radius - 5;
        const x1 = cx + Math.cos(angle) * inner, y1 = cy + Math.sin(angle) * inner;
        const x2 = cx + Math.cos(angle) * outer, y2 = cy + Math.sin(angle) * outer;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = i <= value ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Needle
    const needleAngle = getAngle(Math.min(value, 100));
    const needleLength = radius - 12;
    const nx = cx + Math.cos(needleAngle) * needleLength;
    const ny = cy + Math.sin(needleAngle) * needleLength;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = isCrashed ? '#ff0000' : '#ffffff';
    ctx.lineWidth = 3;
    ctx.shadowColor = isCrashed ? 'rgba(255,0,0,0.5)' : 'rgba(255,255,255,0.3)';
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    const centerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8);
    centerGrad.addColorStop(0, isCrashed ? '#ff4444' : '#ffd93d');
    centerGrad.addColorStop(1, isCrashed ? '#cc0000' : '#f9a825');
    ctx.fillStyle = centerGrad;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glow
    if (!isCrashed) {
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.3);
        glow.addColorStop(0, 'rgba(255,215,0,0.03)');
        glow.addColorStop(1, 'rgba(255,215,0,0)');
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
    }
}

// ==========================================
// UPDATE PLAYERS
// ==========================================
function updatePlayers() {
    if (!playersList) return;
    playersList.innerHTML = '';
    
    const allPlayers = [];
    
    if (hasBet) {
        allPlayers.push({
            name: userName,
            bet: betAmount,
            multiplier: betMultiplier,
            isUser: true,
            cashedOut: isCashedOut
        });
    }
    
    // فقط اگه بازی در حال اجراست، بازیکنان دیگه رو نمایش بده
    if (isPlaying && !isCrashed) {
        const fakePlayers = [
            { name: 'Player1', bet: 50, multiplier: 1.2, cashedOut: false },
            { name: 'Player2', bet: 25, multiplier: 1.8, cashedOut: false },
            { name: 'Player3', bet: 100, multiplier: 2.3, cashedOut: false }
        ];
        fakePlayers.forEach(p => {
            if (p.name !== userName) {
                allPlayers.push({
                    name: p.name,
                    bet: p.bet,
                    multiplier: p.multiplier,
                    isUser: false,
                    cashedOut: p.cashedOut
                });
            }
        });
    }
    
    allPlayers.sort((a, b) => b.bet - a.bet);
    
    if (allPlayers.length === 0) {
        const li = document.createElement('li');
        li.style.textAlign = 'center';
        li.style.color = '#666';
        li.textContent = 'No players yet';
        playersList.appendChild(li);
        return;
    }
    
    allPlayers.forEach((p, i) => {
        const li = document.createElement('li');
        li.className = p.isUser ? 'user-bet' : 'other-bet';
        let status = '⏳';
        let statusClass = '';
        if (p.cashedOut) {
            status = '✅';
            statusClass = 'win-status';
        } else if (isCrashed) {
            status = '💥';
            statusClass = 'lose-status';
        }
        li.innerHTML = `
            <span>${i+1}. ${p.name}</span>
            <span>💰 $${p.bet}</span>
            <span>🎯 ${p.multiplier.toFixed(2)}x <span class="${statusClass}">${status}</span></span>
        `;
        playersList.appendChild(li);
    });
}

// ==========================================
// START GAME
// ==========================================
function startGame() {
    isPlaying = true;
    isCrashed = false;
    multiplier = 1.00;
    crashPoint = generateCrashPoint();

    multiplierDisplay.innerHTML = '1.00<span class="unit">x</span>';
    multiplierDisplay.className = 'multiplier';
    gameStatus.textContent = '🚀 Playing...';
    countdownDisplay.textContent = '';
    betBtn.disabled = true;
    cancelBtn.style.display = 'none';
    cashBtn.classList.remove('show');
    resultEl.textContent = '';
    drawSpeedometer(1);

    if (hasBet && !isCashedOut) {
        cashBtn.classList.add('show');
        cashBtn.textContent = '💰 Cash Out at 1.00x';
    }

    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }

    let lastTime = Date.now();
    gameInterval = setInterval(function() {
        if (!isPlaying || isCrashed) {
            clearInterval(gameInterval);
            gameInterval = null;
            return;
        }

        const now = Date.now();
        const delta = (now - lastTime) / 1000;
        lastTime = now;

        const speed = getSpeed(multiplier);
        multiplier += speed * delta;
        multiplier = Math.round(multiplier * 100) / 100;

        multiplierDisplay.innerHTML = multiplier.toFixed(2) + '<span class="unit">x</span>';

        if (multiplier < 1.5) multiplierDisplay.style.color = '#4CAF50';
        else if (multiplier < 2.5) multiplierDisplay.style.color = '#ffd93d';
        else if (multiplier < 4) multiplierDisplay.style.color = '#ff9f43';
        else if (multiplier < 6) multiplierDisplay.style.color = '#ff6b6b';
        else if (multiplier < 10) multiplierDisplay.style.color = '#ff4500';
        else multiplierDisplay.style.color = '#ff0000';

        drawSpeedometer(multiplier);

        if (hasBet && !isCashedOut) {
            betMultiplier = multiplier;
            cashBtn.textContent = '💰 Cash Out at ' + multiplier.toFixed(2) + 'x';
            cashBtn.classList.add('show');
        }

        if (multiplier >= crashPoint) {
            crashGame();
        }
        
        updatePlayers();
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

    crashHistory.push(multiplier);
    localStorage.setItem(STORAGE_KEY_CRASHES, JSON.stringify(crashHistory));
    updateCrashHistory();

    multiplierDisplay.className = 'multiplier crashed';
    gameStatus.textContent = '💥 CRASHED!';
    cashBtn.classList.remove('show');
    drawSpeedometer(multiplier);

    if (hasBet && !isCashedOut) {
        const msg = '💔 Lost $' + betAmount + ' (' + multiplier.toFixed(2) + 'x)';
        resultEl.textContent = msg;
        resultEl.style.color = '#f44336';
        addHistory(msg, 'lose');
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
// CASH OUT
// ==========================================
function cashOut() {
    if (!hasBet || isCashedOut || isCrashed || !isPlaying) return;

    isCashedOut = true;
    const winAmount = Math.floor(betAmount * betMultiplier);
    balance += winAmount;
    updateBalanceUI();

    const msg = '🎉 Won $' + winAmount + ' (' + betMultiplier.toFixed(2) + 'x)';
    resultEl.textContent = msg;
    resultEl.style.color = '#4CAF50';
    cashBtn.classList.remove('show');
    addHistory(msg, 'win');

    hasBet = false;
    betBtn.disabled = false;
    cancelBtn.style.display = 'none';
    updatePlayers();
}

// ==========================================
// CANCEL BET
// ==========================================
function cancelBet() {
    if (!hasBet || !isWaiting || isCashedOut) return;
    
    balance += betAmount;
    updateBalanceUI();
    hasBet = false;
    betAmount = 0;
    betMultiplier = 0;
    cancelBtn.style.display = 'none';
    betBtn.disabled = false;
    resultEl.textContent = '🔄 Bet cancelled!';
    resultEl.style.color = '#ffd93d';
    updatePlayers();
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
    multiplier = 1.00;
    isCancelled = false;

    multiplierDisplay.innerHTML = '1.00<span class="unit">x</span>';
    multiplierDisplay.className = 'multiplier';
    gameStatus.textContent = '⏳ Place your bet! ' + countdown + 's';
    countdownDisplay.textContent = countdown;
    betBtn.disabled = false;
    cancelBtn.style.display = 'none';
    cashBtn.classList.remove('show');
    resultEl.textContent = '';
    drawSpeedometer(1);
    updatePlayers();

    countdownInterval = setInterval(function() {
        countdown--;
        if (countdown > 0) {
            countdownDisplay.textContent = countdown;
            gameStatus.textContent = '⏳ Place your bet! ' + countdown + 's';
        } else {
            clearInterval(countdownInterval);
            countdownInterval = null;
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
// TELEGRAM
// ==========================================
tg.MainButton.setText("❌ Close");
tg.MainButton.show();
tg.MainButton.onClick(function() {
    tg.close();
});

// ==========================================
// INIT
// ==========================================
startCountdown();
