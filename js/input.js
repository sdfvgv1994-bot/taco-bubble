// 滑鼠、手指、鍵盤和按鈕
function updateAim(event) {
  const bounds = canvas.getBoundingClientRect();
  aim = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

function isTouchLike(event) {
  return event.pointerType === 'touch' || event.pointerType === 'pen';
}

canvas.addEventListener('pointermove', (event) => {
  if (isTouchLike(event) && (!touchAiming || event.pointerId !== touchPointerId)) return;
  aimSet = true;
  updateAim(event);
});
canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  if (isTouchLike(event) && touchAiming) return;   // 第二根手指：不理它
  aimSet = true;
  updateAim(event);
  startMusic();
  if (isTouchLike(event)) {
    if (gameOver || paused) return;
    touchAiming = true;
    touchPointerId = event.pointerId;
    try { canvas.setPointerCapture(event.pointerId); } catch (error) { /* 不支援也沒關係 */ }
    return;
  }
  shoot(aim.x, aim.y);
});
canvas.addEventListener('pointerup', (event) => {
  if (!touchAiming || event.pointerId !== touchPointerId) return;
  updateAim(event);
  touchAiming = false;
  touchPointerId = null;
  shoot(aim.x, aim.y);   // 拖到發射台下面放開＝不發射（shoot 會自己擋掉）
});
canvas.addEventListener('pointercancel', (event) => {
  if (event.pointerId !== touchPointerId) return;
  touchAiming = false;
  touchPointerId = null;
});
// 手機切到別的 App 或關螢幕：自動暫停，音樂也停，回來按「繼續」
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  touchAiming = false;
  touchPointerId = null;
  if (!gameOver) setPaused(true);
  else stopMusic();
});

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.repeat) return;
  if (event.target instanceof HTMLElement && ['INPUT', 'SELECT', 'BUTTON'].includes(event.target.tagName)) return;
  event.preventDefault();
  startMusic();
  shoot(width / 2, height * 0.35);
});

modeSelect.addEventListener('change', () => {
  stopMusic();
  resetGame();
});

gardenColorInput.addEventListener('input', () => {
  const color = gardenColorInput.value.toUpperCase();
  document.documentElement.style.setProperty('--garden-color', color);
  colorValueElement.textContent = color;
  draw();
});

restartButton.addEventListener('click', () => {
  resetGame();
  startMusic();
});

pauseButton.addEventListener('click', () => {
  setPaused(!paused);
});

musicButton.addEventListener('click', () => {
  musicEnabled = !musicEnabled;
  setMusicButton();
  if (musicEnabled) {
    ensureAudio();
    startMusic();
  } else {
    stopMusic();
  }
});
