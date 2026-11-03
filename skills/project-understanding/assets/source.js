/* 离线源码阅读：语法着色、行定位、查找与本地编辑器链接。 */
(() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dialog = document.querySelector('#source-dialog');
  const code = document.querySelector('#source-code');
  let path = '', lines = [], current = 1, keyLine = 1, matches = [], matchIndex = -1;
  const keywords = new Set('async await break case catch class const continue default delete do else enum export extends false finally for from function if implements import in interface let new null of private protected public readonly return static super switch this throw true try type typeof undefined var void while yield def None True False elif except lambda pass raise with as fn pub impl struct use mut match mod trait self return package func defer go select map range'.split(' '));

  function highlight(text, filename) {
    const plain = /\.(md|txt)$/i.test(filename);
    if (plain) return esc(text);
    // Tokenize before escaping; comments and strings cannot inject markup.
    const tokens = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b/g;
    let html = '', end = 0;
    for (const m of text.matchAll(tokens)) {
      html += esc(text.slice(end,m.index));
      const token=m[0];
      const kind = /^(\/\/|\/\*|#)/.test(token) ? 'comment' : /^["'`]/.test(token) ? 'string' : /^\d/.test(token) ? 'number' : keywords.has(token) ? 'keyword' : /^\s*\(/.test(text.slice(m.index+token.length)) ? 'function' : '';
      html += token.split('\n').map(part=>kind ? `<i class="syntax-${kind}">${esc(part)}</i>` : esc(part)).join('\n');
      end=m.index+token.length;
    }
    return html+esc(text.slice(end));
  }

  window.highlightSourceText = highlight;

  function rows(text, filename, start, focus) {
    return highlight(text,filename).split('\n').map((line,i)=>`<span class="code-row ${start+i===focus?'key-line':''}" data-line="${start+i}"><button class="line-number" data-goto="${start+i}" aria-label="定位第 ${start+i} 行">${start+i}</button><code>${line || ' '}</code></span>`).join('');
  }

  function annotationMarkup(note, line, target, owner) {
    return `<span class="code-annotation" data-note-line="${line}"><small>讲解 · 第 ${line} 行（非源码）</small><span>${esc(note)}</span>${target ? `<a href="#${esc(target)}">${esc(owner)} ↗</a>` : ''}</span>`;
  }

  window.decorateSourceExcerpts = () => {
    document.querySelectorAll('.code-evidence').forEach(box=>{
      const ref=box.querySelector('[data-source]');
      const pre=box.querySelector('pre');
      if (!ref || !pre) return;
      pre.classList.add('source-excerpt');
      pre.innerHTML=rows(pre.textContent,ref.dataset.source,Number(ref.dataset.line),Number(ref.dataset.line));
      const note=box.querySelector(':scope > p');
      if(note?.textContent){pre.querySelector('.code-row')?.insertAdjacentHTML('afterend',annotationMarkup(note.textContent,Number(ref.dataset.line)));note.hidden=true;}
    });
  };

  function jump(line) {
    if (!Number.isInteger(line) || line<1 || line>lines.length) {
      document.querySelector('#source-status').textContent=`请输入 1–${lines.length} 的行号`; return;
    }
    current=line;
    showAnnotation(line);
    code.querySelector('.current-line')?.classList.remove('current-line');
    const row=code.querySelector(`[data-line="${line}"]`);
    row.classList.add('current-line');
    document.querySelector('#source-line').value=line;
    row.scrollIntoView({block:'center',inline:'nearest'});
    const snapshot=window.GUIDE.sources[path];
    const editor=document.querySelector('#source-editor').value;
    document.querySelector('#open-editor').href=`${editor}://file${encodeURI(snapshot.absolutePath).replace(/#/g,'%23').replace(/\?/g,'%3F')}:${line}:1`;
    document.querySelector('#source-status').textContent=`第 ${line} / ${lines.length} 行 · 点击行号定位 · 金色标记为引用入口`;
  }

  function find(direction) {
    const query=document.querySelector('#source-query').value.toLowerCase();
    matches=query ? lines.flatMap((line,i)=>line.toLowerCase().includes(query)?[i+1]:[]) : [];
    code.querySelectorAll('.search-line').forEach(el=>el.classList.remove('search-line'));
    matches.forEach(line=>code.querySelector(`[data-line="${line}"]`).classList.add('search-line'));
    if (!matches.length) { document.querySelector('#source-matches').textContent=query?'没有匹配':'输入文本查找'; return; }
    matchIndex=(matchIndex+direction+matches.length)%matches.length;
    jump(matches[matchIndex]);
    document.querySelector('#source-matches').textContent=`${matchIndex+1} / ${matches.length} 个匹配行`;
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); document.querySelector('#source-status').textContent='已复制'; }
    catch { document.querySelector('#source-status').textContent='浏览器不允许剪贴板访问，请选中文本复制'; }
  }

  document.addEventListener('click',event=>{
    const ref=event.target.closest('[data-source]');
    const number=event.target.closest('[data-goto]');
    if (!ref && !number) return;
    if (number && number.closest('#source-code')) { jump(Number(number.dataset.goto)); return; }
    const link=ref || number.closest('.code-evidence').querySelector('[data-source]');
    window.openSourceFile(link.dataset.source,number?Number(number.dataset.goto):Number(link.dataset.line));
  });
  window.openSourceFile = (filename,line=1) => {
    path=filename;
    const snapshot=window.GUIDE.sources[path];
    lines=snapshot.text.split('\n'); keyLine=line; matchIndex=-1;
    document.querySelector('#source-title').textContent=path;
    document.querySelector('#source-meta').textContent=`构建时源码快照 · ${window.GUIDE.revision.slice(0,12)} · ${lines.length} 行`;
    document.querySelector('#source-meta').title=`SHA-256 ${snapshot.sha256}`;
    document.querySelector('#source-location').textContent=snapshot.absolutePath;
    document.querySelector('#source-file').href=snapshot.fileUrl;
    document.querySelector('#source-query').value='';
    document.querySelector('#source-matches').textContent='';
    code.innerHTML=rows(snapshot.text,path,1,keyLine);
    indexSource();
    dialog.classList.toggle('source-outline-hidden',matchMedia('(max-width:720px)').matches);
    document.querySelector('#source-outline-toggle').setAttribute('aria-pressed',String(!dialog.classList.contains('source-outline-hidden')));
    window.selectSourceFile(path);
    if (!dialog.open) dialog.show();
    jump(line);
    code.focus({preventScroll:true});
  };
  document.querySelector('#close-source').onclick=()=>dialog.close();
  document.querySelector('#jump-source').onclick=()=>jump(Number(document.querySelector('#source-line').value));
  document.querySelector('#source-line').onkeydown=e=>{if(e.key==='Enter') jump(Number(e.target.value));};
  document.querySelector('#find-source').onclick=()=>find(1);
  document.querySelector('#previous-source').onclick=()=>find(-1);
  document.querySelector('#source-query').oninput=()=>{matchIndex=-1;find(1);};
  document.querySelector('#source-query').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();find(e.shiftKey?-1:1);}};
  document.querySelector('#source-key').onclick=()=>jump(keyLine);
  document.querySelector('#source-editor').onchange=()=>jump(current);
  document.querySelector('#source-wrap').onclick=e=>{const active=code.classList.toggle('wrap');e.currentTarget.setAttribute('aria-pressed',String(active));};
  document.querySelector('#source-copy').onclick=()=>copy(lines.join('\n'));
  document.querySelector('#location-copy').onclick=()=>copy(`${window.GUIDE.sources[path].absolutePath}:${current}`);
  // 引用讲解与语法树符号分别索引，避免把自动识别的声明冒充架构分析。
  let symbols=[], annotations=[], pane='symbols';
  const $=selector=>document.querySelector(selector);
  const glyphs={
    sidebar:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    key:'<path d="M6 4h12v17l-6-4-6 4z"/>',
    wrap:'<path d="M3 6h18M3 11h14a4 4 0 0 1 0 8h-5m3-3-3 3 3 3M3 17h4"/>',
    copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    full:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    exit:'<path d="M3 8h5V3m8 0v5h5M8 21v-5H3m13 5v-5h5"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    up:'<path d="m5 14 7-7 7 7"/>',down:'<path d="m5 10 7 7 7-7"/>'
  };
  const sourceIcon=(id,name,title)=>{const el=$('#'+id);el.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyphs[name]}</svg>`;el.title=title;el.setAttribute('aria-label',title);};
  for(const [id,name,title] of [['source-outline-toggle','sidebar','显示或隐藏符号导航'],['source-search-toggle','search','查找与跳行 · Ctrl / ⌘ F'],['source-key','key','返回引用入口'],['source-wrap','wrap','自动换行'],['source-copy','copy','复制源码'],['source-more-toggle','more','路径与编辑器'],['source-fullscreen','full','全屏阅读源码'],['close-source','close','关闭源码 · Esc'],['previous-source','up','上一个匹配'],['find-source','down','下一个匹配'],['source-search-close','close','收起查找']])sourceIcon(id,name,title);
  function collectAnnotations(value, owner, target) {
    if (!value || typeof value!=='object') return;
    if(value.path===path && value.note && value.line) annotations.push({line:value.line,end:value.line+(value.excerpt?.split('\n').length||1)-1,note:value.note,owner,target});
    for(const [key,child] of Object.entries(value))if(!['data','sample','media','excerpt'].includes(key))collectAnnotations(child,owner,target);
  }
  function indexSource() {
    const index=window.GUIDE.symbols?.[path];
    symbols=index?.items||[];
    if(!index){
      const patterns=[/^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:fn|def|func|function)\s+([\w$]+)/,/^\s*(?:export\s+)?(?:class|interface|struct|trait|type)\s+([\w$]+)/];
      lines.forEach((text,i)=>{for(const pattern of patterns){const m=pattern.exec(text);if(m){symbols.push({name:m[1],kind:'声明',line:i+1,end:i+1,depth:0,parent:''});break;}}});
    }
    $('#source-symbol-mode').textContent=index?index.mode+' · 当前文件声明':'文本扫描 · 可能不完整';
    annotations=[];
    window.GUIDE.pages.forEach(p=>collectAnnotations(p,p.title,p.id));
    window.GUIDE.diagrams.forEach(g=>collectAnnotations(g,g.title,g.pages[0]));
    const seen=new Set();annotations=annotations.filter(a=>{const key=a.line+':'+a.note;if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>a.line-b.line);
    $('#source-outline-query').value='';
    for(const a of annotations){
      const row=code.querySelector(`[data-line="${a.line}"]`);
      row?.classList.add('annotated-line');
      row?.insertAdjacentHTML('afterend',annotationMarkup(a.note,a.line,a.target,a.owner));
    }
    drawOutline();
  }
  function drawOutline() {
    const query=$('#source-outline-query').value.toLowerCase();
    const items=pane==='symbols'?symbols:annotations;
    $('#source-outline-list').innerHTML=items.filter(a=>(pane==='symbols'?a.name+' '+a.parent:a.note+' '+a.owner).toLowerCase().includes(query)).map(a=>`<button data-outline-line="${a.line}" title="${esc(pane==='symbols'?a.parent?`${a.parent}.${a.name}`:a.name:a.note)}" style="--depth:${Math.min(a.depth||0,4)}"><small>${esc(pane==='symbols'?a.kind:'讲解')}</small><span>${esc(pane==='symbols'?a.name:a.owner)}</span><em>${a.line}</em></button>`).join('')||'<p class="source-empty">没有匹配的'+(pane==='symbols'?'声明。':'已分析代码位置。')+'</p>';
    $('#source-symbols-tab').textContent=`符号 ${symbols.length}`;
    $('#source-notes-tab').textContent=`讲解 ${annotations.length}`;
    $('#source-symbols-tab').setAttribute('aria-pressed',String(pane==='symbols'));
    $('#source-notes-tab').setAttribute('aria-pressed',String(pane==='notes'));
  }
  function showAnnotation(line) {
    const found=annotations.filter(a=>line>=a.line&&line<=a.end);
    $('#source-annotation').hidden=true;
    code.querySelectorAll('.annotation-range').forEach(row=>row.classList.remove('annotation-range'));
    for(const a of found)for(let n=a.line;n<=a.end;n++)code.querySelector(`[data-line="${n}"]`)?.classList.add('annotation-range');
    code.querySelectorAll('.code-annotation').forEach(note=>note.classList.toggle('active',found.some(a=>a.line===Number(note.dataset.noteLine))));
    const active=symbols.filter(s=>s.line<=line&&s.end>=line).at(-1);
    $('#source-current-symbol').textContent=active?active.name:'';
    $('#source-outline-list').querySelectorAll('button').forEach(b=>b.setAttribute('aria-current',String(Number(b.dataset.outlineLine)===(pane==='symbols'?active?.line:found[0]?.line))));
  }
  $('#source-outline-list').onclick=e=>{const b=e.target.closest('[data-outline-line]');if(b)jump(Number(b.dataset.outlineLine));};
  $('#source-outline-query').oninput=drawOutline;
  $('#source-symbols-tab').onclick=()=>{pane='symbols';drawOutline();showAnnotation(current);};
  $('#source-notes-tab').onclick=()=>{pane='notes';drawOutline();showAnnotation(current);};
  $('#source-outline-toggle').onclick=()=>{const hidden=dialog.classList.toggle('source-outline-hidden');$('#source-outline-toggle').setAttribute('aria-pressed',String(!hidden));};
  const openSearch=()=>{$('#source-search').hidden=false;$('#source-query').focus();};
  $('#source-search-toggle').onclick=openSearch;
  $('#source-search-close').onclick=()=>{$('#source-search').hidden=true;code.focus();};
  $('#source-more-toggle').onclick=()=>{const menu=$('#source-more');menu.hidden=!menu.hidden;$('#source-more-toggle').setAttribute('aria-expanded',String(!menu.hidden));};
  dialog.addEventListener('click',e=>{const editor=e.target.closest('[data-editor]');if(editor){$('#source-editor').value=editor.dataset.editor;jump(current);$('#open-editor').click();}if(e.target.closest('.code-annotation a'))dialog.close();});
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('#source-more,#source-more-toggle'))$('#source-more').hidden=true;});
  let sourceFullscreen=false;
  const updateFull=()=>{if(!document.fullscreenElement)sourceFullscreen=false;dialog.classList.toggle('reader-fullscreen',sourceFullscreen);sourceIcon('source-fullscreen',sourceFullscreen?'exit':'full',sourceFullscreen?'退出源码全屏':'全屏阅读源码');};
  $('#source-fullscreen').onclick=async()=>{try{if(sourceFullscreen)await document.exitFullscreen();else {await document.documentElement.requestFullscreen();sourceFullscreen=true;}}catch{$('#source-status').textContent='浏览器未允许全屏，可使用浏览器全屏快捷键。';}updateFull();};
  document.addEventListener('fullscreenchange',updateFull);
  dialog.addEventListener('close',()=>{if(sourceFullscreen)document.exitFullscreen().catch(()=>{});$('#source-more').hidden=true;});
  dialog.addEventListener('keydown',e=>{
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='f'){e.preventDefault();e.stopPropagation();openSearch();return;}
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!$('#source-more').hidden)$('#source-more').hidden=true;else if(!$('#source-search').hidden)$('#source-search').hidden=true;else dialog.close();return;}
    if(e.altKey||e.metaKey||e.ctrlKey||e.target.closest('input,textarea,[contenteditable=true]'))return;
    if(['ArrowDown','ArrowRight','PageDown','ArrowUp','ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();e.stopPropagation();code.scrollBy({top:(['ArrowUp','ArrowLeft','PageUp'].includes(e.key)?-1:1)*code.clientHeight*.85,behavior:'instant'});}
  });

})();
