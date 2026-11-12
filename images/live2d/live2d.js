/* Blog adapter for LuoTian001/live2d-widget-AIChat. See UPSTREAM.md. */
(() => {
  'use strict';
  if (window.__ichigooriWidget) return;
  const api = window.__ichigooriWidget = {state:'starting'};
  const base = new URL('./', document.currentScript.src);
  const asset = name => new URL(name,base).href;
  const historyKey = 'ergoutree-ichigoori-history-v1';
  const storage = {
    get(key) {try {return localStorage.getItem(key);} catch {return null;}},
    set(key,value) {try {localStorage.setItem(key,value);} catch { /* private browsing */ }}
  };
  const el = (tag,classes,text) => {
    const node = document.createElement(tag);
    if (classes) node.className = classes;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const icons = {
    chat:'message-circle',face:'smile',motion:'activity',dynamic:'play',static:'pause',
    close:'x',clear:'trash-2',send:'send',web:'globe',neutral:'meh',happy:'smile',
    crying:'droplet',shy:'heart',sad:'frown',surprised:'circle-alert',
    Blink:'eye',Nod:'move-vertical',Shake:'move-horizontal',large:'zoom-in',small:'zoom-out'
  };
  function paintIcon(button,name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    for (const [key,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'})) svg.setAttribute(key,value);
    const use=document.createElementNS(svg.namespaceURI,'use');use.setAttribute('href',asset(`icons/sprite.svg#${icons[name] || icons.face}`));
    svg.append(use); button.replaceChildren(svg);
  }
  function button(name,label) {
    const node = el('button','ichigoori-icon'); node.type = 'button'; node.setAttribute('aria-label',label);
    // Accessibility labels only: no visible text or native text tooltips.
    paintIcon(node,name); return node;
  }
  function resource(name,type) {
    return new Promise((resolve,reject) => {
      const node = el(type === 'css' ? 'link' : 'script');
      if (type === 'css') {node.rel='stylesheet';node.href=asset(name);} else {node.src=asset(name);node.async=false;}
      node.onload=resolve; node.onerror=()=>reject(Error(`无法加载 ${name}`)); document.head.append(node);
    });
  }
  async function json(url) {
    const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    return response.json();
  }
  async function start() {
    const config=await json(asset('live2d.json?v=secondary-v4'));
    if (!config.enabled) {api.state='disabled';return;}
    await resource('widget.css','css');
    const root=el('aside','no-destroy');root.id='ichigoori-widget';root.setAttribute('aria-label',`${config.name}看板娘`);
    const stage=el('div','ichigoori-stage');stage.tabIndex=0;stage.setAttribute('role','button');stage.setAttribute('aria-label','显示人物工具');
    const portrait=el('img','ichigoori-portrait');portrait.src=asset(config.portrait);portrait.alt=`${config.name}静态立绘`;portrait.draggable=false;
    const canvas=el('canvas');canvas.id='live2d';canvas.width=440;canvas.height=720;canvas.hidden=true;canvas.setAttribute('aria-label',`${config.name}动态模型`);
    stage.append(portrait,canvas);
    const tools=el('div','ichigoori-tools');tools.setAttribute('aria-label','人物工具');tools.inert=true;
    const chatButton=button('chat','打开聊天'),poseButton=button('face','选择表情'),motionButton=button('motion','选择动作'),modeButton=button('static','切换静态立绘'),sizeButton=button('large','放大人物 30%'),hideButton=button('close','收起人物');
    tools.append(chatButton,poseButton,motionButton,modeButton,sizeButton,hideButton);
    const poses=el('div','ichigoori-poses'),motions=el('div','ichigoori-poses');poses.hidden=motions.hidden=true;
    poseButton.disabled=motionButton.disabled=true;
    const panel=el('section','ichigoori-chat');panel.id='ichigoori-chat';panel.hidden=true;panel.setAttribute('aria-label','人物聊天');
    chatButton.setAttribute('aria-controls',panel.id);chatButton.setAttribute('aria-expanded','false');
    const header=el('header');
    const webButton=button('web','开启联网搜索'),clearButton=button('clear','清空聊天'),closeButton=button('close','关闭聊天');
    const spacer=el('span','ichigoori-header-space');header.append(webButton,spacer,clearButton,closeButton);
    const messages=el('div','ichigoori-messages');messages.setAttribute('role','log');messages.setAttribute('aria-live','polite');
    const notice=el('p','ichigoori-notice','');notice.setAttribute('role','status');
    const form=el('form','ichigoori-form'),input=el('textarea'),submit=button('send','发送消息');
    input.rows=2;input.maxLength=1800;input.placeholder='想聊些什么？';input.setAttribute('aria-label','聊天消息');submit.type='submit';
    form.append(input,submit);panel.append(header,messages,notice,form);root.append(stage,tools,poses,motions,panel);document.body.append(root);
    let hidden=storage.get('ergoutree-ichigoori-hidden-v2')!=='false';
    let mode=storage.get('ergoutree-ichigoori-mode')==='static'?'static':'dynamic';
    let large=storage.get('ergoutree-ichigoori-large')==='true';
    const desktop=matchMedia(`(min-width:${config.desktopMinWidth||900}px)`);
    let web=storage.get('ergoutree-ichigoori-web')==='true',busy=false,ready=false,modelLoad=null,timer,indexPromise;
    let history;
    try {history=JSON.parse(storage.get(historyKey)||'[]');} catch {history=[];}
    history=Array.isArray(history)?history.filter(m=>['user','assistant'].includes(m?.role)&&typeof m.content==='string'&&m.content.length<=7000).slice(-12):[];
    const persist=()=>storage.set(historyKey,JSON.stringify(history.slice(-12)));
    const safeLink=value=>{try {const url=new URL(value,location.origin);return ['https:','http:'].includes(url.protocol)?url.href:null;} catch {return null;}};
    function textWithLinks(container,text) {
      const pattern=/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|\/posts\/[^\s)]+)\)|(https?:\/\/[^\s<>）)]+)/g;
      let offset=0;
      for (const match of text.matchAll(pattern)) {
        container.append(document.createTextNode(text.slice(offset,match.index)));
        const href=safeLink(match[2]||match[3]);
        if (href) {const a=el('a','',match[1]||match[3]);a.href=href;if(new URL(href).origin!==location.origin){a.target='_blank';a.rel='noopener noreferrer';}container.append(a);} else container.append(document.createTextNode(match[0]));
        offset=match.index+match[0].length;
      }
      container.append(document.createTextNode(text.slice(offset)));
    }
    function addMessage(role,text,status=false,sources=[]) {
      const bubble=el('div',`ichigoori-message ${role}`);textWithLinks(bubble,text);
      if(status)bubble.setAttribute('role','status');
      if(Array.isArray(sources)&&sources.length){const links=el('div','ichigoori-sources');for(const source of sources){const href=safeLink(source.url);if(!href)continue;const a=el('a','',source.title);a.href=href;if(new URL(href).origin!==location.origin){a.target='_blank';a.rel='noopener noreferrer';}links.append(a);}bubble.append(links);}
      messages.append(bubble);messages.scrollTop=messages.scrollHeight;return bubble;
    }
    function render(){messages.replaceChildren();if(!history.length)addMessage('assistant',config.chat.welcome);for(const m of history)addMessage(m.role,m.content,false,m.sources||[]);}
    function fadeTools(){tools.classList.remove('is-active');tools.inert=true;poses.hidden=motions.hidden=true;poseButton.setAttribute('aria-expanded','false');motionButton.setAttribute('aria-expanded','false');}
    function touch(reveal=false){clearTimeout(timer);if(reveal){tools.classList.add('is-active');tools.inert=false;}if(tools.classList.contains('is-active'))timer=setTimeout(fadeTools,config.toolbarTimeoutMs||5000);}
    function toggleChat(open){panel.hidden=!open;chatButton.setAttribute('aria-expanded',String(open));if(open){poses.hidden=motions.hidden=true;input.focus();ensureIndex().catch(()=>{});}}
    function syncGear(){const toggle=document.getElementById('ichigoori-toggle');if(toggle){toggle.setAttribute('aria-label',hidden?'显示人物':'收起人物');toggle.setAttribute('aria-pressed',String(!hidden));}}
    function updateMode(){
      portrait.hidden=mode==='dynamic'&&ready;canvas.hidden=!(mode==='dynamic'&&ready);
      if(window.live2d)window.live2d.paused=ready&&(hidden||mode==='static'||!desktop.matches);
      paintIcon(modeButton,mode==='dynamic'?'static':'dynamic');modeButton.setAttribute('aria-label',mode==='dynamic'?'切换静态立绘':'切换动态模型');modeButton.setAttribute('aria-pressed',String(mode==='static'));
      poseButton.disabled=motionButton.disabled=mode!=='dynamic'||!ready;
      if(ready&&!hidden&&mode==='dynamic')requestAnimationFrame(()=>window.live2d.resize());
      api.mode=mode;
    }
    function fitSize(){
      const factor=large?1.3:1;
      const height=Math.min(360*factor,Math.max(120,innerHeight-12));
      const width=220*height/360;
      root.style.setProperty('--mascot-width',`${width}px`);root.style.setProperty('--mascot-height',`${height}px`);
      paintIcon(sizeButton,large?'small':'large');sizeButton.setAttribute('aria-label',large?'恢复人物正常大小':'放大人物 30%');sizeButton.setAttribute('aria-pressed',String(large));
      if(ready&&!hidden&&mode==='dynamic'&&desktop.matches)requestAnimationFrame(()=>window.live2d.resize());
    }
    sizeButton.addEventListener('click',()=>{large=!large;storage.set('ergoutree-ichigoori-large',String(large));fitSize();});
    window.addEventListener('resize',fitSize,{passive:true});
    desktop.addEventListener('change',()=>{root.inert=hidden||!desktop.matches;updateMode();if(desktop.matches&&!hidden&&mode==='dynamic')loadModel();});
    function setHidden(value){hidden=value;root.classList.toggle('is-collapsed',hidden);root.inert=hidden||!desktop.matches;storage.set('ergoutree-ichigoori-hidden-v2',String(hidden));syncGear();if(hidden){toggleChat(false);fadeTools();}else if(mode==='dynamic'&&desktop.matches)loadModel();updateMode();api.hidden=hidden;}
    document.addEventListener('click',event=>{if(event.target.closest('#ichigoori-toggle'))setHidden(!hidden);});
    document.addEventListener('pjax:complete',syncGear);
    function petHead(){
      if(!ready||hidden||mode!=='dynamic'||!window.live2d?.petHead?.())return;
      stage.dataset.headPats=String(Number(stage.dataset.headPats||0)+1);
    }
    stage.addEventListener('click',event=>{touch(true);if(window.live2d?.hitTestHead?.(event.clientX,event.clientY))petHead();});
    stage.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();touch(true);petHead();chatButton.focus();}});
    for(const name of ['pointerdown','pointermove','keydown','focusin'])root.addEventListener(name,()=>touch());
    chatButton.addEventListener('click',()=>toggleChat(panel.hidden));closeButton.addEventListener('click',()=>toggleChat(false));hideButton.addEventListener('click',()=>setHidden(true));
    poseButton.addEventListener('click',()=>{toggleChat(false);poses.hidden=!poses.hidden;motions.hidden=true;poseButton.setAttribute('aria-expanded',String(!poses.hidden));});
    motionButton.addEventListener('click',()=>{toggleChat(false);motions.hidden=!motions.hidden;poses.hidden=true;motionButton.setAttribute('aria-expanded',String(!motions.hidden));});
    modeButton.addEventListener('click',()=>{mode=mode==='dynamic'?'static':'dynamic';storage.set('ergoutree-ichigoori-mode',mode);poses.hidden=motions.hidden=true;updateMode();if(mode==='dynamic')loadModel();});
    function syncWeb(){webButton.setAttribute('aria-pressed',String(web));webButton.setAttribute('aria-label',web?'关闭联网搜索':'开启联网搜索');}
    syncWeb();webButton.addEventListener('click',()=>{web=!web;storage.set('ergoutree-ichigoori-web',String(web));syncWeb();});
    clearButton.addEventListener('click',()=>{if(!busy){history=[];persist();render();notice.textContent='';}});
    root.addEventListener('keydown',event=>{if(event.key==='Escape'){toggleChat(false);fadeTools();stage.focus();}});
    input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&!busy){event.preventDefault();form.requestSubmit();}});
    function pageContext(){const article=document.querySelector(config.chat.pageSelector);if(!article)return '';const clone=article.cloneNode(true);clone.querySelectorAll('script,style,iframe,.comment-wrap').forEach(n=>n.remove());return `${document.title}\n${location.href}\n${clone.textContent.replace(/\s+/g,' ').slice(0,3200)}`;}
    async function ensureIndex(){
      if(!indexPromise)indexPromise=Promise.all([import(asset('retrieval.mjs')),json(config.chat.searchIndex)]).then(([search,data])=>({search,posts:search.preparePosts(data,location.origin)})).catch(error=>{indexPromise=null;throw error;});
      return indexPromise;
    }
    async function search(query){const {search,posts}=await ensureIndex();api.indexCount=posts.length;return search.retrieve(posts,query);}
    form.addEventListener('submit',async event=>{
      event.preventDefault();const text=input.value.trim();if(busy||!text)return;
      if(!config.chat.apiUrl){notice.textContent='聊天服务尚未配置';return;}
      busy=true;submit.disabled=clearButton.disabled=true;input.value='';
      history=history.slice(-Math.min(10,Math.max(0,(config.chat.maxHistory||12)-2)));history.push({role:'user',content:text});render();
      const waiting=addMessage('assistant','…',true);
      try {
        let matches=[],indexError=false;
        try {matches=await search(text);} catch {indexError=true;}
        const response=await fetch(config.chat.apiUrl,{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(60000),body:JSON.stringify({messages:history.map(({role,content})=>({role,content})),context:{page:pageContext(),matches,indexStatus:indexError?'unavailable':'ready'},webSearch:web})});
        const data=await response.json();if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);
        const content=data.choices?.[0]?.message?.content;if(typeof content!=='string'||!content.trim())throw Error('聊天服务返回了空内容');
        const sources=[...matches.map(p=>({title:p.title,url:p.url})),...(data.sources||[])].filter((item,i,all)=>all.findIndex(other=>other.url===item.url)===i).slice(0,8);
        waiting.remove();history.push({role:'assistant',content:content.slice(0,7000),sources});addMessage('assistant',content.slice(0,7000),false,sources);persist();
        if(mode==='dynamic'&&Object.hasOwn(config.expressions,data.emotion))window.live2d?.setExpression?.(data.emotion);
        notice.textContent=[indexError?'文章索引暂时不可用':matches.length?`已参考 ${matches.length} 篇博客文章`:'未检索到相关博客文章',data.search?.status==='ok'?'已联网检索':data.search?.status==='empty'?'联网搜索无结果':data.search?.status==='error'?'联网搜索暂时不可用':''].filter(Boolean).join(' · ');
      } catch(error){history.pop();waiting.textContent=error.name==='TimeoutError'?'连接超时，请重试':error.message;waiting.classList.add('error');input.value=text;}
      finally{busy=false;submit.disabled=clearButton.disabled=false;}
    });
    async function loadModel(){
      if(ready||modelLoad||!config.model.enabled)return modelLoad;
      modelLoad=(async()=>{
        try {
          if(!canvas.getContext('webgl2'))throw Error('WebGL2 不可用');
          await resource('dynamics.js?v=secondary-v4','js');await resource('Core/live2dcubismcore.js','js');await resource('Core/live2d-sdk.js?v=secondary-v4','js');
          canvas.hidden=false;canvas.style.visibility='hidden';window.live2d.anchorBottom=true;window.live2d.init();window.live2d.paused=false;window.live2d.loadModel(asset(config.model.directory));
          await new Promise((resolve,reject)=>{const deadline=Date.now()+(config.model.loadTimeoutMs||20000);const poll=()=>{if(window.live2d.isReady())return resolve();if(Date.now()>deadline)return reject(Error('模型加载超时'));setTimeout(poll,100);};poll();});
          ready=true;canvas.style.visibility='visible';api.state='model';window.live2d.setExpression('neutral');
          const caps=window.live2d.capabilities();
          for(const [name,label] of Object.entries(config.expressions)){if(!caps.expressions.includes(name))continue;const b=button(name,label);b.addEventListener('click',()=>window.live2d.setExpression(name));poses.append(b);}
          for(const [name,label] of Object.entries(config.motions)){if(!caps.motions.includes(name))continue;const b=button(name,label);b.addEventListener('click',()=>window.live2d.startMotion(name));motions.append(b);}
          updateMode();
        } catch(error){canvas.hidden=true;portrait.hidden=false;if(window.live2d)window.live2d.paused=true;api.state='fallback';console.warn('[苺氷] 使用静态立绘：',error.message);}
      })();
      return modelLoad;
    }
    Object.assign(api,{config,root,search,setHidden});render();fitSize();setHidden(hidden);updateMode();if(api.state==='starting')api.state='static';
  }
  const begin=()=>start().catch(error=>{api.state='error';console.warn('[苺氷] 挂件加载失败：',error.message);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true});else begin();
})();
