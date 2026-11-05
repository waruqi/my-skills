// Git 快照查看器：提交说明、当前文件过滤与真实补丁共用一个离线数据源。
window.initSourceHistory = ({data,currentFile,openSource}) => {
  const $=id=>document.getElementById(id), esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.SOURCE_HISTORY={};
  let scope=(data.history?.commits||[]).some(c=>c.deep)?'deep':'all',selection,selectedFile='',view='unified',request=0,explanationOpen=true,contentView='analysis';
  function refresh(){
    document.querySelectorAll('[data-history-scope]').forEach(b=>b.classList.toggle('active',b.dataset.historyScope===scope));
    const q=$('history-filter').value.toLowerCase();
    const entries=(data.history?.commits||[]).filter(c=>(scope==='all'||(scope==='deep'?c.deep:c.files.includes(currentFile())))&&(c.title+' '+c.id+' '+(c.analysisTitle||'')).toLowerCase().includes(q));
    $('history-list').innerHTML=entries.map(c=>`<button class="history-item" data-commit="${esc(c.id)}"><b>${esc(c.analysisTitle||c.title)}</b><small>${c.working?'工作区':c.id.slice(0,8)+' · '+c.date.slice(0,10)} · ${c.files.length} 文件${c.deep?' · 深度讲解':''}</small></button>`).join('')||'<p class="empty">此范围没有收录的改动。可切换整个项目；历史范围有限。</p>';
    $('history-scope-note').textContent=scope==='file'?currentFile()||'先打开一个文件':scope==='deep'?`已分析 ${(data.history?.commits||[]).filter(c=>c.deep).length} 个实际代码提交；不含纯文档或注释提交。`:data.history?.range||'尚未生成 Git 快照，请重新构建。';
  }
  async function selectCommit(id){
    const token=++request,meta=data.history?.commits.find(c=>c.id===id);if(!meta)return;
    $('history-dialog').showModal();$('history-content').innerHTML='<p class="empty">读取提交差异…</p>';
    try{
      if(!window.SOURCE_HISTORY[id])await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=meta.chunk;script.onload=()=>{script.remove();resolve();};script.onerror=()=>{script.remove();reject(new Error('Git 快照加载失败'));};document.head.append(script);});
      if(token!==request)return;selection=window.SOURCE_HISTORY[id];explanationOpen=true;contentView='analysis';selectedFile=selection.files.find(f=>f.file===currentFile())?.file||selection.files.find(f=>f.analyzed)?.file||selection.files[0]?.file;render();
    }catch(error){if(token===request)$('history-content').textContent=error.message;}
  }
  function diff(patch){
    let old=0,next=0,inHunk=false;const rows=[];
    for(const text of patch.split('\n')){
      const hunk=text.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if(hunk){inHunk=true;old=Number(hunk[1]);next=Number(hunk[2]);rows.push({kind:'hunk',text});continue;}
      if(!inHunk||text.startsWith('\\')){rows.push({kind:'meta',text});continue;}
      if(text.startsWith('-'))rows.push({kind:'delete',text:text.slice(1),old:old++});
      else if(text.startsWith('+'))rows.push({kind:'add',text:text.slice(1),next:next++});
      else if(text.startsWith(' '))rows.push({kind:'context',text:text.slice(1),old:old++,next:next++});
      else rows.push({kind:'meta',text});
    }
    if(view==='unified')return rows.map(r=>`<div class="diff-row ${r.kind}"><span>${r.old||''}</span><span>${r.next||''}</span><code>${r.kind==='add'?'+':r.kind==='delete'?'-':' '}${esc(r.text)}</code></div>`).join('');
    const result=[];
    const cell=(r,side)=>`<div class="diff-cell ${r?.kind||''}"><span>${r?.[side]||''}</span><code>${esc(r?.text||'')}</code></div>`;
    for(let i=0;i<rows.length;){const row=rows[i];if(row.kind==='add'||row.kind==='delete'){const removed=[],added=[];while(i<rows.length&&['add','delete'].includes(rows[i].kind)){const r=rows[i++];(r.kind==='delete'?removed:added).push(r);}for(let j=0;j<Math.max(removed.length,added.length);j++)result.push('<div class="diff-pair">'+cell(removed[j],'old')+cell(added[j],'next')+'</div>');}else{result.push(row.kind==='context'?'<div class="diff-pair">'+cell(row,'old')+cell(row,'next')+'</div>':`<div class="diff-meta">${esc(row.text)}</div>`);i++;}}
    return result.join('');
  }
  function render(){
    const c=selection,f=c.files.find(f=>f.file===selectedFile);
    $('history-content').dataset.view=contentView;
    $('history-content').innerHTML=`<div class=commit-bar><strong title="${esc(c.analysisTitle||c.title)}">${esc(c.analysisTitle||c.title)}</strong><nav aria-label="提交视图"><button data-history-toggle aria-pressed="${contentView==='analysis'}" title="显示或隐藏右侧讲解" aria-label="显示或隐藏右侧讲解">▥</button></nav></div><section class="commit-summary"><div class="pane-title">改动讲解<button data-history-toggle title="收起讲解" aria-label="收起讲解">×</button></div>${f?`<section class="diff-current-note"><small>当前文件 · ${f.analyzed?'源码分析':'自动统计'}</small><h3>${esc(f.file)}</h3><p>${esc(f.summary)}</p></section>`:''}<small>${c.working?'工作区对比 HEAD':esc(c.id+' · '+c.author+' · '+c.date)} · ${c.analyzed?'源码分析':'未人工分析'}</small><h2>${esc(c.analysisTitle||c.title)}</h2><p>${esc(c.summary)}</p>${c.deep?`<details class=deep-analysis ${explanationOpen?'open':''}><summary>深入讲解 · 执行过程、数据与设计</summary>${c.sections.map(section=>`<section><h3>${esc(section.title)}</h3><p>${esc(section.body)}</p></section>`).join('')}<nav class=deep-evidence>${c.files.filter(item=>item.analyzed).map(item=>`<button data-deep-diff="${esc(item.file)}">查看 diff · ${esc(item.file.split('/').pop())}</button>`).join('')}</nav></details>`:''}${c.body?`<details><summary>提交原文</summary><p>${esc(c.body)}</p></details>`:''}</section><div class="history-layout"><nav class="commit-files">${c.files.map(item=>`<button class="history-item ${item.file===selectedFile?'active':''}" data-diff-file="${esc(item.file)}"><b>${esc(item.file)}</b><small>+${esc(item.add)} −${esc(item.del)}${item.analyzed?' · 已讲解':''}</small></button>`).join('')}${c.totalFiles>c.files.length?'<p>文件清单已截断。</p>':''}</nav><section class="file-diff">${f?`<div class="diff-toolbar"><strong>${esc(f.file)}</strong><button data-diff-view="unified" aria-pressed="${view==='unified'}">统一</button><button data-diff-view="split" aria-pressed="${view==='split'}">左右</button><button data-history-source="${esc(f.file)}" title="查看当前快照源码">↗</button></div>${f.truncated?'<small class=diff-truncation>差异已截断</small>':''}<div class="diff-code">${diff(f.patch)}</div>`:'<p class="empty">没有已跟踪文件的改动。</p>'}</section></div>`;
    const layout=$('history-content').querySelector('.history-layout');
    const divider=document.createElement('div');divider.className='diff-explain-resizer';divider.setAttribute('role','separator');divider.setAttribute('aria-label','调整讲解栏宽度');
    layout.append(divider,$('history-content').querySelector('.commit-summary'));
    divider.onpointerdown=event=>{
      event.preventDefault();const start=event.clientX,width=layout.querySelector('.commit-summary').getBoundingClientRect().width;
      divider.setPointerCapture(event.pointerId);
      divider.onpointermove=move=>$('history-content').style.setProperty('--diff-notes',Math.max(260,Math.min(520,width+start-move.clientX))+'px');
      divider.onpointerup=divider.onpointercancel=()=>{divider.onpointermove=null;};
    };
  }
  document.addEventListener('click',event=>{
    const tab=event.target.closest('[data-side-tab]');if(tab){document.body.classList.toggle('show-history',tab.dataset.sideTab==='git');document.querySelectorAll('[data-side-tab]').forEach(b=>b.classList.toggle('active',b===tab));refresh();return;}
    const filter=event.target.closest('[data-history-scope]');if(filter){scope=filter.dataset.historyScope;document.querySelectorAll('[data-history-scope]').forEach(b=>b.classList.toggle('active',b===filter));refresh();return;}
    const commit=event.target.closest('[data-commit]');if(commit){selectCommit(commit.dataset.commit);return;}
    const toggle=event.target.closest('[data-history-toggle]');if(toggle){contentView=contentView==='analysis'?'diff':'analysis';$('history-content').dataset.view=contentView;document.querySelector('.commit-bar [data-history-toggle]').setAttribute('aria-pressed',String(contentView==='analysis'));return;}
    const evidence=event.target.closest('[data-deep-diff]');if(evidence){selectedFile=evidence.dataset.deepDiff;contentView='analysis';render();return;}
    const file=event.target.closest('[data-diff-file]');if(file){selectedFile=file.dataset.diffFile;render();return;}
    const mode=event.target.closest('[data-diff-view]');if(mode){view=mode.dataset.diffView;render();return;}
    const source=event.target.closest('[data-history-source]');if(source){$('history-dialog').close();openSource(source.dataset.historySource);return;}
    if(event.target.closest('[data-history-close]'))$('history-dialog').close();
  });
  document.addEventListener('toggle',event=>{if(event.target.matches?.('.deep-analysis'))explanationOpen=event.target.open;},true);
  $('history-dialog').addEventListener('close',()=>request++);
  $('history-filter').oninput=refresh;refresh();return refresh;
};
