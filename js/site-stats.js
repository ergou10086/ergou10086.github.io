/**
 * 站点访问统计（替代不稳定的 busuanzi）
 * ---------------------------------------------------------------------------
 * 背景：原主题使用不蒜子（busuanzi.ibruce.info），实测：
 *   1) 服务不稳定：多次请求出现 502 Bad Gateway / Bad Request（2026-10 实测）；
 *   2) 偶尔返回异常数据（曾出现 5700 万 + 的明显错误数字）；
 *   3) 免费第三方无 SLA，且 site_uv 的统计口径（按天去重累计）容易让人误解。
 *
 * 现方案：
 *   1) 数据源改用 Vercount（https://vercount.one，不蒜子的兼容替代，活跃维护）；
 *   2) 统一用规范域名 https://www.ergoutreegal.cn 计数，避免 www / 非 www / github.io
 *      多域名把访问量拆开；
 *   3) 保留切换前的历史总量作为基数（BASE_UV / BASE_PV），避免切换后数字“归零”；
 *   4) localStorage 缓存最后一次成功数据，接口失败时显示缓存值，不再出现空白/离谱数字；
 *   5) hexo clean / generate / deploy 都只影响 public 静态文件，不会重置统计。
 *
 * 说明：只有正式域名下才上报（本地 hexo server 预览不污染线上数据）。
 */
(function () {
  'use strict';

  var CANONICAL_ORIGIN = 'https://www.ergoutreegal.cn';
  // 切换前（2026-10-24）不蒜子累计值快照，作为历史基数
  var BASE_UV = 88811;
  var BASE_PV = 91853;

  var API_URL = 'https://events.vercount.one/api/v2/log';
  var CACHE_KEY = 'ergoutree_site_stats_v1';
  var UV_COOKIE = 'ergoutree_uv';
  var TIMEOUT = 8000;

  var isProduction = (function () {
    var host = location.hostname;
    return host === 'www.ergoutreegal.cn' || host === 'ergoutreegal.cn';
  })();

  function getEl(id) {
    return document.getElementById(id);
  }

  function hasUvCookie() {
    return document.cookie.split('; ').some(function (item) {
      return item.indexOf(UV_COOKIE + '=') === 0;
    });
  }

  function setUvCookie() {
    document.cookie = UV_COOKIE + '=1; path=/; max-age=31536000; SameSite=Lax';
  }

  function formatNumber(value) {
    var num = Number(value);
    if (!isFinite(num) || num < 0) num = 0;
    try {
      return num.toLocaleString('zh-CN');
    } catch (err) {
      return String(Math.round(num));
    }
  }

  function render(uv, pv, note) {
    var uvEl = getEl('busuanzi_value_site_uv');
    var pvEl = getEl('busuanzi_value_site_pv');
    var title = note || '本站自上线以来的累计访问量（Vercount 统计，含历史基数）';
    if (uvEl) {
      uvEl.textContent = formatNumber(uv);
      uvEl.title = title;
    }
    if (pvEl) {
      pvEl.textContent = formatNumber(pv);
      pvEl.title = title;
    }
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (data && isFinite(data.uv) && isFinite(data.pv)) return data;
    } catch (err) {
      /* ignore */
    }
    return null;
  }

  function writeCache(uv, pv) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ uv: uv, pv: pv, t: Date.now() }));
    } catch (err) {
      /* ignore */
    }
  }

  // 统计卡片不存在（例如 video/gallery 等 aside:false 页面）时直接退出
  if (!getEl('busuanzi_value_site_uv') && !getEl('busuanzi_value_site_pv')) {
    return;
  }

  var cached = readCache();

  // 本地预览 / 离线：只展示缓存，不上报
  if (!isProduction) {
    if (cached) {
      render(cached.uv, cached.pv, '本地预览：显示上次缓存的统计数据');
    } else {
      render(BASE_UV, BASE_PV, '本地预览：显示历史基数，正式站点会继续累加');
    }
    return;
  }

  var url = CANONICAL_ORIGIN + location.pathname;

  var isNewUv = !hasUvCookie();
  if (isNewUv) setUvCookie();

  var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = setTimeout(function () {
    if (controller) controller.abort();
  }, TIMEOUT);

  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url, isNewUv: isNewUv }),
    signal: controller ? controller.signal : undefined,
    credentials: 'omit'
  })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      clearTimeout(timer);
      var payload = data && (data.data || data);
      if (!payload || !isFinite(payload.site_uv) || !isFinite(payload.site_pv)) {
        throw new Error('统计返回数据异常');
      }
      var uv = BASE_UV + Number(payload.site_uv);
      var pv = BASE_PV + Number(payload.site_pv);
      render(uv, pv);
      writeCache(uv, pv);
    })
    .catch(function (err) {
      clearTimeout(timer);
      if (window.console && console.warn) {
        console.warn('[site-stats] 统计服务不可用：', err && err.message ? err.message : err);
      }
      if (cached) {
        render(cached.uv, cached.pv, '统计服务暂时不可用，显示缓存数据（' + new Date(cached.t).toLocaleString('zh-CN') + '）');
      } else {
        render(BASE_UV, BASE_PV, '统计服务暂时不可用，当前显示切换前的历史总量');
      }
    });
})();
