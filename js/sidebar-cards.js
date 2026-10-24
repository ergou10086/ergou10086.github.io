/*!
 * sidebar-cards.js — 侧边栏卡片折叠/展开 + 最新文章 1~5 分页
 * ---------------------------------------------------------------------------
 * 作用卡片：公告 / 最新文章 / 分类 / 标签（侧栏 #aside-content 内）。
 * - 折叠状态按卡片写入 localStorage（键：sidebar-card-collapsed:<key>），刷新保持；
 * - 默认展开；键盘 Enter/Space 通过原生 <button> 触发；
 * - 最新文章每页 5 条，分页按钮由 card_recent_post.pug 输出（最多 5 页），
 *   本脚本负责切换可见项、同步 aria-current 并滚动到卡片顶部；
 * - 分类卡片的折叠按钮 / 内容包裹由本脚本注入（列表 HTML 来自 aside_categories
 *   助手，pug 只提供 data-aside-collapse 钩子）；
 * - 兼容 PJAX（本站开启 pjax，导航时 #body-wrap 会被整体替换）：监听
 *   pjax:complete 重新初始化新插入的侧栏，节点带初始化标记避免重复绑定；
 * - 本脚本不执行时页面保持改造前的外观（CSS 默认隐藏折叠按钮、内容展开）。
 */
(function () {
  'use strict'

  var SIDEBAR_SELECTOR = '#aside-content'
  var INIT_MARK = 'data-sidebar-cards-init'
  var STORAGE_PREFIX = 'sidebar-card-collapsed:'
  var DEFAULT_PER_PAGE = 5
  var COLLAPSE_ANIM_MS = 400

  // 四张目标卡片；data-aside-collapse 缺失时用默认 key，保证旧页面也能工作
  var CARD_ENTRIES = [
    { key: 'announcement', className: 'card-announcement' },
    { key: 'recent-post', className: 'card-recent-post' },
    { key: 'categories', className: 'card-categories' },
    { key: 'tags', className: 'card-tags' }
  ]

  var lang = ''
  try {
    lang = (document.documentElement.getAttribute('lang') || 'zh-CN').toLowerCase()
  } catch (e) {
    lang = 'zh-cn'
  }
  var isZh = lang.indexOf('zh') === 0
  var TEXT = {
    collapse: isZh ? '折叠' : 'Collapse',
    expand: isZh ? '展开' : 'Expand',
    page: isZh ? '第 {n} 页' : 'Page {n}'
  }

  function storageGet(key) {
    try {
      return window.localStorage.getItem(STORAGE_PREFIX + key) === '1'
    } catch (e) {
      return false
    }
  }

  function storageSet(key, collapsed) {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + key, collapsed ? '1' : '0')
    } catch (e) {
      /* 隐私模式 / 存储被禁用时忽略，仅本次会话生效 */
    }
  }

  function pageLabel(pageNumber) {
    return TEXT.page.replace('{n}', String(pageNumber))
  }

  function headlineTitle(headline) {
    var spans = headline.querySelectorAll('span')
    for (var i = 0; i < spans.length; i++) {
      var text = (spans[i].textContent || '').replace(/\s+/g, ' ').trim()
      if (text) return text
    }
    return ''
  }

  function setButtonState(btn, collapsed, title) {
    var action = collapsed ? TEXT.expand : TEXT.collapse
    var label = title ? (isZh ? action + title : action + ' ' + title) : action
    btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
    btn.setAttribute('aria-label', label)
    btn.setAttribute('title', label)
  }

  // 内容包裹：pug 已输出 .aside-collapse-content 时直接复用（公告/最新文章/标签）；
  // 分类卡片由助手生成整段 HTML，这里把标题栏之后的节点移入包裹层。
  function ensureContentWrapper(card, key) {
    var content = card.querySelector('.aside-collapse-content')
    if (content) {
      if (!content.id) content.id = 'aside-collapse-' + key
      return content
    }
    var headline = card.querySelector('.item-headline')
    if (!headline) return null
    content = document.createElement('div')
    content.className = 'aside-collapse-content'
    content.id = 'aside-collapse-' + key
    var node = headline.nextSibling
    while (node) {
      var next = node.nextSibling
      content.appendChild(node)
      node = next
    }
    card.appendChild(content)
    return content
  }

  function ensureButton(headline) {
    var btn = headline.querySelector('.aside-collapse-btn')
    if (btn) return btn
    btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'aside-collapse-btn'
    var icon = document.createElement('i')
    icon.className = 'fas fa-chevron-down fa-fw'
    btn.appendChild(icon)
    headline.appendChild(btn)
    return btn
  }

  function setupCard(card, key) {
    if (card.getAttribute(INIT_MARK) === '1') return
    var headline = card.querySelector('.item-headline')
    if (!headline) return

    var content = ensureContentWrapper(card, key)
    if (!content) return

    var btn = ensureButton(headline)
    btn.setAttribute('aria-controls', content.id)

    var title = headlineTitle(headline)
    var expandTimer = null

    function isCollapsed() {
      return card.getAttribute('data-aside-collapsed') === 'true'
    }

    function applyState(nextCollapsed) {
      if (expandTimer) {
        window.clearTimeout(expandTimer)
        expandTimer = null
      }
      if (nextCollapsed) {
        // 先测量真实高度再收缩，保证 max-height 过渡平顺
        content.style.maxHeight = content.scrollHeight + 'px'
        void content.offsetHeight
        content.style.maxHeight = '0px'
        content.setAttribute('inert', '')
        content.setAttribute('aria-hidden', 'true')
      } else {
        content.style.maxHeight = content.scrollHeight + 'px'
        content.removeAttribute('inert')
        content.removeAttribute('aria-hidden')
        expandTimer = window.setTimeout(function () {
          expandTimer = null
          if (!isCollapsed()) content.style.maxHeight = ''
        }, COLLAPSE_ANIM_MS)
      }
      card.setAttribute('data-aside-collapsed', nextCollapsed ? 'true' : 'false')
      setButtonState(btn, nextCollapsed, title)
    }

    // 初始状态：直接落地（此时 html 还没有 sidebar-cards-anim，不会播放动画）
    var collapsed = storageGet(key)
    if (collapsed) {
      card.setAttribute('data-aside-collapsed', 'true')
      content.style.maxHeight = '0px'
      content.setAttribute('inert', '')
      content.setAttribute('aria-hidden', 'true')
    } else {
      card.setAttribute('data-aside-collapsed', 'false')
      content.style.maxHeight = ''
      content.removeAttribute('inert')
      content.removeAttribute('aria-hidden')
    }
    setButtonState(btn, collapsed, title)

    // 标题栏整行可点击；「分类」卡片里的“更多”链接保持原有跳转
    headline.addEventListener('click', function (event) {
      var target = event.target
      if (target && target.closest && target.closest('a')) return
      event.preventDefault()
      var next = !isCollapsed()
      applyState(next)
      storageSet(key, next)
    })

    card.setAttribute(INIT_MARK, '1')
  }

  function scrollCardIntoView(card) {
    var rect
    try {
      rect = card.getBoundingClientRect()
    } catch (e) {
      return
    }
    var offset = window.pageYOffset || document.documentElement.scrollTop || 0
    var top = Math.max(0, rect.top + offset - 16)
    try {
      window.scrollTo({ top: top, behavior: 'smooth' })
    } catch (e) {
      window.scrollTo(0, top)
    }
  }

  function setupRecentPost(card) {
    var list = card.querySelector('.aside-list')
    if (!list) return

    var items = []
    for (var i = 0; i < list.children.length; i++) {
      var child = list.children[i]
      if (child.classList && child.classList.contains('aside-list-item')) items.push(child)
    }
    var nav = card.querySelector('.aside-recent-pagination')
    if (!items.length || !nav) return

    var buttons = []
    var btnNodes = nav.querySelectorAll('.aside-recent-page')
    for (var j = 0; j < btnNodes.length; j++) buttons.push(btnNodes[j])
    if (!buttons.length) return

    var perPage = parseInt(card.getAttribute('data-aside-per-page'), 10)
    if (!perPage || perPage < 1) perPage = DEFAULT_PER_PAGE

    var currentPage = 1

    function render(pageNumber, shouldScroll) {
      currentPage = pageNumber
      for (var k = 0; k < items.length; k++) {
        var item = items[k]
        var index = parseInt(item.getAttribute('data-post-index'), 10)
        if (isNaN(index)) index = k
        var itemPage = Math.floor(index / perPage) + 1
        if (itemPage === pageNumber) item.classList.remove('is-hidden')
        else item.classList.add('is-hidden')
      }
      for (var m = 0; m < buttons.length; m++) {
        var btn = buttons[m]
        var pageNo = parseInt(btn.getAttribute('data-page'), 10)
        if (pageNo === pageNumber) {
          btn.classList.add('current')
          btn.setAttribute('aria-current', 'page')
        } else {
          btn.classList.remove('current')
          btn.removeAttribute('aria-current')
        }
        btn.setAttribute('aria-label', pageLabel(pageNo))
      }
      if (shouldScroll) scrollCardIntoView(card)
    }

    render(1, false)

    nav.addEventListener('click', function (event) {
      var target = event.target
      var btn = target && target.closest ? target.closest('.aside-recent-page') : null
      if (!btn || !nav.contains(btn)) return
      var pageNumber = parseInt(btn.getAttribute('data-page'), 10)
      if (!pageNumber || pageNumber === currentPage) return
      render(pageNumber, true)
    })
  }

  function boot() {
    var sidebar = document.querySelector(SIDEBAR_SELECTOR)
    if (!sidebar) return

    // PJAX 重新初始化时先关掉过渡，避免“恢复 localStorage 收起状态”被播成动画
    document.documentElement.classList.remove('sidebar-cards-anim')

    var seen = 0
    var prepared = 0
    for (var i = 0; i < CARD_ENTRIES.length; i++) {
      var entry = CARD_ENTRIES[i]
      var card = sidebar.querySelector('.card-widget.' + entry.className)
      if (!card) continue
      seen++
      var key = card.getAttribute('data-aside-collapse') || entry.key
      if (card.getAttribute(INIT_MARK) === '1') {
        prepared++
        continue
      }
      try {
        setupCard(card, key)
        if (entry.key === 'recent-post') setupRecentPost(card)
        prepared++
      } catch (e) {
        if (window.console && window.console.warn) {
          window.console.warn('[sidebar-cards] 初始化失败：' + key, e)
        }
      }
    }
    if (!prepared || !seen) return

    // 无 JS 时按钮保持隐藏；初始化完成后再显示，避免出现无响应的死按钮
    document.documentElement.classList.add('sidebar-cards-ready')

    // 延迟两帧再开启过渡，避免“读取 localStorage 得到的收起状态”播动画
    var enableAnim = function () {
      document.documentElement.classList.add('sidebar-cards-anim')
    }
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(enableAnim)
      })
    } else {
      window.setTimeout(enableAnim, 0)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }

  // 本站开启 PJAX：导航时 #body-wrap（连同 #aside-content）会被整体替换，
  // 需要在 pjax:complete 后对新插入的侧栏重新初始化（节点带标记，不会重复绑定）。
  document.addEventListener('pjax:complete', boot)
})()
