// Shared by the browser and the chat service. No external vector database is required.
const STOP = new Set(['我','你','您','的','了','是','在','中','和','与','或','有','也','就','都','这','那','一个','一下','可以','能够','希望','现在','请','请问','帮我','帮忙','查看','看看','相关','内容','哪些','文章','博客','关于','介绍','什么','怎么','如何','搜索','联网','一下子','the','a','an','of','in','and','to','for','is']);
export function plainText(value) {
  return String(value || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);|&#(?:x[\da-f]+|\d+);/gi, entity => {
      const names = { '&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"', '&apos;':"'", '&nbsp;':' ' };
      if (names[entity]) return names[entity];
      const code = entity[2]?.toLowerCase() === 'x' ? parseInt(entity.slice(3),16) : parseInt(entity.slice(2),10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
    }).replace(/\s+/g, ' ').trim();
}
export function queryTerms(query) {
  const text = String(query).normalize('NFKC').toLowerCase();
  const words = text.match(/[a-z][a-z\d+#_.-]*/g) || [];
  const chinese = text.replace(/[a-z\d+#_.-]+/g, ' ');
  if (typeof Intl.Segmenter === 'function') {
    for (const part of new Intl.Segmenter('zh', {granularity:'word'}).segment(chinese)) {
      if (part.isWordLike && part.segment.length > 1 && !STOP.has(part.segment)) words.push(part.segment);
    }
  } else {
    for (const run of chinese.match(/[\p{Script=Han}]{2,}/gu) || []) for (let i=0;i<run.length-1;i++) words.push(run.slice(i,i+2));
  }
  return [...new Set(words.filter(word => !STOP.has(word) && word.length > 1))].slice(0,18);
}
export function preparePosts(data, origin) {
  const list = Array.isArray(data) ? data : data?.posts || data?.entries || [];
  return list.flatMap(post => {
    try {
      const url = new URL(post.url || post.path, origin);
      if (!['http:','https:'].includes(url.protocol) || url.origin !== new URL(origin).origin) return [];
      return [{title:plainText(post.title), url:url.href, content:plainText(post.content || post.text), lowerTitle:plainText(post.title).toLowerCase(), lower:plainText(post.content || post.text).toLowerCase()}];
    } catch { return []; }
  });
}
export function retrieve(posts, query, limit = 3) {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  const weights = terms.map(term => 1 + Math.log(1 + posts.length / (1 + posts.filter(p => p.lowerTitle.includes(term) || p.lower.includes(term)).length)));
  const ranked = posts.map(post => {
    let score = 0, coverage = 0;
    terms.forEach((term,i) => {
      const titleHit = post.lowerTitle.includes(term);
      const count = post.lower.split(term).length - 1;
      if (titleHit || count) { coverage++; score += weights[i] * ((titleHit ? 7 : 0) + Math.min(3,Math.log2(1+count))); }
    });
    return {post,coverage,score:score * (coverage / terms.length)};
  }).filter(hit => hit.score > 0).sort((a,b) => b.score - a.score);
  const coverage = ranked[0]?.coverage || 0;
  return ranked.filter(hit => hit.coverage >= Math.max(1,coverage-0.5) && hit.score >= ranked[0].score * .6).slice(0,limit).map(({post}) => {
    // Choose the densest relevant passage instead of always sending the article introduction.
    let best = 0, bestScore = -1;
    for (const term of terms) {
      let offset = post.lower.indexOf(term), count = 0;
      while (offset >= 0 && count++ < 80) {
        const start = Math.max(0,offset-180), window = post.lower.slice(start,start+1050);
        const score = terms.reduce((n,t,i) => n + (window.includes(t) ? weights[i] : 0) + Math.min(4,window.split(t).length-1)*.1,0);
        if (score > bestScore) {best = start; bestScore = score;}
        offset = post.lower.indexOf(term,offset+term.length);
      }
    }
    return {title:post.title,url:post.url,content:(best ? '…' : '') + post.content.slice(best,best+1100)};
  });
}
