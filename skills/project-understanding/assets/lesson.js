/* 连续讲解与自由查看共用已有图、动画和源码，不复制项目内容。 */
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons = {
    play:'<path d="m8 4 12 8-12 8z"/>',
    pause:'<path d="M8 5v14M16 5v14"/>',
    replay:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
    settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
    speak:'<path d="M11 4 6 8H3v8h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
    home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
    back:'<path d="m9 4-6 6 6 6M3 10h11a7 7 0 0 1 0 14"/>',
    previous:'<path d="m14 5-7 7 7 7"/>', next:'<path d="m10 5 7 7-7 7"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    history:'<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>',
    fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    exit:'<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5"/>',
    moon:'<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/>',
    focus:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M16 4v16"/>',
    details:'<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8m-8 4h6"/>',
    down:'<path d="m7 10 5 5 5-5"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;
  const setIcon = (button, name, label) => { button.innerHTML=icon(name);button.title=label;button.setAttribute('aria-label',label);button.classList.add('lesson-icon'); };
  window.setGuideIcon = setIcon;
  try { document.documentElement.dataset.theme = localStorage.getItem('guide-theme') || 'light'; } catch { document.documentElement.dataset.theme='light'; }
  // 保留 select 的值与 change 事件，交互使用统一的可搜索弹出菜单。
  function enhanceSelect(select, cleanups) {
    const trigger=document.createElement('button');trigger.type='button';trigger.className='guide-picker';
    trigger.setAttribute('aria-label',select.getAttribute('aria-label'));trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-haspopup','dialog');
    select.hidden=true;select.after(trigger);
    const update=()=>{trigger.innerHTML=`<span>${esc(select.selectedOptions[0]?.textContent || '选择')}</span>${icon('down')}`;};update();select.addEventListener('change',update);select.addEventListener('guide-value',update);
    let popup;
    const close=()=>{popup?.remove();popup=undefined;trigger.setAttribute('aria-expanded','false');};
    const outside=event=>{if(popup&&!popup.contains(event.target)&&!trigger.contains(event.target))close();};
    const open=()=>{
      if(popup){close();return;}
      window.pauseWalkthrough?.();popup=document.createElement('div');popup.className='guide-picker-popup';popup.setAttribute('role','dialog');popup.setAttribute('aria-label',select.getAttribute('aria-label'));
      popup.innerHTML='<input aria-label="筛选选项" placeholder="搜索…"><div class="guide-picker-items"></div>';document.body.append(popup);
      const box=trigger.getBoundingClientRect();popup.style.width=`${Math.min(420,innerWidth-16)}px`;popup.style.left=`${Math.max(8,Math.min(box.left,innerWidth-Math.min(420,innerWidth-16)-8))}px`;popup.style.top=`${Math.min(box.bottom+6,innerHeight-240)}px`;
      const list=popup.querySelector('.guide-picker-items');
      const draw=()=>{const query=popup.querySelector('input').value.toLowerCase();list.innerHTML='';let group='';for(const option of select.options){if(!option.value||!option.textContent.toLowerCase().includes(query))continue;const label=option.parentElement.tagName==='OPTGROUP'?option.parentElement.label:'';if(label&&label!==group){const heading=document.createElement('small');heading.textContent=label;list.append(heading);group=label;}const button=document.createElement('button');button.textContent=option.textContent;button.setAttribute('aria-current',String(option.selected));button.onclick=()=>{select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));close();trigger.focus();};list.append(button);}if(!list.children.length)list.textContent='没有匹配项';};
      draw();popup.querySelector('input').oninput=draw;popup.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();trigger.focus();}if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const items=[...list.querySelectorAll('button')];const at=items.indexOf(document.activeElement);items[(at+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus();}});
      trigger.setAttribute('aria-expanded','true');popup.querySelector('input').focus();
    };
    trigger.onclick=open;document.addEventListener('pointerdown',outside);window.addEventListener('resize',close);
    cleanups.push(()=>{close();document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',close);select.removeEventListener('change',update);select.removeEventListener('guide-value',update);});
  }
  let resume = 0;
  window.lessonRoute = route => {
    const lesson = window.GUIDE.lesson;
    if (!lesson) return null;
    if (route === 'overview' || route.startsWith('lesson/')) {
      const index = route === 'overview' ? 0 : Number(route.slice(7));
      if (!Number.isInteger(index) || !lesson.slides[index]) return {invalid:true};
      resume = index;
      return {index, slide:lesson.slides[index]};
    }
    if (route.startsWith('explore/')) {
      const page = window.GUIDE.pages.find(p => p.id === route.slice(8));
      if (!page) return {invalid:true};
      return {index:null, slide:{page:page.id, title:page.title, chapter:'自由查看', note:page.summary}};
    }
    const page = window.GUIDE.pages.find(p => p.id === route);
    if (page) {
      const index = lesson.slides.findIndex(s => s.page === page.id);
      if (index >= 0) { resume = index; return {index, slide:lesson.slides[index]}; }
    }
    return null;
  };
  window.renderLesson = (page, route) => {
    const main = document.querySelector('main');
    const slides = window.GUIDE.lesson.slides;
    const {slide, index} = route;
    const cursor = index === null ? slides.findIndex(item => item.page === page.id) : index;
    document.body.classList.add('lesson-mode');
    const diagrams = window.GUIDE.diagrams.filter(d => d.pages.includes(page.id));
    const diagramId = slide.diagram || page.walkthrough?.diagram || diagrams.find(d => !d.after).id;
    const card = [...main.querySelectorAll('.visual-card')].find(el => el.dataset.diagram === diagramId);
    const archive = document.createElement('div');
    archive.className = 'lesson-archive';
    while (main.firstChild) archive.append(main.firstChild);
    const refs=[];
    const seenRefs=new Set();
    const addRefs=(items,owner)=>{for(const ref of items){const key=ref.path+':'+ref.line;if(!seenRefs.has(key)){seenRefs.add(key);refs.push({...ref,owner});}}};
    addRefs(slide.refs||[],page.title);
    for(const step of (page.walkthrough?.steps||[]).slice(slide.steps?.[0]||0,slide.steps?slide.steps[1]+1:undefined)) addRefs((step.refs||[]).map(ref=>({...ref,note:ref.note||step.text})),step.title);
    if(!slide.refs?.length && !slide.diagram) addRefs(page.sections.flatMap(section=>section.refs||[]),page.title);
    addRefs(diagrams.filter(diagram=>diagram.id===diagramId).flatMap(diagram=>diagram.nodes.flatMap(node=>node.ref?[node.ref]:[])),page.title);
    if(!refs.some(ref=>/\.(ts|js|py|go|rs|cpp|c|java|mjs)$/.test(ref.path))){
      const queue=window.GUIDE.pages.filter(item=>item.parent===page.id);
      while(queue.length&&refs.length<8){const child=queue.shift();addRefs(child.sections.flatMap(section=>section.refs||[]),child.title);queue.push(...window.GUIDE.pages.filter(item=>item.parent===child.id));}
    }
    if(!refs.length) addRefs(page.sections.flatMap(section=>section.refs||[]),page.title);
    const isDocument=ref=>/\.(md|mdx|rst|adoc|txt)$/i.test(ref.path);
    refs.sort((a,b)=>Number(isDocument(a))-Number(isDocument(b)));
    const cleanups=[];
    const chapters = [...new Set(slides.map(s => s.chapter))];
    main.innerHTML = `<div class="lesson-shell ${slide.layout==='cover'?'lesson-cover':''}"><nav class="lesson-bar" aria-label="讲解控制"><a class="lesson-home" href="#overview" title="回到讲解首页">首页</a><button data-lesson="back" title="返回刚才查看的页面">返回</button><button data-lesson="previous" ${cursor <= 0 ? 'disabled' : ''}>上一页</button><span class="lesson-count">${cursor < 0 ? '模块' : `${cursor + 1} / ${slides.length}`}</span><button data-lesson="next" ${cursor < 0 || cursor === slides.length - 1 ? 'disabled' : ''}>下一页</button><select aria-label="讲解目录"><option value="">按章节跳转</option>${chapters.map(chapter => `<optgroup label="${esc(chapter)}">${slides.map((s,i) => s.chapter === chapter ? `<option value="${i}" ${index === i ? 'selected' : ''}>${i+1}. ${esc(s.title)}</option>` : '').join('')}</optgroup>`).join('')}</select><details class="lesson-more"><summary>更多</summary><div><select aria-label="选择模块"><option value="">查看任意模块</option>${window.GUIDE.pages.filter(p => ['subsystem','module'].includes(p.kind)).map(p => `<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('')}</select><button data-lesson="resume">返回讲解进度</button><a href="#reference/${esc(page.id)}">文件与 Git</a></div></details><button data-lesson="focus">放大图</button><button data-lesson="fullscreen">全屏</button><button data-lesson="theme">夜间模式</button></nav><header class="lesson-title"><small>${esc(slide.chapter)}</small><h1>${esc(slide.title)}</h1></header><div class="lesson-stage"><div class="lesson-visual"></div><aside class="lesson-notes" aria-label="本页讲解"><nav class="lesson-tabs" aria-label="讲解与代码"><button data-lesson="explain" aria-pressed="true">讲解</button><button data-lesson="code" aria-pressed="false">关键代码 <small>${refs.length}</small></button></nav><div class="lesson-note"><div class="lesson-note-label">讲解 <button data-lesson="speak" disabled>朗读</button></div>${slide.media ? `<figure class="lesson-preview"><button data-lesson="preview" aria-label="放大界面示例"><img src="${esc(slide.media.src)}" alt="${esc(slide.media.alt)}"></button><figcaption>${esc(slide.media.caption)}</figcaption></figure>` : ''}<p>${esc(slide.note)}</p>${slide.example ? `<pre>${esc(slide.example)}</pre>` : ''}</div>${slide.historyCommit ? `<a class="lesson-history-link" data-history-lesson href="#history/${esc(slide.historyCommit)}">查看这次提交的代码 diff ↗</a>` : ''}${slide.actions ? `<nav class="lesson-actions">${slide.actions.map(a=>`<a href="#${esc(a.route)}">${esc(a.label)}</a>`).join('')}</nav>` : ''}<div class="lesson-live"></div><div class="lesson-code">${refs.map(ref => `<div class="code-evidence"><small>${esc(ref.owner)}</small><p>${esc(ref.note || '对应实现；点击文件名查看完整上下文。')}</p><button class="source-link" data-source="${esc(ref.path)}" data-line="${ref.line}">${esc(ref.path)}:${ref.line} · ${isDocument(ref) ? "查看完整文档" : "查看完整源码"}</button><pre>${esc(ref.excerpt)}</pre></div>`).join('')}</div><button data-lesson="details">展开本页完整说明与数据</button></aside></div><div class="lesson-footer">${esc(slide.next || (index === null ? '点击图中模块继续下钻，或返回刚才的讲解。' : '看完这一页，点击下一页继续。'))}<span class="lesson-status" role="status"></span></div></div>`;
    for(const [selector,name,label] of [['.lesson-home','home','首页'],['[data-lesson=back]','back','返回刚才页面'],['[data-lesson=previous]','previous','上一页'],['[data-lesson=next]','next','下一页'],['.lesson-more>summary','more','更多'],['[data-lesson=focus]','focus','放大图']]) setIcon(main.querySelector(selector),name,label);
    const gitSlides=slides.map((s,i)=>s.historyCommit?i:-1).filter(i=>i>=0);
    if(gitSlides.length){
      const link=document.createElement('a');link.href=`#lesson/${gitSlides[0]}`;link.dataset.gitLesson='';
      setIcon(link,'history','Git 最近提交分析');main.querySelector('.lesson-more').before(link);
      if(slide.layout==='cover'){
        let actions=main.querySelector('.lesson-actions');
        if(!actions){actions=document.createElement('nav');actions.className='lesson-actions';main.querySelector('.lesson-note').after(actions);}
        const entry=document.createElement('a');entry.href=link.href;entry.textContent=`Git 最近提交分析 · ${gitSlides.length} 页`;actions.append(entry);
      }
    }
    if(slide.historyCommit){
      const diff=main.querySelector('.lesson-history-link');diff.textContent='查看 Git diff · 统一 / 左右对照 ↗';
      main.querySelector('.lesson-tabs').after(diff);
    }
    const detailButton=main.querySelector('[data-lesson=details]');detailButton.innerHTML=icon('details')+'<span>详细说明</span>';detailButton.className='lesson-detail-link';
    const themeButton=main.querySelector('[data-lesson=theme]');
    const updateTheme=()=>{const dark=document.documentElement.dataset.theme==='dark';setIcon(themeButton,dark?'sun':'moon',dark?'切换日间模式':'切换夜间模式');themeButton.setAttribute('aria-pressed',String(dark));};updateTheme();
    main.querySelector('.lesson-visual').append(card);
    const svg = card.querySelector('.atlas-svg');
    const bounds = svg.getBBox();
    svg.setAttribute('viewBox', `${bounds.x-18} ${bounds.y-18} ${bounds.width+36} ${bounds.height+36}`);
    const live = card.querySelector('.walkthrough-aside');
    if (live) main.querySelector('.lesson-live').append(live);
    const drawer = document.createElement('dialog');
    drawer.className = 'lesson-details';
    drawer.setAttribute('aria-label','完整说明与数据');
    drawer.innerHTML = '<nav class="lesson-detail-bar"><button class="lesson-close">返回讲解</button><a href="#overview">首页</a><span>完整说明与数据</span></nav>';
    drawer.append(archive);
    main.append(drawer);
    drawer.querySelector('.lesson-close').onclick = () => drawer.close();
    drawer.addEventListener('close', () => { main.querySelector('.lesson-shell').inert = false; main.querySelector('[data-lesson=details]').focus(); });
    drawer.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); drawer.close(); } });
    const openDetails = () => { window.pauseWalkthrough?.(); if (!drawer.open) { drawer.show(); main.querySelector('.lesson-shell').inert = true; drawer.querySelector('.lesson-close').focus(); } };
    window.navigateGuide = id => { const destination=slides.findIndex(item=>item.page===id);location.hash=destination>=0?`lesson/${destination}`:`explore/${id}`; };
    window.revealGuideSection = openDetails;
    const speech = window.speechSynthesis;
    const speakButton = main.querySelector('[data-lesson=speak]');
    setIcon(speakButton,'speak','朗读讲解');
    let utterance;
    const voice = () => speech?.getVoices().find(v => v.localService && v.lang.toLowerCase().startsWith('zh'));
    const updateVoice = () => { speakButton.disabled = !voice(); speakButton.title = voice() ? '使用系统本地中文语音' : '未检测到本地中文语音，可直接阅读文字讲解'; };
    updateVoice();speech?.addEventListener('voiceschanged',updateVoice);
    const stopSpeech = () => { if (utterance) speech.cancel();utterance = undefined;setIcon(speakButton,'speak','朗读讲解'); };
    const fullscreenButton = main.querySelector('[data-lesson=fullscreen]');
    const updateFullscreen = () => { setIcon(fullscreenButton,document.fullscreenElement?'exit':'fullscreen',document.fullscreenElement?'退出全屏':'全屏'); };
    updateFullscreen();document.addEventListener('fullscreenchange',updateFullscreen);
    const go = delta => { if (cursor >= 0 && slides[cursor+delta]) location.hash=`lesson/${cursor+delta}`; };
    main.querySelector('.lesson-shell').addEventListener('click', async event => {
      if (event.target.closest('[data-history-lesson]')) window.historyLessonReturn=location.hash;
      if (event.target.closest('.source-link')) { window.pauseWalkthrough?.();stopSpeech(); }
      const action = event.target.closest('[data-lesson]')?.dataset.lesson;
      if (action === 'code' || action === 'explain') {
        const showCode=action==='code';window.pauseWalkthrough?.();
        main.querySelector('.lesson-shell').classList.toggle('lesson-code-focus',showCode);
        main.querySelector('.lesson-shell').classList.remove('lesson-graph-only');
        main.querySelector('[data-lesson=code]').setAttribute('aria-pressed',String(showCode));
        main.querySelector('[data-lesson=explain]').setAttribute('aria-pressed',String(!showCode));
        main.querySelector('.lesson-notes').scrollTop=0;
      }
      if (action === 'theme') { document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';try {localStorage.setItem('guide-theme',document.documentElement.dataset.theme);}catch {}updateTheme(); }
      if (action === 'back') { if (history.length > 1) history.back(); else location.hash='overview'; }
      if (action === 'focus') { const expanded = main.querySelector('.lesson-shell').classList.toggle('lesson-graph-only'); setIcon(main.querySelector('[data-lesson=focus]'),'focus',expanded?'显示讲解':'放大图'); }
      if (action === 'previous') go(-1);
      if (action === 'next') go(1);
      if (action === 'resume') location.hash = `lesson/${resume}`;
      if (action === 'details') openDetails();
      if (action === 'preview') { openDetails();drawer.querySelector('figure')?.scrollIntoView({block:'center'}); }
      if (action === 'fullscreen') {
        try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
        catch { main.querySelector('.lesson-status').textContent = '浏览器未允许全屏；当前已隐藏侧栏，可用浏览器全屏快捷键。'; }
      }
      if (action === 'speak') {
        if (utterance) {stopSpeech();return;}
        const current = card.querySelector('.walkthrough-story') || main.querySelector('.walkthrough-story');
        utterance = new SpeechSynthesisUtterance(slide.note + '\n' + (current?.querySelector('p')?.textContent || ''));
        utterance.voice=voice();utterance.lang='zh-CN';utterance.onend=utterance.onerror=()=>{utterance=undefined;setIcon(speakButton,'speak','朗读讲解');};
        setIcon(speakButton,'stop','停止朗读');speech.speak(utterance);
      }
    });
    main.querySelector('[aria-label="讲解目录"]').onchange = event => { if (event.target.value !== '') location.hash=`lesson/${event.target.value}`; };
    main.querySelector('[aria-label="选择模块"]').onchange = event => { if (event.target.value) location.hash=`explore/${event.target.value}`; };
    main.querySelectorAll('select').forEach(select=>enhanceSelect(select,cleanups));
    const keydown = event => {
      if (event.altKey || event.metaKey || event.ctrlKey || event.target.closest('input,select,textarea,[contenteditable=true],dialog,.guide-picker-popup') || document.querySelector('dialog[open]')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown') {event.preventDefault();go(1);}
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {event.preventDefault();go(-1);}
    };
    const selectCode = event => {
      const {path,line}=event.detail;
      const target=[...main.querySelectorAll('.lesson-code .source-link')].find(button=>button.dataset.source===path&&Number(button.dataset.line)===line);
      if(!target)return;
      main.querySelector('[data-lesson=code]').click();
      main.querySelectorAll('.code-evidence').forEach(item=>item.classList.toggle('selected',item===target.closest('.code-evidence')));
      target.closest('.code-evidence').scrollIntoView({block:'start'});
      target.focus({preventScroll:true});
    };
    document.addEventListener('guide-code-ref',selectCode);
    const onVisibility = () => { if(document.hidden)stopSpeech(); };
    document.addEventListener('keydown',keydown);document.addEventListener('visibilitychange',onVisibility);
    window.disposeLesson = () => {
      document.removeEventListener('guide-code-ref',selectCode);
      cleanups.forEach(cleanup=>cleanup());
      stopSpeech();speech?.removeEventListener('voiceschanged',updateVoice);
      document.removeEventListener('fullscreenchange',updateFullscreen);document.removeEventListener('keydown',keydown);document.removeEventListener('visibilitychange',onVisibility);
      document.body.classList.remove('lesson-mode');window.navigateGuide=undefined;window.revealGuideSection=undefined;
    };
  };
})();
