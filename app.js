// ==========================================
// AVIATOR CRASH - FULL VERSION
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
    // ===== 10. AIRPLANE (PROFESSIONAL) =====
    // ==========================================
    if (points.length > 0) {
        const lastP = points[points.length - 1];
        const px = lastP.x;
        const py = lastP.y;

        // ===== AIRPLANE GLOW =====
        const planeGlow = ctx.createRadialGradient(px, py, 2, px, py, 45);
        if (globalGameState.isCrashed) {
            planeGlow.addColorStop(0, 'rgba(255,50,50,0.3)');
            planeGlow.addColorStop(0.5, 'rgba(255,50,50,0.1)');
            planeGlow.addColorStop(1, 'rgba(255,50,50,0)');
        } else {
            planeGlow.addColorStop(0, 'rgba(255,215,0,0.25)');
            planeGlow.addColorStop(0.5, 'rgba(255,215,0,0.08)');
            planeGlow.addColorStop(1, 'rgba(255,215,0,0)');
        }
        ctx.fillStyle = planeGlow;
        ctx.beginPath();
        ctx.arc(px, py, 45, 0, Math.PI * 2);
        ctx.fill();

        // ===== AIRPLANE SAVE STATE =====
        ctx.save();
        ctx.translate(px, py);

        // Calculate angle based on path
        let angle = -Math.PI / 2;
        if (points.length > 3) {
            const prev = points[points.length - 3];
            const curr = points[points.length - 1];
            const dx = curr.x - prev.x || 1;
            const dy = curr.y - prev.y;
            angle = Math.atan2(-dy, dx);
        }
        ctx.rotate(angle);

        // ===== AIRPLANE SHADOW =====
        ctx.shadowColor = 'rgba(255,215,0,0.3)';
        ctx.shadowBlur = 20;

        // ===== AIRPLANE BODY =====
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.bezierCurveTo(6, -14, 9, -8, 10, -2);
        ctx.bezierCurveTo(11, 2, 10, 6, 8, 10);
        ctx.bezierCurveTo(6, 14, 3, 16, 0, 17);
        ctx.bezierCurveTo(-3, 16, -6, 14, -8, 10);
        ctx.bezierCurveTo(-10, 6, -11, 2, -10, -2);
        ctx.bezierCurveTo(-9, -8, -6, -14, 0, -18);
        ctx.closePath();
        
        const bodyGrad = ctx.createLinearGradient(0, -18, 0, 17);
        bodyGrad.addColorStop(0, '#ffd700');
        bodyGrad.addColorStop(0.2, '#ffc800');
        bodyGrad.addColorStop(0.5, '#ffb000');
        bodyGrad.addColorStop(0.7, '#ff9500');
        bodyGrad.addColorStop(0.85, '#ff7a00');
        bodyGrad.addColorStop(1, '#ff5500');
        ctx.fillStyle = bodyGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // ===== COCKPIT =====
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(0, -7, 5, 6, 0, 0, Math.PI * 2);
        const cockpitGrad = ctx.createRadialGradient(0, -8, 1, 0, -7, 5);
        cockpitGrad.addColorStop(0, 'rgba(150,220,255,0.5)');
        cockpitGrad.addColorStop(0.5, 'rgba(80,180,255,0.2)');
        cockpitGrad.addColorStop(1, 'rgba(40,100,200,0.1)');
        ctx.fillStyle = cockpitGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,220,255,0.2)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // ===== MAIN WINGS =====
        ctx.shadowBlur = 0;
        
        // Left wing
        ctx.beginPath();
        ctx.moveTo(-2, -3);
        ctx.lineTo(-16, -11);
        ctx.lineTo(-16, -7);
        ctx.lineTo(-3, -2);
        ctx.closePath();
        const wingGrad = ctx.createLinearGradient(-2, -3, -16, -7);
        wingGrad.addColorStop(0, 'rgba(255,210,100,0.7)');
        wingGrad.addColorStop(1, 'rgba(255,180,80,0.4)');
        ctx.fillStyle = wingGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        
        // Right wing
        ctx.beginPath();
        ctx.moveTo(2, -3);
        ctx.lineTo(16, -11);
        ctx.lineTo(16, -7);
        ctx.lineTo(3, -2);
        ctx.closePath();
        ctx.fillStyle = wingGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // ===== LOWER WINGS =====
        ctx.fillStyle = 'rgba(255,180,100,0.3)';
        ctx.beginPath();
        ctx.moveTo(-2, 3);
        ctx.lineTo(-11, 8);
        ctx.lineTo(-11, 5);
        ctx.lineTo(-2, 2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(2, 3);
        ctx.lineTo(11, 8);
        ctx.lineTo(11, 5);
        ctx.lineTo(2, 2);
        ctx.closePath();
        ctx.fill();

        // ===== TAIL =====
        ctx.fillStyle = 'rgba(255,200,100,0.5)';
        ctx.beginPath();
        ctx.moveTo(-1, 12);
        ctx.lineTo(-4, 18);
        ctx.lineTo(0, 15);
        ctx.lineTo(0, 12);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(1, 12);
        ctx.lineTo(4, 18);
        ctx.lineTo(0, 15);
        ctx.lineTo(0, 12);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(-1, 13);
        ctx.lineTo(-8, 16);
        ctx.lineTo(-8, 14);
        ctx.lineTo(-1, 12);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(1, 13);
        ctx.lineTo(8, 16);
        ctx.lineTo(8, 14);
        ctx.lineTo(1, 12);
        ctx.closePath();
        ctx.fill();

        // ===== ENGINE EXHAUST =====
        if (!globalGameState.isCrashed) {
            const fireLen = 5 + Math.sin(Date.now() / 80) * 3;
            
            ctx.shadowColor = 'rgba(255,100,0,0.5)';
            ctx.shadowBlur = 25;
            ctx.beginPath();
            ctx.moveTo(-4, 15);
            ctx.quadraticCurveTo(-6, 15 + fireLen * 1.2, 0, 15 + fireLen * 1.5);
            ctx.quadraticCurveTo(6, 15 + fireLen * 1.2, 4, 15);
            ctx.closePath();
            const fireGrad = ctx.createLinearGradient(0, 15, 0, 15 + fireLen * 1.5);
            fireGrad.addColorStop(0, 'rgba(255,200,50,0.8)');
            fireGrad.addColorStop(0.3, 'rgba(255,150,0,0.6)');
            fireGrad.addColorStop(0.6, 'rgba(255,80,0,0.4)');
            fireGrad.addColorStop(1, 'rgba(255,50,0,0)');
            ctx.fillStyle = fireGrad;
            ctx.fill();
            
            ctx.shadowColor = 'rgba(255,255,200,0.3)';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.moveTo(-2, 14);
            ctx.quadraticCurveTo(-3, 14 + fireLen * 0.7, 0, 14 + fireLen);
            ctx.quadraticCurveTo(3, 14 + fireLen * 0.7, 2, 14);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,255,200,0.5)';
            ctx.fill();
            
            ctx.shadowBlur = 0;
            for (let i = 0; i < 3; i++) {
                const sx = (Math.random() - 0.5) * 6;
                const sy = 15 + Math.random() * fireLen * 0.8;
                ctx.beginPath();
                ctx.arc(sx, sy, 1 + Math.random(), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,200,50,${0.3 + Math.random() * 0.5})`;
                ctx.fill();
            }
            
            // ===== WING LIGHTS =====
            ctx.shadowBlur = 0;
            const blink1 = 0.5 + Math.sin(Date.now() / 200) * 0.5;
            const blink2 = 0.5 + Math.sin(Date.now() / 200 + 1.5) * 0.5;
            
            ctx.shadowColor = 'rgba(255,0,0,0.6)';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(-9, -6, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,0,0,${0.3 + blink1 * 0.5})`;
            ctx.fill();
            
            ctx.shadowColor = 'rgba(0,255,0,0.6)';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.arc(9, -6, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0,255,0,${0.3 + blink2 * 0.5})`;
            ctx.fill();
            
            ctx.shadowBlur = 0;
        }

        // ===== CRASH EFFECT =====
        if (globalGameState.isCrashed) {
            ctx.shadowBlur = 0;
            for (let i = 0; i < 20; i++) {
                const a = Math.random() * Math.PI * 2;
                const len = 5 + Math.random() * 35;
                const x1 = (Math.random() - 0.5) * 8;
                const y1 = (Math.random() - 0.5) * 8;
                const x2 = x1 + Math.cos(a) * len;
                const y2 = y1 + Math.sin(a) * len;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = `rgba(255,50,50,${0.1 + Math.random() * 0.4})`;
                ctx.lineWidth = 1 + Math.random() * 3;
                ctx.shadowColor = 'rgba(255,50,50,0.2)';
                ctx.shadowBlur = 10;
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
            
            for (let i = 0; i < 8; i++) {
                const a = Math.random() * Math.PI * 2;
                const dist = 10 + Math.random() * 25;
                const x = Math.cos(a) * dist;
                const y = Math.sin(a) * dist;
                const size = 3 + Math.random() * 8;
                const alpha = 0.1 + Math.random() * 0.2;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(200,200,200,${alpha})`;
                ctx.shadowColor = 'rgba(200,200,200,0.05)';
                ctx.shadowBlur = 20;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        // ===== AIRPLANE SHADOW =====
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(0, 20, 12, 3, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fill();

        ctx.restore();

        // ==========================================
        // ===== 11. CRASH EXPLOSION =====
        // ==========================================
        if (globalGameState.isCrashed) {
            const flash = ctx.createRadialGradient(px, py, 5, px, py, 60);
            flash.addColorStop(0, 'rgba(255,200,50,0.2)');
            flash.addColorStop(0.3, 'rgba(255,100,0,0.1)');
            flash.addColorStop(1, 'rgba(255,0,0,0)');
            ctx.fillStyle = flash;
            ctx.beginPath();
            ctx.arc(px, py, 60, 0, Math.PI * 2);
            ctx.fill();

            for (let i = 0; i < 15; i++) {
                const a = Math.random() * Math.PI * 2;
                const dist = 10 + Math.random() * 30;
                const x = px + Math.cos(a) * dist;
                const y = py + Math.sin(a) * dist;
                const size = 2 + Math.random() * 4;
                const alpha = 0.1 + Math.random() * 0.3;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,${100 + Math.random() * 100},0,${alpha})`;
                ctx.shadowColor = 'rgba(255,100,0,0.2)';
                ctx.shadowBlur = 15;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
    }

    // ===== 12. X-AXIS LABEL =====
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = '8px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Time', w/2, h - 18);
    
    // ===== 13. Y-AXIS LABEL =====
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('x', 12, padding.top + 10);
    
    // ===== 14. RUNWAY LINE =====
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
