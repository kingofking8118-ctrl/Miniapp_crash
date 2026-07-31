// Basic state
let walletBalance = 100;
let currentMultiplier = 1.0;
let crashPoint = null;
let gameInterval = null;
let gameRunning = false;
let betActive = false;
let betAmount = 0;
let autoCashoutValue = 2.0;
let cashedOut = false;

// Canvas setup
const canvas = document.getElementById("crashCanvas");
const ctx = canvas.getContext("2d");

// Resize canvas to container
function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 12;
    canvas.height = rect.height - 12;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// UI elements
const walletBalanceEl = document.getElementById("walletBalance");
const gamePhaseEl = document.getElementById("gamePhase");
const currentMultiplierEl = document.getElementById("currentMultiplier");
const betAmountInput = document.getElementById("betAmount");
const autoCashoutInput = document.getElementById("autoCashout");
const betStatusEl = document.getElementById("betStatus");
const historyListEl = document.getElementById("historyList");
const tgStatusEl = document.getElementById("tgStatus");
const userNameEl = document.getElementById("userName");

// Buttons
const btnPlaceBet = document.getElementById("btnPlaceBet");
const btnCashOut = document.getElementById("btnCashOut");
const btnDeposit = document.getElementById("btnDeposit");
const btnJoinRoom = document.getElementById("btnJoinRoom");
const depositModalBackdrop = document.getElementById("depositModalBackdrop");
const btnConfirmDeposit = document.getElementById("btnConfirmDeposit");
const btnCancelDeposit = document.getElementById("btnCancelDeposit");
const depositAmountInput = document.getElementById("depositAmount");

// --- Telegram Mini App integration (placeholder) ---
// In real Telegram WebApp, you would use window.Telegram.WebApp
function initTelegramMiniApp() {
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.expand();
        tgStatusEl.textContent = "Telegram: Connected";
        userNameEl.textContent = tg.initDataUnsafe?.user?.first_name || "Telegram User";
        // Example: you could load wallet from backend using tg.initData
    } else {
        tgStatusEl.textContent = "Telegram: Not connected (WebApp placeholder)";
    }
}
initTelegramMiniApp();

// --- Wallet functions ---

function updateWalletUI() {
    walletBalanceEl.textContent = `$${walletBalance.toFixed(2)}`;
}

function openDepositModal() {
    depositModalBackdrop.classList.add("show");
}

function closeDepositModal() {
    depositModalBackdrop.classList.remove("show");
}

btnDeposit.addEventListener("click", openDepositModal);
btnCancelDeposit.addEventListener("click", closeDepositModal);

btnConfirmDeposit.addEventListener("click", () => {
    const amount = Number(depositAmountInput.value);
    if (amount > 0) {
        // In real app: call Telegram payment API or backend
        walletBalance += amount;
        updateWalletUI();
        closeDepositModal();
    }
});

// --- Lobby ---

btnJoinRoom.addEventListener("click", () => {
    gamePhaseEl.textContent = "Joined room. Waiting for next round...";
});

// --- Game logic ---

function resetGame() {
    currentMultiplier = 1.0;
    crashPoint = null;
    gameRunning = false;
    cashedOut = false;
    betActive = false;
    btnCashOut.disabled = true;
    betStatusEl.textContent = "No active bet.";
    currentMultiplierEl.textContent = "x1.00";
    clearInterval(gameInterval);
    drawGraphBase();
}

function startRound() {
    resetGame();
    gamePhaseEl.textContent = "Round starting...";
    // Random crash point between x1.2 and x10
    crashPoint = 1.2 + Math.random() * 8.8;

    gameRunning = true;
    gamePhaseEl.textContent = "Round running...";
    let t = 0;

    gameInterval = setInterval(() => {
        t += 0.05;
        // Simple exponential growth for multiplier
        currentMultiplier = 1 + Math.pow(t, 1.7);
        currentMultiplierEl.textContent = `x${currentMultiplier.toFixed(2)}`;

        drawGraph(currentMultiplier, crashPoint);

        // Auto cashout
        if (betActive && !cashedOut && currentMultiplier >= autoCashoutValue) {
            performCashOut("Auto cashout");
        }

        // Crash
        if (currentMultiplier >= crashPoint) {
            handleCrash();
        }
    }, 80);
}

function handleCrash() {
    clearInterval(gameInterval);
    gameRunning = false;
    gamePhaseEl.textContent = "Crashed!";
    currentMultiplierEl.textContent = `x${crashPoint.toFixed(2)} (CRASH)`;

    if (betActive && !cashedOut) {
        betStatusEl.textContent = `You lost $${betAmount.toFixed(2)}.`;
    }

    addHistoryEntry(crashPoint);

    // Next round after delay
    setTimeout(() => {
        gamePhaseEl.textContent = "Next round starting soon...";
        setTimeout(startRound, 1500);
    }, 1500);
}

function addHistoryEntry(multiplier) {
    const li = document.createElement("li");
    li.textContent = `Crash at x${multiplier.toFixed(2)}`;
    historyListEl.prepend(li);
    // Limit history length
    if (historyListEl.children.length > 20) {
        historyListEl.removeChild(historyListEl.lastChild);
    }
}

// --- Betting ---

btnPlaceBet.addEventListener("click", () => {
    const amount = Number(betAmountInput.value);
    const autoValue = Number(autoCashoutInput.value);

    if (!gameRunning) {
        gamePhaseEl.textContent = "Wait for round to start...";
        return;
    }

    if (betActive) {
        betStatusEl.textContent = "You already have an active bet.";
        return;
    }

    if (amount <= 0 || amount > walletBalance) {
        betStatusEl.textContent = "Invalid bet amount or insufficient balance.";
        return;
    }

    if (autoValue <= 1.0) {
        betStatusEl.textContent = "Auto cashout must be greater than x1.0.";
        return;
    }

    betAmount = amount;
    autoCashoutValue = autoValue;
    betActive = true;
    cashedOut = false;
    walletBalance -= betAmount;
    updateWalletUI();
    btnCashOut.disabled = false;

    betStatusEl.textContent = `Bet placed: $${betAmount.toFixed(2)} | Auto cashout at x${autoCashoutValue.toFixed(2)}.`;
});

btnCashOut.addEventListener("click", () => {
    if (!betActive || cashedOut || !gameRunning) return;
    performCashOut("Manual cashout");
});

function performCashOut(reason) {
    cashedOut = true;
    betActive = false;
    btnCashOut.disabled = true;

    const winAmount = betAmount * currentMultiplier;
    walletBalance += winAmount;
    updateWalletUI();

    betStatusEl.textContent = `${reason}: You won $${winAmount.toFixed(2)} at x${currentMultiplier.toFixed(2)}.`;
}

// --- Graph drawing ---

function drawGraphBase() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#263238";
    ctx.lineWidth = 1;

    // Axes
    ctx.beginPath();
    ctx.moveTo(30, canvas.height - 20);
    ctx.lineTo(canvas.width - 10, canvas.height - 20);
    ctx.moveTo(30, canvas.height - 20);
    ctx.lineTo(30, 20);
    ctx.stroke();

    ctx.fillStyle = "#b0bec5";
    ctx.font = "11px system-ui";
    ctx.fillText("Multiplier", 35, 30);
    ctx.fillText("Time →", canvas.width - 80, canvas.height - 25);
}

function drawGraph(currentMult, crashMult) {
    drawGraphBase();

    const maxMult = Math.max(crashMult, currentMult) + 1;
    const maxTime = 5; // arbitrary

    ctx.strokeStyle = "#4caf50";
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let t = 0; t <= maxTime; t += 0.05) {
        const m = 1 + Math.pow(t, 1.7);
        const x = 30 + (t / maxTime) * (canvas.width - 50);
        const y = canvas.height - 20 - (m / maxMult) * (canvas.height - 60);

        if (t === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        if (m >= currentMult) break;
    }
    ctx.stroke();

    // Crash point marker
    const crashX = 30 + (Math.pow(crashMult - 1, 1 / 1.7) / maxTime) * (canvas.width - 50);
    const crashY = canvas.height - 20 - (crashMult / maxMult) * (canvas.height - 60);

    ctx.fillStyle = "#e53935";
    ctx.beginPath();
    ctx.arc(crashX, crashY, 4, 0, Math.PI * 2);
    ctx.fill();
}

// Init
updateWalletUI();
drawGraphBase();

// Start first round after short delay
setTimeout(startRound, 1500);
