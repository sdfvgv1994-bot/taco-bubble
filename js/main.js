// 最後開局（一定要放在最後載入）
// 版本號：上線時 workflow 會把 dev 換成提交代號，方便確認手機上是不是最新版
document.getElementById('ver').textContent = document.querySelector('meta[name="app-version"]').content;
window.addEventListener('resize', resizeCanvas);
setMusicButton();
resizeCanvas();
resetGame();
window.requestAnimationFrame(animate);
