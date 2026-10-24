/**
 * 页脚站点运行时间
 *
 * 起始时间由 Hexo 插件 /scripts/site-runtime.js（博客根目录 scripts/site-runtime.js）
 * 持久化在 .site-runtime.json 中，并通过 footer.pug 的 data-runtime-start 属性输出。
 * 本脚本只负责按“北京时间（UTC+8）”做日历换算并逐秒刷新，因此：
 *   - hexo clean / generate / deploy / server 不会让时间重置；
 *   - 也不会因为访客本地时区不同而出现“少一天/多一天”的偏差；
 *   - 不再依赖 dayjs。
 */
(function () {
  'use strict';

  var DEFAULT_START = '2025-03-19T00:00:00+08:00';
  var STORAGE_KEY = 'ergoutree_site_runtime_start';
  var HOUR_MS = 60 * 60 * 1000;
  var DAY_MS = 24 * HOUR_MS;
  var TZ_OFFSET = 8 * HOUR_MS; // Asia/Shanghai（中国无夏令时）

  var timerId = null;
  var currentStart = null;

  function parseTime(value) {
    if (!value) return null;
    var ts = Date.parse(value);
    return isNaN(ts) ? null : ts;
  }

  function readStoredStart() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function writeStoredStart(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* localStorage 不可用时忽略即可 */
    }
  }

  /**
   * 解析起始日期，优先级：页脚构建时写入的 data-runtime-start > localStorage 记录 > 默认值。
   * 若两者同时存在，取更早的那个，保证时间永远不会“倒流”。
   */
  function resolveStart() {
    var host = document.querySelector('.footer_custom_text[data-runtime-start]');
    var fromData = host ? parseTime(host.getAttribute('data-runtime-start')) : null;
    var fromStore = parseTime(readStoredStart());

    var startMs;
    if (fromData && fromStore) {
      startMs = Math.min(fromData, fromStore);
    } else {
      startMs = fromData || fromStore || parseTime(DEFAULT_START);
    }

    // 记录到本地，页面没有 data 属性（例如旧的缓存 HTML）时也能接续上一次记录
    writeStoredStart(new Date(startMs).toISOString());
    return startMs;
  }

  // 把绝对时间换算到“北京时间的日历坐标”（用 UTC getter 读取即得北京时间）
  function toCalendar(ms) {
    return ms + TZ_OFFSET;
  }

  function partsOf(calendarMs) {
    var d = new Date(calendarMs);
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth(),
      day: d.getUTCDate(),
      hours: d.getUTCHours(),
      minutes: d.getUTCMinutes(),
      seconds: d.getUTCSeconds()
    };
  }

  function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  }

  function addCalendarYears(calendarMs, count) {
    var d = new Date(calendarMs);
    var year = d.getUTCFullYear() + count;
    var month = d.getUTCMonth();
    var day = Math.min(d.getUTCDate(), daysInMonth(year, month));
    return Date.UTC(year, month, day, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
  }

  function addCalendarMonths(calendarMs, count) {
    var d = new Date(calendarMs);
    var total = d.getUTCFullYear() * 12 + d.getUTCMonth() + count;
    var year = Math.floor(total / 12);
    var month = total - year * 12;
    var day = Math.min(d.getUTCDate(), daysInMonth(year, month));
    return Date.UTC(year, month, day, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
  }

  /** 计算 X年X月X天XX时XX分XX秒（按真实日历，含闰年/大小月） */
  function diffParts(startMs, nowMs) {
    var startCal = toCalendar(startMs);
    var nowCal = toCalendar(nowMs);

    var startParts = partsOf(startCal);
    var nowParts = partsOf(nowCal);

    // 先按年估算，再回退到不超过 now 的最大整年数
    var years = nowParts.year - startParts.year;
    var cursor = addCalendarYears(startCal, years);
    if (cursor > nowCal) {
      years -= 1;
      cursor = addCalendarYears(startCal, years);
    }

    // 再补整月（最多 11 次）
    var months = 0;
    while (addCalendarMonths(cursor, 1) <= nowCal) {
      months += 1;
      cursor = addCalendarMonths(cursor, 1);
    }

    var rest = nowCal - cursor;
    var days = Math.floor(rest / DAY_MS);
    rest -= days * DAY_MS;
    var hours = Math.floor(rest / HOUR_MS);
    rest -= hours * HOUR_MS;
    var minutes = Math.floor(rest / 60000);
    rest -= minutes * 60000;
    var seconds = Math.floor(rest / 1000);

    return {
      years: Math.max(years, 0),
      months: months,
      days: days,
      hours: hours,
      minutes: minutes,
      seconds: seconds
    };
  }

  function pad2(num) {
    return num < 10 ? '0' + num : String(num);
  }

  function render(el, startMs) {
    var d = diffParts(startMs, Date.now());
    el.textContent =
      'ErgouTree的破站已稳定或不稳定运行' +
      d.years + '年' +
      d.months + '月' +
      d.days + '天' +
      pad2(d.hours) + '时' +
      pad2(d.minutes) + '分' +
      pad2(d.seconds) + '秒';
  }

  function tick() {
    var el = document.getElementById('realtime_duration');
    if (!el || !currentStart) {
      timerId = null; // 元素不存在（例如 PJAX 切换中），停止计时，等待下次初始化
      return;
    }
    render(el, currentStart);
    // 对齐到下一个整秒，避免长时间运行后出现偏差
    var delay = 1000 - (Date.now() % 1000);
    timerId = setTimeout(tick, delay);
  }

  function initRuntime() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
    var el = document.getElementById('realtime_duration');
    if (!el) return;

    currentStart = resolveStart();
    tick();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRuntime);
  } else {
    initRuntime();
  }

  // PJAX / 主题全局钩子
  document.addEventListener('pjax:complete', initRuntime);
  if (typeof window.btf !== 'undefined' && typeof window.btf.addGlobalFn === 'function') {
    window.btf.addGlobalFn('pjaxComplete', initRuntime, 'site_runtime');
  }
})();
