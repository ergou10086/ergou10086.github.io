/* Native comment composer: visual media, virtual sticker rows and GitHub-backed API. */
(() => {
  'use strict';
  if (window.SiteComments) { window.SiteComments.mount(); return; }
  const EMOJI = [
    ['表情', '😀 😃 😄 😁 😆 😅 😂 🤣 😊 🙂 🙃 😉 😍 🥰 😘 😚 😋 😛 😜 🤪 🤗 🤭 🤫 🤔 🫡 🤨 😐 😑 😶 🙄 😏 😣 😥 😮 😯 😲 😳 🥺 🥹 😢 😭 😤 😠 😡 🤬 🤯 😱 😨 😰 😓 😴 🥱 🤤 😎 🤓 🧐 🤩 🥳 😇 🤡 👻 💀 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾'],
    ['手势与爱心', '👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 💪 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 💕 💞 💓 💗 💖 💘 💝 💯 💢 💥 💫 💦 💤'],
    ['动物与自然', '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦆 🦉 🦋 🐝 🐞 🐢 🐍 🐙 🦑 🐟 🐬 🐳 🦈 🐈 🐕 🐾 🌸 🌹 🌻 🌼 🌷 🌱 🌲 🌳 🍀 🍁 🍂 🍄 🌈 ☀️ 🌤️ 🌙 ⭐ 🌟 ✨ ⚡ 🔥 ❄️ ☃️ 💧 🌊'],
    ['食物与日常', '🍎 🍊 🍋 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥝 🍅 🥑 🥦 🥕 🌽 🍞 🥐 🧀 🍔 🍟 🍕 🌭 🍜 🍣 🍙 🍚 🍰 🎂 🍮 🍩 🍪 🍫 🍬 🍭 ☕ 🍵 🧋 🥤 🍺 🥂 🎉 🎊 🎈 🎁 🎀 🏆 🥇 🎮 🎵 🎶 🎨 📷 📚 💻 📱 💡 ✅ ❌ ❓ ❗ 🚀 🛸 🏠 🌍']
  ].map(([name, values]) => ({ name, values: values.split(' ') }));
  const ICONS = {
    smile: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 14s1 3 4 3 4-3 4-3M8 8h.01M16 8h.01"/></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L6 21"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 19 9-19 9 4-9-4-9Zm4 9h15"/></svg>'
  };
  const AUTH_KEY = 'ergoutree-comment-session';
  let active = null, catalogPromise = null, purifierPromise = null;
  const $ = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
  const storage = {
    get(key, session = false) { try { return (session ? sessionStorage : localStorage).getItem(key); } catch { return null; } },
    set(key, value, session = false) { try { (session ? sessionStorage : localStorage).setItem(key, value); } catch {} },
    remove(key, session = false) { try { (session ? sessionStorage : localStorage).removeItem(key); } catch {} }
  };
  function acceptSession() {
    if (!location.hash.startsWith('#comment-session=')) return;
    const token = location.hash.slice(17);
    if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) && token.length < 6000) storage.set(AUTH_KEY, token);
    history.replaceState(history.state, '', location.pathname + location.search + '#post-comment');
  }
  async function getCatalog(url) {
    if (!catalogPromise) catalogPromise = fetch(url).then(response => { if (!response.ok) throw new Error('贴纸清单暂时无法加载'); return response.json(); }).catch(error => { catalogPromise = null; throw error; });
    return catalogPromise;
  }
  function purifier(url) {
    if (window.DOMPurify) return Promise.resolve(window.DOMPurify);
    if (!purifierPromise) purifierPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = url; script.onload = () => resolve(window.DOMPurify); script.onerror = () => { purifierPromise = null; reject(new Error('评论内容暂时无法显示，请重试')); }; document.head.appendChild(script);
    });
    return purifierPromise;
  }
  class Picker {
    constructor(owner) {
      this.owner = owner; this.tab = 'emoji'; this.query = ''; this.catalog = null; this.rows = []; this.nodes = new Map(); this.frame = 0;
      this.el = $('section', 'cc-picker'); this.el.setAttribute('role', 'dialog'); this.el.setAttribute('aria-label', '表情和贴纸');
      this.tabs = $('div', 'cc-picker-tabs'); this.tabs.setAttribute('role', 'tablist');
      for (const [id, name] of [['emoji', 'Emoji'], ['stickers', '贴纸'], ['gif', 'GIF 动态图']]) {
        const button = $('button', '', name); button.type = 'button'; button.dataset.tab = id; button.setAttribute('role', 'tab');
        button.addEventListener('click', () => this.setTab(id)); this.tabs.appendChild(button);
      }
      this.tabs.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault(); const buttons = [...this.tabs.children], index = buttons.indexOf(document.activeElement);
        const button = buttons[(index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length]; button.click(); button.focus();
      });
      this.search = $('input', 'cc-picker-search'); this.search.type = 'search'; this.search.placeholder = '搜索表情或贴纸包'; this.search.setAttribute('aria-label', '搜索表情或贴纸包');
      this.search.addEventListener('input', () => { this.query = this.search.value.trim().toLowerCase(); this.rebuild(); });
      this.viewport = $('div', 'cc-picker-viewport'); this.viewport.tabIndex = 0; this.viewport.setAttribute('aria-label', '表情列表');
      this.content = $('div', 'cc-picker-content'); this.viewport.appendChild(this.content);
      this.viewport.addEventListener('scroll', () => { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.render(); }); }, { passive: true });
      this.rail = $('nav', 'cc-pack-rail'); this.rail.setAttribute('aria-label', '贴纸包');
      this.hint = $('div', 'cc-picker-hint', '选择后加入草稿，点击发送再发布');
      this.el.append(this.tabs, this.search, this.viewport, this.rail, this.hint); document.body.appendChild(this.el);
      this.resize = new ResizeObserver(() => this.rebuild(false)); this.resize.observe(this.viewport);
      this.outside = event => { if (!this.el.contains(event.target) && !owner.face.contains(event.target)) this.close(); };
      this.escape = event => { if (event.key === 'Escape') { event.preventDefault(); this.close(); owner.face.focus(); } };
      this.move = event => { if (!this.el.contains(event.target)) this.position(); };
      this.setTab('emoji'); this.position();
      document.addEventListener('pointerdown', this.outside); document.addEventListener('keydown', this.escape); window.addEventListener('resize', this.move); window.addEventListener('scroll', this.move, true);
      owner.face.setAttribute('aria-expanded', 'true');
    }
    position() {
      const rect = this.owner.face.getBoundingClientRect();
      const width = Math.min(420, innerWidth - 24), height = Math.min(460, innerHeight - 32);
      this.el.style.width = width + 'px'; this.el.style.height = height + 'px';
      this.el.style.left = Math.max(12, Math.min(rect.left, innerWidth - width - 12)) + 'px';
      this.el.style.top = Math.max(12, Math.min(rect.top - height - 10, innerHeight - height - 12)) + 'px';
    }
    async setTab(tab) {
      this.tab = tab; this.query = ''; this.search.value = '';
      [...this.tabs.children].forEach(button => { const selected = button.dataset.tab === tab; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; });
      if (tab !== 'emoji' && !this.catalog) {
        this.content.replaceChildren($('p', 'cc-picker-empty', '正在加载贴纸……'));
        try { this.catalog = await getCatalog(this.owner.config.manifest); if (this.el.isConnected) this.rebuild(); }
        catch (error) { this.content.replaceChildren($('p', 'cc-picker-empty', error.message)); }
      }
      this.rebuild();
    }
    rebuild(reset = true) {
      if (!this.el.isConnected) return;
      const columns = this.tab === 'emoji' ? Math.max(5, Math.floor((this.viewport.clientWidth - 20) / 43)) : Math.max(3, Math.floor((this.viewport.clientWidth - 20) / 78));
      const groups = this.tab === 'emoji'
        ? EMOJI.map((group, index) => ({ id: 'emoji-' + index, name: group.name, items: !this.query || group.name.includes(this.query) ? group.values : group.values.filter(value => value.includes(this.query)) }))
        : (this.catalog?.packs || []).map(pack => ({ ...pack, items: pack.stickers.filter(sticker => (this.tab !== 'gif' || sticker.animated) && (!this.query || (pack.name + ' ' + sticker.name).toLowerCase().includes(this.query))) }));
      this.rows = []; this.offsets = new Map(); let top = 0;
      for (const group of groups.filter(group => group.items.length)) {
        this.offsets.set(group.id, top);
        this.rows.push({ key: group.id + '-heading', heading: group.name, top, height: 34, group: group.id }); top += 34;
        for (let i = 0; i < group.items.length; i += columns) {
          const height = this.tab === 'emoji' ? 45 : 84;
          this.rows.push({ key: group.id + '-' + i, items: group.items.slice(i, i + columns), top, height, columns, group: group.id }); top += height;
        }
      }
      this.nodes.clear(); this.content.replaceChildren(); this.content.style.height = top + 'px';
      if (!top && (this.tab === 'emoji' || this.catalog)) { this.content.style.height = 'auto'; this.content.appendChild($('p', 'cc-picker-empty', '没有找到表情')); }
      if (reset) this.viewport.scrollTop = 0;
      this.rail.replaceChildren();
      if (this.tab !== 'emoji' && this.catalog) for (const pack of this.catalog.packs) {
        if (!this.offsets.has(pack.id)) continue;
        const button = $('button', 'cc-pack-button'); button.type = 'button'; button.title = pack.name; button.setAttribute('aria-label', pack.name); button.dataset.pack = pack.id;
        const img = $('img'); img.src = pack.icon; img.alt = ''; img.width = 32; img.height = 32; img.loading = 'lazy'; img.decoding = 'async'; button.appendChild(img);
        button.addEventListener('click', () => { this.viewport.scrollTop = this.offsets.get(pack.id); this.render(); }); this.rail.appendChild(button);
      }
      this.rail.hidden = this.tab === 'emoji'; this.render();
    }
    render() {
      if (!this.el.isConnected) return;
      const start = this.viewport.scrollTop - 160, end = this.viewport.scrollTop + this.viewport.clientHeight + 160;
      // Binary search keeps long sticker catalogs cheap to scroll.
      let left = 0, right = this.rows.length;
      while (left < right) { const mid = (left + right) >>> 1; if (this.rows[mid].top + this.rows[mid].height < start) left = mid + 1; else right = mid; }
      const visible = new Set(); let current;
      for (let i = left; i < this.rows.length && this.rows[i].top <= end; i++) {
        const row = this.rows[i]; visible.add(row.key);
        if (row.top <= this.viewport.scrollTop + 38) current = row.group;
        if (this.nodes.has(row.key)) continue;
        const node = $('div', row.heading ? 'cc-picker-heading' : 'cc-picker-row'); node.style.top = row.top + 'px'; node.style.height = row.height + 'px';
        if (row.heading) node.textContent = row.heading;
        else {
          node.style.gridTemplateColumns = `repeat(${row.columns},minmax(0,1fr))`;
          for (const item of row.items) {
            const button = $('button', this.tab === 'emoji' ? 'cc-emoji' : 'cc-sticker'); button.type = 'button';
            if (typeof item === 'string') { button.textContent = item; button.title = item; button.addEventListener('click', () => this.owner.insertEmoji(item)); }
            else {
              button.title = item.name; button.setAttribute('aria-label', '贴纸 ' + item.name); button.dataset.sticker = item.id;
              const img = $('img'); img.src = item.thumbnail; img.alt = ''; img.width = 72; img.height = 72; img.decoding = 'async'; img.loading = 'lazy'; button.appendChild(img);
              if (item.animated && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
                const play = () => { img.src = item.src; }, stop = () => { img.src = item.thumbnail; };
                button.addEventListener('pointerenter', play); button.addEventListener('pointerleave', stop); button.addEventListener('focus', play); button.addEventListener('blur', stop);
              }
              button.addEventListener('click', () => this.owner.addSticker(item, this.catalog.revision));
            }
            node.appendChild(button);
          }
        }
        this.nodes.set(row.key, node); this.content.appendChild(node);
      }
      for (const [key, node] of this.nodes) if (!visible.has(key)) { node.remove(); this.nodes.delete(key); }
      for (const button of this.rail.children) button.setAttribute('aria-pressed', String(button.dataset.pack === current));
    }
    close() {
      if (!this.el.isConnected) return;
      cancelAnimationFrame(this.frame); this.resize.disconnect(); this.el.remove();
      document.removeEventListener('pointerdown', this.outside); document.removeEventListener('keydown', this.escape); window.removeEventListener('resize', this.move); window.removeEventListener('scroll', this.move, true);
      this.owner.face.setAttribute('aria-expanded', 'false'); this.owner.picker = null;
    }
  }

  class Comments {
    constructor(root, config) {
      this.root = root; this.config = config; this.user = null; this.files = []; this.stickers = []; this.busy = false; this.destroyed = false; this.requestId = crypto.randomUUID(); this.seen = new Set(); this.threads = new Map(); this.relation = null; this.nextPage = null;
      this.abort = new AbortController(); this.draftKey = 'comment-draft:' + config.page; this.cursor = [0, 0];
      root.className = 'cc';
      const header = $('div', 'cc-session'); this.identity = $('span', '', '用 GitHub 登录后参与讨论');
      this.login = $('button', 'cc-login', 'GitHub 登录'); this.login.type = 'button'; this.login.addEventListener('click', () => this.signIn());
      this.logout = $('button', 'cc-logout', '退出'); this.logout.type = 'button'; this.logout.hidden = true; this.logout.addEventListener('click', () => { storage.remove(AUTH_KEY); this.user = null; this.session(); }); header.append(this.identity, this.login, this.logout);
      this.form = $('form', 'cc-composer');
      this.text = $('textarea', 'cc-text'); this.text.rows = 4; this.text.placeholder = '写下你的评论……'; this.text.maxLength = 6000; this.text.setAttribute('aria-label', '评论内容');
      this.text.addEventListener('input', () => { this.update(); this.saveDraft(); });
      for (const event of ['select', 'keyup', 'click', 'input']) this.text.addEventListener(event, () => { this.cursor = [this.text.selectionStart, this.text.selectionEnd]; });
      this.text.addEventListener('keydown', event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); this.submit(); } });
      this.tray = $('div', 'cc-media-tray'); this.tray.setAttribute('aria-label', '待发送图片和贴纸');
      const toolbar = $('div', 'cc-toolbar'); const actions = $('div', 'cc-actions');
      this.face = $('button', 'cc-icon'); this.face.type = 'button'; this.face.innerHTML = ICONS.smile; this.face.title = 'Emoji 和表情贴纸'; this.face.setAttribute('aria-label', this.face.title); this.face.setAttribute('aria-expanded', 'false'); this.face.setAttribute('aria-haspopup', 'dialog'); this.face.addEventListener('click', () => { if (this.picker) this.picker.close(); else this.picker = new Picker(this); });
      this.upload = $('button', 'cc-icon'); this.upload.type = 'button'; this.upload.innerHTML = ICONS.image; this.upload.title = '选择本地图片（支持 GIF）'; this.upload.setAttribute('aria-label', this.upload.title); this.upload.addEventListener('click', () => { if (!this.user) { this.message('请先登录，再选择本地图片。'); return; } this.input.click(); });
      this.input = $('input', 'cc-file'); this.input.type = 'file'; this.input.multiple = true; this.input.accept = 'image/png,image/jpeg,image/gif,image/webp'; this.input.hidden = true; this.input.addEventListener('change', () => { this.addFiles([...this.input.files]); this.input.value = ''; });
      actions.append(this.face, this.upload, this.input);
      this.counter = $('span', 'cc-counter'); this.send = $('button', 'cc-send'); this.send.type = 'submit'; this.send.innerHTML = ICONS.send + '<span>发送</span>';
      this.target = $('div', 'cc-target'); this.target.hidden = true;
      toolbar.append(actions, this.counter, this.send); this.form.append(this.target, this.text, this.tray, toolbar); this.form.addEventListener('submit', event => { event.preventDefault(); this.submit(); });
      this.form.addEventListener('paste', event => { const files = [...(event.clipboardData?.files || [])]; if (files.length) { event.preventDefault(); this.addFiles(files); } });
      this.form.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); this.form.classList.add('cc-dragging'); } });
      this.form.addEventListener('dragleave', () => this.form.classList.remove('cc-dragging'));
      this.form.addEventListener('drop', event => { event.preventDefault(); this.form.classList.remove('cc-dragging'); this.addFiles([...(event.dataTransfer?.files || [])]); });
      this.status = $('p', 'cc-status'); this.status.setAttribute('role', 'status');
      this.list = $('div', 'cc-list'); this.more = $('button', 'cc-more', '加载更多评论'); this.more.type = 'button'; this.more.hidden = true; this.more.addEventListener('click', () => this.load(this.nextPage));
      this.reload = $('button', 'cc-reload', '重新加载评论'); this.reload.type = 'button'; this.reload.hidden = true; this.reload.addEventListener('click', () => this.load());
      root.replaceChildren(header, this.form, this.status, this.reload, this.list, this.more);
      this.restoreDraft(); this.update(); this.session();
      this.observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { this.observer.disconnect(); this.load(); } }, { rootMargin: '250px' }); this.observer.observe(root);
    }
    async request(path, options = {}) {
      const controller = new AbortController(), abort = () => controller.abort();
      this.abort.signal.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(() => controller.abort(new DOMException('请求超时，请稍后重试。', 'TimeoutError')), options.method === 'POST' ? 120000 : 25000);
      try {
        const response = await fetch(this.config.api + path, { ...options, headers: { ...(storage.get(AUTH_KEY) ? { authorization: 'Bearer ' + storage.get(AUTH_KEY) } : {}), ...options.headers }, signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) { const error = new Error(data.error || '评论暂时无法加载，请稍后重试。'); error.status = response.status; throw error; }
        return data;
      } finally { clearTimeout(timer); this.abort.signal.removeEventListener('abort', abort); }
    }
    async session() {
      if (storage.get(AUTH_KEY)) {
        try { this.user = (await this.request('/v1/session')).user; }
        catch (error) { if (error.status === 401) storage.remove(AUTH_KEY); this.user = null; }
      }
      if (this.destroyed) return;
      this.identity.textContent = this.user ? '已登录 @' + this.user.login : '用 GitHub 登录后参与讨论'; this.login.hidden = !!this.user; this.logout.hidden = !this.user;
      this.update();
    }
    signIn() { this.saveDraft(); location.assign(this.config.api + '/auth/start?' + new URLSearchParams({ return_to: location.href.split('#')[0] })); }
    message(text, error = false) { if (this.destroyed) return; this.status.textContent = text; this.status.classList.toggle('cc-error', error); }
    update() {
      this.counter.textContent = this.text.value.length ? this.text.value.length + ' / 6000' : '';
      this.send.disabled = this.busy || !(this.text.value.trim() || this.files.length || this.stickers.length);
      this.text.disabled = this.busy; this.upload.disabled = this.busy; this.face.disabled = this.busy;
      this.send.querySelector('span').textContent = this.busy ? '发送中…' : '发送';
    }
    insertEmoji(value) {
      if (this.busy) return;
      const [start, end] = this.cursor;
      if (this.text.value.length - (end - start) + value.length > 6000) { this.message('评论最多 6000 个字符。', true); return; }
      this.text.setRangeText(value, start, end, 'end'); this.cursor = [this.text.selectionStart, this.text.selectionEnd]; this.text.dispatchEvent(new Event('input', { bubbles: true }));
    }
    addSticker(sticker, revision) {
      if (this.busy) return;
      if (this.stickers.length >= 12) { this.message('一次最多选择 12 张贴纸。', true); return; }
      this.stickers.push(sticker); this.stickerRevision = revision; this.renderTray(); this.saveDraft(); this.update();
    }
    addFiles(files) {
      if (this.busy) return;
      if (!this.user) { this.message('请先登录，再选择本地图片。'); return; }
      for (const file of files) {
        if (this.files.length >= this.config.maxFiles) { this.message('一次最多上传 4 张本地图片。', true); break; }
        if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type) || !file.size || file.size > this.config.maxFileBytes) { this.message('请选择不超过 5 MiB 的 PNG、JPG、GIF 或 WebP 图片。', true); continue; }
        this.files.push({ file, url: URL.createObjectURL(file) });
      }
      this.renderTray(); this.update();
    }
    renderTray() {
      this.tray.replaceChildren();
      for (const [type, items] of [['sticker', this.stickers], ['file', this.files]]) items.forEach((item, index) => {
        const chip = $('div', 'cc-media-chip'); const img = $('img'); img.src = type === 'sticker' ? item.src : item.url; img.alt = type === 'sticker' ? '贴纸 ' + item.name : item.file.name; img.decoding = 'async'; img.width = 72; img.height = 72;
        const remove = $('button', 'cc-remove', '×'); remove.type = 'button'; remove.setAttribute('aria-label', '移除 ' + img.alt); remove.disabled = this.busy;
        remove.addEventListener('click', () => { if (this.busy) return; if (type === 'file') URL.revokeObjectURL(item.url); items.splice(index, 1); this.renderTray(); this.saveDraft(); this.update(); }); chip.append(img, remove); this.tray.appendChild(chip);
      });
      this.tray.hidden = !this.files.length && !this.stickers.length;
    }
    saveDraft() {
      if (this.destroyed) return;
      storage.set(this.draftKey, JSON.stringify({ relation: this.relation, text: this.text.value, stickers: this.stickers.map(sticker => sticker.id), requestId: this.requestId, lastAttempt: this.lastAttempt }), true);
    }
    async restoreDraft() {
      let draft; try { draft = JSON.parse(storage.get(this.draftKey, true) || 'null'); } catch {}
      if (!draft) return;
      if (draft.relation && ['reply','quote'].includes(draft.relation.kind) && Number.isSafeInteger(draft.relation.targetId)) { this.relation = draft.relation; this.showTarget(); }
      this.text.value = String(draft.text || '').slice(0, 6000); this.cursor = [this.text.value.length, this.text.value.length];
      if (/^[a-f0-9-]{36}$/.test(draft.requestId || '')) this.requestId = draft.requestId;
      if (typeof draft.lastAttempt === 'string') this.lastAttempt = draft.lastAttempt;
      if (draft.stickers?.length) {
        try {
          const catalog = await getCatalog(this.config.manifest), all = new Map(catalog.packs.flatMap(pack => pack.stickers.map(sticker => [sticker.id, sticker])));
          if (this.destroyed) return;
          this.stickers = draft.stickers.slice(0, 12).map(id => all.get(id)).filter(Boolean); this.stickerRevision = catalog.revision; this.renderTray(); this.update();
        } catch {}
      }
      this.update();
    }
    async renderComment(comment) {
      if (this.seen.has(comment.id)) return null;
      const sanitize = await purifier(this.config.purifier);
      if (this.destroyed) return null;
      const article = $('article', 'cc-comment'); article.dataset.commentId = String(comment.id);
      const avatar = $('img', 'cc-avatar'); avatar.alt = ''; avatar.width = 36; avatar.height = 36; avatar.loading = 'lazy'; avatar.decoding = 'async';
      if (/^https:\/\/avatars\.githubusercontent\.com\//.test(comment.author.avatar || '')) avatar.src = comment.author.avatar;
      const content = $('div', 'cc-comment-content'), head = $('div', 'cc-comment-head');
      const name = $('a', 'cc-comment-author', comment.author.name || comment.author.login); name.href = 'https://github.com/' + encodeURIComponent(comment.author.login); name.target = '_blank'; name.rel = 'noopener noreferrer';
      const date = $('time'); const timestamp = new Date(comment.createdAt); if (!Number.isNaN(timestamp.getTime())) { date.dateTime = timestamp.toISOString(); date.textContent = timestamp.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }); }
      const meta = $('span', 'cc-comment-meta');
      if (comment.context) for (const value of [comment.context.location, comment.context.browser, comment.context.os]) meta.append($('span', '', value || '未知'));
      meta.append(date); head.append(name, meta);
      const body = $('div', 'cc-comment-body'); body.innerHTML = sanitize.sanitize(comment.html || '', { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe'], FORBID_ATTR: ['style', 'srcset'] });
      body.querySelectorAll('a').forEach(link => { link.target = '_blank'; link.rel = 'noopener noreferrer nofollow'; });
      body.querySelectorAll('img').forEach(img => { if (!/^https?:\/\//i.test(img.getAttribute('src') || '')) { img.remove(); return; } img.loading = 'lazy'; img.decoding = 'async'; });
      const reference = $('div', 'cc-reference');
      if (comment.relation) { reference.textContent = (comment.relation.kind === 'reply' ? '回复 ' : '引用 ') + '@' + comment.relation.name + '：' + comment.relation.excerpt; }
      else reference.hidden = true;
      const actions = $('div', 'cc-comment-actions');
      for (const [kind, label, path] of [['quote', '引用', 'M5 8h5v5H7v3H4v-5z M14 8h5v5h-3v3h-3v-5z'], ['reply', '回复', 'M10 5 3 11l7 6v-4c5 0 8 1 11 5-1-8-5-10-11-10z']]) {
        const button = $('button', 'cc-icon'); button.type = 'button'; button.title = label; button.setAttribute('aria-label', label + ' @' + comment.author.login);
        button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"></path></svg>';
        button.addEventListener('click', () => { if (this.busy) return; this.relation = { kind, targetId: comment.id, name: comment.author.name || comment.author.login, excerpt: body.textContent.trim().slice(0, 300) }; this.showTarget(); this.saveDraft(); this.form.scrollIntoView({behavior:'smooth', block:'center'}); this.text.focus({preventScroll:true}); }); actions.append(button);
      }
      actions.hidden = !this.threadSupport;
      content.append(head, reference, body, actions); article.append(avatar, content); this.seen.add(comment.id);
      if (!comment.relation || comment.relation.kind !== 'reply' || comment.replies) {
        const replies = $('div', 'cc-replies'), more = $('button', 'cc-more-replies', '展开更多回复'); more.type = 'button';
        const thread = { replies, more, offset: comment.nextReplyOffset, count: comment.replyCount || 0 }; this.threads.set(comment.id, thread);
        more.hidden = thread.offset == null; more.addEventListener('click', () => this.loadReplies(comment.id)); content.append(replies, more);
        for (const reply of comment.replies || []) { const node = await this.renderComment(reply); if (node) replies.append(node); }
      }
      return article;
    }
    showTarget() {
      this.target.replaceChildren(); this.target.hidden = !this.relation;
      if (!this.relation) return;
      const text = $('span', '', (this.relation.kind === 'reply' ? '回复 ' : '引用 ') + '@' + this.relation.name + '：' + this.relation.excerpt);
      const cancel = $('button', '', '取消'); cancel.type = 'button'; cancel.addEventListener('click', () => { if (this.busy) return; this.relation = null; this.showTarget(); this.saveDraft(); }); this.target.append(text, cancel);
    }
    async loadReplies(id) {
      const thread = this.threads.get(id); if (!thread || thread.offset == null) return;
      thread.more.disabled = true;
      try {
        const data = await this.request('/v1/comments?' + new URLSearchParams({path:this.config.page, root:String(id), offset:String(thread.offset)}));
        for (const comment of data.comments) { const node = await this.renderComment(comment); if (node) thread.replies.append(node); }
        thread.offset = data.nextOffset; thread.more.hidden = data.nextOffset == null;
      } catch(error) { this.message(error.message, true); }
      finally { thread.more.disabled = false; }
    }
    async addPublished(comment) {
      const thread = comment.relation?.kind === 'reply' && this.threads.get(comment.relation.rootId);
      if (thread) {
        thread.count++;
        if (thread.offset == null && thread.replies.children.length < 2) { const node = await this.renderComment(comment); if (node) thread.replies.append(node); }
        else { if (thread.offset == null) thread.offset = thread.replies.children.length; thread.more.hidden = false; }
      } else { const node = await this.renderComment(comment); if (node) this.list.append(node); }
    }
    async load(page = 1) {
      if (this.destroyed) return;
      this.more.disabled = true; this.reload.hidden = true; if (page === 1) this.message('正在加载评论……');
      try {
        const data = await this.request('/v1/comments?' + new URLSearchParams({ path: this.config.page, page: String(page) }));
        this.threadSupport = data.capabilities?.includes('threads-v1') === true;
        for (const comment of data.comments) { const article = await this.renderComment(comment); if (article) this.list.appendChild(article); }
        this.nextPage = data.nextPage; this.more.hidden = !data.nextPage; this.message(this.seen.size ? '' : '还没有评论，来发表第一条吧。');
      } catch (error) {
        if (error.name === 'AbortError') return;
        this.message(error.message, true); this.reload.hidden = false;
        const legacy = document.getElementById('comments-legacy'); if (legacy) legacy.open = true;
      } finally { this.more.disabled = false; }
    }
    async submit() {
      if (this.busy || !(this.text.value.trim() || this.files.length || this.stickers.length)) return;
      if (this.relation && !this.threadSupport) { this.message('回复服务尚未更新，请先取消回复，或等待站长更新服务。', true); return; }
      if (!this.user) { this.message('请先点击 GitHub 登录，草稿会为你保留。'); this.login.focus(); this.saveDraft(); return; }
      this.picker?.close(); this.busy = true; this.update(); this.renderTray(); this.saveDraft(); this.message(this.files.length ? '正在上传图片并发送评论……' : '正在发送评论……');
      const fingerprint = JSON.stringify({ relation: this.relation, text: this.text.value, stickers: this.stickers.map(sticker => sticker.id), files: this.files.map(item => [item.file.name, item.file.size, item.file.lastModified]) });
      if (this.lastAttempt && this.lastAttempt !== fingerprint) this.requestId = crypto.randomUUID();
      this.lastAttempt = fingerprint;
      this.saveDraft();
      const form = new FormData();
      form.append('payload', JSON.stringify({ text: this.text.value, stickers: this.stickers.map(sticker => sticker.id), stickerRevision: this.stickerRevision, requestId: this.requestId, relation: this.relation ? { kind: this.relation.kind, targetId: this.relation.targetId } : null }));
      for (const item of this.files) form.append('files', item.file, item.file.name);
      try {
        const result = await this.request('/v1/comments?' + new URLSearchParams({ path: this.config.page }), { method: 'POST', body: form });
        // Only the successful server response becomes a published comment.
        await this.addPublished(result.comment);
        for (const item of this.files) URL.revokeObjectURL(item.url);
        this.files = []; this.stickers = []; this.relation = null; this.showTarget(); this.text.value = ''; this.requestId = crypto.randomUUID(); this.lastAttempt = null; this.cursor = [0, 0]; storage.remove(this.draftKey, true); this.renderTray(); this.message('评论已发送。');
      } catch (error) {
        if (error.name !== 'AbortError') this.message(error.message, true);
        if (error.status === 401) { storage.remove(AUTH_KEY); this.user = null; this.session(); }
      } finally { this.busy = false; this.update(); this.renderTray(); }
    }
    destroy() {
      this.saveDraft(); this.destroyed = true; this.abort.abort(); this.observer.disconnect(); this.picker?.close(); for (const item of this.files) URL.revokeObjectURL(item.url); this.files = [];
    }
  }
  function mount() {
    acceptSession();
    const root = document.getElementById('site-comments'), data = document.getElementById('comment-media-config');
    if (!root || !data || active?.root === root) return;
    active?.destroy();
    let config; try { config = JSON.parse(data.textContent); } catch { return; }
    if (!config.api) return;
    active = new Comments(root, config);
  }
  function destroy() { active?.destroy(); active = null; }
  document.addEventListener('pjax:send', destroy); document.addEventListener('pjax:complete', mount);
  window.SiteComments = Object.freeze({ mount, destroy });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();
