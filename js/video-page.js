/*!
 * /video/ 视频随选页脚本
 * ------------------------------------------------------------------
 * - 数据：source/video/videos.json（B 站 UP 主投稿，字段 bvid/title/pic/duration/pubdate/view）
 * - 行为：每次随机展示 3 个不重复视频；「换一批」排除当前 3 个再随机；
 *         点击卡片在本页弹层内播放（B 站 iframe），支持关闭按钮 / 点击遮罩 / Esc。
 * - 兼容：无第三方依赖；与 Butterfly 的 PJAX 共存（脚本带 data-pjax，
 *         重复执行时用 data-vp-ready 做幂等保护，页面级监听只安装一次）。
 */

(function () {
  'use strict';

  var PICK_COUNT = 3;
  var COVER_SUFFIX = '@672w_378h_1c.webp';
  var PLAYER_API =
    'https://player.bilibili.com/player.html?bvid={bvid}&page=1&high_quality=1&danmaku=0&autoplay=1';
  var BILI_VIDEO_URL = 'https://www.bilibili.com/video/';
  var BILI_SPACE_API = 'https://space.bilibili.com/{uid}/video';
  var FETCH_TIMEOUT = 15000;
  var FALLBACK_COVER =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="672" height="378" viewBox="0 0 672 378">' +
        '<rect width="672" height="378" fill="#e8eef5"/>' +
        '<circle cx="336" cy="189" r="54" fill="rgba(73,177,245,0.9)"/>' +
        '<path d="M320 160l54 29-54 29z" fill="#ffffff"/>' +
        '</svg>'
    );

  /* ------------------------------------------------------------------ */
  /* 工具函数                                                            */
  /* ------------------------------------------------------------------ */

  function pad2(num) {
    return num < 10 ? '0' + num : String(num);
  }

  /** 秒级时间戳或 ISO 字符串 → Date，失败返回 null */
  function parseDate(value) {
    if (value === null || value === undefined || value === '') return null;
    var date;
    if (typeof value === 'number') {
      date = new Date(value < 1e12 ? value * 1000 : value);
    } else {
      date = new Date(value);
    }
    if (!date || isNaN(date.getTime())) return null;
    return date;
  }

  function formatDate(value) {
    var date = parseDate(value);
    if (!date) return '';
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  /** 7189 → 1:59:49 */
  function formatDuration(seconds) {
    if (typeof seconds !== 'number' || !isFinite(seconds) || seconds <= 0) return '';
    var total = Math.round(seconds);
    var hour = Math.floor(total / 3600);
    var minute = Math.floor((total % 3600) / 60);
    var second = total % 60;
    return (hour > 0 ? hour + ':' + pad2(minute) : String(minute)) + ':' + pad2(second);
  }

  /** 1375 → 1375；23456 → 2.3万；123456789 → 1.2亿 */
  function formatViews(view) {
    if (typeof view !== 'number' || !isFinite(view) || view <= 0) return '0';
    if (view >= 1e8) return trimZero(view / 1e8) + '亿';
    if (view >= 1e4) return trimZero(view / 1e4) + '万';
    return String(Math.round(view));
  }

  function trimZero(num) {
    return num.toFixed(1).replace(/\.0$/, '');
  }

  function isSafeBvid(bvid) {
    return typeof bvid === 'string' && /^BV[0-9A-Za-z]{10}$/.test(bvid);
  }

  /** B 站封面地址 → 672x378 webp 缩略图 */
  function coverUrl(pic) {
    if (typeof pic !== 'string' || !pic) return FALLBACK_COVER;
    var base = pic.split('@')[0];
    if (base.indexOf('http://') === 0) base = 'https://' + base.slice(7);
    if (base.indexOf('//') === 0) base = 'https:' + base;
    return base + COVER_SUFFIX;
  }

  function normalizeList(raw) {
    if (!Array.isArray(raw)) return [];
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var item = raw[i];
      if (!item || !isSafeBvid(item.bvid) || !item.pic) continue;
      out.push({
        bvid: item.bvid,
        title: typeof item.title === 'string' && item.title ? item.title : item.bvid,
        pic: item.pic,
        duration: typeof item.duration === 'number' ? item.duration : 0,
        pubdate: item.pubdate,
        view: typeof item.view === 'number' ? item.view : 0
      });
    }
    return out;
  }

  function shuffleInPlace(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  /** 随机抽 count 个；优先排除 excludeIds，池子不够时退回全量 */
  function pickRandom(list, count, excludeIds) {
    if (!list.length) return [];
    var excluded = {};
    var i;
    for (i = 0; i < (excludeIds || []).length; i++) excluded[excludeIds[i]] = true;

    var pool = [];
    for (i = 0; i < list.length; i++) {
      if (!excluded[list[i].bvid]) pool.push(list[i]);
    }
    if (pool.length < count) pool = list.slice();

    shuffleInPlace(pool);
    return pool.slice(0, Math.min(count, pool.length));
  }

  function createIcon(className) {
    var icon = document.createElement('i');
    icon.className = className;
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  function createElement(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function fetchJson(url) {
    if (typeof window.fetch !== 'function') {
      return Promise.reject(new Error('fetch is not supported'));
    }
    var controller = typeof window.AbortController === 'function' ? new window.AbortController() : null;
    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, FETCH_TIMEOUT);
    var options = { cache: 'no-cache' };
    if (controller) options.signal = controller.signal;

    return window
      .fetch(url, options)
      .then(function (response) {
        if (!response || !response.ok) {
          throw new Error('HTTP ' + (response ? response.status : 'error'));
        }
        return response.json();
      })
      .then(
        function (data) {
          window.clearTimeout(timer);
          return data;
        },
        function (error) {
          window.clearTimeout(timer);
          throw error;
        }
      );
  }

  /* ------------------------------------------------------------------ */
  /* 全局钩子：Esc 关闭、PJAX 离开时清理（整站只安装一次）                  */
  /* ------------------------------------------------------------------ */

  function installGlobalHooks() {
    if (window.__videoPageHooks) return;
    window.__videoPageHooks = true;

    document.addEventListener('keydown', function (event) {
      var key = event.key;
      if (key !== 'Escape' && key !== 'Esc') return;
      var modal = document.querySelector('.video-page .vp-modal:not([hidden])');
      if (modal && typeof modal.__vpClose === 'function') modal.__vpClose();
    });

    document.addEventListener('pjax:send', function () {
      var modals = document.querySelectorAll('.video-page .vp-modal:not([hidden])');
      for (var i = 0; i < modals.length; i++) {
        if (typeof modals[i].__vpClose === 'function') modals[i].__vpClose();
      }
      document.body.classList.remove('vp-modal-open');
    });
  }

  /* ------------------------------------------------------------------ */
  /* 单个页面实例                                                        */
  /* ------------------------------------------------------------------ */

  function initPage(root) {
    if (!root || root.getAttribute('data-vp-ready') === '1') return;
    root.setAttribute('data-vp-ready', '1');

    var grid = root.querySelector('#vp-grid');
    var errorBox = root.querySelector('#vp-error');
    var totalEl = root.querySelector('#vp-total');
    var updatedEl = root.querySelector('#vp-updated');
    var shuffleBtn = root.querySelector('#vp-shuffle');
    var retryBtn = root.querySelector('#vp-retry');
    var modal = root.querySelector('#vp-modal');
    var maskEl = root.querySelector('.vp-modal-mask');
    var playerEl = root.querySelector('#vp-modal-player');
    var modalTitle = root.querySelector('#vp-modal-title');
    var modalLink = root.querySelector('#vp-modal-link');
    var closeBtn = root.querySelector('#vp-modal-close');
    var spaceLinks = root.querySelectorAll('.js-vp-space');

    var dataUrl = root.getAttribute('data-json') || '/video/videos.json';
    var all = [];
    var currentItems = [];
    var isLoading = false;
    var lastFocus = null;

    installGlobalHooks();

    function emit(name, detail) {
      try {
        root.dispatchEvent(new window.CustomEvent(name, { detail: detail || {} }));
      } catch (err) {
        /* 旧浏览器忽略 */
      }
    }

    /* ---------- 状态渲染 ---------- */

    function setMeta(total, updated) {
      if (totalEl) totalEl.textContent = '共 ' + total + ' 个视频';
      if (!updatedEl) return;
      var date = parseDate(updated);
      if (date) {
        updatedEl.textContent = '数据更新于 ' + formatDate(date);
      } else if (typeof updated === 'string' && updated) {
        updatedEl.textContent = '数据更新于 ' + updated;
      } else {
        updatedEl.textContent = '';
      }
    }

    function updateSpaceLinks(uid) {
      if (!/^\d+$/.test(uid) || !spaceLinks.length) return;
      var url = BILI_SPACE_API.replace('{uid}', uid);
      for (var i = 0; i < spaceLinks.length; i++) spaceLinks[i].href = url;
    }

    function renderSkeletons() {
      if (!grid) return;
      var fragment = document.createDocumentFragment();
      for (var i = 0; i < PICK_COUNT; i++) {
        var card = createElement('div', 'vp-card vp-skeleton');
        card.setAttribute('aria-hidden', 'true');

        var cover = createElement('div', 'vp-cover');
        cover.appendChild(createElement('div', 'vp-sk-block vp-sk-cover'));

        var body = createElement('div', 'vp-body');
        body.appendChild(createElement('div', 'vp-sk-block vp-sk-title'));
        body.appendChild(createElement('div', 'vp-sk-block vp-sk-meta'));

        card.appendChild(cover);
        card.appendChild(body);
        fragment.appendChild(card);
      }
      grid.innerHTML = '';
      grid.appendChild(fragment);
      grid.hidden = false;
      grid.setAttribute('aria-busy', 'true');
    }

    function setLoading(loading) {
      isLoading = loading;
      if (shuffleBtn) shuffleBtn.disabled = true;
      if (retryBtn) retryBtn.disabled = loading;
      if (!loading) return;
      if (totalEl) totalEl.textContent = '正在加载视频数据…';
      if (updatedEl) updatedEl.textContent = '';
      if (errorBox) errorBox.hidden = true;
      renderSkeletons();
    }

    function showError(error) {
      isLoading = false;
      all = [];
      currentItems = [];
      if (grid) {
        grid.innerHTML = '';
        grid.hidden = true;
        grid.setAttribute('aria-busy', 'false');
      }
      if (errorBox) errorBox.hidden = false;
      if (totalEl) totalEl.textContent = '视频数据暂时不可用';
      if (updatedEl) updatedEl.textContent = '';
      if (shuffleBtn) shuffleBtn.disabled = true;
      if (retryBtn) retryBtn.disabled = false;
      root.setAttribute('data-vp-state', 'error');
      emit('vp:error', { message: error && error.message ? error.message : 'unknown' });
    }

    /* ---------- 卡片 ---------- */

    function createCard(item) {
      var card = createElement('article', 'vp-card');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('data-bvid', item.bvid);
      card.setAttribute('aria-label', '播放视频：' + item.title);
      card.title = item.title;

      var cover = createElement('div', 'vp-cover');

      var img = document.createElement('img');
      img.className = 'vp-cover-img';
      img.setAttribute('src', coverUrl(item.pic));
      img.setAttribute('alt', item.title);
      img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
      img.setAttribute('referrerpolicy', 'no-referrer');
      img.onerror = function () {
        img.onerror = null;
        img.src = FALLBACK_COVER;
      };
      cover.appendChild(img);

      var play = createElement('span', 'vp-play');
      play.appendChild(createIcon('fas fa-play'));
      cover.appendChild(play);

      var durationText = formatDuration(item.duration);
      if (durationText) {
        var duration = createElement('span', 'vp-duration');
        duration.textContent = durationText;
        cover.appendChild(duration);
      }

      var body = createElement('div', 'vp-body');
      var title = createElement('h3', 'vp-title');
      title.textContent = item.title;

      var meta = createElement('div', 'vp-meta');
      var dateText = formatDate(item.pubdate);
      if (dateText) {
        var dateItem = createElement('span', 'vp-meta-item');
        dateItem.appendChild(createIcon('fas fa-calendar-days'));
        var dateSpan = document.createElement('span');
        dateSpan.textContent = dateText;
        dateItem.appendChild(dateSpan);
        meta.appendChild(dateItem);
      }
      var viewItem = createElement('span', 'vp-meta-item');
      viewItem.appendChild(createIcon('fas fa-eye'));
      var viewSpan = document.createElement('span');
      viewSpan.textContent = formatViews(item.view);
      viewItem.appendChild(viewSpan);
      meta.appendChild(viewItem);

      body.appendChild(title);
      body.appendChild(meta);

      card.appendChild(cover);
      card.appendChild(body);

      card.addEventListener('click', function () {
        openPlayer(item);
      });
      card.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          openPlayer(item);
        }
      });

      return card;
    }

    function renderCards(items) {
      if (!grid) return;
      var fragment = document.createDocumentFragment();
      for (var i = 0; i < items.length; i++) fragment.appendChild(createCard(items[i]));
      grid.innerHTML = '';
      grid.appendChild(fragment);
      grid.hidden = false;
      grid.setAttribute('aria-busy', 'false');

      // 每次换一批做一次轻微的淡入动画
      grid.classList.remove('vp-fade-in');
      void grid.offsetWidth;
      grid.classList.add('vp-fade-in');
    }

    function renderRandom(excludeIds) {
      if (!all.length) return;
      var picked = pickRandom(all, PICK_COUNT, excludeIds || []);
      if (!picked.length) return;
      currentItems = picked;
      renderCards(picked);
      emit('vp:change', { items: picked });
    }

    /* ---------- 弹层播放器 ---------- */

    function openPlayer(item) {
      if (!modal || !item) return;
      lastFocus = document.activeElement;

      if (modalTitle) modalTitle.textContent = item.title;
      if (modalLink) modalLink.href = BILI_VIDEO_URL + item.bvid;

      if (playerEl) {
        playerEl.innerHTML = '';
        var iframe = document.createElement('iframe');
        iframe.setAttribute('src', PLAYER_API.replace('{bvid}', encodeURIComponent(item.bvid)));
        iframe.setAttribute('title', item.title);
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('border', '0');
        iframe.setAttribute('scrolling', 'no');
        iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
        iframe.setAttribute('allowfullscreen', 'true');
        playerEl.appendChild(iframe);
      }

      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('vp-modal-open');
      if (closeBtn) closeBtn.focus();
      emit('vp:open', { bvid: item.bvid });
    }

    function closePlayer() {
      if (!modal || modal.hidden) return;
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
      if (playerEl) playerEl.innerHTML = '';
      document.body.classList.remove('vp-modal-open');
      if (lastFocus && typeof lastFocus.focus === 'function') {
        try {
          lastFocus.focus();
        } catch (err) {
          /* 元素可能已被移除 */
        }
      }
      lastFocus = null;
      emit('vp:close', {});
    }

    if (modal) {
      modal.__vpClose = closePlayer;
      modal.addEventListener('click', function (event) {
        if (event.target === modal || event.target === maskEl) closePlayer();
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closePlayer);

    /* ---------- 交互 ---------- */

    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', function () {
        if (isLoading || !all.length) return;
        var excludeIds = currentItems.map(function (item) {
          return item.bvid;
        });
        renderRandom(excludeIds);
      });
    }
    if (retryBtn) retryBtn.addEventListener('click', load);

    /* ---------- 数据加载 ---------- */

    function load() {
      setLoading(true);
      root.setAttribute('data-vp-state', 'loading');
      fetchJson(dataUrl)
        .then(function (data) {
          var list = normalizeList(data && data.videos);
          if (!list.length) throw new Error('empty data');
          all = list;

          var total = typeof data.total === 'number' && data.total > 0 ? data.total : list.length;
          var uid = data.uid ? String(data.uid).replace(/\D/g, '') : '';
          if (uid) updateSpaceLinks(uid);
          setMeta(total, data.updated);

          isLoading = false;
          if (errorBox) errorBox.hidden = true;
          if (grid) {
            grid.hidden = false;
            grid.setAttribute('aria-busy', 'false');
          }
          if (shuffleBtn) shuffleBtn.disabled = false;
          if (retryBtn) retryBtn.disabled = false;

          renderRandom([]);
          root.setAttribute('data-vp-state', 'ready');
          emit('vp:ready', { total: all.length });
        })
        .catch(showError);
    }

    load();
  }

  /* ------------------------------------------------------------------ */
  /* 启动                                                               */
  /* ------------------------------------------------------------------ */

  function boot() {
    var roots = document.querySelectorAll('.video-page');
    if (!roots.length) return;
    for (var i = 0; i < roots.length; i++) initPage(roots[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
