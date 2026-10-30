/* 文件树与架构引用联动；未引用的文本文件按需从本地脚本块读取。 */
(() => {
  const guide=window.GUIDE;
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tree=document.querySelector('#file-tree');
  const query=document.querySelector('#file-query');
  const related=new Map();
  let selected='', request=0;
  function collect(value,page) {
    if (!value || typeof value!=='object') return;
    if (value.path && guide.sources[value.path]) {
      if (!related.has(value.path)) related.set(value.path,new Map());
      related.get(value.path).set(page.id,{title:page.title,line:value.line||1});
    }
    for(const [key,child] of Object.entries(value)) if(!['data','sample','media','excerpt'].includes(key)) collect(child,page);
  }
  guide.pages.forEach(page=>collect(page,page));
  guide.diagrams.forEach(diagram=>diagram.pages.forEach(id=>collect(diagram,guide.pages.find(p=>p.id===id))));

  function draw() {
    const term=query.value.trim().toLowerCase();
    const root={dirs:new Map(),files:[]};
    const visible=guide.files.filter(f=>f.name.toLowerCase().includes(term));
    for(const file of visible){
      const parts=file.name.split('/'); let dir=root;
      for(const part of parts.slice(0,-1)) {if(!dir.dirs.has(part))dir.dirs.set(part,{dirs:new Map(),files:[]});dir=dir.dirs.get(part);}
      dir.files.push(file);
    }
    const render=(dir,prefix='')=>[...dir.dirs].map(([name,child])=>`<details data-dir="${esc(prefix+name+'/')}" ${term||selected.startsWith(prefix+name+'/')?'open':''}><summary>${esc(name)}</summary>${render(child,prefix+name+'/')}</details>`).join('')+dir.files.map(f=>`<button class="file-item ${f.name===selected?'active':''}" data-file="${esc(f.name)}" title="${esc(f.name)}">${esc(f.name.split('/').pop())}${related.has(f.name)?'<small>图</small>':''}</button>`).join('');
    tree.innerHTML=render(root);
    document.querySelector('#file-count').textContent=`${visible.length} / ${guide.files.length} 个 Git 跟踪文件`;
    markPage();
  }
  function markPage(){
    document.querySelectorAll('#architecture-tree a').forEach(link=>{
      const active=link.hash===(location.hash||'#overview');
      if(active) {link.setAttribute('aria-current','page');let parent=link.parentElement;while(parent&&parent.id!=='architecture-tree'){if(parent.tagName==='DETAILS')parent.open=true;parent=parent.parentElement;}}
      else link.removeAttribute('aria-current');
    });
    const page=location.hash.slice(1)||'overview';
    tree.querySelectorAll('[data-file]').forEach(button=>button.classList.toggle('page-related',related.get(button.dataset.file)?.has(page)||false));
  }
  window.selectSourceFile=path=>{
    selected=path;
    if(query.value&&!path.toLowerCase().includes(query.value.toLowerCase()))query.value='';
    draw();
    const button=[...tree.querySelectorAll('[data-file]')].find(el=>el.dataset.file===path);
    if(button) tree.scrollTop=Math.max(0,button.offsetTop-tree.offsetTop-tree.clientHeight/2);
    const refs=related.get(path);
    document.querySelector('#source-related').innerHTML=refs?.size ? '相关讲解：'+[...refs].map(([id,ref])=>`<a href="#${esc(id)}">${esc(ref.title)} :${ref.line}</a>`).join(' ') : '该文件尚无架构讲解；可阅读源码或返回当前图。';
  };
  tree.addEventListener('click',async event=>{
    const button=event.target.closest('[data-file]');if(!button)return;
    const file=guide.files.find(f=>f.name===button.dataset.file);
    const token=++request;
    if(!file.readable){document.querySelector('#file-info').textContent=file.reason||'文件不可读取';document.querySelector('#file-original').href=file.fileUrl;document.querySelector('#file-original').hidden=false;return;}
    document.querySelector('#file-info').textContent='';document.querySelector('#file-original').hidden=true;
    if(!guide.sources[file.name]){
      document.querySelector('#file-info').textContent='正在读取源码…';
      try {await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=file.chunk;script.onload=()=>{script.remove();resolve();};script.onerror=()=>{script.remove();reject();};document.head.append(script);});}
      catch{document.querySelector('#file-info').textContent='源码块加载失败，请重新构建网站。';return;}
    }
    if(token!==request)return;
    document.querySelector('#file-info').textContent='';
    const refs=related.get(file.name);const page=location.hash.slice(1)||'overview';
    window.openSourceFile(file.name,refs?.get(page)?.line||1);
  });
  document.querySelector('#source-related').addEventListener('click',e=>{if(e.target.closest('a'))document.querySelector('dialog').close();});
  query.addEventListener('input',draw);
  query.addEventListener('keydown',e=>{if(e.key==='Enter')tree.querySelector('[data-file]')?.click();});
  let initiallyHidden=matchMedia('(max-width:850px)').matches;
  try { const saved=localStorage.getItem('atlas-sidebar-hidden'); if(saved!==null)initiallyHidden=saved==='true'; } catch { /* file 页面可能禁用存储，仍可切换。 */ }
  document.body.classList.toggle('files-hidden',initiallyHidden);
  document.querySelector('#toggle-files').setAttribute('aria-expanded',String(!initiallyHidden));
  document.querySelector('#toggle-files').onclick=()=>{const hidden=document.body.classList.toggle('files-hidden');document.querySelector('#toggle-files').setAttribute('aria-expanded',String(!hidden));try{localStorage.setItem('atlas-sidebar-hidden',String(hidden));}catch{/* 保留本次页面状态。 */}};
  new ResizeObserver(entries=>document.body.style.setProperty('--header-height',`${entries[0].target.getBoundingClientRect().height}px`)).observe(document.querySelector('.site-header'));
  document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='p'){e.preventDefault();document.querySelector('dialog').close();document.body.classList.remove('files-hidden');document.querySelector('#toggle-files').setAttribute('aria-expanded','true');switchPanel('files');query.focus();query.select();}});
  window.addEventListener('hashchange',markPage);
  function switchPanel(panel) {
    document.querySelector('#history-panel').hidden=panel!=='history';
    document.querySelector('#history-tab').setAttribute('aria-pressed',String(panel==='history'));
    document.querySelector('#architecture-panel').hidden=panel!=='nav';
    document.querySelector('#files-panel').hidden=panel!=='files';
    document.querySelector('#nav-tab').setAttribute('aria-pressed',String(panel==='nav'));
    document.querySelector('#files-tab').setAttribute('aria-pressed',String(panel==='files'));
  }
  window.selectSidebarPanel=switchPanel;
  const branch=parent=>guide.pages.filter(p=>p.parent===parent).map(p=>{
    const children=branch(p.id);
    const link=`<a href="#${esc(p.id)}">${esc(p.title)}</a>`;
    return children ? `<details ${p.parent===null?'open':''}><summary>${link}</summary>${children}</details>` : link;
  }).join('');
  document.querySelector('#architecture-tree').innerHTML=branch(null);
  document.querySelector('#architecture-tree').addEventListener('click',e=>{if(e.target.closest('a'))document.querySelector('dialog').close();});
  document.querySelector('#nav-tab').onclick=()=>switchPanel('nav');
  document.querySelector('#files-tab').onclick=()=>switchPanel('files');
  document.querySelector('#history-tab').onclick=()=>{switchPanel('history');document.querySelector('dialog').close();location.hash='history';};
  draw();
})();
