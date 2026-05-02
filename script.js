const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highScore'); // 新增：最高分 DOM
const comboMessage = document.getElementById('comboMessage');

const gameOverModal = document.getElementById('gameOverModal');
const finalScoreElement = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');

// === 新增：讀取本機最高分紀錄 ===
let highScore = localStorage.getItem('grandmaBlockPuzzleHighScore') || 0;
highScoreElement.innerText = highScore;

// === 音樂與音效控制 ===
const bgMusic = document.getElementById('bgMusic');
const muteBtn = document.getElementById('muteBtn');
let isMuted = false;
let audioUnlocked = false;

bgMusic.volume = 0.3;

muteBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    isMuted = !isMuted;
    if (isMuted) {
        bgMusic.pause();
        muteBtn.innerText = '🔇';
    } else {
        if (audioUnlocked) bgMusic.play().catch(() => {});
        muteBtn.innerText = '🔊';
    }
});

// 音效引擎
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = new AudioContext();

function unlockAudio() {
    if (audioUnlocked) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(0);
    osc.stop(0.01);

    if (!isMuted && bgMusic.paused) {
        bgMusic.play().catch(() => {});
    }

    audioUnlocked = true;
    document.removeEventListener('pointerdown', unlockAudio);
}

document.addEventListener('pointerdown', unlockAudio);

function playSound(type, combo = 1) {
    if (isMuted || !audioUnlocked) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'place') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.5, now + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'clear') {
        osc.type = 'triangle';
        const baseFreq = 440 * Math.pow(1.15, combo - 1);
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.3);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.4, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'over') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.8);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.5, now + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.8);
    }
}

// === 遊戲設定 ===
const ROWS = 8;
const COLS = 8;
let score = 0;
let isGameOver = false;

let containerWidth = Math.min(window.innerWidth * 0.95, 420);
let GRID_SIZE = Math.floor(containerWidth / COLS);

canvas.width = COLS * GRID_SIZE;
canvas.height = (ROWS + 4.5) * GRID_SIZE;

const BOARD_COLOR_BG = '#1e2738';
const CELL_COLOR_EMPTY = '#2a3548';
const BLOCK_COLORS = ['#ff3838', '#32ff7e', '#18dcff', '#ffb8b8', '#c56cf0', '#ffb142', '#fff200'];

let board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
const SHAPES = [
    [[0,0]],
    [[0,0],[0,1]], [[0,0],[1,0]],
    [[0,0],[0,1],[0,2]], [[0,0],[1,0],[2,0]],
    [[0,0],[1,0],[1,1]], [[0,1],[1,0],[1,1]], [[0,0],[0,1],[1,0]], [[0,0],[0,1],[1,1]],
    [[0,0],[0,1],[0,2],[0,3]], [[0,0],[1,0],[2,0],[3,0]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[0,2],[1,1]], [[1,0],[1,1],[1,2],[0,1]], [[0,1],[1,0],[1,1],[2,1]], [[0,0],[1,0],[2,0],[1,1]],
    [[0,1],[1,0],[1,1],[1,2],[2,1]],
    [[0,0],[0,1],[0,2],[0,3],[0,4]], [[0,0],[1,0],[2,0],[3,0],[4,0]],
    [[0,0],[1,0],[2,0],[2,1],[2,2]], [[0,0],[0,1],[0,2],[1,0],[2,0]],
    [[0,0],[1,0],[2,0],[2,-1],[2,-2]], [[0,0],[1,0],[2,0],[0,1],[0,2]],
    [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],
    [[0,0],[0,1],[0,2],[1,1],[2,1]], [[0,2],[1,0],[1,1],[1,2],[2,2]],
    [[0,0],[0,1],[0,2],[1,0],[1,2]], [[0,0],[1,0],[2,0],[0,1],[2,1]],
    [[0,0],[0,1],[1,1],[1,2]], [[0,1],[0,2],[1,0],[1,1]],
    [[0,0],[1,1],[2,2]], [[0,2],[1,1],[2,0]]
];

let handBlocks = [];
let draggingBlock = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

let isAnimatingClear = false;
let clearingBlocks = [];

// === 新增：粒子系統陣列 ===
let particles = [];

// === 新增：產生粒子的函式 ===
function createParticles(x, y, color) {
    const particleCount = 6; // 每個方塊炸出 6 個碎片
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: x + GRID_SIZE / 2, // 從方塊中心噴出
            y: y + GRID_SIZE / 2,
            vx: (Math.random() - 0.5) * 15, // 隨機水平噴射速度
            vy: (Math.random() - 0.5) * 15 - 5, // 隨機垂直噴射速度 (稍微偏上)
            life: 1.0, // 初始不透明度
            decay: Math.random() * 0.05 + 0.02, // 消失的速度
            size: Math.random() * (GRID_SIZE * 0.4) + 4, // 碎片大小
            color: color
        });
    }
}

function init() {
    isGameOver = false;
    isAnimatingClear = false;
    clearingBlocks = [];
    particles = []; // 重製時清空粒子
    score = 0;
    scoreElement.innerText = score;
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    generateHandBlocks();
    requestAnimationFrame(gameLoop);
}

function canShapeFitAnywhere(shape) {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (canPlace(shape, r, c)) return true;
        }
    }
    return false;
}

function getClearableShape() {
    let shuffledShapes = [...SHAPES].sort(() => Math.random() - 0.5);
    for (let shape of shuffledShapes) {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (canPlace(shape, r, c)) {
                    let clears = getPreviewClears(shape, r, c);
                    if (clears.rows.length > 0 || clears.cols.length > 0) {
                        return shape;
                    }
                }
            }
        }
    }
    return null;
}

function generateHandBlocks() {
    handBlocks = [];
    const zoneWidth = canvas.width / 3;
    const startY = ROWS * GRID_SIZE;

    let chosenShapes = [];
    let giantCount = 0;

    let smartShape = null;
    if (Math.random() < 0.8) {
        smartShape = getClearableShape();
    }

    if (smartShape) {
        chosenShapes.push(smartShape);
        if (smartShape.length >= 5) giantCount++;
    }

    while (chosenShapes.length < 3) {
        let shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];

        if (shape.length >= 5) {
            if (giantCount >= 1 && Math.random() < 0.85) continue;
            giantCount++;
        }
        chosenShapes.push(shape);
    }

    chosenShapes.sort(() => Math.random() - 0.5);

    let canFitAny = false;
    for (let shape of chosenShapes) {
        if (canShapeFitAnywhere(shape)) { canFitAny = true; break; }
    }
    if (!canFitAny) {
        for (let backupShape of SHAPES) {
            if (canShapeFitAnywhere(backupShape)) {
                chosenShapes[2] = backupShape;
                break;
            }
        }
    }

    for (let i = 0; i < 3; i++) {
        const shape = chosenShapes[i];
        const color = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];

        let minC = 0, maxC = 0, minR = 0, maxR = 0;
        shape.forEach(cell => {
            if(cell[1] > maxC) maxC = cell[1];
            if(cell[1] < minC) minC = cell[1];
            if(cell[0] > maxR) maxR = cell[0];
            if(cell[0] < minR) minR = cell[0];
        });

        let targetScale = 0.55;
        let blockWidth = (maxC - minC + 1) * (GRID_SIZE * targetScale);
        let blockHeight = (maxR - minR + 1) * (GRID_SIZE * targetScale);

        let zoneCenter = (zoneWidth * i) + (zoneWidth / 2);
        let originalX = zoneCenter - (blockWidth / 2) - (minC * GRID_SIZE * targetScale);
        let originalY = startY + (GRID_SIZE * 2.25) - (blockHeight / 2) - (minR * GRID_SIZE * targetScale);

        handBlocks.push({
            shape, color, minC, maxC, minR, maxR,
            originalX, originalY,
            currentX: originalX, currentY: originalY,
            scale: 0,
            targetScale: targetScale,
            isUsed: false
        });
    }
    checkGameOver();
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}

function draw3DBlock(ctx, x, y, size, baseColor, alpha = 1) {
    ctx.globalAlpha = alpha;
    const padding = 1.5;
    const drawSize = size - padding * 2;
    const drawX = x + padding;
    const drawY = y + padding;
    const radius = size * 0.15;

    ctx.fillStyle = baseColor;
    drawRoundedRect(ctx, drawX, drawY, drawSize, drawSize, radius);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    drawRoundedRect(ctx, drawX + drawSize*0.05, drawY + drawSize*0.05, drawSize - drawSize*0.1, drawSize - drawSize*0.2, radius);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    drawRoundedRect(ctx, drawX + drawSize*0.1, drawY + drawSize*0.1, drawSize - drawSize*0.2, drawSize - drawSize*0.1, radius);

    ctx.globalAlpha = 1;
}

function drawBoard() {
    ctx.fillStyle = BOARD_COLOR_BG;
    ctx.fillRect(0, 0, canvas.width, ROWS * GRID_SIZE);

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let x = c * GRID_SIZE;
            let y = r * GRID_SIZE;

            if (board[r][c] === 0) {
                ctx.fillStyle = CELL_COLOR_EMPTY;
                drawRoundedRect(ctx, x + 1.5, y + 1.5, GRID_SIZE - 3, GRID_SIZE - 3, GRID_SIZE * 0.15);
            } else {
                draw3DBlock(ctx, x, y, GRID_SIZE, board[r][c]);
            }
        }
    }
}

function drawShape(block, x, y, alpha = 1, forceColor = null) {
    let size = GRID_SIZE * block.scale;
    block.shape.forEach(cell => {
        let dx = x + (cell[1] * size);
        let dy = y + (cell[0] * size);

        if (forceColor) {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = forceColor;
            drawRoundedRect(ctx, dx + 1.5, dy + 1.5, size - 3, size - 3, size * 0.15);
            ctx.globalAlpha = 1;
        } else {
            draw3DBlock(ctx, dx, dy, size, block.color, alpha);
        }
    });
}

function getPreviewClears(shape, r0, c0) {
    let previewRows = [];
    let previewCols = [];

    shape.forEach(cell => board[r0 + cell[0]][c0 + cell[1]] = 'preview');

    for (let r = 0; r < ROWS; r++) {
        if (board[r].every(cell => cell !== 0)) previewRows.push(r);
    }
    for (let c = 0; c < COLS; c++) {
        let isFull = true;
        for (let r = 0; r < ROWS; r++) {
            if (board[r][c] === 0) { isFull = false; break; }
        }
        if (isFull) previewCols.push(c);
    }

    shape.forEach(cell => board[r0 + cell[0]][c0 + cell[1]] = 0);
    return { rows: previewRows, cols: previewCols };
}

function getSnapTarget(shape, row, col) {
    if (canPlace(shape, row, col)) return { r: row, c: col };

    let bestR = -1, bestC = -1, minDist = 99;
    for(let dr = -1; dr <= 1; dr++){
        for(let dc = -1; dc <= 1; dc++){
            if(dr === 0 && dc === 0) continue;
            if(canPlace(shape, row + dr, col + dc)){
                let dist = dr * dr + dc * dc;
                if(dist < minDist){
                    minDist = dist;
                    bestR = row + dr;
                    bestC = col + dc;
                }
            }
        }
    }
    if(minDist !== 99) return { r: bestR, c: bestC };
    return null;
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard();

    if (isAnimatingClear) {
        let allDone = true;
        clearingBlocks.forEach(b => {
            b.scale -= 0.12;
            if (b.scale > 0) {
                allDone = false;
                let size = GRID_SIZE * b.scale;
                let offset = (GRID_SIZE - size) / 2;
                draw3DBlock(ctx, b.x + offset, b.y + offset, size, b.color);
            }
        });

        if (allDone) {
            clearingBlocks = [];
            isAnimatingClear = false;

            if (handBlocks.every(b => b.isUsed)) {
                generateHandBlocks();
            } else {
                checkGameOver();
            }
        }
    }

    if (draggingBlock && !isAnimatingClear) {
        const baseCol = Math.floor((draggingBlock.currentX + (GRID_SIZE * draggingBlock.scale) / 2) / GRID_SIZE);
        const baseRow = Math.floor((draggingBlock.currentY + (GRID_SIZE * draggingBlock.scale) / 2) / GRID_SIZE);

        const snapTarget = getSnapTarget(draggingBlock.shape, baseRow, baseCol);

        if (snapTarget) {
            drawShape({...draggingBlock, scale: 1}, snapTarget.c * GRID_SIZE, snapTarget.r * GRID_SIZE, 0.5, '#ffffff');

            const upcomingClears = getPreviewClears(draggingBlock.shape, snapTarget.r, snapTarget.c);
            if (upcomingClears.rows.length > 0 || upcomingClears.cols.length > 0) {
                ctx.save();
                ctx.shadowColor = '#ffea00';
                ctx.shadowBlur = 25;
                ctx.fillStyle = 'rgba(255, 234, 0, 0.65)';

                upcomingClears.rows.forEach(r => {
                    for(let c = 0; c < COLS; c++) drawRoundedRect(ctx, c * GRID_SIZE + 1.5, r * GRID_SIZE + 1.5, GRID_SIZE - 3, GRID_SIZE - 3, GRID_SIZE * 0.15);
                });
                upcomingClears.cols.forEach(c => {
                    for(let r = 0; r < ROWS; r++) drawRoundedRect(ctx, c * GRID_SIZE + 1.5, r * GRID_SIZE + 1.5, GRID_SIZE - 3, GRID_SIZE - 3, GRID_SIZE * 0.15);
                });
                ctx.restore();
            }
        }
    }

    handBlocks.forEach(b => {
        if (!b.isUsed && b !== draggingBlock) {
            b.currentX += (b.originalX - b.currentX) * 0.25;
            b.currentY += (b.originalY - b.currentY) * 0.25;
            b.scale += (b.targetScale - b.scale) * 0.25;
            drawShape(b, b.currentX, b.currentY, 1);
        }
    });

    if (draggingBlock) {
        draggingBlock.scale += (1.0 - draggingBlock.scale) * 0.3;
        drawShape(draggingBlock, draggingBlock.currentX, draggingBlock.currentY, 0.95);
    }

    // === 新增：繪製爆破粒子 ===
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.8; // 重力效果，讓粒子呈拋物線下墜
        p.life -= p.decay;

        if (p.life <= 0) {
            particles.splice(i, 1); // 移除死掉的粒子
        } else {
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.translate(p.x, p.y);
            // 讓粒子帶有旋轉感
            ctx.rotate(p.life * Math.PI);
            ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
            ctx.restore();
        }
    }

    if (!isGameOver) requestAnimationFrame(gameLoop);
}

function showCombo(lines) {
    if (lines <= 1) return;
    comboMessage.innerText = `COMBO x${lines}!`;
    comboMessage.style.opacity = 1;
    comboMessage.style.transform = "translate(-50%, -60%) scale(1.2)";
    setTimeout(() => {
        comboMessage.style.opacity = 0;
        comboMessage.style.transform = "translate(-50%, -50%) scale(1)";
    }, 800);
}

// 包含最高分邏輯的分數跳動動畫
function animateScore(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        let currentVal = Math.floor(easeProgress * (end - start) + start);
        element.innerText = currentVal;

        // === 檢查並更新最高分 ===
        if (currentVal > highScore) {
            highScore = currentVal;
            localStorage.setItem('grandmaBlockPuzzleHighScore', highScore);
            highScoreElement.innerText = highScore;
        }

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.innerText = end;
        }
    };
    window.requestAnimationFrame(step);
}

function checkAndClearLines() {
    let rowsToClear = new Set();
    let colsToClear = new Set();

    for (let r = 0; r < ROWS; r++) {
        if (board[r].every(cell => cell !== 0)) rowsToClear.add(r);
    }
    for (let c = 0; c < COLS; c++) {
        let isFull = true;
        for (let r = 0; r < ROWS; r++) {
            if (board[r][c] === 0) { isFull = false; break; }
        }
        if (isFull) colsToClear.add(c);
    }

    let totalLinesCleared = rowsToClear.size + colsToClear.size;

    if (totalLinesCleared > 0) {
        isAnimatingClear = true;
        showCombo(totalLinesCleared);

        // 如果手機支援，觸發消除時的實體震動 (打擊感倍增！)
        if (navigator.vibrate) {
            navigator.vibrate(50 * totalLinesCleared);
        }

        let earnedScore = 10;
        const comboBonus = (Math.pow(2, totalLinesCleared) - 1) * 100;
        earnedScore += comboBonus;

        let oldScore = score;
        score += earnedScore;

        animateScore(scoreElement, oldScore, score, 500);
        playSound('clear', totalLinesCleared);

        rowsToClear.forEach(r => {
            for (let c = 0; c < COLS; c++) {
                if (board[r][c] !== 0) {
                    clearingBlocks.push({ x: c * GRID_SIZE, y: r * GRID_SIZE, color: board[r][c], scale: 1 });

                    // === 觸發粒子爆破 ===
                    createParticles(c * GRID_SIZE, r * GRID_SIZE, board[r][c]);

                    board[r][c] = 0;
                }
            }
        });
        colsToClear.forEach(c => {
            for (let r = 0; r < ROWS; r++) {
                if (board[r][c] !== 0) {
                    clearingBlocks.push({ x: c * GRID_SIZE, y: r * GRID_SIZE, color: board[r][c], scale: 1 });

                    // === 觸發粒子爆破 ===
                    createParticles(c * GRID_SIZE, r * GRID_SIZE, board[r][c]);

                    board[r][c] = 0;
                }
            }
        });
    } else {
        score += 10;
        // 如果沒打破最高分，至少更新當前分數跳動；如果有打破，同步更新最高分
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('grandmaBlockPuzzleHighScore', highScore);
            highScoreElement.innerText = highScore;
        }
        scoreElement.innerText = score;

        // 放置的微震動
        if (navigator.vibrate) navigator.vibrate(10);
        playSound('place');
    }
}

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
}

canvas.addEventListener('pointerdown', (e) => {
    if (isGameOver || isAnimatingClear) return;
    const pos = getPos(e);

    if (pos.y > ROWS * GRID_SIZE) {
        const zoneWidth = canvas.width / 3;
        const zoneIndex = Math.floor(pos.x / zoneWidth);

        if (zoneIndex >= 0 && zoneIndex < 3) {
            let b = handBlocks[zoneIndex];
            if (!b.isUsed) {
                draggingBlock = b;

                dragOffsetX = ((b.maxC + b.minC + 1) * GRID_SIZE) / 2;
                dragOffsetY = ((b.maxR + b.minR + 1) * GRID_SIZE) / 2 + (GRID_SIZE * 2);

                draggingBlock.currentX = pos.x - dragOffsetX;
                draggingBlock.currentY = pos.y - dragOffsetY;

                // 拿起積木的微震動
                if (navigator.vibrate) navigator.vibrate(5);
            }
        }
    }
});

canvas.addEventListener('pointermove', (e) => {
    if (!draggingBlock) return;
    e.preventDefault();
    const pos = getPos(e);
    draggingBlock.currentX = pos.x - dragOffsetX;
    draggingBlock.currentY = pos.y - dragOffsetY;
});

canvas.addEventListener('pointerup', () => {
    if (!draggingBlock) return;

    const baseCol = Math.floor((draggingBlock.currentX + (GRID_SIZE * draggingBlock.scale) / 2) / GRID_SIZE);
    const baseRow = Math.floor((draggingBlock.currentY + (GRID_SIZE * draggingBlock.scale) / 2) / GRID_SIZE);

    const snapTarget = getSnapTarget(draggingBlock.shape, baseRow, baseCol);

    if (snapTarget) {
        place(draggingBlock, snapTarget.r, snapTarget.c);
        draggingBlock.isUsed = true;
        draggingBlock = null;

        checkAndClearLines();

        if (!isAnimatingClear) {
            if (handBlocks.every(b => b.isUsed)) {
                generateHandBlocks();
            } else {
                checkGameOver();
            }
        }
    } else {
        draggingBlock = null;
    }
});

function canPlace(shape, r0, c0) {
    return shape.every(cell => {
        let r = r0 + cell[0], c = c0 + cell[1];
        return r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === 0;
    });
}

function place(block, r0, c0) {
    block.shape.forEach(cell => {
        board[r0 + cell[0]][c0 + cell[1]] = block.color;
    });
}

function checkGameOver() {
    if (handBlocks.length === 0 || handBlocks.every(b => b.isUsed)) return;

    let canAnyBlockFit = false;
    for (let b of handBlocks) {
        if (b.isUsed) continue;
        if (canShapeFitAnywhere(b.shape)) {
            canAnyBlockFit = true;
            break;
        }
    }

    if (!canAnyBlockFit && !isGameOver) {
        isGameOver = true;
        playSound('over');
        setTimeout(() => {
            finalScoreElement.innerText = score;
            gameOverModal.style.display = 'flex';
        }, 500);
    }
}

restartBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    gameOverModal.style.display = 'none';
    init();
});

init();