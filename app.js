// ==========================================
// TELEGRAM
// ==========================================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const user = tg.initDataUnsafe?.user;
let userName = user?.first_name || 'Guest';
let userUsername = user?.username ? '@' + user.username : '';

document.getElementById('lobbyName').textContent = userName;
document.getElementById('lobbyUsername').textContent = userUsername;
document.getElementById('lobbyAvatar').textContent = userName.charAt(0).toUpperCase();

// ==========================================
// BALANCE
// ==========================================
let balance = 1000;

function updateBalanceUI() {
    document.getElementById('lobbyBalance').textContent = '$' + balance;
    document.getElementById('gameBalance').textContent = '$' + balance;
}
updateBalanceUI();

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
const crashHistoryEl = document.getElementById('crashHistory');
const needle = document.getElementById('needle');
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
let betMultiplier = 0;
let isCashedOut = false;
let crashHistory = [];
let countdown = 10;
let isWaiting = false;
let gameHistory = [];
let loopId = null;
let countdownId = null;

// ==========================================
// CONSTANTS
// ==========================================
const MIN_BET = 1;
const MAX_DISPLAY = 100;

// ==========================================
// UPDATE NEEDLE
// ==========================================
function updateNeedle(value) {
    const displayValue = Math.min(value, MAX_DISPLAY);
    const percent = (displayValue / MAX_DISPLAY) * 100;
    needle.style.left = Math.min(percent, 100) + '%';
    
    if (isCrashed) {
        needle.classList.add('crashed');
    } else {
        needle.classList.remove('crashed');
    }
}

// ==========================================
// UPDATE CRASH HISTORY
// ==========================================
function updateCrashHistory() {
    crashHistoryEl.innerHTML = '';
    const lastSix = crashHistory.slice(-6).reverse();
    lastSix.forEach(v => {
        const span = document.createElement('span');
        span.textContent = v.toFixed(2) + 'x';
        if (v < 1.5) span.style.color = '#4CAF50';
        else if (v < 2.5) span.style.color = '#ffd93d';
        else if (v < 4) span.style.color = '#ff9f43';
        else if (v < 6) span.style.color = '#ff6b6b';
        else span.style.color = '#ff0000';
        crashHistoryEl.appendChild(span);
    });
}

// ==========================================
// UPDATE HISTORY LIST
// ==========================================
function updateHistoryList() {
    historyList.innerHTML = '';
    gameHistory.slice(0, 20).forEach(item => {
        const li = document.createElement('li');
        li.textContent = item.text;
        li.className = item.type;
        historyList.appendChild(li);
    });
}

// ==========================================
// ADD HISTORY
// ==========================================
function addHistory(text, type) {
    gameHistory.unshift({ text, type });
    if (gameHistory.length > 50) gameHistory.pop();
    updateHistoryList();
}

// ==========================================
// UPDATE PLAYERS
// ==========================================
function updatePlayers() {
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
// UPDATE MULTIPLIER - MAIN LOOP
// ==========================================
function updateMultiplier() {
    if (!isPlaying || isCrashed) {
        return;
    }

    // Increase multiplier - VERY SLOW
    const baseSpeed = 0.00006;
    const logFactor = Math.log(multiplier + 0.5) / Math.log(10);
    const speed = baseSpeed * (1 + logFactor * 1.5);
    
    multiplier += speed;
    multiplier = Math.round(multiplier * 100) / 100;

    // Update display
    multiplierDisplay.innerHTML = multiplier.toFixed(2) + '<span class="unit">x</span>';

    // Color
    if (multiplier < 1.5) multiplierDisplay.style.color = '#4CAF50';
    else if (multiplier < 2.5) multiplierDisplay.style.color = '#ffd93d';
    else if (multiplier < 4) multiplierDisplay.style.color = '#ff9f43';
    else if (multiplier < 6) multiplierDisplay.style.color = '#ff6b6b';
    else if (multiplier < 10) multiplierDisplay.style.color = '#ff4500';
    else multiplierDisplay.style.color = '#ff0000';

    // Needle
    updateNeedle(multiplier);

    // Cash out button
    if (hasBet && !isCashedOut) {
        betMultiplier = multiplier;
        cashBtn.textContent = '💰 Cash Out at ' + multiplier.toFixed(2) + 'x';
        cashBtn.classList.add('show');
    }

    // Check crash
    if (multiplier >= crashPoint) {
        crashGame();
        return;
    }

    // Continue loop
    loopId = setTimeout(updateMultiplier, 50);
}

// ==========================================
// START GAME
// ==========================================
function startGame() {
    // Reset state
    isPlaying = true;
    isCrashed = false;
    multiplier = 1.00;
    crashPoint = generateCrashPoint();

    // Update display
    multiplierDisplay.innerHTML = '1.00<span class="unit">x</span>';
    multiplierDisplay.className = 'multiplier';
    gameStatus.textContent = '🚀 Playing...';
    countdownDisplay.textContent = '';
    betBtn.disabled = true;
    cashBtn.classList.remove('show');
    resultEl.textContent = '';
    updateNeedle(1);

    // Show cash out if bet exists
    if (hasBet && !isCashedOut) {
        cashBtn.classList.add('show');
        cashBtn.textContent = '💰 Cash Out at 1.00x';
    }

    // Start loop
    if (loopId) clearTimeout(loopId);
    updateMultiplier();
}

// ==========================================
// CRASH
// ==========================================
function crashGame() {
    if (isCrashed) return;
    
    isCrashed = true;
    isPlaying = false;

    // Stop loop
    if (loopId) {
        clearTimeout(loopId);
        loopId = null;
    }

    // Add to crash history
    crashHistory.push(multiplier);
    updateCrashHistory();

    // Update display
    multiplierDisplay.className = 'multiplier crashed';
    gameStatus.textContent = '💥 CRASHED!';
    cashBtn.classList.remove('show');

    // Handle bet result
    if (hasBet && !isCashedOut) {
        const msg = '💔 Lost $' + betAmount + ' (' + multiplier.toFixed(2) + 'x)';
        resultEl.textContent = msg;
        resultEl.style.color = '#f44336';
        addHistory(msg, 'lose');
        hasBet = false;
        betBtn.disabled = false;
    }

    addHistory('💥 Crashed at ' + multiplier.toFixed(2) + 'x', 'crash');
    updatePlayers();

    // Next round after 1.5s
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
    updatePlayers();
}

// ==========================================
// COUNTDOWN
// ==========================================
function startCountdown() {
    // Clear everything
    if (loopId) {
        clearTimeout(loopId);
        loopId = null;
    }
    if (countdownId) {
        clearInterval(countdownId);
        countdownId = null;
    }

    // Reset state
    isWaiting = true;
    isPlaying = false;
    isCrashed = false;
    countdown = 10;
    hasBet = false;
    isCashedOut = false;
    multiplier = 1.00;

    // Update display
    multiplierDisplay.innerHTML = '1.00<span class="unit">x</span>';
    multiplierDisplay.className = 'multiplier';
    gameStatus.textContent = '⏳ Place your bet! ' + countdown + 's';
    countdownDisplay.textContent = countdown;
    betBtn.disabled = false;
    cashBtn.classList.remove('show');
    resultEl.textContent = '';
    updateNeedle(1);
    updatePlayers();

    // Start countdown
    countdownId = setInterval(function() {
        countdown--;
        if (countdown > 0) {
            countdownDisplay.textContent = countdown;
            gameStatus.textContent = '⏳ Place your bet! ' + countdown + 's';
        } else {
            clearInterval(countdownId);
            countdownId = null;
            countdownDisplay.textContent = '';
            isWaiting = false;
            // START GAME IMMEDIATELY
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
    if (isNaN(bet) || bet < MIN_BET) {
        resultEl.textContent = '⚠️ Minimum bet is $' + MIN_BET;
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
    resultEl.textContent = '✅ Bet $' + bet + ' placed!';
    resultEl.style.color = '#4CAF50';
    updatePlayers();
});

// ==========================================
// CASH BUTTON
// ==========================================
cashBtn.addEventListener('click', cashOut);

// ==========================================
// QUICK BETS
// ==========================================
document.querySelectorAll('.quick-bets button').forEach(function(btn) {
    btn.addEventListener('click', function() {
        betInput.value = btn.dataset.amount;
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
    if (loopId) {
        clearTimeout(loopId);
        loopId = null;
    }
    if (countdownId) {
        clearInterval(countdownId);
        countdownId = null;
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
updateHistoryList();
startCountdown();
