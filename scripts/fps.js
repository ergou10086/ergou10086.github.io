// FPS计数器
(function() {
  let prevTime = performance.now();
  let frames = 0;
  let fpsElement = null;

  function init() {
    fpsElement = document.getElementById('fps');
    if (!fpsElement) return;
    
    requestAnimationFrame(loop);
  }

  function loop(time) {
    frames++;
    
    if (time - prevTime >= 1000) {
      const fps = Math.round((frames * 1000) / (time - prevTime));
      if (fpsElement) {
        fpsElement.textContent = `FPS: ${fps}`;
      }
      
      prevTime = time;
      frames = 0;
    }
    
    requestAnimationFrame(loop);
  }

  // 页面加载完成后初始化
  window.addEventListener('load', init);
})();
