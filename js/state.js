// 遊戲狀態：盤面、分數、最高紀錄、瞄準、暫停
let width = 0;
let height = 0;
let radius = 0;
let rowGap = 0;
let board = [];
let score = 0;
let bestScore = 0;
let gameMode = 'classic';
let currentLevel = 1;
let levelAdvanceTimer = null;
let remainingTime = 60;
let shotsRemaining = 25;
let descentTimer = modeSettings.descent.interval;
let dropsThisLevel = 0;
let gameStarted = false;
let gameOverReason = '';
let lastDisplayedTime = 60;
let lastDisplayedDescent = modeSettings.descent.interval;
let currentColor = 0;
let nextColor = 1;
let projectile = null;
let boardDropAnimation = null;
let fallingBubbles = [];
let aim = { x: 0, y: 0 };
let gameOver = false;
let hasWon = false;
let paused = false;
let pausedAt = 0;
let audioContext = null;
let musicTimer = null;
let musicStep = 0;
let musicEnabled = true;
let lastFrame = 0;
// 每多一排泡泡從上面降下來，就把奇偶排交換，原本的泡泡才不會整片左右跳半格
let rowParity = 0;
// 手機瞄準：手指按住時顯示瞄準線，放開才發射
let touchAiming = false;
let touchPointerId = null;
let aimSet = false;
// 泡泡還在飛、或整片正在往下降時放開手指：先記著，等可以射了再自動射（不會被吃掉）
let pendingShot = null;
try { bestScore = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (error) { bestScore = 0; }

function saveBest() {
  try { localStorage.setItem(BEST_KEY, String(bestScore)); } catch (error) { /* 無痕模式存不了也照玩 */ }
}
