// 音效和背景音樂
// 瀏覽器不支援或擋住音效時就安靜玩，不要讓遊戲當掉
function ensureAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;
    try { audioContext = new AudioContextClass(); } catch (error) { return false; }
  }
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return true;
}

function playTone(frequency, duration, volume, type = 'sine') {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

function startMusic(continueFromCurrentStep = false) {
  if (!musicEnabled || gameOver || paused) return;
  if (musicTimer !== null) return;
  if (!ensureAudio()) return;

  if (!continueFromCurrentStep) musicStep = 0;
  const playStep = () => {
    playTone(melody[musicStep], 0.32, 0.022);
    if (musicStep % 4 === 0) {
      playTone(melody[musicStep] / 2, 0.6, 0.014, 'triangle');
    }
    musicStep = (musicStep + 1) % melody.length;
  };
  playStep();
  musicTimer = window.setInterval(playStep, 340);
}

function stopMusic() {
  window.clearInterval(musicTimer);
  musicTimer = null;
}

function setMusicButton() {
  musicButton.textContent = musicEnabled ? '♫ 音樂開' : '♫ 音樂關';
  musicButton.setAttribute('aria-pressed', String(musicEnabled));
}
