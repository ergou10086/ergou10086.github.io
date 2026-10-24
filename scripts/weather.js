/**
 * 侧边栏天气卡片 weather card
 * ---------------------------------------------------------------------------
 * 数据来源：Open-Meteo（免 Key，CORS 全开）
 * 定位方式：ipwho.is → ipinfo.io → 北京 三级降级
 * 图表实现：纯手写 SVG（渐变面积 + Catmull-Rom 平滑曲线 + hover tooltip），
 *          不依赖任何图表库；DOM 自适应宽度。
 * 兼容 PJAX：window.btf.addGlobalFn('pjaxComplete', ...) + pjax:complete 兜底，
 *          重复初始化幂等，页面上没有卡片时静默退出。
 */
(function () {
  'use strict';

  var API_URL = 'https://api.open-meteo.com/v1/forecast';
  var GEO_PRIMARY_URL = 'https://ipwho.is/?lang=zh-CN';
  var GEO_FALLBACK_URL = 'https://ipinfo.io/json';
  var DEFAULT_LOCATION = { name: '北京', region: '默认位置', lat: 39.9042, lon: 116.4074 };

  var GEO_CACHE_KEY = 'hexo_weather_geo_v2';
  var WX_CACHE_KEY = 'hexo_weather_data_v2';
  var GEO_TTL = 24 * 60 * 60 * 1000; // 位置缓存 24 小时
  var WX_TTL = 10 * 60 * 1000; // 天气缓存 10 分钟
  var AUTO_REFRESH = 10 * 60 * 1000; // 每 10 分钟静默刷新一次

  var CHART_HEIGHT = 84; // 图表高度（含底部时间刻度）
  var CHART_PAD_L = 10;
  var CHART_PAD_R = 10;
  var CHART_PAD_T = 13;
  var CHART_PAD_B = 15;
  var HOURS = 24;
  var DAYS = 7;

  // WMO 天气代码 → [中文描述, 白天图标, 夜间图标(可选)]
  var WMO = {
    0: ['晴', 'fa-sun', 'fa-moon'],
    1: ['晴间多云', 'fa-cloud-sun', 'fa-cloud-moon'],
    2: ['多云', 'fa-cloud-sun', 'fa-cloud-moon'],
    3: ['阴', 'fa-cloud'],
    45: ['雾', 'fa-smog'],
    48: ['雾凇', 'fa-smog'],
    51: ['小毛毛雨', 'fa-cloud-rain'],
    53: ['毛毛雨', 'fa-cloud-rain'],
    55: ['大毛毛雨', 'fa-cloud-showers-heavy'],
    56: ['冻毛毛雨', 'fa-cloud-rain'],
    57: ['强冻毛毛雨', 'fa-cloud-showers-heavy'],
    61: ['小雨', 'fa-cloud-rain'],
    63: ['中雨', 'fa-cloud-rain'],
    65: ['大雨', 'fa-cloud-showers-heavy'],
    66: ['冻雨', 'fa-cloud-rain'],
    67: ['强冻雨', 'fa-cloud-showers-heavy'],
    71: ['小雪', 'fa-snowflake'],
    73: ['中雪', 'fa-snowflake'],
    75: ['大雪', 'fa-snowflake'],
    77: ['米雪', 'fa-snowflake'],
    80: ['阵雨', 'fa-cloud-sun-rain', 'fa-cloud-moon-rain'],
    81: ['强阵雨', 'fa-cloud-showers-heavy'],
    82: ['暴雨', 'fa-cloud-showers-heavy'],
    85: ['阵雪', 'fa-snowflake'],
    86: ['强阵雪', 'fa-snowflake'],
    95: ['雷阵雨', 'fa-bolt'],
    96: ['雷阵雨伴冰雹', 'fa-bolt'],
    99: ['强雷暴伴冰雹', 'fa-bolt']
  };

  var WIND_DIRS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  // 蒲福风级（km/h 下限）
  var BEAUFORT = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  var WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  var gradSeq = 0;

  /* ----------------------------- 小工具 ----------------------------- */

  function $(card, sel) {
    return card ? card.querySelector(sel) : null;
  }

  function num(value, suffix) {
    if (value === null || value === undefined || value === '' || isNaN(Number(value))) {
      return '--';
    }
    return Math.round(Number(value)) + (suffix || '');
  }

  function storeGet(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function storeSet(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* 隐私模式 / 存储已满时静默失败 */
    }
  }

  function fetchJSON(url, timeout) {
    return new Promise(function (resolve, reject) {
      var controller = typeof window.AbortController !== 'undefined' ? new window.AbortController() : null;
      var timer = window.setTimeout(function () {
        if (controller) {
          controller.abort();
        }
        reject(new Error('请求超时'));
      }, timeout || 8000);

      var options = { credentials: 'omit', cache: 'default' };
      if (controller) {
        options.signal = controller.signal;
      }

      window.fetch(url, options)
        .then(function (res) {
          if (!res.ok) {
            throw new Error('HTTP ' + res.status);
          }
          return res.json();
        })
        .then(function (data) {
          window.clearTimeout(timer);
          resolve(data);
        })
        .catch(function (err) {
          window.clearTimeout(timer);
          reject(err);
        });
    });
  }

  /* --------------------------- 天气代码映射 --------------------------- */

  function weatherInfo(code, isDay) {
    var c = Number(code);
    var item = WMO[c] || rangeInfo(c);
    var night = isDay === 0 || isDay === false;
    return {
      text: item[0],
      icon: night && item[2] ? item[2] : item[1]
    };
  }

  // WMO 未单列的代码按区间兜底
  function rangeInfo(c) {
    if (c <= 3) return ['多云', 'fa-cloud-sun', 'fa-cloud-moon'];
    if (c <= 48) return ['雾', 'fa-smog'];
    if (c <= 57) return ['毛毛雨', 'fa-cloud-rain'];
    if (c <= 67) return ['雨', 'fa-cloud-rain'];
    if (c <= 77) return ['雪', 'fa-snowflake'];
    if (c <= 82) return ['阵雨', 'fa-cloud-sun-rain', 'fa-cloud-moon-rain'];
    if (c <= 86) return ['阵雪', 'fa-snowflake'];
    return ['雷阵雨', 'fa-bolt'];
  }

  /* ---------------------------- 格式格式化 ---------------------------- */

  function windText(deg, speedKmh) {
    var level = 0;
    var speed = Number(speedKmh);
    if (isNaN(speed)) {
      return '--';
    }
    for (var i = 0; i < BEAUFORT.length; i++) {
      if (speed >= BEAUFORT[i]) {
        level = i + 1;
      }
    }
    if (level === 0) {
      return '静风';
    }
    var dirIdx = Math.round((((Number(deg) || 0) % 360) + 360) % 360 / 45) % 8;
    return WIND_DIRS[dirIdx] + ' ' + level + '级';
  }

  // '2026-10-24T18:30' → '18:30'
  function fmtHHMM(iso) {
    var str = String(iso || '');
    return str.length >= 16 ? str.slice(11, 16) : '--';
  }

  // '2026-10-24' → '10/27'
  function fmtMonthDay(dateStr) {
    var parts = String(dateStr || '').split('-');
    return parts.length === 3 ? parts[1] + '/' + parts[2] : '';
  }

  function weekdayCN(dateStr) {
    var parts = String(dateStr || '').split('-');
    if (parts.length !== 3) {
      return '';
    }
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return WEEK_CN[date.getDay()] || '';
  }

  // 日序列的显示名：今天 / 明天 / 周X
  function dayLabel(index, dateStr) {
    if (index === 0) return '今天';
    if (index === 1) return '明天';
    return weekdayCN(dateStr);
  }

  /* ----------------------------- 定位 & 天气 ----------------------------- */

  function hasCJK(text) {
    return /[\u4e00-\u9fa5]/.test(String(text || ''));
  }

  function normalizeLocation(data, fallbackName) {
    var lat = Number(data.latitude);
    var lon = Number(data.longitude);
    if (!isFinite(lat) || !isFinite(lon)) {
      return null;
    }
    // 优先中文城市名；部分境外 IP 的 city 只有英文时退回中文 region
    var name = data.city || '';
    if (!hasCJK(name)) {
      if (hasCJK(data.region)) {
        name = data.region;
      } else if (!name) {
        name = data.region || data.country || fallbackName;
      }
    }
    return {
      name: String(name || fallbackName),
      region: String(data.region || data.country || ''),
      lat: lat,
      lon: lon
    };
  }

  function loadLocation() {
    var cached = storeGet(GEO_CACHE_KEY);
    if (cached && cached.loc && Date.now() - cached.t < GEO_TTL) {
      return Promise.resolve(cached.loc);
    }

    return fetchJSON(GEO_PRIMARY_URL, 6000)
      .then(function (res) {
        if (!res || res.success === false) {
          throw new Error('ipwho.is 定位失败');
        }
        var loc = normalizeLocation(res, '当前位置');
        if (!loc) {
          throw new Error('ipwho.is 坐标无效');
        }
        return loc;
      })
      .catch(function () {
        // 降级：ipinfo.io 的 loc 形如 "39.9042,116.4074"
        return fetchJSON(GEO_FALLBACK_URL, 6000).then(function (res) {
          var loc = String((res && res.loc) || '').split(',');
          if (loc.length !== 2 || !loc[0] || !loc[1]) {
            throw new Error('ipinfo.io 定位失败');
          }
          var position = normalizeLocation({
            latitude: loc[0],
            longitude: loc[1],
            city: res && res.city,
            region: res && res.region,
            country: res && res.country
          }, '当前位置');
          if (!position) {
            throw new Error('ipinfo.io 坐标无效');
          }
          return position;
        });
      })
      .catch(function () {
        return DEFAULT_LOCATION;
      })
      .then(function (loc) {
        storeSet(GEO_CACHE_KEY, { t: Date.now(), loc: loc });
        return loc;
      });
  }

  function weatherCacheKey(loc) {
    return WX_CACHE_KEY + '_' + loc.lat.toFixed(2) + '_' + loc.lon.toFixed(2);
  }

  function buildWeatherURL(loc) {
    var params = [
      'latitude=' + loc.lat,
      'longitude=' + loc.lon,
      'current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
      'hourly=temperature_2m,weather_code,precipitation_probability',
      'daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      'timezone=auto',
      'forecast_days=7'
    ];
    return API_URL + '?' + params.join('&');
  }

  function loadWeather(loc, force) {
    var key = weatherCacheKey(loc);
    var cached = storeGet(key);
    if (!force && cached && cached.data && Date.now() - cached.t < WX_TTL) {
      return Promise.resolve(cached.data);
    }
    return fetchJSON(buildWeatherURL(loc), 9000).then(function (data) {
      if (!data || !data.current || !data.hourly || !data.daily) {
        throw new Error('天气数据格式异常');
      }
      storeSet(key, { t: Date.now(), data: data });
      return data;
    });
  }

  /* ------------------------------- 序列构建 ------------------------------ */

  // Open-Meteo 的 hourly 从当天 00:00 开始，需要从当前小时切出未来 24 条
  function findHourStart(times, currentTime) {
    var key = String(currentTime || '').slice(0, 13) + ':00';
    var idx = times.indexOf(key);
    if (idx >= 0) {
      return idx;
    }
    for (var i = 0; i < times.length; i++) {
      if (String(times[i]) >= key) {
        return i;
      }
    }
    return 0;
  }

  function buildHourlySeries(data) {
    var hourly = data.hourly || {};
    var times = hourly.time || [];
    var temps = hourly.temperature_2m || [];
    var codes = hourly.weather_code || [];
    var pops = hourly.precipitation_probability || [];
    var start = findHourStart(times, (data.current || {}).time);
    var points = [];

    for (var i = start; i < times.length && points.length < HOURS; i++) {
      if (temps[i] === null || temps[i] === undefined) {
        continue;
      }
      points.push({
        time: times[i],
        value: Number(temps[i]),
        code: codes[i],
        pop: pops[i] === undefined ? null : pops[i]
      });
    }
    return points;
  }

  function buildDailySeries(data) {
    var daily = data.daily || {};
    var times = daily.time || [];
    var maxs = daily.temperature_2m_max || [];
    var mins = daily.temperature_2m_min || [];
    var codes = daily.weather_code || [];
    var pops = daily.precipitation_probability_max || [];
    var points = [];

    for (var i = 0; i < times.length && i < DAYS; i++) {
      if (maxs[i] === null || maxs[i] === undefined) {
        continue;
      }
      points.push({
        time: times[i],
        value: Number(maxs[i]),
        secondary: mins[i] === undefined ? null : Number(mins[i]),
        code: codes[i],
        pop: pops[i] === undefined ? null : pops[i]
      });
    }
    return points;
  }

  /* ------------------------------- 图表渲染 ------------------------------ */

  // Catmull-Rom → 三次贝塞尔，得到平滑曲线
  function smoothPath(coords) {
    if (!coords.length) {
      return '';
    }
    if (coords.length === 1) {
      return 'M' + coords[0].x.toFixed(2) + ',' + coords[0].y.toFixed(2);
    }
    var tension = 0.18;
    var d = 'M' + coords[0].x.toFixed(2) + ',' + coords[0].y.toFixed(2);
    for (var i = 0; i < coords.length - 1; i++) {
      var p0 = coords[i - 1] || coords[i];
      var p1 = coords[i];
      var p2 = coords[i + 1];
      var p3 = coords[i + 2] || p2;
      var c1x = p1.x + (p2.x - p0.x) * tension;
      var c1y = p1.y + (p2.y - p0.y) * tension;
      var c2x = p2.x - (p3.x - p1.x) * tension;
      var c2y = p2.y - (p3.y - p1.y) * tension;
      d += ' C' + c1x.toFixed(2) + ',' + c1y.toFixed(2) + ' ' + c2x.toFixed(2) + ',' + c2y.toFixed(2) + ' ' + p2.x.toFixed(2) + ',' + p2.y.toFixed(2);
    }
    return d;
  }

  function buildSvg(points, width, mode) {
    var H = CHART_HEIGHT;
    var padT = CHART_PAD_T;
    var padB = CHART_PAD_B;
    var padL = CHART_PAD_L;
    var padR = CHART_PAD_R;
    var plotW = Math.max(20, width - padL - padR);
    var plotH = H - padT - padB;
    var bottom = padT + plotH;

    // 数值范围（主折线 + 次折线），上下各留 18% 空隙
    var lo = Infinity;
    var hi = -Infinity;
    points.forEach(function (point) {
      [point.value, point.secondary].forEach(function (value) {
        if (value === null || value === undefined || isNaN(value)) {
          return;
        }
        lo = Math.min(lo, value);
        hi = Math.max(hi, value);
      });
    });
    if (!isFinite(lo) || !isFinite(hi)) {
      lo = 0;
      hi = 1;
    }
    var span = hi - lo;
    if (span < 0.5) {
      span = 0.5;
    }
    lo -= span * 0.18;
    hi += span * 0.18;

    function yOf(value) {
      return padT + (1 - (value - lo) / (hi - lo)) * plotH;
    }

    function xOf(index) {
      if (points.length === 1) {
        return padL + plotW / 2;
      }
      return padL + (index / (points.length - 1)) * plotW;
    }

    var coords = points.map(function (point, index) {
      return { x: xOf(index), y: yOf(point.value), point: point, index: index };
    });
    var secondaryCoords = points.map(function (point, index) {
      if (point.secondary === null || point.secondary === undefined || isNaN(point.secondary)) {
        return null;
      }
      return { x: xOf(index), y: yOf(point.secondary) };
    });

    var gradId = 'wx-grad-' + (++gradSeq);
    var svg = [];
    svg.push('<svg viewBox="0 0 ' + width + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="温度趋势图">');
    svg.push('<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" style="stop-color: var(--wx-accent); stop-opacity: .28"></stop>' +
      '<stop offset="100%" style="stop-color: var(--wx-accent); stop-opacity: 0"></stop>' +
      '</linearGradient></defs>');

    // 两条淡淡的横向参考线
    [0.28, 0.72].forEach(function (ratio) {
      var y = (padT + plotH * ratio).toFixed(2);
      svg.push('<line class="wx-grid-line" x1="' + padL + '" y1="' + y + '" x2="' + (width - padR) + '" y2="' + y + '"></line>');
    });

    // 渐变面积
    var linePath = smoothPath(coords);
    if (coords.length > 1) {
      svg.push('<path class="wx-area" style="fill: url(#' + gradId + ')" d="' + linePath +
        ' L' + coords[coords.length - 1].x.toFixed(2) + ',' + bottom.toFixed(2) +
        ' L' + coords[0].x.toFixed(2) + ',' + bottom.toFixed(2) + ' Z"></path>');
    }

    // 7 天视图额外画一条低调的最低温度虚线
    if (secondaryCoords.some(Boolean)) {
      var secondaryPath = [];
      var segment = [];
      secondaryCoords.forEach(function (item) {
        if (item) {
          segment.push(item);
        } else if (segment.length) {
          secondaryPath.push(smoothPath(segment));
          segment = [];
        }
      });
      if (segment.length) {
        secondaryPath.push(smoothPath(segment));
      }
      secondaryPath.forEach(function (d) {
        svg.push('<path class="wx-line-secondary" d="' + d + '"></path>');
      });
    }

    svg.push('<path class="wx-line-primary" d="' + linePath + '"></path>');
    svg.push('<circle class="wx-now-dot" cx="' + coords[0].x.toFixed(2) + '" cy="' + coords[0].y.toFixed(2) + '" r="2.6"></circle>');
    svg.push('<line class="wx-hover-line" x1="0" y1="' + padT + '" x2="0" y2="' + bottom + '"></line>');
    svg.push('<circle class="wx-hover-dot" cx="0" cy="0" r="3.4"></circle>');

    // 横轴刻度：按可用宽度自适应步长，避免窄侧边栏里文字挤在一起
    var isDaily = mode === 'daily';
    var minGap = 32;
    var step = isDaily ? 1 : 3;
    while (step < points.length - 1 && (step * plotW) / (points.length - 1) < minGap) {
      step++;
    }
    var lastIndex = points.length - 1;
    for (var i = 0; i < points.length; i += step) {
      var point = points[i];
      var label;
      if (isDaily) {
        label = dayLabel(i, point.time);
      } else {
        label = String(point.time).slice(11, 13) + '时';
      }
      var anchor = i === 0 ? 'start' : (i === lastIndex ? 'end' : 'middle');
      svg.push('<text class="wx-axis-label" x="' + coords[i].x.toFixed(2) + '" y="' + (H - 3) +
        '" text-anchor="' + anchor + '">' + label + '</text>');
    }

    svg.push('</svg>');
    return { markup: svg.join(''), coords: coords, width: width };
  }

  function renderChart(card) {
    var state = card && card.__wxState;
    if (!state || !state.data) {
      return;
    }
    var wrap = $(card, '.weather-chart-wrap');
    var canvas = $(card, '.weather-chart-canvas');
    if (!wrap || !canvas) {
      return;
    }

    var points = state.mode === 'daily' ? buildDailySeries(state.data) : buildHourlySeries(state.data);
    if (!points.length) {
      canvas.innerHTML = '';
      return;
    }

    var width = Math.round(wrap.clientWidth || canvas.clientWidth || 0);
    if (width < 80) {
      width = 220; // 卡片被隐藏时兜底，等 ResizeObserver 触发后重绘
    }

    var built = buildSvg(points, width, state.mode);
    card.__wxWidth = width;
    canvas.innerHTML = built.markup;

    var svgEl = canvas.querySelector('svg');
    state.chart = {
      coords: built.coords,
      width: width,
      height: CHART_HEIGHT,
      svg: svgEl,
      hoverLine: canvas.querySelector('.wx-hover-line'),
      hoverDot: canvas.querySelector('.wx-hover-dot'),
      tip: $(card, '.weather-tooltip'),
      wrap: wrap
    };

    // 图表重绘后隐藏上一次的悬停指示
    hideTooltip(card);
  }

  /* ------------------------------ 图表交互 ------------------------------ */

  function tooltipHTML(point, mode, index) {
    var info = weatherInfo(point.code, 1);
    var pop = point.pop === null || point.pop === undefined ? null : Math.round(Number(point.pop));
    var rows = [];

    if (mode === 'daily') {
      rows.push('<div class="weather-tip-title">' + dayLabel(index, point.time) + ' ' + fmtMonthDay(point.time) + ' · ' + info.text + '</div>');
      var temps = '<span class="weather-tip-temp">' + num(point.value, '°') + '</span>';
      if (point.secondary !== null && point.secondary !== undefined && !isNaN(point.secondary)) {
        temps += '<span class="weather-tip-title">/</span><span>' + num(point.secondary, '°') + '</span>';
      }
      rows.push('<div class="weather-tip-row">' + temps + precipHTML(pop) + '</div>');
    } else {
      rows.push('<div class="weather-tip-title">' + fmtHHMM(point.time) + ' · ' + info.text + '</div>');
      rows.push('<div class="weather-tip-row"><span class="weather-tip-temp">' + num(point.value, '°C') + '</span>' + precipHTML(pop) + '</div>');
    }
    return rows.join('');
  }

  function precipHTML(pop) {
    if (pop === null || isNaN(pop)) {
      return '';
    }
    return '<i class="fas fa-droplet"></i><span>' + pop + '%</span>';
  }

  function hideTooltip(card) {
    var state = card && card.__wxState;
    var chart = state && state.chart;
    if (!chart) {
      return;
    }
    if (chart.tip) {
      chart.tip.classList.remove('is-visible');
    }
    chart.wrap.classList.remove('is-hovering');
  }

  function showTooltipAt(card, coord) {
    var state = card.__wxState;
    var chart = state && state.chart;
    if (!chart || !chart.tip || !chart.hoverLine || !chart.hoverDot) {
      return;
    }

    chart.hoverLine.setAttribute('x1', coord.x.toFixed(2));
    chart.hoverLine.setAttribute('x2', coord.x.toFixed(2));
    chart.hoverDot.setAttribute('cx', coord.x.toFixed(2));
    chart.hoverDot.setAttribute('cy', coord.y.toFixed(2));
    chart.wrap.classList.add('is-hovering');

    chart.tip.innerHTML = tooltipHTML(coord.point, state.mode, coord.index);
    chart.tip.classList.add('is-visible');

    // tooltip 的定位参照物就是 .weather-chart-wrap（position: relative）
    // 始终浮在高点上方，越界时夹在图表范围内，避免遮住底部时间刻度
    var wrapW = chart.wrap.clientWidth || chart.width;
    var wrapH = chart.wrap.offsetHeight;
    var tipW = chart.tip.offsetWidth;
    var tipH = chart.tip.offsetHeight;

    var left = Math.max(tipW / 2 + 1, Math.min(wrapW - tipW / 2 - 1, coord.x));
    var top = Math.max(0, Math.min(wrapH - tipH, coord.y - tipH - 10));

    chart.tip.style.left = left.toFixed(1) + 'px';
    chart.tip.style.top = top.toFixed(1) + 'px';
  }

  function bindChartEvents(card) {
    var wrap = $(card, '.weather-chart-wrap');
    if (!wrap || wrap.__wxBound) {
      return;
    }
    wrap.__wxBound = true;

    function handlePointer(event) {
      var chart = card.__wxState && card.__wxState.chart;
      if (!chart || !chart.coords.length) {
        return;
      }
      var rect = wrap.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var nearest = chart.coords[0];
      var minDistance = Infinity;
      chart.coords.forEach(function (coord) {
        var distance = Math.abs(coord.x - x);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = coord;
        }
      });
      showTooltipAt(card, nearest);
    }

    wrap.addEventListener('pointermove', handlePointer);
    wrap.addEventListener('pointerdown', handlePointer);
    wrap.addEventListener('pointerleave', function () {
      hideTooltip(card);
    });
    wrap.addEventListener('pointercancel', function () {
      hideTooltip(card);
    });
  }

  /* ------------------------------ 卡片渲染 ------------------------------ */

  function setState(card, name) {
    var loading = $(card, '.weather-loading');
    var error = $(card, '.weather-error');
    var main = $(card, '.weather-main');
    if (loading) loading.style.display = name === 'loading' ? 'flex' : 'none';
    if (error) error.style.display = name === 'error' ? 'flex' : 'none';
    if (main) main.style.display = name === 'main' ? 'block' : 'none';
  }

  function showError(card, message) {
    var errorText = $(card, '.weather-error-text');
    if (errorText) {
      errorText.textContent = message || '天气加载失败，请稍后重试';
    }
    setState(card, 'error');
  }

  function renderCurrent(card, location, data) {
    var current = data.current || {};
    var info = weatherInfo(current.weather_code, current.is_day);

    var icon = $(card, '.weather-now-icon');
    if (icon) {
      icon.className = 'weather-now-icon fas ' + info.icon;
    }

    var temp = $(card, '.weather-temp-value');
    if (temp) temp.textContent = num(current.temperature_2m);

    var desc = $(card, '.weather-desc');
    if (desc) desc.textContent = info.text;

    var cityName = $(card, '.weather-city-name');
    if (cityName) {
      cityName.textContent = location.name || '当前位置';
      cityName.title = location.region && location.region !== location.name
        ? location.name + ' · ' + location.region
        : (location.name || '');
    }

    var feels = $(card, '.weather-feels');
    if (feels) feels.textContent = num(current.apparent_temperature, '°');

    var humidity = $(card, '.weather-humidity');
    if (humidity) humidity.textContent = num(current.relative_humidity_2m, '%');

    var wind = $(card, '.weather-wind');
    if (wind) wind.textContent = windText(current.wind_direction_10m, current.wind_speed_10m);

    var update = $(card, '.weather-update');
    if (update) update.textContent = '更新 ' + fmtHHMM(current.time);
  }

  function refreshActiveTab(card, mode) {
    var tabs = card.querySelectorAll('.weather-tab');
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.classList.toggle('is-active', tab.getAttribute('data-range') === mode);
      tab.setAttribute('aria-pressed', tab.getAttribute('data-range') === mode ? 'true' : 'false');
    });
  }

  function setRefreshing(card, refreshing) {
    var icon = $(card, '.weather-refresh i');
    if (icon) {
      icon.classList.toggle('fa-spin', refreshing);
    }
    var button = $(card, '.weather-refresh');
    if (button) {
      button.disabled = refreshing;
    }
  }

  function loadCard(card, force) {
    var state = card.__wxState;
    if (!state || state.loading) {
      return;
    }
    state.loading = true;
    if (!state.data) {
      setState(card, 'loading');
    }
    setRefreshing(card, true);

    loadLocation()
      .then(function (location) {
        return loadWeather(location, force).then(function (data) {
          return { location: location, data: data };
        });
      })
      .then(function (result) {
        state.location = result.location;
        state.data = result.data;
        renderCurrent(card, result.location, result.data);
        setState(card, 'main');
        // 先显示再绘制，保证 clientWidth 可测量
        renderChart(card);
      })
      .catch(function (err) {
        if (state.data) {
          // 已有内容时静默失败：保留旧数据，只在底部提示
          var update = $(card, '.weather-update');
          if (update && state.location) {
            update.textContent = '更新失败 · 点击右侧重试';
          }
        } else {
          showError(card, '暂时获取不到天气，稍后再试试');
        }
        if (window.console && window.console.warn) {
          window.console.warn('[weather] 加载失败：', err);
        }
      })
      .then(function () {
        state.loading = false;
        setRefreshing(card, false);
      });
  }

  function bindControls(card) {
    var tabs = card.querySelectorAll('.weather-tab');
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener('click', function () {
        var state = card.__wxState;
        var mode = tab.getAttribute('data-range') === 'daily' ? 'daily' : 'hourly';
        if (!state || state.mode === mode) {
          return;
        }
        state.mode = mode;
        refreshActiveTab(card, mode);
        renderChart(card);
      });
    });

    var retry = $(card, '.weather-retry');
    if (retry) {
      retry.addEventListener('click', function () {
        loadCard(card, true);
      });
    }

    var refresh = $(card, '.weather-refresh');
    if (refresh) {
      refresh.addEventListener('click', function () {
        loadCard(card, true);
      });
    }
  }

  function observeSize(card) {
    var wrap = $(card, '.weather-chart-wrap');
    if (!wrap) {
      return;
    }

    var schedule = function () {
      if (card.__wxRaf) {
        return;
      }
      card.__wxRaf = window.requestAnimationFrame(function () {
        card.__wxRaf = 0;
        renderChart(card);
      });
    };

    var widthChanged = function () {
      var state = card.__wxState;
      if (!state || !state.data || state.loading) {
        return false;
      }
      var width = Math.round(wrap.clientWidth || 0);
      return width >= 40 && Math.abs(width - (card.__wxWidth || 0)) >= 2;
    };

    if (typeof window.ResizeObserver !== 'undefined') {
      var observer = new window.ResizeObserver(function () {
        if (widthChanged()) {
          schedule();
        }
      });
      observer.observe(wrap);
      card.__wxObserver = observer;
      return;
    }

    // 兜底：老浏览器没有 ResizeObserver 时监听窗口尺寸
    window.addEventListener('resize', function () {
      if (widthChanged()) {
        schedule();
      }
    });
  }

  function scheduleRefresh(card) {
    if (card.__wxTimer) {
      window.clearInterval(card.__wxTimer);
    }
    card.__wxTimer = window.setInterval(function () {
      if (document.hidden || !document.body.contains(card)) {
        window.clearInterval(card.__wxTimer);
        card.__wxTimer = null;
        return;
      }
      loadCard(card, true);
    }, AUTO_REFRESH);
  }

  function initCard(card) {
    if (!card || card.getAttribute('data-weather-init') === '1') {
      return;
    }
    card.setAttribute('data-weather-init', '1');
    card.__wxState = { mode: 'hourly', data: null, location: null, loading: false, chart: null };

    bindControls(card);
    bindChartEvents(card);
    refreshActiveTab(card, 'hourly');
    observeSize(card);
    scheduleRefresh(card);
    loadCard(card, false);
  }

  function initWeather() {
    var cards = document.querySelectorAll('.card-weather');
    if (!cards.length) {
      return; // 没有天气卡片时静默退出
    }
    Array.prototype.forEach.call(cards, initCard);
  }

  /* ------------------------------- 启动 ------------------------------- */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWeather);
  } else {
    initWeather();
  }

  // PJAX：主题的 btf.addGlobalFn 优先，同时监听原生事件兜底（初始化幂等）
  if (typeof window.btf !== 'undefined' && typeof window.btf.addGlobalFn === 'function') {
    window.btf.addGlobalFn('pjaxComplete', initWeather, 'weather_init');
  }
  document.addEventListener('pjax:complete', initWeather);
})();
