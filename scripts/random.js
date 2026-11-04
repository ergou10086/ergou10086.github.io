(() => {
  'use strict';
  if (window.randomPost) return;
  const script = document.currentScript;
  const base = new URL('../', script.src);
  const randomPath = new URL('random/', base).pathname;
  let list;
  window.randomPost = async ({ replace = false } = {}) => {
    if (!list) list = fetch(new URL('random-posts.json', base)).then(response => {
      if (!response.ok) throw new Error(`Article list: ${response.status}`);
      return response.json();
    }).catch(error => { list = null; throw error; });
    const posts = (await list).map(value => new URL(value, base)).filter(url => url.origin === location.origin);
    const alternatives = posts.filter(url => url.pathname !== location.pathname);
    const candidates = alternatives.length ? alternatives : posts;
    if (!candidates.length) throw new Error('No published articles');
    const target = candidates[Math.floor(Math.random() * candidates.length)].href;
    replace ? location.replace(target) : location.assign(target);
  };
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname !== randomPath) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.randomPost().catch(error => {
      console.warn('[random]', error);
      if (window.btf?.snackbarShow) btf.snackbarShow('随机文章暂时不可用，请稍后重试');
    });
  }, true);
})();
