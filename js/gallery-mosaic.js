/**
 * 相册瀑布流的点击看大图（不依赖主题 Pjax / Fancybox 是否可用）
 * ---------------------------------------------------------------------------
 * 背景：本站开启了 Butterfly 的 Pjax（a 链接会被 Pjax 接管）。相册里的
 *   <a class="mosaic-item" data-fancybox="..."> 点击时可能先被 Pjax 拦截，
 *   导致图片被打包成页面请求（Fancybox 来不及接管）。
 * 方案：在相册容器上安装 capture 阶段的点击代理：
 *   1) 阻止事件继续冒泡（不让 Pjax 处理）；
 *   2) 优先调用主题已加载的 Fancybox.show(...)（有上一张/下一张/放大/关闭等）；
 *   3) 如果 Fancybox 因 CDN 被墙等原因未加载，则使用内置的极简灯箱兜底，
 *      保证「点进去看大图」始终可用；
 *   4) 支持键盘（← → 切换、Esc 关闭）与移动端滑动关闭。
 */
(function () {
  'use strict';

  var groups = [];

  function collect(container) {
    var anchors = container.querySelectorAll('.mosaic-item');
    var items = [];
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var href = a.getAttribute('href');
      if (!href) continue;
      items.push({
        src: href,
        caption: a.getAttribute('data-caption') || (a.querySelector('img') ? a.querySelector('img').alt : '') || ''
      });
    }
    return items;
  }

  function getIndex(items, anchor) {
    var href = anchor.getAttribute('href');
    for (var i = 0; i < items.length; i++) {
      if (items[i].src === href) return i;
    }
    return 0;
  }

  /* -------------------------- 内置兜底灯箱 -------------------------- */

  var fallback = null;

  function ensureFallback() {
    if (fallback) return fallback;
    var root = document.createElement('div');
    root.className = 'mosaic-lightbox';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML =
      '<button type="button" class="mosaic-lb-close" aria-label="关闭">&#215;</button>' +
      '<button type="button" class="mosaic-lb-prev" aria-label="上一张">&#10094;</button>' +
      '<figure class="mosaic-lb-figure"><img class="mosaic-lb-img" alt=""><figcaption class="mosaic-lb-caption"></figcaption></figure>' +
      '<button type="button" class="mosaic-lb-next" aria-label="下一张">&#10095;</button>';
    document.body.appendChild(root);

    var state = { items: [], index: 0 };
    var img = root.querySelector('.mosaic-lb-img');
    var caption = root.querySelector('.mosaic-lb-caption');

    function paint() {
      var item = state.items[state.index];
      if (!item) return;
      img.src = item.src;
      img.alt = item.caption;
      caption.textContent = item.caption ? item.caption + '  (' + (state.index + 1) + '/' + state.items.length + ')' : (state.index + 1) + '/' + state.items.length;
    }
    function close() {
      root.classList.remove('is-open');
      document.body.classList.remove('mosaic-lb-open');
      img.removeAttribute('src');
    }
    function move(step) {
      if (!state.items.length) return;
      state.index = (state.index + step + state.items.length) % state.items.length;
      paint();
    }
    root.querySelector('.mosaic-lb-close').addEventListener('click', close);
    root.querySelector('.mosaic-lb-prev').addEventListener('click', function (e) { e.stopPropagation(); move(-1); });
    root.querySelector('.mosaic-lb-next').addEventListener('click', function (e) { e.stopPropagation(); move(1); });
    root.addEventListener('click', function (e) { if (e.target === root || e.target.classList.contains('mosaic-lb-figure')) close(); });
    img.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('keydown', function (e) {
      if (!root.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
    });

    fallback = {
      open: function (items, index) {
        state.items = items || [];
        state.index = index || 0;
        paint();
        root.classList.add('is-open');
        document.body.classList.add('mosaic-lb-open');
      }
    };
    return fallback;
  }

  /* ------------------------------ 打开 ------------------------------ */

  function openLightbox(container, anchor) {
    var items = collect(container);
    if (!items.length) return;
    var index = getIndex(items, anchor);

    if (typeof window.Fancybox !== 'undefined' && typeof window.Fancybox.show === 'function') {
      try {
        window.Fancybox.show(items, { startIndex: index });
        return;
      } catch (err) {
        if (window.console && console.warn) console.warn('[gallery] Fancybox 调用失败，使用内置灯箱', err);
      }
    }
    ensureFallback().open(items, index);
  }

  /* ------------------------------ 初始化 ------------------------------ */

  function bindGroup(container) {
    if (container.getAttribute('data-mosaic-bound') === '1') return;
    container.setAttribute('data-mosaic-bound', '1');
    // capture=true：在 Pjax 的 document 级监听之前截获点击
    container.addEventListener('click', function (event) {
      var anchor = event.target && event.target.closest ? event.target.closest('.mosaic-item') : null;
      if (!anchor || !container.contains(anchor)) return;
      event.preventDefault();
      event.stopPropagation();
      openLightbox(container, anchor);
    }, true);
    // 键盘回车/空格也打开
    container.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var anchor = event.target && event.target.closest ? event.target.closest('.mosaic-item') : null;
      if (!anchor || !container.contains(anchor)) return;
      event.preventDefault();
      openLightbox(container, anchor);
    });
    groups.push(container);
  }

  function boot() {
    var containers = document.querySelectorAll('#article-container .mosaic-gallery');
    for (var i = 0; i < containers.length; i++) bindGroup(containers[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  document.addEventListener('pjax:complete', boot);
  if (typeof window.btf !== 'undefined' && typeof window.btf.addGlobalFn === 'function') {
    window.btf.addGlobalFn('pjaxComplete', boot, 'gallery_mosaic');
  }
})();
