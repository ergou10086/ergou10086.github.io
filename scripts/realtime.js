document.addEventListener('DOMContentLoaded', initRuntime)
document.addEventListener('pjax:complete', initRuntime) // 添加Pjax支持

function initRuntime() {
  dayjs.extend(window.dayjs_plugin_duration)

  const el = document.getElementById('realtime_duration')
  if (!el) return // 确保元素存在

  const startDate = dayjs('2025-03-19T00:00:00+08:00')

  const updateTime = () => {
    const now = dayjs()
    const duration = dayjs.duration(now.diff(startDate))

    // 手动拼接时间部分
    const days = duration.days()
    const hours = duration.hours().toString().padStart(2, '0')
    const minutes = duration.minutes().toString().padStart(2, '0')
    const seconds = duration.seconds().toString().padStart(2, '0')

    el.innerHTML = `ErgouTree的破站已稳定或不稳定运行${days}天${hours}时${minutes}分${seconds}秒`
  }

  updateTime()
  setInterval(updateTime, 1000)
}