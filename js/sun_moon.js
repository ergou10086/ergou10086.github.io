function switchNightMode() {
  // 添加动画效果
  document.querySelector('body').insertAdjacentHTML('beforeend', '<div class="Cuteen_DarkSky"><div class="Cuteen_DarkPlanet"></div></div>')
  
  // 获取当前模式
  const nowMode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  const willChangeMode = nowMode === 'light' ? 'dark' : 'light'
  
  // 延迟执行模式切换，配合动画效果
  setTimeout(function() {
    // 切换主题模式
    if (willChangeMode === 'dark') {
      btf.activateDarkMode()
      btf.saveToLocal.set('theme', 'dark', 2)
      GLOBAL_CONFIG.Snackbar !== undefined && btf.snackbarShow(GLOBAL_CONFIG.Snackbar.day_to_night)
      document.getElementById('modeicon').setAttribute('xlink:href', '#icon-sun')
    } else {
      btf.activateLightMode()
      btf.saveToLocal.set('theme', 'light', 2)
      GLOBAL_CONFIG.Snackbar !== undefined && btf.snackbarShow(GLOBAL_CONFIG.Snackbar.night_to_day)
      document.getElementById('modeicon').setAttribute('xlink:href', '#icon-moon')
    }
    
    // 处理主题变化相关的回调
    const globalFn = window.globalFn || {}
    const themeChange = globalFn.themeChange || {}
    if (themeChange) {
      Object.keys(themeChange).forEach(key => {
        const themeChangeFn = themeChange[key]
        if (['disqus', 'disqusjs'].includes(key)) {
          setTimeout(() => themeChangeFn(willChangeMode), 300)
        } else {
          themeChangeFn(willChangeMode)
        }
      })
    }
    
    // 处理其他评论系统
    typeof utterancesTheme === 'function' && utterancesTheme()
    typeof FB === 'object' && window.loadFBComment()
    window.DISQUS && document.getElementById('disqus_thread') && document.getElementById('disqus_thread').children.length && setTimeout(() => window.disqusReset(), 200)
    
    // 淡出动画效果
    setTimeout(function() {
      const darkSky = document.getElementsByClassName('Cuteen_DarkSky')[0]
      if (darkSky) {
        darkSky.style.transition = 'opacity 3s'
        darkSky.style.opacity = '0'
        setTimeout(function() {
          darkSky.remove()
        }, 1000)
      }
    }, 2000)
  }, 0)
}
