/**
 * 访客地图（重新实现，替代不稳定/被墙的 Clustrmaps globe）
 * ---------------------------------------------------------------------------
 * 原方案 clustrmaps.com/globe.js 在国内网络基本不可用（域名被污染/连接被拒），
 * 且脚本只成功渲染一次，后续访问空白。现在改为：
 *
 *   1) 地图：高德地图静态图 REST API（国内可访问、无需额外 SDK，展示访客所在城市/
 *      区域，并带一个标记点）；
 *   2) 定位：ipwho.is(?lang=zh-CN) → ipinfo.io → 无定位（世界地图）三级降级；
 *   3) 地区累计：用 abacus 免费计数器记录每个国家/地区的访问次数（不存 IP、
 *      不存城市，只累加国家代码），显示“你来自 X · 该地区累计 N 次访问”；
 *   4) 全球累计访问量读取侧边栏「网站信息」里的 Vercount 统计值；
 *   5) 失败兜底：地图图片加载失败时显示定位城市 + 重试按钮，不再出现空白/卡死；
 *      所有网络请求超时、缓存、重试都做了保护，不影响页面其他内容。
 *
 * 说明：高德 Key 仅用于静态地图（REST），若该 Key 额度用尽可替换下方 AMAP_KEY。
 */
(function () {
  'use strict';

  var AMAP_KEY = '381f905c40bb943cf975a737dc7a81b4';
  var AMAP_STATIC = 'https://restapi.amap.com/v3/staticmap';
  var COUNT_API = 'https://abacus.jasoncameron.dev';
  var COUNT_NAMESPACE = 'ergoutreegal';
  var GEO_URL = 'https://ipwho.is/?lang=zh-CN';
  var GEO_FALLBACK = 'https://ipinfo.io/json';
  var GEO_CACHE_KEY = 'ergoutree_map_geo_v1';
  var GEO_TTL = 24 * 60 * 60 * 1000;
  var SESSION_KEY = 'ergoutree_map_counted_v1';
  var TIMEOUT = 8000;

  var isProduction = location.hostname === 'www.ergoutreegal.cn' || location.hostname === 'ergoutreegal.cn';
  var root = null;
  var body = null;
  var loading = null;
  var errorBox = null;
  var img = null;
  var cityEl = null;
  var localEl = null;
  var totalEl = null;
  var stateTimer = null;

  function fetchJSON(url, timeout) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (controller) controller.abort();
    }, timeout || TIMEOUT);
    return fetch(url, { signal: controller ? controller.signal : undefined, credentials: 'omit' })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        clearTimeout(timer);
        return data;
      });
  }

  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* ignore */
    }
  }

  function sessionGet(key) {
    try {
      var raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function sessionSet(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* ignore */
    }
  }

  /* ------------------------------ 定位 ------------------------------ */

  function loadGeo() {
    var cached = readJSON(GEO_CACHE_KEY);
    if (cached && cached.loc && cached.t && Date.now() - cached.t < GEO_TTL) {
      return Promise.resolve(cached.loc);
    }

    return fetchJSON(GEO_URL, 6000)
      .then(function (res) {
        if (!res || res.success === false) throw new Error('ipwho.is 定位失败');
        var lat = Number(res.latitude);
        var lon = Number(res.longitude);
        if (!isFinite(lat) || !isFinite(lon)) throw new Error('坐标无效');
        return {
          name: res.city || res.region || res.country || '未知位置',
          region: res.region || '',
          country: res.country || '',
          countryCode: (res.country_code || '').toUpperCase(),
          lat: lat,
          lon: lon
        };
      })
      .catch(function () {
        return fetchJSON(GEO_FALLBACK, 6000).then(function (res) {
          var loc = String((res && res.loc) || '').split(',');
          if (loc.length !== 2 || !loc[0] || !loc[1]) throw new Error('ipinfo.io 定位失败');
          return {
            name: res.city || res.region || res.country || '未知位置',
            region: res.region || '',
            country: res.country || '',
            countryCode: (res.country || '').toUpperCase(),
            lat: Number(loc[0]),
            lon: Number(loc[1])
          };
        });
      })
      .catch(function () {
        return null;
      })
      .then(function (loc) {
        if (loc) writeJSON(GEO_CACHE_KEY, { t: Date.now(), loc: loc });
        return loc;
      });
  }

  /* --------------------------- 地区累计访问 --------------------------- */

  function loadLocalCount(countryCode) {
    if (!countryCode || !/^[A-Z]{2}$/.test(countryCode)) {
      return Promise.resolve(null);
    }
    var key = 'visit-' + countryCode.toLowerCase();
    // 同一次会话内只 hit 一次，之后读 get，避免刷新页面把地区计数刷高
    var counted = sessionGet(SESSION_KEY);
    var endpoint = COUNT_API + '/hit/' + COUNT_NAMESPACE + '/' + key;
    if (counted && counted.cc === countryCode && counted.t && Date.now() - counted.t < 30 * 60 * 1000) {
      endpoint = COUNT_API + '/get/' + COUNT_NAMESPACE + '/' + key;
    } else if (!isProduction) {
      endpoint = COUNT_API + '/get/' + COUNT_NAMESPACE + '/' + key;
    }

    return fetchJSON(endpoint, 6000)
      .then(function (res) {
        var value = res && isFinite(res.value) ? Number(res.value) : null;
        if (value !== null && endpoint.indexOf('/hit/') >= 0) {
          sessionSet(SESSION_KEY, { cc: countryCode, t: Date.now() });
        }
        return value;
      })
      .catch(function () {
        return null;
      });
  }

  /* ------------------------------ 渲染 ------------------------------ */

  function buildMapUrl(loc) {
    if (loc) {
      var markers = 'mid,0xFF5A5F,A:' + loc.lon.toFixed(4) + ',' + loc.lat.toFixed(4);
      return (
        AMAP_STATIC +
        '?location=' + loc.lon.toFixed(4) + ',' + loc.lat.toFixed(4) +
        '&zoom=4&size=400*200&scale=2' +
        '&markers=' + encodeURIComponent(markers) +
        '&key=' + AMAP_KEY
      );
    }
    // 无定位时展示世界地图
    return AMAP_STATIC + '?location=105,35&zoom=2&size=400*200&scale=2&key=' + AMAP_KEY;
  }

  function showError(message) {
    if (loading) loading.hidden = true;
    if (body) body.hidden = true;
    if (!errorBox) return;
    errorBox.hidden = false;
    errorBox.innerHTML =
      '<i class="fas fa-earth-asia visitmap-error-icon"></i>' +
      '<p class="visitmap-error-text"></p>' +
      '<button type="button" class="visitmap-retry">重试</button>';
    errorBox.querySelector('.visitmap-error-text').textContent = message || '访客地图加载失败';
    var retry = errorBox.querySelector('.visitmap-retry');
    if (retry) {
      retry.addEventListener('click', function () {
        init();
      });
    }
  }

  function render(loc, localCount) {
    if (!body) return;

    var metaHtml =
      '<span class="visitmap-city">' +
        (loc ? (loc.region && loc.region !== loc.name ? loc.name + ' · ' + loc.region : loc.name) : '世界地图') +
      '</span>' +
      '<span class="visitmap-local">' +
        (localCount !== null && localCount !== undefined
          ? '该地区累计 ' + Number(localCount).toLocaleString('zh-CN') + ' 次访问'
          : '') +
      '</span>';

    // 点击地图：有定位时打开高德地图上该位置，否则打开高德地图首页
    var mapHref = loc
      ? 'https://uri.amap.com/marker?position=' + loc.lon.toFixed(4) + ',' + loc.lat.toFixed(4) +
        '&name=' + encodeURIComponent(loc.name || '当前位置') + '&coordinate=gaode&callnative=0'
      : 'https://www.amap.com/';

    body.innerHTML =
      '<a class="visitmap-map-link" href="' + mapHref + '" target="_blank" rel="noopener noreferrer" title="在高德地图中查看">' +
        '<img class="visitmap-img" alt="访客地图" loading="eager" decoding="async">' +
      '</a>' +
      '<div class="visitmap-meta">' + metaHtml + '</div>' +
      '<div class="visitmap-foot">' +
        '<span class="visitmap-total">全球累计访问统计加载中…</span>' +
        '<button type="button" class="visitmap-refresh" title="刷新访客地图" aria-label="刷新访客地图">' +
          '<i class="fas fa-rotate-right"></i>' +
        '</button>' +
      '</div>';

    img = body.querySelector('.visitmap-img');
    cityEl = body.querySelector('.visitmap-city');
    localEl = body.querySelector('.visitmap-local');
    totalEl = body.querySelector('.visitmap-total');

    if (loading) loading.hidden = true;
    body.hidden = false;
    if (errorBox) errorBox.hidden = true;

    var refresh = body.querySelector('.visitmap-refresh');
    if (refresh) {
      refresh.addEventListener('click', function () {
        refresh.disabled = true;
        refresh.querySelector('i').classList.add('fa-spin');
        reloadMapImage(refresh);
      });
    }

    bindTotalCounter();
    attemptLoadMapImage(0);
  }

  function attemptLoadMapImage(retry) {
    if (!img) return;
    var loc = currentLoc;
    // 加时间戳可绕过浏览器/高德的失败缓存；成功时 URL 不变以命中缓存
    var url = buildMapUrl(loc);
    if (retry > 0) url += '&_r=' + retry;
    var settled = false;
    stateTimer = setTimeout(function () {
      if (settled) return;
      settled = true;
      showError('地图加载超时，请稍后重试');
    }, 15000);

    img.onload = function () {
      if (stateTimer) clearTimeout(stateTimer);
      if (settled) return;
      settled = true;
      img.classList.add('is-loaded');
    };
    img.onerror = function () {
      if (stateTimer) clearTimeout(stateTimer);
      if (settled) return;
      settled = true;
      if (retry < 1) {
        attemptLoadMapImage(retry + 1);
      } else {
        showError('地图图片加载失败，可能是高德 Key 额度用尽或网络波动');
      }
    };
    img.src = url;
  }

  function reloadMapImage(button) {
    if (!img) {
      init();
      return;
    }
    img.classList.remove('is-loaded');
    var oldSrc = img.getAttribute('src') || '';
    var sep = oldSrc.indexOf('?') >= 0 ? '&' : '?';
    var settled = false;
    img.onload = function () {
      settled = true;
      img.classList.add('is-loaded');
      if (button) {
        button.disabled = false;
        button.querySelector('i').classList.remove('fa-spin');
      }
    };
    img.onerror = function () {
      if (settled) return;
      settled = true;
      showError('地图图片加载失败，请稍后重试');
    };
    img.src = oldSrc + sep + '_t=' + Date.now();
  }

  function bindTotalCounter() {
    var totalNode = document.getElementById('busuanzi_value_site_pv');
    var lastText = '';
    function paint() {
      if (!totalEl) return;
      var value = totalNode ? totalNode.textContent.trim() : '';
      if (value && /^[\d,]+$/.test(value)) {
        if (value !== lastText) {
          lastText = value;
          totalEl.textContent = '全球累计访问 ' + value + ' 次';
        }
      } else if (!lastText) {
        totalEl.textContent = '全球累计访问统计加载中…';
      }
    }
    paint();
    if (totalNode && typeof MutationObserver !== 'undefined') {
      new MutationObserver(paint).observe(totalNode, { childList: true, characterData: true, subtree: true });
    }
    // 兜底轮询（统计脚本可能比地图晚加载）
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      paint();
      if (lastText || tries >= 12) clearInterval(timer);
    }, 1000);
  }

  var currentLoc = null;
  var initializing = false;

  function init() {
    root = document.getElementById('visitmap');
    if (!root || initializing) return;
    initializing = true;

    root.innerHTML =
      '<div class="visitmap-loading"><i class="fas fa-spinner fa-spin"></i><span>正在加载访客地图…</span></div>' +
      '<div class="visitmap-body" hidden></div>' +
      '<div class="visitmap-error" hidden></div>';
    loading = root.querySelector('.visitmap-loading');
    body = root.querySelector('.visitmap-body');
    errorBox = root.querySelector('.visitmap-error');

    Promise.resolve()
      .then(function () {
        return loadGeo();
      })
      .then(function (loc) {
        currentLoc = loc;
        return loadLocalCount(loc ? loc.countryCode : null);
      })
      .then(function (count) {
        render(currentLoc, count);
      })
      .catch(function () {
        render(null, null);
      })
      .then(function () {
        initializing = false;
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  if (typeof window.btf !== 'undefined' && typeof window.btf.addGlobalFn === 'function') {
    window.btf.addGlobalFn('pjaxComplete', init, 'visitmap_init');
  }
  document.addEventListener('pjax:complete', init);
})();
