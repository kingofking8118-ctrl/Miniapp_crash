// ==========================================
// AVIATOR CRASH - FULL VERSION WITH REAL AIRPLANE
// ==========================================

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
const STORAGE_KEY_BALANCE = 'aviator_balance_' + userId;
const STORAGE_KEY_HISTORY = 'aviator_history_' + userId;
const STORAGE_KEY_CRASHES = 'aviator_crashes_global';

// ==========================================
// BALANCE
// ==========================================
let balance = parseFloat(localStorage.getItem(STORAGE_KEY_BALANCE)) || 1000;

function updateBalanceUI() {
    document.getElementById('lobbyBalance').textContent = '$' + balance.toFixed(2);
    document.getElementById('gameBalance').textContent = '$' + balance.toFixed(2);
    localStorage.setItem(STORAGE_KEY_BALANCE, balance);
}
updateBalanceUI();

// ==========================================
// TON PRICE
// ==========================================
let tonPrice = 0;

async function fetchTonPrice() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=toncoin&vs_currencies=usd');
        const data = await response.json();
        if (data && data.toncoin && data.toncoin.usd) {
            tonPrice = data.toncoin.usd;
        } else {
            throw new Error('Invalid response');
        }
    } catch (error) {
        console.error('Error fetching TON price:', error);
        tonPrice = 1.25;
    }
}
fetchTonPrice();

// ==========================================
// DEPOSIT MODAL - 3 STEP SYSTEM
// ==========================================
let selectedCurrency = 'ton';
let depositAmount = 10;
let currentStep = 1;

function selectCurrency(currency) {
    if (currency !== 'ton') {
        alert('⚠️ Only TON is available at the moment.\nOther currencies coming soon!');
        return;
    }
    selectedCurrency = currency;
    document.querySelectorAll('.currency-item').forEach(el => {
        el.classList.remove('active');
        if (el.dataset.currency === currency) {
            el.classList.add('active');
        }
    });
}

function goToStep2() {
    if (selectedCurrency !== 'ton') {
        alert('⚠️ Please select TON currency first!');
        return;
    }
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');
    currentStep = 2;
    updateUsdEquivalent();
}

function setAmount(value) {
    document.getElementById('depositAmountInput').value = value;
    updateUsdEquivalent();
}

function updateUsdEquivalent() {
    const amount = parseFloat(document.getElementById('depositAmountInput').value) || 0;
    depositAmount = amount;
    const usdValue = amount * tonPrice;
    document.getElementById('usdEquivalent').textContent = usdValue.toFixed(2);
}

document.getElementById('depositAmountInput').addEventListener('input', updateUsdEquivalent);

function goToStep1() {
    document.getElementById('step1').classList.remove('hidden');
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.add('hidden');
    currentStep = 1;
}

function goToStep3() {
    const amount = parseFloat(document.getElementById('depositAmountInput').value);
    if (!amount || amount <= 0) {
        alert('⚠️ Please enter a valid amount!');
        return;
    }
    if (amount < 0.1) {
        alert('⚠️ Minimum deposit is 0.1 TON!');
        return;
    }
    
    depositAmount = amount;
    const usdValue = amount * tonPrice;
    
    document.getElementById('summaryCurrency').textContent = 'TON';
    document.getElementById('summaryAmount').textContent = amount + ' TON';
    document.getElementById('summaryUsd').textContent = '$' + usdValue.toFixed(2);
    document.getElementById('warningAmount').textContent = amount + ' TON';
    
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.remove('hidden');
    currentStep = 3;
}

function copyAddress() {
    const addressEl = document.getElementById('tonWalletAddress');
    const copyBtn = document.getElementById('copyAddressBtn');
    const address = addressEl.textContent;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(address).then(() => {
            copyBtn.textContent = '✅ Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.textContent = '📋 Copy';
                copyBtn.classList.remove('copied');
            }, 2000);
        }).catch(() => {
            fallbackCopy(address, copyBtn);
        });
    } else {
        fallbackCopy(address, copyBtn);
    }
}

function fallbackCopy(text, btn) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        btn.textContent = '✅ Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.textContent = '📋 Copy';
            btn.classList.remove('copied');
        }, 2000);
    } catch (err) {
        alert('⚠️ Could not copy. Please copy manually:\n' + text);
    }
    document.body.removeChild(textarea);
}

function checkDeposit() {
    const amount = depositAmount;
    const usdValue = amount * tonPrice;
    balance += usdValue;
    updateBalanceUI();
    alert('✅ $' + usdValue.toFixed(2) + ' (≈ ' + amount + ' TON) added to your balance!');
    closeDepositModal();
    resetDepositModal();
}

function resetDepositModal() {
    document.getElementById('step1').classList.remove('hidden');
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.add('hidden');
    currentStep = 1;
    document.getElementById('depositAmountInput').value = '10';
    updateUsdEquivalent();
    
    document.querySelectorAll('.currency-item').forEach(el => {
        el.classList.remove('active');
        if (el.dataset.currency === 'ton') {
            el.classList.add('active');
        }
    });
}

document.getElementById('depositBtn').addEventListener('click', function() {
    document.getElementById('depositModal').classList.remove('hidden');
    resetDepositModal();
    fetchTonPrice();
});

function closeDepositModal() {
    document.getElementById('depositModal').classList.add('hidden');
    resetDepositModal();
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
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = item.text;
        if (item.type === 'win') div.style.color = '#4CAF50';
        else if (item.type === 'lose') div.style.color = '#ff4444';
        else div.style.color = '#ff8c00';
        list.appendChild(div);
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
// CRASH HISTORY (GLOBAL)
// ==========================================
let crashHistory = JSON.parse(localStorage.getItem(STORAGE_KEY_CRASHES)) || [];

function updateCrashHistoryBar() {
    const el = document.getElementById('crashHistoryList');
    if (!el) return;
    el.innerHTML = '';
    const lastFive = crashHistory.slice(-5).reverse();
    lastFive.forEach(v => {
        const span = document.createElement('span');
        span.textContent = v.toFixed(2) + 'x';
        if (v < 1.5) span.style.color = '#4CAF50';
        else if (v < 2.5) span.style.color = '#ffd700';
        else if (v < 4) span.style.color = '#ff8c00';
        else if (v < 6) span.style.color = '#ff6b6b';
        else span.style.color = '#ff4444';
        el.appendChild(span);
    });
}
updateCrashHistoryBar();

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
const canvas = document.getElementById('chartCanvas');
const ctx = canvas.getContext('2d');

// ==========================================
// GLOBAL GAME STATE
// ==========================================
let globalGameState = {
    multiplier: 1.00,
    isPlaying: false,
    isCrashed: false,
    crashPoint: 0,
    phase: 'countdown',
    countdown: 10,
    roundStartTime: 0,
    chartHistory: [],
    roundId: 0
};

// ==========================================
// LOCAL STATE
// ==========================================
let hasBet = false;
let betAmount = 0;
let isCashedOut = false;
let totalBets = 0;
let totalWins = 0;
let totalBetAmount = 0;
let autoBetActive = false;
let autoBetMultiplier = 2.00;
let chartHistory = [];
let lastCountdownTime = 0;

// ==========================================
// SPEED CONFIG
// ==========================================
function getSpeed(m) {
    if (m < 2) return 1/6;
    if (m < 3) return 1/4;
    if (m < 4) return 1/3;
    if (m < 5) return 1/2;
    return 0.5 + Math.log(m - 4) * 0.08;
}

// ==========================================
// GENERATE CRASH POINT
// ==========================================
function generateCrashPoint() {
    const r = Math.random() * 100;
    if (r < 20) return 1.00;
    if (r < 60) return 1.01 + ((r - 20) / 40) * 0.98;
    if (r < 80) return 2.00 + ((r - 60) / 20) * 0.99;
    if (r < 90) return 3.00 + ((r - 80) / 10) * 2.99;
    if (r < 95) return 6.00 + ((r - 90) / 5) * 3.99;
    if (r < 98) return 10.00 + ((r - 95) / 3) * 4.99;
    if (r < 99.8) return 15.00 + ((r - 98) / 1.8) * 9.99;
    return 25.00 + ((r - 99.8) / 0.2) * 74.99;
}

// ==========================================
// DRAW REAL AIRPLANE - BIG SIZE WITH FULL DETAILS
// ==========================================
function drawRealAirplane(ctx, x, y, angle, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale * 2.2, scale * 2.2);

    // ===== SHADOW =====
    ctx.shadowColor = 'rgba(255,215,0,0.15)';
    ctx.shadowBlur = 40;

    // ===== 1. MAIN BODY (FUSELAGE) =====
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.bezierCurveTo(9, -23, 14, -13, 16, -4);
    ctx.bezierCurveTo(17, 3, 16, 9, 13, 15);
    ctx.bezierCurveTo(10, 22, 5, 26, 0, 27);
    ctx.bezierCurveTo(-5, 26, -10, 22, -13, 15);
    ctx.bezierCurveTo(-16, 9, -17, 3, -16, -4);
    ctx.bezierCurveTo(-14, -13, -9, -23, 0, -28);
    ctx.closePath();

    const bodyGrad = ctx.createLinearGradient(0, -28, 0, 27);
    bodyGrad.addColorStop(0, '#ffd700');
    bodyGrad.addColorStop(0.15, '#ffc800');
    bodyGrad.addColorStop(0.35, '#ffb000');
    bodyGrad.addColorStop(0.55, '#ff9500');
    bodyGrad.addColorStop(0.75, '#ff7a00');
    bodyGrad.addColorStop(1, '#ff5500');
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ===== 2. BODY STRIPES =====
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(13, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-11, 6);
    ctx.lineTo(11, 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-9, 11);
    ctx.lineTo(9, 11);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-8, -15);
    ctx.quadraticCurveTo(0, -20, 8, -15);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ===== 3. COCKPIT =====
    ctx.shadowBlur = 0;
    
    ctx.beginPath();
    ctx.ellipse(0, -12, 7, 9, 0, 0, Math.PI * 2);
    const cockpitGrad = ctx.createRadialGradient(0, -13, 1, 0, -12, 7);
    cockpitGrad.addColorStop(0, 'rgba(200,240,255,0.7)');
    cockpitGrad.addColorStop(0.3, 'rgba(120,210,255,0.4)');
    cockpitGrad.addColorStop(0.6, 'rgba(60,170,255,0.2)');
    cockpitGrad.addColorStop(0.85, 'rgba(30,120,230,0.1)');
    cockpitGrad.addColorStop(1, 'rgba(10,60,180,0.05)');
    ctx.fillStyle = cockpitGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,230,255,0.3)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Reflection
    ctx.beginPath();
    ctx.ellipse(-3, -15, 3, 2, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(2, -10, 1.5, 1, 0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();

    // ===== 4. MAIN WINGS =====
    ctx.shadowBlur = 0;

    // LEFT WING
    ctx.beginPath();
    ctx.moveTo(-3, -5);
    ctx.quadraticCurveTo(-10, -10, -24, -17);
    ctx.quadraticCurveTo(-27, -15, -25, -12);
    ctx.quadraticCurveTo(-18, -9, -4, -4);
    ctx.closePath();
    const wingGrad = ctx.createLinearGradient(-3, -5, -24, -17);
    wingGrad.addColorStop(0, 'rgba(255,215,100,0.85)');
    wingGrad.addColorStop(0.3, 'rgba(255,200,80,0.7)');
    wingGrad.addColorStop(0.6, 'rgba(255,180,60,0.5)');
    wingGrad.addColorStop(1, 'rgba(255,150,40,0.3)');
    ctx.fillStyle = wingGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-22, -14);
    ctx.lineTo(-22, -10);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-18, -12);
    ctx.lineTo(-18, -8);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-14, -10);
    ctx.lineTo(-14, -6);
    ctx.stroke();

    // RIGHT WING
    ctx.beginPath();
    ctx.moveTo(3, -5);
    ctx.quadraticCurveTo(10, -10, 24, -17);
    ctx.quadraticCurveTo(27, -15, 25, -12);
    ctx.quadraticCurveTo(18, -9, 4, -4);
    ctx.closePath();
    ctx.fillStyle = wingGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(22, -14);
    ctx.lineTo(22, -10);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(18, -12);
    ctx.lineTo(18, -8);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(14, -10);
    ctx.lineTo(14, -6);
    ctx.stroke();

    // ===== 5. LOWER WINGS =====
    const lowerWingGrad = ctx.createLinearGradient(-3, 4, -16, 10);
    lowerWingGrad.addColorStop(0, 'rgba(255,180,100,0.5)');
    lowerWingGrad.addColorStop(1, 'rgba(255,150,80,0.25)');

    ctx.beginPath();
    ctx.moveTo(-3, 4);
    ctx.quadraticCurveTo(-8, 6, -16, 11);
    ctx.quadraticCurveTo(-17, 9, -15, 7);
    ctx.quadraticCurveTo(-9, 5, -3, 3);
    ctx.closePath();
    ctx.fillStyle = lowerWingGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(3, 4);
    ctx.quadraticCurveTo(8, 6, 16, 11);
    ctx.quadraticCurveTo(17, 9, 15, 7);
    ctx.quadraticCurveTo(9, 5, 3, 3);
    ctx.closePath();
    ctx.fill();

    // ===== 6. TAIL SECTION =====
    const tailGrad = ctx.createLinearGradient(0, 15, 0, 26);
    tailGrad.addColorStop(0, 'rgba(255,200,100,0.7)');
    tailGrad.addColorStop(0.5, 'rgba(255,180,80,0.5)');
    tailGrad.addColorStop(1, 'rgba(255,160,60,0.3)');

    ctx.beginPath();
    ctx.moveTo(-1.5, 15);
    ctx.quadraticCurveTo(-4, 19, -7, 26);
    ctx.quadraticCurveTo(-3, 23, 0, 21);
    ctx.quadraticCurveTo(3, 23, 7, 26);
    ctx.quadraticCurveTo(4, 19, 1.5, 15);
    ctx.closePath();
    ctx.fillStyle = tailGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-4, 20);
    ctx.lineTo(4, 20);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-1.5, 16);
    ctx.quadraticCurveTo(-5, 17, -12, 21);
    ctx.quadraticCurveTo(-13, 19, -10, 18);
    ctx.quadraticCurveTo(-6, 17, -1.5, 15);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(1.5, 16);
    ctx.quadraticCurveTo(5, 17, 12, 21);
    ctx.quadraticCurveTo(13, 19, 10, 18);
    ctx.quadraticCurveTo(6, 17, 1.5, 15);
    ctx.closePath();
    ctx.fill();

    // ===== 7. ENGINE EXHAUST =====
    if (!globalGameState.isCrashed) {
        const fireLen = 8 + Math.sin(Date.now() / 80) * 4;
        
        ctx.shadowColor = 'rgba(255,100,0,0.7)';
        ctx.shadowBlur = 40;
        ctx.beginPath();
        ctx.moveTo(-6, 22);
        ctx.quadraticCurveTo(-9, 22 + fireLen * 1.4, 0, 22 + fireLen * 1.8);
        ctx.quadraticCurveTo(9, 22 + fireLen * 1.4, 6, 22);
        ctx.closePath();
        const fireGrad = ctx.createLinearGradient(0, 22, 0, 22 + fireLen * 1.8);
        fireGrad.addColorStop(0, 'rgba(255,230,120,0.95)');
        fireGrad.addColorStop(0.15, 'rgba(255,200,70,0.8)');
        fireGrad.addColorStop(0.35, 'rgba(255,150,40,0.6)');
        fireGrad.addColorStop(0.6, 'rgba(255,100,20,0.4)');
        fireGrad.addColorStop(0.8, 'rgba(255,60,0,0.2)');
        fireGrad.addColorStop(1, 'rgba(255,30,0,0)');
        ctx.fillStyle = fireGrad;
        ctx.fill();

        ctx.shadowColor = 'rgba(255,255,200,0.5)';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.moveTo(-4, 21);
        ctx.quadraticCurveTo(-5, 21 + fireLen * 0.8, 0, 21 + fireLen * 1.2);
        ctx.quadraticCurveTo(5, 21 + fireLen * 0.8, 4, 21);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,200,0.7)';
        ctx.fill();

        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(-2, 20);
        ctx.quadraticCurveTo(-2.5, 20 + fireLen * 0.5, 0, 20 + fireLen * 0.8);
        ctx.quadraticCurveTo(2.5, 20 + fireLen * 0.5, 2, 20);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fill();

        ctx.shadowBlur = 0;
        for (let i = 0; i < 6; i++) {
            const sx = (Math.random() - 0.5) * 10;
            const sy = 20 + Math.random() * fireLen * 1.1;
            const size = 0.8 + Math.random() * 2;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            const sparkAlpha = 0.2 + Math.random() * 0.7;
            ctx.fillStyle = `rgba(255,${200 + Math.random() * 55},${50 + Math.random() * 100},${sparkAlpha})`;
            ctx.fill();
        }

        ctx.shadowBlur = 0;
        for (let i = 0; i < 5; i++) {
            const dist = -10 - i * 8;
            const sx = (Math.random() - 0.5) * 12;
            const sy = 22 + dist * 0.5 + (Math.random() - 0.5) * 6;
            const size = 4 + Math.random() * 6;
            const alpha = 0.05 + (1 - i / 5) * 0.08;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200,200,200,${alpha})`;
            ctx.fill();
        }

        ctx.shadowBlur = 0;
    }

    // ===== 8. WING LIGHTS =====
    if (!globalGameState.isCrashed) {
        const blink1 = 0.5 + Math.sin(Date.now() / 200) * 0.5;
        const blink2 = 0.5 + Math.sin(Date.now() / 200 + 1.5) * 0.5;

        ctx.shadowColor = 'rgba(255,0,0,0.9)';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(-15, -11, 3.5, 0, Math.PI * 2);
        const redGrad = ctx.createRadialGradient(-15, -11, 0, -15, -11, 3.5);
        redGrad.addColorStop(0, `rgba(255,50,50,${0.6 + blink1 * 0.4})`);
        redGrad.addColorStop(0.5, `rgba(220,0,0,${0.3 + blink1 * 0.3})`);
        redGrad.addColorStop(1, `rgba(150,0,0,${0.1 + blink1 * 0.2})`);
        ctx.fillStyle = redGrad;
        ctx.fill();

        ctx.shadowColor = 'rgba(0,255,0,0.9)';
        ctx.shadowBlur = 25;
        ctx.beginPath();
        ctx.arc(15, -11, 3.5, 0, Math.PI * 2);
        const greenGrad = ctx.createRadialGradient(15, -11, 0, 15, -11, 3.5);
        greenGrad.addColorStop(0, `rgba(50,255,50,${0.6 + blink2 * 0.4})`);
        greenGrad.addColorStop(0.5, `rgba(0,220,0,${0.3 + blink2 * 0.3})`);
        greenGrad.addColorStop(1, `rgba(0,150,0,${0.1 + blink2 * 0.2})`);
        ctx.fillStyle = greenGrad;
        ctx.fill();

        ctx.shadowBlur = 0;
        const glowGrad = ctx.createRadialGradient(-15, -11, 0, -15, -11, 15);
        glowGrad.addColorStop(0, `rgba(255,0,0,${0.05 + blink1 * 0.05})`);
        glowGrad.addColorStop(1, 'rgba(255,0,0,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(-15, -11, 15, 0, Math.PI * 2);
        ctx.fill();

        const glowGrad2 = ctx.createRadialGradient(15, -11, 0, 15, -11, 15);
        glowGrad2.addColorStop(0, `rgba(0,255,0,${0.05 + blink2 * 0.05})`);
        glowGrad2.addColorStop(1, 'rgba(0,255,0,0)');
        ctx.fillStyle = glowGrad2;
        ctx.beginPath();
        ctx.arc(15, -11, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
    }

    // ===== 9. CRASH EFFECT =====
    if (globalGameState.isCrashed) {
        ctx.shadowBlur = 0;
        for (let i = 0; i < 30; i++) {
            const a = Math.random() * Math.PI * 2;
            const dist = 10 + Math.random() * 50;
            const x1 = (Math.random() - 0.5) * 10;
            const y1 = (Math.random() - 0.5) * 10;
            const x2 = x1 + Math.cos(a) * dist;
            const y2 = y1 + Math.sin(a) * dist;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            const alpha = 0.1 + Math.random() * 0.5;
            ctx.strokeStyle = `rgba(255,${50 + Math.random() * 150},0,${alpha})`;
            ctx.lineWidth = 1 + Math.random() * 4;
            ctx.shadowColor = 'rgba(255,50,0,0.3)';
            ctx.shadowBlur = 15;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        for (let i = 0; i < 12; i++) {
            const a = Math.random() * Math.PI * 2;
            const dist = 15 + Math.random() * 35;
            const x = Math.cos(a) * dist;
            const y = Math.sin(a) * dist;
            const size = 5 + Math.random() * 12;
            const alpha = 0.05 + Math.random() * 0.15;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(200,200,200,${alpha})`;
            ctx.shadowColor = 'rgba(200,200,200,0.05)';
            ctx.shadowBlur = 30;
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        const flash = ctx.createRadialGradient(0, 0, 0, 0, 0, 40);
        flash.addColorStop(0, 'rgba(255,255,255,0.3)');
        flash.addColorStop(0.3, 'rgba(255,200,100,0.15)');
        flash.addColorStop(1, 'rgba(255,100,0,0)');
        ctx.fillStyle = flash;
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.fill();
    }

    // ===== 10. AIRPLANE SHADOW =====
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.ellipse(0, 32, 18, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fill();

    ctx.restore();
}

// ==========================================
// DRAW CHART - PROFESSIONAL VERSION
// ==========================================
function drawChart(value) {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // ===== 1. BACKGROUND =====
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0d0d2b');
    bgGrad.addColorStop(0.5, '#0a0a1a');
    bgGrad.addColorStop(1, '#060612');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // ===== 2. GRID LINES =====
    for (let i = 0; i < 5; i++) {
        const y = 20 + i * 38;
        ctx.beginPath();
        ctx.moveTo(30, y);
        ctx.lineTo(w - 15, y);
        ctx.strokeStyle = `rgba(255,255,255,${0.03 + i * 0.01})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = '7px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const labelValue = (i + 1) * 2;
        ctx.fillText(labelValue + 'x', 25, y);
    }

    // ===== 3. CHART DATA =====
    const globalChart = globalGameState.chartHistory;
    if (globalChart.length < 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✈️ Waiting for flight...', w/2, h/2);
        
        ctx.beginPath();
        ctx.moveTo(30, h - 25);
        ctx.lineTo(w - 20, h - 25);
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
    }

    // ===== 4. CALCULATE CHART DIMENSIONS =====
    const maxVal = Math.max(3, ...globalChart);
    const minVal = 1;
    const range = maxVal - minVal || 1;
    const padding = { top: 20, bottom: 30, left: 35, right: 25 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // ===== 5. DRAW AREA UNDER LINE =====
    const areaGrad = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    areaGrad.addColorStop(0, 'rgba(255,215,0,0.15)');
    areaGrad.addColorStop(0.3, 'rgba(255,180,0,0.08)');
    areaGrad.addColorStop(0.7, 'rgba(255,100,0,0.03)');
    areaGrad.addColorStop(1, 'rgba(255,50,0,0)');

    // ===== 6. DRAW MAIN LINE =====
    const points = [];
    ctx.beginPath();
    
    for (let i = 0; i < globalChart.length; i++) {
        const x = padding.left + (i / 100) * chartW;
        const y = padding.top + chartH - ((globalChart[i] - minVal) / range) * chartH;
        const clampedY = Math.max(padding.top, Math.min(padding.top + chartH, y));
        points.push({ x, y: clampedY });
        if (i === 0) ctx.moveTo(x, clampedY);
        else ctx.lineTo(x, clampedY);
    }
    
    const lastPoint = points[points.length - 1];
    ctx.lineTo(lastPoint.x, padding.top + chartH);
    ctx.lineTo(padding.left, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // ===== 7. STROKE LINE =====
    ctx.beginPath();
    const lineGrad = ctx.createLinearGradient(0, 0, w, 0);
    lineGrad.addColorStop(0, '#ffd700');
    lineGrad.addColorStop(0.3, '#ffaa00');
    lineGrad.addColorStop(0.6, '#ff8c00');
    lineGrad.addColorStop(0.85, '#ff6a00');
    lineGrad.addColorStop(1, '#ff4500');
    
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255,215,0,0.2)';
    ctx.shadowBlur = 10;
    
    for (let i = 0; i < points.length; i++) {
        if (i === 0) ctx.moveTo(points[i].x, points[i].y);
        else ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ===== 8. DRAW POINTS =====
    const step = Math.max(1, Math.floor(points.length / 12));
    for (let i = step; i < points.length; i += step) {
        const p = points[i];
        
        const glow = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 8);
        glow.addColorStop(0, 'rgba(255,215,0,0.4)');
        glow.addColorStop(1, 'rgba(255,215,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = 'rgba(255,215,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        const label = globalChart[i].toFixed(2) + 'x';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, p.x, p.y - 6);
    }

    // ===== 9. LAST POINT =====
    if (points.length > 0) {
        const lastP = points[points.length - 1];
        
        const bigGlow = ctx.createRadialGradient(lastP.x, lastP.y, 1, lastP.x, lastP.y, 20);
        bigGlow.addColorStop(0, 'rgba(255,215,0,0.5)');
        bigGlow.addColorStop(0.5, 'rgba(255,215,0,0.2)');
        bigGlow.addColorStop(1, 'rgba(255,215,0,0)');
        ctx.fillStyle = bigGlow;
        ctx.beginPath();
        ctx.arc(lastP.x, lastP.y, 20, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(lastP.x, lastP.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = 'rgba(255,215,0,0.6)';
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        const lastLabel = globalChart[globalChart.length - 1].toFixed(2) + 'x';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillText(lastLabel, lastP.x, lastP.y - 12);
        ctx.shadowBlur = 0;
    }

    // ==========================================
    // ===== 10. AIRPLANE =====
    // ==========================================
    if (points.length > 0) {
        const lastP = points[points.length - 1];
        const px = lastP.x;
        const py = lastP.y;
        
        let angle = -Math.PI / 2;
        if (points.length > 4) {
            const prev = points[Math.max(0, points.length - 5)];
            const curr = points[points.length - 1];
            const dx = curr.x - prev.x || 1;
            const dy = curr.y - prev.y;
            angle = Math.atan2(-dy, dx);
        }
        
        drawRealAirplane(ctx, px, py, angle, 1);
    }

    // ===== 11. X-AXIS LABEL =====
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Time', w/2, h - 18);
    
    // ===== 12. Y-AXIS LABEL =====
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('x', 12, padding.top + 10);
    
    // ===== 13. RUNWAY LINE =====
    ctx.beginPath();
    ctx.moveTo(30, h - 25);
    ctx.lineTo(w - 20, h - 25);
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
}

// ==========================================
// UPDATE UI
// ==========================================
function updateUIFromGlobalState() {
    const state = globalGameState;
    const multiplier = state.multiplier;
    
    multiplierDisplay.innerHTML = multiplier.toFixed(2) + '<span class="unit">x</span>';
    
    if (multiplier < 1.5) multiplierDisplay.style.color = '#4CAF50';
    else if (multiplier < 2.5) multiplierDisplay.style.color = '#ffd700';
    else if (multiplier < 4) multiplierDisplay.style.color = '#ff8c00';
    else if (multiplier < 6) multiplierDisplay.style.color = '#ff6b6b';
    else multiplierDisplay.style.color = '#ff4444';
    
    if (state.phase === 'countdown') {
        multiplierDisplay.className = 'multiplier';
        gameStatus.textContent = '⏳ Place your bet! ' + state.countdown + 's';
        countdownDisplay.textContent = state.countdown;
        betBtn.style.display = 'block';
        cancelBtn.style.display = hasBet ? 'block' : 'none';
        cashBtn.style.display = 'none';
    } else if (state.phase === 'playing') {
        gameStatus.textContent = '✈️ Flying...';
        countdownDisplay.textContent = '';
        betBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        cashBtn.style.display = (hasBet && !isCashedOut) ? 'block' : 'none';
        if (hasBet && !isCashedOut) {
            cashBtn.textContent = '💰 Cash Out at ' + multiplier.toFixed(2) + 'x';
        }
    } else if (state.phase === 'crashed') {
        multiplierDisplay.className = 'multiplier crashed';
        gameStatus.textContent = '💥 CRASHED!';
        countdownDisplay.textContent = '';
        betBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        cashBtn.style.display = 'none';
    }
    
    drawChart(multiplier);
    updatePlayers();
}

// ==========================================
// UPDATE PLAYERS
// ==========================================
function updatePlayers() {
    const playersList = document.getElementById('playersList');
    if (!playersList) return;
    playersList.innerHTML = '';
    
    if (hasBet) {
        const li = document.createElement('div');
        li.className = 'history-item user-bet';
        li.innerHTML = `<span>👤 ${userName}</span><span>💰 $${betAmount.toFixed(2)}</span><span>🎯 ${globalGameState.multiplier.toFixed(2)}x</span>`;
        playersList.appendChild(li);
    } else {
        const li = document.createElement('div');
        li.style.textAlign = 'center';
        li.style.color = '#666';
        li.style.padding = '4px';
        li.textContent = 'No players yet';
        playersList.appendChild(li);
    }
}

// ==========================================
// UPDATE STATS
// ==========================================
function updateStats() {
    document.getElementById('totalBets').textContent = totalBets.toLocaleString();
    document.getElementById('totalWins').textContent = '$' + totalWins.toFixed(2);
    document.getElementById('totalBetAmount').textContent = '$' + totalBetAmount.toFixed(2);
}

// ==========================================
// CASH OUT
// ==========================================
function cashOut() {
    if (!hasBet || isCashedOut || globalGameState.isCrashed || globalGameState.phase !== 'playing') {
        resultEl.textContent = '⚠️ Cannot cash out now!';
        resultEl.style.color = '#ff8c00';
        return;
    }
    
    isCashedOut = true;
    const winAmount = betAmount * globalGameState.multiplier;
    balance += winAmount;
    totalWins += winAmount;
    updateBalanceUI();
    
    const msg = '🎉 Won $' + winAmount.toFixed(2) + ' (' + globalGameState.multiplier.toFixed(2) + 'x)';
    resultEl.textContent = msg;
    resultEl.style.color = '#4CAF50';
    cashBtn.style.display = 'none';
    addHistory(msg, 'win');
    updateStats();
    
    hasBet = false;
    betAmount = 0;
    isCashedOut = false;
    betBtn.style.display = 'block';
    updatePlayers();
}

// ==========================================
// CANCEL BET
// ==========================================
function cancelBet() {
    if (!hasBet || globalGameState.phase !== 'countdown') {
        resultEl.textContent = '⚠️ Cannot cancel now!';
        resultEl.style.color = '#ff8c00';
        return;
    }
    
    balance += betAmount;
    updateBalanceUI();
    hasBet = false;
    betAmount = 0;
    cancelBtn.style.display = 'none';
    betBtn.style.display = 'block';
    resultEl.textContent = '🔄 Bet cancelled!';
    resultEl.style.color = '#ff8c00';
    updatePlayers();
}

// ==========================================
// PLACE BET
// ==========================================
function placeBet() {
    if (globalGameState.phase !== 'countdown') {
        resultEl.textContent = '⏳ Wait for betting phase!';
        resultEl.style.color = '#ff8c00';
        return;
    }
    if (hasBet) {
        resultEl.textContent = '⏳ You already bet!';
        resultEl.style.color = '#ff8c00';
        return;
    }
    
    let bet = parseFloat(betInput.value);
    if (isNaN(bet) || bet < 0.1) {
        resultEl.textContent = '⚠️ Minimum bet is $0.1';
        resultEl.style.color = '#ff8c00';
        return;
    }
    if (bet > balance) {
        resultEl.textContent = '⚠️ Insufficient balance!';
        resultEl.style.color = '#ff4444';
        return;
    }
    
    betAmount = bet;
    balance -= bet;
    totalBetAmount += bet;
    hasBet = true;
    isCashedOut = false;
    
    updateBalanceUI();
    betBtn.style.display = 'none';
    cancelBtn.style.display = 'block';
    cashBtn.style.display = 'none';
    resultEl.textContent = '✅ Bet $' + bet.toFixed(2) + ' placed!';
    resultEl.style.color = '#4CAF50';
    updateStats();
    updatePlayers();
}

// ==========================================
// GLOBAL GAME LOOP
// ==========================================
function globalGameLoop() {
    const now = Date.now();
    
    // COUNTDOWN
    if (globalGameState.phase === 'countdown') {
        if (now - lastCountdownTime >= 1000) {
            lastCountdownTime = now;
            globalGameState.countdown--;
            
            if (globalGameState.countdown <= 0) {
                globalGameState.phase = 'playing';
                globalGameState.multiplier = 1.00;
                globalGameState.crashPoint = generateCrashPoint();
                globalGameState.roundStartTime = Date.now();
                globalGameState.isPlaying = true;
                globalGameState.isCrashed = false;
                globalGameState.chartHistory = [];
                globalGameState.roundId++;
                
                if (autoBetActive && !hasBet) {
                    const autoBetAmount = parseFloat(betInput.value) || 10;
                    if (autoBetAmount <= balance) {
                        betAmount = autoBetAmount;
                        balance -= betAmount;
                        totalBetAmount += betAmount;
                        hasBet = true;
                        isCashedOut = false;
                        updateBalanceUI();
                    }
                }
            }
        }
        return;
    }
    
    // PLAYING
    if (globalGameState.phase === 'playing') {
        const elapsed = (Date.now() - globalGameState.roundStartTime) / 1000;
        const speed = getSpeed(globalGameState.multiplier);
        globalGameState.multiplier += speed * 0.05;
        globalGameState.multiplier = Math.round(globalGameState.multiplier * 100) / 100;
        globalGameState.chartHistory.push(globalGameState.multiplier);
        if (globalGameState.chartHistory.length > 100) globalGameState.chartHistory.shift();
        
        if (autoBetActive && hasBet && !isCashedOut && globalGameState.multiplier >= autoBetMultiplier) {
            cashOut();
        }
        
        if (globalGameState.multiplier >= globalGameState.crashPoint) {
            globalGameState.phase = 'crashed';
            globalGameState.isCrashed = true;
            globalGameState.isPlaying = false;
            crashHistory.push(globalGameState.multiplier);
            localStorage.setItem(STORAGE_KEY_CRASHES, JSON.stringify(crashHistory));
            updateCrashHistoryBar();
            
            if (hasBet && !isCashedOut) {
                const msg = '💔 Lost $' + betAmount.toFixed(2) + ' (' + globalGameState.multiplier.toFixed(2) + 'x)';
                resultEl.textContent = msg;
                resultEl.style.color = '#ff4444';
                addHistory(msg, 'lose');
                hasBet = false;
                betAmount = 0;
                isCashedOut = false;
            }
            
            setTimeout(() => {
                globalGameState.phase = 'countdown';
                globalGameState.countdown = 10;
                globalGameState.isCrashed = false;
                globalGameState.chartHistory = [];
                lastCountdownTime = Date.now();
                if (!hasBet) betBtn.style.display = 'block';
                cancelBtn.style.display = 'none';
                cashBtn.style.display = 'none';
                updatePlayers();
                
                setTimeout(() => {
                    if (resultEl.textContent.includes('Lost') || resultEl.textContent.includes('CRASHED')) {
                        resultEl.textContent = '';
                    }
                }, 2000);
                
            }, 1500);
        }
    }
}

// ==========================================
// START
// ==========================================
function startGlobalGame() {
    globalGameState.phase = 'countdown';
    globalGameState.countdown = 10;
    globalGameState.multiplier = 1.00;
    globalGameState.isPlaying = false;
    globalGameState.isCrashed = false;
    globalGameState.chartHistory = [];
    lastCountdownTime = Date.now();
    
    setInterval(globalGameLoop, 100);
    setInterval(updateUIFromGlobalState, 100);
}

// ==========================================
// BUTTONS
// ==========================================
betBtn.addEventListener('click', placeBet);
cancelBtn.addEventListener('click', cancelBet);
cashBtn.addEventListener('click', cashOut);

// ==========================================
// QUICK BETS
// ==========================================
document.querySelectorAll('.quick-bets button').forEach(function(btn) {
    btn.addEventListener('click', function() {
        betInput.value = this.dataset.amount;
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
// LOBBY
// ==========================================
function startGameFromLobby() {}
function stopGame() {}

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
startGlobalGame();
updateHistoryList();
