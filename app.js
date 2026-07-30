const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const user = tg.initDataUnsafe?.user;
if (user) {
    document.getElementById('welcomeMessage').innerHTML = `🔥 سلام ${user.first_name}!`;
}

let multiplier = 1.00;
let isGameRunning = false;
let isCrashed = false;
let animationId = null;
let crashPoint = 0;

const multiplierValue = document.getElementById('multiplierValue');
const gameStatus = document.getElementById('gameStatus');
const betButton = document.getElementById('betButton');
const betInput = document.getElementById('betInput');
const resultMessage = document.getElementById('resultMessage');
const historyList = document.getElementById('historyList');

document.querySelectorAll('.quick-bet').forEach(btn => {
    btn.addEventListener('click', () => {
        betInput.value = btn.dataset.amount;
    });
});

function startNewRound() {
    multiplier = 1.00;
    isCrashed = false;
    isGameRunning = true;
    crashPoint = generateCrashPoint();
    
    multiplierValue.textContent = multiplier.toFixed(2);
    multiplierValue.className = '';
    gameStatus.textContent = '🎯 در حال بازی...';
    resultMessage.textContent = '';
    betButton.disabled = true;
    
    if (animationId) cancelAnimationFrame(animationId);
    increaseMultiplier();
}

function generateCrashPoint() {
    const r = Math.random() * 100;
    if (r < 5) return 1.10;
    if (r < 20) return 1.50;
    if (r < 40) return 2.00 + Math.random() * 1.5;
    if (r < 70) return 3.00 + Math.random() * 4;
    return 5.00 + Math.random() * 10;
}

function increaseMultiplier() {
    if (!isGameRunning) return;
    
    const speed = 0.005 + (Math.random() * 0.015);
    multiplier += speed;
    multiplier = Math.round(multiplier * 100) / 100;
    
    multiplierValue.textContent = multiplier.toFixed(2);
    
    if (multiplier < 1.5) {
        multiplierValue.style.color = '#4CAF50';
    } else if (multiplier < 3) {
        multiplierValue.style.color = '#ffd93d';
    } else if (multiplier < 5) {
        multiplierValue.style.color = '#ff9f43';
    } else {
        multiplierValue.style.color = '#ff6b6b';
    }
    
    if (multiplier >= crashPoint) {
        crashGame();
        return;
    }
    
    animationId = requestAnimationFrame(increaseMultiplier);
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
    
    addHistory(`💥 سقوط در ${multiplier.toFixed(2)}x`, 'crash');
    
    setTimeout(() => {
        startNewRound();
    }, 3000);
}

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
    
    const currentMultiplier = multiplier;
    const winAmount = Math.floor(bet * currentMultiplier);
    
    resultMessage.textContent = `✅ شرط ${bet} تومان بسته شد!`;
    resultMessage.style.color = '#4CAF50';
    betButton.disabled = true;
    
    const checkWin = setInterval(() => {
        if (isCrashed) {
            clearInterval(checkWin);
            resultMessage.textContent = `💔 باخت! ${bet} تومان از دست رفتی (ضریب ${currentMultiplier.toFixed(2)}x)`;
            resultMessage.style.color = '#f44336';
            addHistory(`🔴 باخت ${bet} تومان (x${currentMultiplier.toFixed(2)})`, 'lose');
            betButton.disabled = false;
        }
    }, 100);
});

function addHistory(text, type) {
    const li = document.createElement('li');
    li.textContent = text;
    li.className = type;
    historyList.prepend(li);
    
    if (historyList.children.length > 20) {
        historyList.removeChild(historyList.lastChild);
    }
}

tg.MainButton.setText("❌ بستن");
tg.MainButton.show();
tg.MainButton.onClick(() => {
    tg.close();
});

setTimeout(() => {
    startNewRound();
}, 500);

window.addEventListener('beforeunload', () => {
    if (animationId) cancelAnimationFrame(animationId);
    tg.sendData(JSON.stringify({ action: 'close' }));
});
