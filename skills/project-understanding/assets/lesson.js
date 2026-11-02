/* 连续讲解与自由查看共用已有图、动画和源码，不复制项目内容。 */
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons = {
    home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
    back:'<path d="m9 4-6 6 6 6M3 10h11a7 7 0 0 1 0 14"/>',
    previous:'<path d="m14 5-7 7 7 7"/>', next:'<path d="m10 5 7 7-7 7"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
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
    const cleanups=[];
    const chapters = [...new Set(slides.map(s => s.chapter))];
    main.innerHTML = `<div class="lesson-shell"><nav class="lesson-bar" aria-label="讲解控制"><a class="lesson-home" href="#overview" title="回到讲解首页">首页</a><button data-lesson="back" title="返回刚才查看的页面">返回</button><button data-lesson="previous" ${cursor <= 0 ? 'disabled' : ''}>上一页</button><span class="lesson-count">${cursor < 0 ? '模块' : `${cursor + 1} / ${slides.length}`}</span><button data-lesson="next" ${cursor < 0 || cursor === slides.length - 1 ? 'disabled' : ''}>下一页</button><select aria-label="讲解目录"><option value="">按章节跳转</option>${chapters.map(chapter => `<optgroup label="${esc(chapter)}">${slides.map((s,i) => s.chapter === chapter ? `<option value="${i}" ${index === i ? 'selected' : ''}>${i+1}. ${esc(s.title)}</option>` : '').join('')}</optgroup>`).join('')}</select><details class="lesson-more"><summary>更多</summary><div><select aria-label="选择模块"><option value="">查看任意模块</option>${window.GUIDE.pages.filter(p => ['subsystem','module'].includes(p.kind)).map(p => `<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('')}</select><button data-lesson="resume">返回讲解进度</button><a href="#reference/${esc(page.id)}">文件与 Git</a></div></details><button data-lesson="focus">放大图</button><button data-lesson="fullscreen">全屏</button><button data-lesson="theme">夜间模式</button></nav><header class="lesson-title"><small>${esc(slide.chapter)}</small><h1>${esc(slide.title)}</h1></header><div class="lesson-stage"><div class="lesson-visual"></div><aside class="lesson-notes" aria-label="本页讲解"><div class="lesson-note"><div class="lesson-note-label">讲解 <button data-lesson="speak" disabled>朗读</button></div><p>${esc(slide.note)}</p>${slide.example ? `<pre>${esc(slide.example)}</pre>` : ''}</div><div class="lesson-live"></div><div class="lesson-code">${(slide.refs || []).map(ref => `<div class="code-evidence"><p>${esc(ref.note)}</p><button class="source-link" data-source="${esc(ref.path)}" data-line="${ref.line}">${esc(ref.path)}:${ref.line} · 完整源码</button><pre>${esc(ref.excerpt)}</pre></div>`).join('')}</div><button data-lesson="details">展开本页完整说明与数据</button></aside></div><div class="lesson-footer">${esc(slide.next || (index === null ? '点击图中模块继续下钻，或返回刚才的讲解。' : '看完这一页，点击下一页继续。'))}<span class="lesson-status" role="status"></span></div></div>`;
    for(const [selector,name,label] of [['.lesson-home','home','首页'],['[data-lesson=back]','back','返回刚才页面'],['[data-lesson=previous]','previous','上一页'],['[data-lesson=next]','next','下一页'],['.lesson-more>summary','more','更多'],['[data-lesson=focus]','focus','放大图']]) setIcon(main.querySelector(selector),name,label);
    const detailButton=main.querySelector('[data-lesson=details]');detailButton.innerHTML=icon('details')+'<span>详细说明</span>';detailButton.className='lesson-detail-link';
    const themeButton=main.querySelector('[data-lesson=theme]');
    const updateTheme=()=>{const dark=document.documentElement.dataset.theme==='dark';setIcon(themeButton,dark?'sun':'moon',dark?'切换日间模式':'切换夜间模式');themeButton.setAttribute('aria-pressed',String(dark));};updateTheme();
    main.querySelector('.lesson-visual').append(card);
    const svg = card.querySelector('svg');
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
    window.navigateGuide = id => { location.hash = `explore/${id}`; };
    window.revealGuideSection = openDetails;
    const speech = window.speechSynthesis;
    const speakButton = main.querySelector('[data-lesson=speak]');
    let utterance;
    const voice = () => speech?.getVoices().find(v => v.localService && v.lang.toLowerCase().startsWith('zh'));
    const updateVoice = () => { speakButton.disabled = !voice(); speakButton.title = voice() ? '使用系统本地中文语音' : '未检测到本地中文语音，可直接阅读文字讲解'; };
    updateVoice();speech?.addEventListener('voiceschanged',updateVoice);
    const stopSpeech = () => { if (utterance) speech.cancel();utterance = undefined;speakButton.textContent = '朗读'; };
    const fullscreenButton = main.querySelector('[data-lesson=fullscreen]');
    const updateFullscreen = () => { setIcon(fullscreenButton,document.fullscreenElement?'exit':'fullscreen',document.fullscreenElement?'退出全屏':'全屏'); };
    updateFullscreen();document.addEventListener('fullscreenchange',updateFullscreen);
    const go = delta => { if (cursor >= 0 && slides[cursor+delta]) location.hash=`lesson/${cursor+delta}`; };
    main.querySelector('.lesson-shell').addEventListener('click', async event => {
      if (event.target.closest('.source-link')) { window.pauseWalkthrough?.();stopSpeech(); }
      const action = event.target.closest('[data-lesson]')?.dataset.lesson;
      if (action === 'theme') { document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';try {localStorage.setItem('guide-theme',document.documentElement.dataset.theme);}catch {}updateTheme(); }
      if (action === 'back') { if (history.length > 1) history.back(); else location.hash='overview'; }
      if (action === 'focus') { const expanded = main.querySelector('.lesson-shell').classList.toggle('lesson-graph-only'); setIcon(main.querySelector('[data-lesson=focus]'),'focus',expanded?'显示讲解':'放大图'); }
      if (action === 'previous') go(-1);
      if (action === 'next') go(1);
      if (action === 'resume') location.hash = `lesson/${resume}`;
      if (action === 'details') openDetails();
      if (action === 'fullscreen') {
        try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
        catch { main.querySelector('.lesson-status').textContent = '浏览器未允许全屏；当前已隐藏侧栏，可用浏览器全屏快捷键。'; }
      }
      if (action === 'speak') {
        if (utterance) {stopSpeech();return;}
        const current = card.querySelector('.walkthrough-story') || main.querySelector('.walkthrough-story');
        utterance = new SpeechSynthesisUtterance(slide.note + '\n' + (current?.querySelector('p')?.textContent || ''));
        utterance.voice=voice();utterance.lang='zh-CN';utterance.onend=utterance.onerror=()=>{utterance=undefined;speakButton.textContent='朗读';};
        speakButton.textContent='停止朗读';speech.speak(utterance);
      }
    });
    main.querySelector('[aria-label="讲解目录"]').onchange = event => { if (event.target.value !== '') location.hash=`lesson/${event.target.value}`; };
    main.querySelector('[aria-label="选择模块"]').onchange = event => { if (event.target.value) location.hash=`explore/${event.target.value}`; };
    main.querySelectorAll('select').forEach(select=>enhanceSelect(select,cleanups));
    const keydown = event => {
      if (event.altKey || event.metaKey || event.ctrlKey || event.target.closest('input,select,textarea,button,a,[role=button],dialog') || document.querySelector('dialog[open]')) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {event.preventDefault();go(1);}
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {event.preventDefault();go(-1);}
    };
    const onVisibility = () => { if(document.hidden)stopSpeech(); };
    document.addEventListener('keydown',keydown);document.addEventListener('visibilitychange',onVisibility);
    window.disposeLesson = () => {
      cleanups.forEach(cleanup=>cleanup());
      stopSpeech();speech?.removeEventListener('voiceschanged',updateVoice);
      document.removeEventListener('fullscreenchange',updateFullscreen);document.removeEventListener('keydown',keydown);document.removeEventListener('visibilitychange',onVisibility);
      document.body.classList.remove('lesson-mode');window.navigateGuide=undefined;window.revealGuideSection=undefined;
    };
  };
})();
