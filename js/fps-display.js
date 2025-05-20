// FPS显示器
(function() {
  // 上一帧的时间戳
  let prevTime = performance.now();
  // 帧数计数器
  let frames = 0;
  // 当前FPS值
  let fps = 60;
  // FPS显示元素
  let fpsElement;

  // 初始化函数
  function init() {
    fpsElement = document.getElementById('fps');
    if (!fpsElement) return;
    
    // 请求动画帧，开始计算FPS
    requestAnimationFrame(loop);
  }

  // 动画循环
  function loop(time) {
    // 计算帧数
    frames++;
    
    // 每秒更新一次FPS显示
    if (time - prevTime >= 1000) {
      // 计算FPS
      fps = Math.round((frames * 1000) / (time - prevTime));
      
      // 更新显示
      fpsElement.textContent = `FPS: ${fps}`;
      
      // 重置计数器
      prevTime = time;
      frames = 0;
    }
    
    // 继续循环
    requestAnimationFrame(loop);
  }

  // 页面加载完成后初始化
  window.addEventListener('load', init);
})();
