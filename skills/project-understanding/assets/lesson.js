/* 连续讲解与自由查看共用已有图、动画和源码，不复制项目内容。 */
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
    const chapters = [...new Set(slides.map(s => s.chapter))];
    main.innerHTML = `<div class="lesson-shell"><nav class="lesson-bar" aria-label="讲解控制"><a class="lesson-home" href="#overview" title="回到讲解首页">首页</a><button data-lesson="back" title="返回刚才查看的页面">返回</button><button data-lesson="previous" ${cursor <= 0 ? 'disabled' : ''}>上一页</button><span class="lesson-count">${cursor < 0 ? '模块' : `${cursor + 1} / ${slides.length}`}</span><button data-lesson="next" ${cursor < 0 || cursor === slides.length - 1 ? 'disabled' : ''}>下一页</button><select aria-label="讲解目录"><option value="">按章节跳转</option>${chapters.map(chapter => `<optgroup label="${esc(chapter)}">${slides.map((s,i) => s.chapter === chapter ? `<option value="${i}" ${index === i ? 'selected' : ''}>${i+1}. ${esc(s.title)}</option>` : '').join('')}</optgroup>`).join('')}</select><details class="lesson-more"><summary>更多</summary><div><select aria-label="选择模块"><option value="">查看任意模块</option>${window.GUIDE.pages.filter(p => ['subsystem','module'].includes(p.kind)).map(p => `<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('')}</select><button data-lesson="resume">返回讲解进度</button><a href="#reference/${esc(page.id)}">文件与 Git</a></div></details><button data-lesson="focus">放大图</button><button data-lesson="fullscreen">全屏</button></nav><header class="lesson-title"><small>${esc(slide.chapter)}</small><h1>${esc(slide.title)}</h1></header><div class="lesson-stage"><div class="lesson-visual"></div><aside class="lesson-notes" aria-label="本页讲解"><div class="lesson-note"><div class="lesson-note-label">讲解 <button data-lesson="speak" disabled>朗读</button></div><p>${esc(slide.note)}</p>${slide.example ? `<pre>${esc(slide.example)}</pre>` : ''}</div><div class="lesson-live"></div><div class="lesson-code">${(slide.refs || []).map(ref => `<div class="code-evidence"><p>${esc(ref.note)}</p><button class="source-link" data-source="${esc(ref.path)}" data-line="${ref.line}">${esc(ref.path)}:${ref.line} · 完整源码</button><pre>${esc(ref.excerpt)}</pre></div>`).join('')}</div><button data-lesson="details">展开本页完整说明与数据</button></aside></div><div class="lesson-footer">${esc(slide.next || (index === null ? '点击图中模块继续下钻，或返回刚才的讲解。' : '看完这一页，点击下一页继续。'))}<span class="lesson-status" role="status"></span></div></div>`;
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
    const updateFullscreen = () => { fullscreenButton.textContent = document.fullscreenElement ? '退出全屏' : '全屏'; };
    updateFullscreen();document.addEventListener('fullscreenchange',updateFullscreen);
    const go = delta => { if (cursor >= 0 && slides[cursor+delta]) location.hash=`lesson/${cursor+delta}`; };
    main.querySelector('.lesson-shell').addEventListener('click', async event => {
      if (event.target.closest('.source-link')) { window.pauseWalkthrough?.();stopSpeech(); }
      const action = event.target.closest('[data-lesson]')?.dataset.lesson;
      if (action === 'back') { if (history.length > 1) history.back(); else location.hash='overview'; }
      if (action === 'focus') { const expanded = main.querySelector('.lesson-shell').classList.toggle('lesson-graph-only'); event.target.textContent = expanded ? '显示讲解' : '放大图'; }
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
    const keydown = event => {
      if (event.altKey || event.metaKey || event.ctrlKey || event.target.closest('input,select,textarea,button,a,[role=button],dialog') || document.querySelector('dialog[open]')) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {event.preventDefault();go(1);}
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {event.preventDefault();go(-1);}
    };
    const onVisibility = () => { if(document.hidden)stopSpeech(); };
    document.addEventListener('keydown',keydown);document.addEventListener('visibilitychange',onVisibility);
    window.disposeLesson = () => {
      stopSpeech();speech?.removeEventListener('voiceschanged',updateVoice);
      document.removeEventListener('fullscreenchange',updateFullscreen);document.removeEventListener('keydown',keydown);document.removeEventListener('visibilitychange',onVisibility);
      document.body.classList.remove('lesson-mode');window.navigateGuide=undefined;window.revealGuideSection=undefined;
    };
  };
})();
