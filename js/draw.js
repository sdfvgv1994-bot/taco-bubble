// 把畫面畫到畫布上
function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  width = bounds.width;
  height = bounds.height;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  radius = width / (columns * 2 + 1);
  rowGap = radius * Math.sqrt(3);
  // 一開始瞄準線朝正上方（手機沒有滑鼠移動，原本會指向左上角）
  if (!aimSet) aim = { x: width / 2, y: height * 0.3 };
  draw();
}

function drawBubble(x, y, colorIndex, bubbleRadius = radius) {
  const bubble = colors[colorIndex];
  const gradient = context.createRadialGradient(
    x - bubbleRadius * 0.34,
    y - bubbleRadius * 0.4,
    bubbleRadius * 0.08,
    x,
    y,
    bubbleRadius,
  );
  gradient.addColorStop(0, bubble.light);
  gradient.addColorStop(0.46, bubble.fill);
  gradient.addColorStop(1, '#32634e');

  context.beginPath();
  context.arc(x, y, bubbleRadius * 0.94, 0, Math.PI * 2);
  context.fillStyle = gradient;
  context.fill();
  context.lineWidth = Math.max(1, bubbleRadius * 0.07);
  context.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  context.stroke();
}

function syncHud() {
  if (hudScore.textContent !== scoreElement.textContent) hudScore.textContent = scoreElement.textContent;
  if (hudBest.textContent !== bestScoreElement.textContent) hudBest.textContent = bestScoreElement.textContent;
  if (hudStatus.textContent !== challengeStatusElement.textContent) hudStatus.textContent = challengeStatusElement.textContent;
  if (hudNext.style.color !== nextColorElement.style.color) hudNext.style.color = nextColorElement.style.color;
}

function draw() {
  syncHud();
  if (!width || !height) return;
  context.clearRect(0, 0, width, height);
  context.fillStyle = getComputedStyle(document.documentElement)
    .getPropertyValue('--garden-color').trim();
  context.fillRect(0, 0, width, height);
  const gardenGradient = context.createLinearGradient(0, 0, 0, height);
  gardenGradient.addColorStop(0, 'rgba(190, 220, 160, 0.12)');
  gardenGradient.addColorStop(0.58, 'rgba(20, 50, 35, 0.04)');
  gardenGradient.addColorStop(1, 'rgba(5, 20, 15, 0.28)');
  context.fillStyle = gardenGradient;
  context.fillRect(0, 0, width, height);

  context.save();
  context.strokeStyle = 'rgba(209, 230, 166, 0.08)';
  context.lineWidth = 1;
  for (let lineY = radius * 2; lineY < height; lineY += radius * 1.6) {
    context.beginPath();
    context.moveTo(0, lineY);
    context.lineTo(width, lineY);
    context.stroke();
  }
  context.restore();

  const dangerY = height - radius * 4.2;
  context.save();
  context.setLineDash([7, 8]);
  context.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  context.beginPath();
  context.moveTo(0, dangerY);
  context.lineTo(width, dangerY);
  context.stroke();
  context.restore();

  const dropAnimation = boardDropAnimation;
  const dropProgress = dropAnimation
    ? Math.min((performance.now() - dropAnimation.startedAt) / 520, 1)
    : 1;
  const easedDropProgress = 1 - (1 - dropProgress) ** 3;
  const dropOffset = dropAnimation ? -rowGap * (1 - easedDropProgress) : 0;
  board.forEach((row, rowIndex) => {
    if (!row) return;
    row.forEach((colorIndex, column) => {
      if (colorIndex === undefined) return;
      const center = bubbleCenter(rowIndex, column);
      drawBubble(center.x, center.y + (rowIndex >= (dropAnimation?.firstRow ?? Infinity) ? dropOffset : 0), colorIndex);
    });
  });
  if (dropAnimation && dropProgress >= 1) boardDropAnimation = null;
  const now = performance.now();
  fallingBubbles = fallingBubbles.filter((bubble) => {
    const progress = (now - bubble.startedAt) / 480;
    if (progress >= 1) return false;
    context.save();
    context.globalAlpha = 1 - progress;
    drawBubble(bubble.x, bubble.y + rowGap * 2.2 * progress, bubble.color);
    context.restore();
    return true;
  });

  const shooter = shooterPosition();
  if (!gameOver && !projectile && !paused) {
    const dx = aim.x - shooter.x;
    const dy = aim.y - shooter.y;
    const canShoot = dy < -radius * 0.4;
    context.save();
    context.setLineDash([5, 6]);
    context.lineWidth = 2;
    if (touchAiming) {
      context.strokeStyle = canShoot ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 120, 120, 0.6)';
      const path = canShoot ? aimPath(shooter, dx, dy) : [shooter, { x: aim.x, y: aim.y }];
      context.beginPath();
      context.moveTo(path[0].x, path[0].y);
      path.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
    } else {
      const length = Math.hypot(dx, dy) || 1;
      context.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      context.beginPath();
      context.moveTo(shooter.x, shooter.y);
      context.lineTo(shooter.x + (dx / length) * radius * 5, shooter.y + (dy / length) * radius * 5);
      context.stroke();
    }
    context.restore();
  }

  drawBubble(shooter.x, shooter.y, currentColor, radius * 1.12);
  // 下一顆放在發射台旁邊（原本放在下面，手機上會被切掉）
  drawBubble(shooter.x + radius * 2.6, shooter.y + radius * 0.4, nextColor, radius * 0.6);
  if (projectile) {
    drawBubble(projectile.x, projectile.y, projectile.color);
  }

  if (gameOver) {
    context.fillStyle = 'rgba(8, 24, 18, 0.76)';
    context.fillRect(0, 0, width, height);
    context.textAlign = 'center';
    context.fillStyle = '#fff2ac';
    context.font = `700 ${Math.max(25, radius * 1.7)}px "Segoe UI", sans-serif`;
    const title = hasWon
      ? gameMode === 'campaign' || gameMode === 'falling'
        ? currentLevel === maxLevels ? '闖關完成！' : `第 ${currentLevel} 關完成！`
        : '太厲害了！'
      : gameOverReason || '遊戲結束';
    context.fillText(title, width / 2, height / 2 - 12);
    context.fillStyle = '#f7f5ff';
    context.font = `500 ${Math.max(15, radius * 0.9)}px "Segoe UI", sans-serif`;
    const message = (gameMode === 'campaign' || gameMode === 'falling') && hasWon && currentLevel < maxLevels
      ? `下一關即將開始・第 ${currentLevel + 1} / ${maxLevels} 關`
      : `分數：${score}　點「重新開始」再玩一次`;
    context.fillText(message, width / 2, height / 2 + 25);
  } else if (paused) {
    context.fillStyle = 'rgba(8, 24, 18, 0.76)';
    context.fillRect(0, 0, width, height);
    context.textAlign = 'center';
    context.fillStyle = '#fff2ac';
    context.font = `700 ${Math.max(25, radius * 1.7)}px "Segoe UI", sans-serif`;
    context.fillText('遊戲暫停', width / 2, height / 2);
    context.fillStyle = '#f7f5ff';
    context.font = `500 ${Math.max(15, radius * 0.9)}px "Segoe UI", sans-serif`;
    context.fillText('按「繼續」回到遊戲', width / 2, height / 2 + 34);
  }
}
