// 關卡、回合、計分、下降、勝負和主迴圈
function setPaused(nextPaused) {
  if (gameOver || paused === nextPaused) return;
  paused = nextPaused;
  pauseButton.textContent = paused ? '▶ 繼續' : 'Ⅱ 暫停';
  pauseButton.setAttribute('aria-pressed', String(paused));
  if (paused) {
    pausedAt = performance.now();
    pendingShot = null;
    stopMusic();
    if (audioContext?.state === 'running') audioContext.suspend().catch(() => {});
  } else {
    const pausedDuration = performance.now() - pausedAt;
    if (boardDropAnimation) boardDropAnimation.startedAt += pausedDuration;
    fallingBubbles.forEach((bubble) => {
      bubble.startedAt += pausedDuration;
    });
    if (musicEnabled) startMusic(true);
  }
  draw();
}

function updateChallengeStatus() {
  const settings = modeSettings[gameMode];
  if (gameMode === 'campaign' || gameMode === 'falling') {
    challengeStatusElement.textContent = hasWon
      ? currentLevel === maxLevels
        ? '50 關全數完成！'
        : `第 ${currentLevel} 關完成・準備第 ${currentLevel + 1} 關`
      : gameMode === 'falling'
        ? dropsThisLevel >= maxDropsPerLevel
          ? `第 ${String(currentLevel).padStart(2, '0')} / ${maxLevels} 關・下降已達上限，清除剩餘泡泡`
          : `第 ${String(currentLevel).padStart(2, '0')} / ${maxLevels} 關・下降 ${dropsThisLevel}/${maxDropsPerLevel} 次・${Math.ceil(descentTimer)} 秒後下降`
        : `${settings.label}・第 ${currentLevel} / ${maxLevels} 關`;
  } else if (gameMode === 'timed') {
    challengeStatusElement.textContent =
      `${settings.label}・剩餘 ${Math.ceil(remainingTime)} 秒`;
  } else if (gameMode === 'shots') {
    challengeStatusElement.textContent =
      `${settings.label}・剩餘 ${shotsRemaining} 顆`;
  } else if (gameMode === 'descent') {
    challengeStatusElement.textContent =
      `${settings.label}・${Math.ceil(descentTimer)} 秒後下降`;
  } else {
    challengeStatusElement.textContent = settings.label;
  }
}

function getDescentInterval() {
  return gameMode === 'falling'
    ? Math.max(3, modeSettings.falling.interval - Math.floor((currentLevel - 1) / 10))
    : modeSettings.descent.interval;
}

function startLevel() {
  remainingTime = modeSettings.timed.seconds;
  shotsRemaining = modeSettings.shots.shots;
  descentTimer = getDescentInterval();
  gameStarted = false;
  gameOverReason = '';
  lastDisplayedTime = remainingTime;
  lastDisplayedDescent = descentTimer;
  dropsThisLevel = 0;
  rowParity = 0;
  pendingShot = null;
  touchAiming = false;
  board = [];
  const rowCount = gameMode === 'campaign' || gameMode === 'falling'
    ? Math.min(7, 4 + Math.floor((currentLevel - 1) / 10))
    : initialRows;
  for (let row = 0; row < rowCount; row += 1) {
    board[row] = [];
    const count = isShiftedRow(row) ? columns - 1 : columns;
    for (let column = 0; column < count; column += 1) {
      board[row][column] = randomColor();
    }
  }
  currentColor = randomColor();
  nextColor = randomColor();
  projectile = null;
  boardDropAnimation = null;
  fallingBubbles = [];
  gameOver = false;
  hasWon = false;
  paused = false;
  pauseButton.textContent = 'Ⅱ 暫停';
  pauseButton.setAttribute('aria-pressed', 'false');
  roundLabelElement.textContent = gameMode === 'campaign' || gameMode === 'falling'
    ? `關卡 ${String(currentLevel).padStart(2, '0')} / 50`
    : 'ROUND 01';
  scoreNoteElement.textContent = gameMode === 'falling'
    ? '連成 3 顆同色，泡泡一起掉落'
    : '讓相同顏色連成一片';
  scoreElement.textContent = String(score).padStart(4, '0');
  bestScoreElement.textContent = String(bestScore).padStart(4, '0');
  nextColorElement.style.color = colors[nextColor].fill;
  updateChallengeStatus();
  draw();
}

function resetGame() {
  window.clearTimeout(levelAdvanceTimer);
  levelAdvanceTimer = null;
  gameMode = modeSelect.value;
  columns = gameMode === 'falling' ? 14 : 10;
  currentLevel = 1;
  score = 0;
  resizeCanvas();
  startLevel();
}

function dropField() {
  if (gameMode === 'falling' && dropsThisLevel >= maxDropsPerLevel) {
    updateChallengeStatus();
    return;
  }
  const topRow = [];
  // 新的一排插在最上面：所有排的編號 +1，奇偶跟著換，原本的泡泡位置才不會跳
  rowParity ^= 1;
  const count = isShiftedRow(0) ? columns - 1 : columns;
  for (let column = 0; column < count; column += 1) {
    topRow[column] = randomColor();
  }
  board.unshift(topRow);
  if (gameMode === 'falling') dropsThisLevel += 1;
  boardDropAnimation = { startedAt: performance.now(), firstRow: 1 };
  descentTimer = getDescentInterval();
  lastDisplayedDescent = Math.ceil(descentTimer);
  updateChallengeStatus();
  checkGameOver();
}

function finishTurn(row, column, colorIndex) {
  if (!board[row]) board[row] = [];
  board[row][column] = colorIndex;
  let clearedCount = 0;
  let floatingCount = 0;
  let shouldScoreClear = false;
  const cluster = findCluster(row, column, colorIndex);
  if (cluster.length >= 3) {
    const startedAt = performance.now();
    if (gameMode === 'falling') {
      cluster.forEach(([bubbleRow, bubbleColumn]) => {
        const center = bubbleCenter(bubbleRow, bubbleColumn);
        fallingBubbles.push({
          x: center.x,
          y: center.y,
          color: board[bubbleRow][bubbleColumn],
          startedAt,
        });
      });
    }
    cluster.forEach(([bubbleRow, bubbleColumn]) => {
      board[bubbleRow][bubbleColumn] = undefined;
    });
    clearedCount = cluster.length;
    floatingCount = removeFloatingBubbles();
    shouldScoreClear = true;
  }

  if (shouldScoreClear) {
    score += clearedCount * 10 + floatingCount * 5;
    scoreElement.textContent = String(score).padStart(4, '0');
    if (score > bestScore) {
      bestScore = score;
      saveBest();
    }
    bestScoreElement.textContent = String(bestScore).padStart(4, '0');
    playTone(880, 0.12, 0.07);
    window.setTimeout(() => playTone(1174.66, 0.18, 0.055), 90);
  } else {
    playTone(330, 0.08, 0.025, 'triangle');
  }

  projectile = null;
  currentColor = nextColor;
  nextColor = randomColor();
  nextColorElement.style.color = colors[nextColor].fill;

  if (!board.some((rowBubbles) => rowBubbles?.some((bubble) => bubble !== undefined))) {
    gameOver = true;
    hasWon = true;
    gameOverReason = gameMode === 'campaign' || gameMode === 'falling'
      ? '本關完成！'
      : '花園清空！';
    stopMusic();
    playTone(1046.5, 0.25, 0.05);
    if ((gameMode === 'campaign' || gameMode === 'falling') && currentLevel < maxLevels) {
      levelAdvanceTimer = window.setTimeout(() => {
        currentLevel += 1;
        roundLabelElement.textContent = `關卡 ${String(currentLevel).padStart(2, '0')} / 50`;
        startLevel();
        if (document.hidden) setPaused(true);
        else if (musicEnabled) startMusic();
      }, 1800);
    }
  } else {
    // 下降挑戰只照「每 8 秒降一排」，射泡泡不會額外降（老闆 10/29 決定，跟選單寫的一致）
    if (!gameOver) checkGameOver();
    if (!gameOver && gameMode === 'shots' && shotsRemaining === 0) {
      gameOver = true;
      gameOverReason = '泡泡用完！';
      stopMusic();
    }
  }
  updateChallengeStatus();
  draw();
}

function checkGameOver() {
  const dangerY = height - radius * 4.2;
  const reachedBottom = board.some((row, rowIndex) =>
    row?.some((colorIndex, column) => {
      if (colorIndex === undefined) return false;
      return bubbleCenter(rowIndex, column).y + radius >= dangerY;
    }),
  );
  if (reachedBottom) {
    gameOver = true;
    gameOverReason = '泡泡碰到底線！';
    stopMusic();
    playTone(196, 0.35, 0.06, 'triangle');
  }
}

function shoot(targetX, targetY) {
  if (gameOver || paused) return;
  const shooter = shooterPosition();
  const dx = targetX - shooter.x;
  const dy = targetY - shooter.y;
  if (dy >= -radius * 0.4) return;
  if (projectile || boardDropAnimation) {
    pendingShot = { x: targetX, y: targetY };
    return;
  }
  gameStarted = true;
  if (gameMode === 'shots') {
    shotsRemaining -= 1;
    updateChallengeStatus();
  }
  const length = Math.hypot(dx, dy) || 1;
  const speed = Math.max(440, radius * 28);

  projectile = {
    x: shooter.x,
    y: shooter.y,
    ux: dx / length,
    uy: dy / length,
    vx: (dx / length) * speed,
    vy: (dy / length) * speed,
    speed,
    travel: 0,
    color: currentColor,
  };
  ensureAudio();
  playTone(440, 0.08, 0.025, 'triangle');
}

function updateProjectile(deltaTime) {
  if (!projectile) return;
  // 這一格畫面該走多遠，就一小步一小步走（跟瞄準線同一套），途中碰到就停
  projectile.travel += projectile.speed * deltaTime;
  let hit = false;
  while (projectile.travel >= flightStep()) {
    projectile.travel -= flightStep();
    const result = stepFlight(projectile);
    projectile.vx = projectile.ux * projectile.speed;
    if (result.hit) { hit = true; break; }
  }

  if (hit) {
    const spot = findNearestEmpty(projectile.x, projectile.y);
    if (spot) {
      finishTurn(spot.row, spot.column, projectile.color);
    } else {
      projectile = null;
      gameOver = true;
      gameOverReason = '沒有可放置泡泡的位置！';
      stopMusic();
    }
  }
}

function animate(timestamp) {
  const deltaTime = Math.min((timestamp - lastFrame) / 1000 || 0, 0.04);
  lastFrame = timestamp;
  if (paused) {
    draw();
    window.requestAnimationFrame(animate);
    return;
  }
  if (gameMode === 'timed' && gameStarted && !gameOver) {
    remainingTime = Math.max(0, remainingTime - deltaTime);
    const displayedTime = Math.ceil(remainingTime);
    if (displayedTime !== lastDisplayedTime) {
      lastDisplayedTime = displayedTime;
      updateChallengeStatus();
    }
    if (remainingTime === 0) {
      gameOver = true;
      gameOverReason = '時間到！';
      stopMusic();
    }
  }
  if ((gameMode === 'descent' || gameMode === 'falling') && gameStarted && !gameOver
    && (gameMode !== 'falling' || dropsThisLevel < maxDropsPerLevel)) {
    descentTimer -= deltaTime;
    const displayedDescent = Math.ceil(descentTimer);
    if (displayedDescent !== lastDisplayedDescent) {
      lastDisplayedDescent = displayedDescent;
      updateChallengeStatus();
    }
    if (descentTimer <= 0) dropField();
  }
  if (!gameOver) updateProjectile(deltaTime);
  if (pendingShot && !projectile && !boardDropAnimation && !gameOver) {
    const queued = pendingShot;
    pendingShot = null;
    shoot(queued.x, queued.y);
  }
  draw();
  window.requestAnimationFrame(animate);
}
