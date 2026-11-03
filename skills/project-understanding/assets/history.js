/* Git 历史阅读：日志筛选、按需差异、分支对比和架构关联。 */
(() => {
  const h=window.GUIDE.history;
  window.HISTORY_DETAILS={};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let pageSize=50, generation=0, split=false, activeFile=0, loaded=null;
  const main=document.querySelector('main');
  const links=ids=>[...new Set(ids)].map(id=>{const p=window.GUIDE.pages.find(p=>p.id===id);return p?`<a href="#${esc(id)}">${esc(p.title)}</a>`:'';}).join(' ');
  const analysis=sha=>h.notes.find(n=>n.commit===sha);
  const choices=h.branches.map(b=>`<option value="${esc(b.name)}">${esc(b.name)}</option>`).join('');
  document.querySelector('#history-branch').innerHTML='<option value="">所有本地引用</option>'+choices;

  function list() {
    const query=document.querySelector('#history-query').value.toLowerCase();
    const branch=h.branches.find(b=>b.name===document.querySelector('#history-branch').value);
    const only=document.querySelector('#history-key-only').checked;
    const items=h.commits.filter(c=>(!branch||branch.commits.includes(c.id))&&(!only||analysis(c.id))&&[c.subject,c.id,c.author,...c.files.map(f=>f.name)].join(' ').toLowerCase().includes(query));
    document.querySelector('#history-count').textContent=`${items.length} 条 · ${h.since} 起`;
    document.querySelector('#history-log').innerHTML=items.slice(0,pageSize).map(c=>`<a class="commit-link ${location.hash==='#history/'+c.id?'selected':''}" href="#history/${c.id}"><small>${esc(c.id.slice(0,9))} · ${esc(c.date.slice(0,10))}${analysis(c.id)?' · 解读':''}</small><span>${esc(c.subject)}</span></a>`).join('')+(items.length>pageSize?'<button id="history-more">再显示 50 条</button>':'');
    document.querySelector('#history-more')?.addEventListener('click',()=>{pageSize+=50;list();});
  }
  for(const id of ['history-query','history-branch','history-key-only'])document.querySelector('#'+id).addEventListener('input',()=>{pageSize=50;list();});

  function diffRows(patch) {
    let old=0,newLine=0,inHunk=false;
    return patch.split('\n').map(text=>{
      const hunk=/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
      if(hunk){old=Number(hunk[1]);newLine=Number(hunk[2]);inHunk=true;return {kind:'hunk',text};}
      if(!inHunk||![' ','+','-'].includes(text[0]))return {kind:'meta',text};
      if(text[0]==='+')return {kind:'add',right:newLine++,text:text.slice(1)};
      if(text[0]==='-')return {kind:'del',left:old++,text:text.slice(1)};
      return {kind:'context',left:old++,right:newLine++,text:text.slice(1)};
    });
  }
  function fileView() {
    const file=loaded.files[activeFile];
    const host=document.querySelector('#diff-body');
    if(!file){host.innerHTML='<p class="empty-diff">两个版本的文件内容相同，没有代码差异。</p>';return;}
    const rows=diffRows(file.patch||'');
    const markup=rows.map(row=>{
      if(row.kind==='hunk'||row.kind==='meta')return `<div class="diff-banner">${esc(row.text)}</div>`;
      const code=window.highlightSourceText(row.text,file.name)||' ';
      return split?`<div class="diff-split"><div class="diff-cell ${row.kind==='del'?'del':''}"><b>${row.left??''}</b><code>${row.kind==='add'?'':code}</code></div><div class="diff-cell ${row.kind==='add'?'add':''}"><b>${row.right??''}</b><code>${row.kind==='del'?'':code}</code></div></div>`:`<div class="diff-row ${row.kind}"><b>${row.left??''}</b><b>${row.right??''}</b><em>${row.kind==='add'?'+':row.kind==='del'?'-':' '}</em><code>${code}</code></div>`;
    }).join('');
    host.innerHTML=`<header class="diff-file-head"><strong>${esc(file.name)}</strong><small>${esc(file.status)}${file.old!==file.name?' · 原路径 '+esc(file.old):''}</small></header><nav class="history-related">当前架构中的文件引用：${links(file.pages)||'暂无。文件路径关联不代表历史版本已有架构分析。'}</nav>${file.omitted?`<p>${esc(file.omitted)}</p>`:''}${file.truncated?'<p>大文件差异仅展示前 3000 行；可用下方 Git 命令查看完整差异。</p>':''}<div class="diff-code ${split?'split':''}">${markup}</div>`;
    document.querySelectorAll('[data-diff-file]').forEach(button=>button.classList.toggle('active',Number(button.dataset.diffFile)===activeFile));
  }
  window.renderHistory=async route=>{
    const token=++generation; document.querySelector('dialog').close();
    window.selectSidebarPanel('history');list();
    document.querySelector('#breadcrumbs').innerHTML='<a href="#overview">项目全景</a> / <a href="#history">Git 历史</a>';
    const key=decodeURIComponent(route.slice(8));
    const commit=h.commits.find(c=>c.id===key);
    const comparison=h.comparisons.find(c=>c.id===key);
    const item=commit||comparison;
    if(!item){
      main.innerHTML=`<header class="hero"><div class="eyebrow">Git 历史 · 本地只读快照</div><h1>从改动理解项目怎样走到今天</h1><p>${esc(h.since)} 至构建时，收录 ${h.commits.length} / ${h.total} 条提交。${h.commits.length<h.total?'达到数量上限，较早提交未收录。':''}差异与提交说明来自 Git；下面的关键解读仅覆盖标出的提交。</p></header><section class="history-card"><h2>分支停在哪个版本</h2><p>仅展示本机引用，未联网刷新。点击比较查看 HEAD → 分支 tip 的净变化；这不是 merge-base 差异。相同 SHA 表示两条引用指向同一版本。</p>${h.branches.map(b=>{const c=h.comparisons.find(v=>v.name===b.name);return `<div class="branch-line"><strong>${esc(b.name)}</strong><code>${b.tip.slice(0,12)}</code><span>领先 ${c.ahead} / 落后 ${c.behind}</span><a href="#history/${encodeURIComponent(c.id)}">与 HEAD 比较</a></div>`;}).join('')||'<p>仓库暂无提交或分支。</p>'}</section><section class="history-card"><h2>值得先看的改动</h2><div class="history-timeline">${h.notes.filter(n=>h.commits.some(c=>c.id===n.commit)).map(n=>`<article><a href="#history/${n.commit}">${esc(n.title)}</a><p>${esc(n.summary)}</p><nav>${links(n.pages||[])}</nav></article>`).join('')||'<p>当前只有 Git 事实记录，尚未添加人工核对的关键解读。</p>'}</div></section>`;
      window.scrollTo(0,0);return;
    }
    const note=analysis(key);
    main.innerHTML=`<header class="hero"><div class="eyebrow">${commit?'提交差异 · 相对第一父提交':'分支比较 · HEAD → 分支 tip'}</div><h1>${esc(commit?commit.subject:comparison.name)}</h1><p>${commit?`${esc(commit.author)} · 提交时间 ${esc(commit.date)} · 作者时间 ${esc(commit.authored)}`:`领先 HEAD ${comparison.ahead} 条 / 落后 ${comparison.behind} 条`}</p><code>${esc(commit?commit.id:comparison.base+' → '+comparison.tip)}</code></header>${commit?`<section class="history-card"><h2>${note?esc(note.title):'这次修改涉及哪里'}</h2>${note?`<p>${esc(note.summary)}</p><p>${esc(note.reason)}</p><p>${esc(note.impact)}</p><small>${esc(note.evidence)}</small><nav class="history-related">${links(note.pages||[])}</nav>`:'<p>这条提交尚未单独解读。下面提供 Git 原始说明、真实 diff 和基于文件路径的架构关联，不自动推断设计意图。</p>'}<details><summary>Git 原始提交说明</summary><pre>${esc(commit.body)}</pre></details><p>父提交：${commit.parents.map(p=>h.commits.some(c=>c.id===p)?`<a href="#history/${p}">${p.slice(0,12)}</a>`:esc(p.slice(0,12))+'（范围外）').join(' · ')||'无，根提交相对空树'}${commit.parents.length>1?'。这是合并提交，diff 采用第一父提交，不混淆为每条合并边的差异。':''}</p></section>`:''}<section class="history-card"><div class="diff-tools"><h2>代码差异</h2><button id="diff-layout">${split?'切换统一视图':'切换左右视图'}</button><label>文件筛选 <input id="diff-filter" type="search" placeholder="路径关键字"></label></div><div class="diff-files">${item.files.map((f,i)=>`<button data-diff-file="${i}">${esc(f.status)} · ${esc(f.name)}</button>`).join('')}</div><div id="diff-body"><p>正在读取本地差异…</p></div><details><summary>在本机查看完整 diff</summary><pre>git diff ${esc(commit?commit.base:comparison.base)} ${esc(commit?commit.id:comparison.tip)} --</pre></details></section>`;
    if(window.historyLessonReturn){const back=document.createElement('a');back.className='lesson-history-back';back.href=window.historyLessonReturn;back.textContent='← 返回这页改动讲解';main.prepend(back);}
    window.scrollTo(0,0);
    try {
      if(!window.HISTORY_DETAILS[key])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=item.chunk;script.onload=()=>{script.remove();resolve();};script.onerror=()=>{script.remove();reject(new Error('本地差异文件加载失败，请重新构建网站。'));};document.head.append(script);});
      if(token!==generation||location.hash.slice(1)!==route)return;
      loaded=window.HISTORY_DETAILS[key];activeFile=0;fileView();
      document.querySelector('#diff-layout').onclick=()=>{split=!split;document.querySelector('#diff-layout').textContent=split?'切换统一视图':'切换左右视图';fileView();};
      document.querySelector('#diff-filter').oninput=e=>document.querySelectorAll('[data-diff-file]').forEach(b=>b.hidden=!item.files[Number(b.dataset.diffFile)].name.toLowerCase().includes(e.target.value.toLowerCase()));
      document.querySelectorAll('[data-diff-file]').forEach(b=>b.onclick=()=>{activeFile=Number(b.dataset.diffFile);fileView();});
    } catch(error){if(token===generation&&document.querySelector('#diff-body'))document.querySelector('#diff-body').textContent=error.message;}
  };
  list();
})();
