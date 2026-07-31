// ==========================================
// TELEGRAM
// ==========================================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const user = tg.initDataUnsafe?.user;
let userName = user?.first_name || 'Guest';
let userUsername = user?.username ? '@' + user.username : '';
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
function loadBalance() {
    const saved = localStorage.getItem(STORAGE_KEY_BALANCE);
    return saved ? parseInt(saved) : 1000;
}

function saveBalance() {
    localStorage.setItem(STORAGE_KEY_BALANCE, balance.toString());
}

let balance = loadBalance();

function updateBalanceUI() {
    document.getElementById('lobbyBalance').textContent = '$' + balance;
    document.getElementById('gameBalance').textContent = '$' + balance;
    saveBalance();
}
updateBalanceUI();

// ==========================================
// HISTORY
// ==========================================
function loadHistory() {
    const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
    return saved ? JSON.parse(saved) : [];
}

function saveHistory(history) {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
}

let gameHistory = loadHistory();

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
    saveHistory(gameHistory);
    updateHistoryList();
}
updateHistoryList();

// ==========================================
// CRASH HISTORY
// ==========================================
function loadCrashHistory() {
    const saved = localStorage.getItem(STORAGE_KEY_CRASHES);
    return saved ? JSON.parse(saved) : [];
}

function saveCrashHistory(history) {
    localStorage.setItem(STORAGE_KEY_CRASHES, JSON.stringify(history));
}

let crashHistory = loadCrashHistory();

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
// DEPOSIT FUNCTIONS
// ==========================================
function depositTon(amount) {
    const usdAmount = amount * 1.25;
    balance += usdAmount;
    updateBalanceUI();
    alert('✅ Deposited ' + amount + ' TON ($' + usdAmount + ')');
}

// ==========================================
// ELEMENTS
// ==========================================
const multiplierDisplay = document.getElementById('multiplierDisplay');
const gameStatus = document.getElementById('gameStatus');
const countdownDisplay = document.getElementById('countdownDisplay');
const betBtn = document.getElementById('betBtn');
const cashBtn = document.getElementById('cashBtn');
const betInput = document.getElementById('betInput');
const resultEl = document.getElementById('result');
const playersList = document.getElementById('playersList');
const canvas = document.getElementById('speedometerCanvas');

// ==========================================
// GAME STATE
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

// ==========================================
// SPEED CONFIGURATION
// ==========================================
function getSpeedForMultiplier(m) {
    if (m < 2) return 0.25;
    if (m < 3) return 0.33;
    if (m < 4) return 0.5;
    if (m < 5) return 0.67;
    return 0.67 + Math.log(m - 4) * 0.1;
}

// ==========================================
// DRAW SPEEDOMETER
// ==========================================
function drawSpeedometer(value) {
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h - 10;
    const radius = 165;
    const startAngle = Math.PI + 0.2;
    const endAngle = 2 * Math.PI - 0.2;

    const timePoints = [
        { value: 1, time: 0 },
        { value: 2, time: 4 },
        { value: 3, time: 7 },
        { value: 4, time: 9 },
        { value: 5, time: 10.5 },
        { value: 10, time: 14 },
        { value: 20, time: 18 },
        { value: 50, time: 24 },
        { value: 100, time: 30 }
    ];

    const maxTime = 30;
    
    function getAngleForMultiplier(m) {
        let minPoint = timePoints[0];
        let maxPoint = timePoints[timePoints.length - 1];
        
        for (let i = 0; i < timePoints.length - 1; i++) {
            if (m >= timePoints[i].value && m <= timePoints[i + 1].value) {
                minPoint = timePoints[i];
                maxPoint = timePoints[i + 1];
                break;
            }
        }
        
        if (m > maxPoint.value) {
            const extraTime = Math.log(m / maxPoint.value) * 3;
            const totalTime = maxPoint.time + extraTime;
            const progress = Math.min(totalTime / maxTime, 1);
            return startAngle + (endAngle - startAngle) * progress;
        }
        
        const valueRatio = (m - minPoint.value) / (maxPoint.value - minPoint.value);
        const time = minPoint.time + (maxPoint.time - minPoint.time) * valueRatio;
        const progress = Math.min(time / maxTime, 1);
        return startAngle + (endAngle - startAngle) * progress;
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

    const currentAngle = getAngleForMultiplier(Math.min(value, 100));
    
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, currentAngle);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Ticks
    const ticks = [1, 2, 3, 4, 5, 10, 20, 50, 100];
    
    ticks.forEach(tick => {
        const angle = getAngleForMultiplier(tick);
        const isMajor = tick <= 5 || tick === 10 || tick === 20 || tick === 50 || tick === 100;
        
        const inner = isMajor ? radius - 18 : radius - 12;
        const outer = radius + 5;
        const x1 = cx + Math.cos(angle) * inner;
        const y1 = cy + Math.sin(angle) * inner;
        const x2 = cx + Math.cos(angle) * outer;
        const y2 = cy + Math.sin(angle) * outer;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = tick <= value ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = isMajor ? 3 : 1.5;
        ctx.stroke();

        const labelR = isMajor ? radius - 28 : radius - 22;
        const lx = cx + Math.cos(angle) * labelR;
        const ly = cy + Math.sin(angle) * labelR;
        ctx.fillStyle = tick <= value ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.2)';
        ctx.font = isMajor ? '10px Arial' : '8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tick + 'x', lx, ly);
    });

    // Needle
    const needleAngle = getAngleForMultiplier(Math.min(value, 100));
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
}

// ==========================================
// UPDATE PLAYERS
// ==========================================
function updatePlayers() {
    if (!playersList) return;
    playersList.innerHTML = '';
    
    if (hasBet) {
        const li = document.createElement('li');
        li.className = 'user-bet';
        li.innerHTML = `<span>👤 ${userName}</span><span>💰 $${betAmount}</span><span>🎯 ${betMultiplier.toFixed(2)}x</span>`;
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
// GENERATE CRASH POINT
// ==========================================
function generateCrashPoint() {
    const r = Math.random() * 100;
    if (r < 20) return 1.00;
    if (r < 70) return 1.01 + ((r - 20) / 50) * 0.99;
    if (r < 85) return 2.01 + ((r - 70) / 15) * 2.99;
    if (r < 95) return 5.01 + ((r - 85) / 10) * 9.99;
    if (r < 98) return 15.01 + ((r - 95) / 3) * 34.99;
    return 50.01 + ((r - 98) / 2) * 949.99;
}

// ==========================================
// START GAME
// ==========================================
function startGame() {
    console.log('✅ startGame called');
    
    isPlaying = true;
    isCrashed = false;
    multiplier = 1.00;
    crashPoint = generateCrashPoint();
    
    console.log('🎯 Crash point:', crashPoint);

    // Update UI
    if (multiplierDisplay) {
        multiplierDisplay.innerHTML = '1.00<span class="unit">x</span>';
        multiplierDisplay.className = 'multiplier';
    }
    if (gameStatus) gameStatus.textContent = '🚀 Playing...';
    if (countdownDisplay) countdownDisplay.textContent = '';
    if (betBtn) betBtn.disabled = true;
    if (cashBtn) cashBtn.classList.remove('show');
    if (resultEl) resultEl.textContent = '';
    
    drawSpeedometer(1);

    if (hasBet && !isCashedOut && cashBtn) {
        cashBtn.classList.add('show');
        cashBtn.textContent = '💰 Cash Out at 1.00x';
    }

    // Stop old interval
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }

    // ==========================================
    // GAME LOOP
    // ==========================================
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

        const speed = getSpeedForMultiplier(multiplier);
        multiplier += speed * delta;
        multiplier = Math.round(multiplier * 100) / 100;

        if (multiplierDisplay) {
            multiplierDisplay.innerHTML = multiplier.toFixed(2) + '<span class="unit">x</span>';
        }

        // Color
        if (multiplierDisplay) {
            if (multiplier < 1.5) multiplierDisplay.style.color = '#4CAF50';
            else if (multiplier < 2.5) multiplierDisplay.style.color = '#ffd93d';
            else if (multiplier < 4) multiplierDisplay.style.color = '#ff9f43';
            else if (multiplier < 6) multiplierDisplay.style.color = '#ff6b6b';
            else if (multiplier < 10) multiplierDisplay.style.color = '#ff4500';
            else multiplierDisplay.style.color = '#ff0000';
        }

        drawSpeedometer(multiplier);

        if (hasBet && !isCashedOut && cashBtn) {
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
    console.log('💥 CRASHED at:', multiplier);
    if (isCrashed) return;
    isCrashed = true;
    isPlaying = false;

    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }

    crashHistory.push(multiplier);
    saveCrashHistory(crashHistory);
    updateCrashHistory();

    if (multiplierDisplay) {
        multiplierDisplay.className = 'multiplier crashed';
    }
    if (gameStatus) gameStatus.textContent = '💥 CRASHED!';
    if (cashBtn) cashBtn.classList.remove('show');
    drawSpeedometer(multiplier);

    if (hasBet && !isCashedOut) {
        const msg = '💔 Lost $' + betAmount + ' (' + multiplier.toFixed(2) + 'x)';
        if (resultEl) {
            resultEl.textContent = msg;
            resultEl.style.color = '#f44336';
        }
        addHistory(msg, 'lose');
        hasBet = false;
        if (betBtn) betBtn.disabled = false;
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
    if (resultEl) {
        resultEl.textContent = msg;
        resultEl.style.color = '#4CAF50';
    }
    if (cashBtn) cashBtn.classList.remove('show');
    addHistory(msg, 'win');

    hasBet = false;
    if (betBtn) betBtn.disabled = false;
    updatePlayers();
}

// ==========================================
// COUNTDOWN
// ==========================================
function startCountdown() {
    console.log('⏳ startCountdown called');
    
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
    isPlaying = false;
    isCrashed = false;
    countdown = 10;
    hasBet = false;
    isCashedOut = false;
    multiplier = 1.00;

    if (multiplierDisplay) {
        multiplierDisplay.innerHTML = '1.00<span class="unit">x</span>';
        multiplierDisplay.className = 'multiplier';
    }
    if (gameStatus) gameStatus.textContent = '⏳ Place your bet! ' + countdown + 's';
    if (countdownDisplay) countdownDisplay.textContent = countdown;
    if (betBtn) betBtn.disabled = false;
    if (cashBtn) cashBtn.classList.remove('show');
    if (resultEl) resultEl.textContent = '';
    drawSpeedometer(1);
    updatePlayers();

    countdownInterval = setInterval(function() {
        countdown--;
        if (countdown > 0) {
            if (countdownDisplay) countdownDisplay.textContent = countdown;
            if (gameStatus) gameStatus.textContent = '⏳ Place your bet! ' + countdown + 's';
        } else {
            clearInterval(countdownInterval);
            countdownInterval = null;
            if (countdownDisplay) countdownDisplay.textContent = '';
            isWaiting = false;
            startGame();
        }
    }, 1000);
}

// ==========================================
// BET
// ==========================================
if (betBtn) {
    betBtn.addEventListener('click', function() {
        if (!isWaiting) {
            if (resultEl) {
                resultEl.textContent = '⏳ Wait for betting phase!';
                resultEl.style.color = '#ffd93d';
            }
            return;
        }
        if (hasBet) {
            if (resultEl) {
                resultEl.textContent = '⏳ You already bet!';
                resultEl.style.color = '#ffd93d';
            }
            return;
        }

        const bet = parseInt(betInput ? betInput.value : 10);
        if (isNaN(bet) || bet < 1) {
            if (resultEl) {
                resultEl.textContent = '⚠️ Minimum bet is $1';
                resultEl.style.color = 'orange';
            }
            return;
        }
        if (bet > balance) {
            if (resultEl) {
                resultEl.textContent = '⚠️ Not enough balance!';
                resultEl.style.color = 'orange';
            }
            return;
        }

        betAmount = bet;
        balance -= bet;
        hasBet = true;
        isCashedOut = false;
        betMultiplier = 1.00;

        updateBalanceUI();
        if (betBtn) betBtn.disabled = true;
        if (resultEl) {
            resultEl.textContent = '✅ Bet $' + bet + ' placed!';
            resultEl.style.color = '#4CAF50';
        }
        updatePlayers();
    });
}

// ==========================================
// CASH BUTTON
// ==========================================
if (cashBtn) {
    cashBtn.addEventListener('click', cashOut);
}

// ==========================================
// QUICK BETS
// ==========================================
document.querySelectorAll('.quick-bets button').forEach(function(btn) {
    btn.addEventListener('click', function() {
        if (betInput) betInput.value = this.dataset.amount;
    });
});

// ==========================================
// TON DEPOSIT BUTTONS
// ==========================================
document.querySelectorAll('.ton-amount').forEach(function(btn) {
    btn.addEventListener('click', function() {
        const amount = parseInt(this.dataset.amount);
        depositTon(amount);
        closeDepositModal();
    });
});

function closeDepositModal() {
    const modal = document.getElementById('depositModal');
    if (modal) modal.classList.add('hidden');
}

function openDepositModal() {
    const modal = document.getElementById('depositModal');
    if (modal) modal.classList.remove('hidden');
}

function depositCustomTon() {
    const input = document.getElementById('customTonAmount');
    if (!input) return;
    const amount = parseInt(input.value);
    if (amount && amount > 0) {
        depositTon(amount);
        input.value = '';
        closeDepositModal();
    }
}

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
console.log('🚀 Game starting...');
startCountdown();
