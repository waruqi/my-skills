// 离线源码浏览、静态关系与人工讲解共用同一定位，不执行项目代码。
(() => {
  'use strict';
  const D = window.SOURCE_INDEX, $ = id => document.getElementById(id);
  if(D.packed){
    D.refs=D.refs.map(r=>({file:D.files[r[0]].id,line:r[1],col:r[2],length:r[3],targets:r[4].map(i=>D.symbols[i].id),owner:r[5]<0?null:D.symbols[r[5]].id}));
    D.calls=D.calls.map(c=>({from:c[0]<0?'file:'+D.files[c[2]].id:D.symbols[c[0]].id,to:c[1].map(i=>D.symbols[i].id),file:D.files[c[2]].id,line:c[3],col:c[4],expression:c[5],kind:c[6]?'construct':'call',deferred:!!c[7],certainty:['unresolved','contract','static'][c[8]]}));
  }
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fileMap = new Map(D.files.map(f => [f.id, f])), symMap = new Map(D.symbols.map(s => [s.id, s]));
  const key = 'source-workbench:' + D.root;
  const saved = name => { try { return JSON.parse(localStorage.getItem(key + name) || 'null'); } catch { return null; } };
  const save = (name, value) => { try { localStorage.setItem(key + name, JSON.stringify(value)); } catch {} };
  let current, symbol, selectedLine = 1, panel = 'explain', graphMode = 'both', depth = 1, zoom = 1, generation = 0;
  let tabs = (saved(':tabs') || []).filter(f => fileMap.get(f)?.readable), marks = (saved(':marks') || []).filter(m => fileMap.has(m.file));
  let searchMode = 'files', searchVersion = 0, chain, folded = new Set(), matches = [], matchCursor = -1;
  const outgoing = new Map(), incoming = new Map(), references = new Map();
  for (const call of D.calls) {
    if (!outgoing.has(call.from)) outgoing.set(call.from, []); outgoing.get(call.from).push(call);
    for (const id of call.to) { if (!incoming.has(id)) incoming.set(id, []); incoming.get(id).push(call); }
  }
  for (const ref of D.refs) for (const id of ref.targets) { if (!references.has(id)) references.set(id, []); references.get(id).push(ref); }
  const status = text => { $('status').textContent = text; };
  $('title').textContent = D.title; document.title = D.title + ' · 源码工作台';
  $('coverage').textContent = `${D.coverage.indexedFiles} 个语义文件 · ${D.symbols.length} 个符号 · ${D.revision.slice(0,8)}${D.dirty?' · 工作区已修改':''}`;
  const loading = new Map();
  function load(file) {
    if (window.SOURCE_FILES[file]) return Promise.resolve(window.SOURCE_FILES[file]);
    if (loading.has(file)) return loading.get(file);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = fileMap.get(file).chunk;
      script.onload = () => { script.remove(); resolve(window.SOURCE_FILES[file]); };
      script.onerror = () => { script.remove(); loading.delete(file); reject(new Error('离线源码块加载失败：'+file)); };
      document.head.append(script);
    }); loading.set(file,promise); return promise;
  }
  function route(file, line = 1, id) { return '#file='+encodeURIComponent(file)+'&line='+line+(id?'&symbol='+encodeURIComponent(id):''); }
  function go(file, line = 1, id) { const hash=route(file,line,id); if(location.hash===hash) open(file,line,id); else location.hash=hash; }
  function jump(id) { const s = symMap.get(id); if(s) go(s.file,s.line,s.id); }
  function fileTree() {
    const query = $('file-filter').value.toLowerCase();
    const found = D.files.filter(f=>f.id.toLowerCase().includes(query));
    const tree = { dirs:new Map(),files:[] };
    for(const f of found){const parts=f.id.split('/');parts.pop();let d=tree;for(const part of parts){if(!d.dirs.has(part))d.dirs.set(part,{dirs:new Map(),files:[]});d=d.dirs.get(part);}d.files.push(f);}
    const render=(dir,prefix='')=>[...dir.dirs].map(([name,d])=>`<details ${query||current?.startsWith(prefix+name+'/')?'open':''}><summary>${esc(name)}</summary><div>${render(d,prefix+name+'/')}</div></details>`).join('')+dir.files.map(f=>`<button class="row ${f.id===current?'active':''}" data-file="${esc(f.id)}" ${f.readable?'':'disabled'} title="${esc(f.reason||f.id)}"><span class="kind">${f.language==='typescript'?'TS':'·'}</span><span>${esc(f.id.split('/').pop())}</span></button>`).join('');
    $('tree').innerHTML=render(tree);
  }
  function outline() {
    const q=$('symbol-filter').value.toLowerCase();
    const syms=(fileMap.get(current)?.symbols||[]).map(id=>symMap.get(id));
    $('outline-count').textContent=syms.length;
    $('outline').innerHTML=syms.filter(s=>s.qualified.toLowerCase().includes(q)).map(s=>`<button class="row ${s.id===symbol?.id?'active':''}" data-symbol="${esc(s.id)}" title="${esc(s.qualified)}"><span class="kind">${esc(s.kind.slice(0,2))}</span><span>${s.parent?'　':''}${esc(s.name)}</span><small>${s.line}</small></button>`).join('')||'<p class="empty">此语言暂未提供语义符号索引；仍可读源码和搜索文本。</p>';
  }
  function renderTabs() {
    $('tabs').innerHTML=tabs.map(f=>`<span class="tab ${f===current?'active':''}" data-file="${esc(f)}" title="${esc(f)}">${esc(f.split('/').pop())}<button data-close-tab="${esc(f)}" title="关闭标签">×</button></span>`).join('');
    save(':tabs',tabs);
  }
  function notesFor(s) { return (D.analysis.notes||[]).filter(n=>n.file===(s?.file||current)&&(n.symbolId?s?.id===n.symbolId:!s||n.line>=s.line&&n.line<=s.end)); }
  function noteHTML(n) { return `<article class="note"><small>${esc(n.evidence||'源码阅读分析')} · ${n.line}–${n.end||n.line}</small><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p>${n.input!==undefined?`<b>输入</b><pre>${esc(typeof n.input==='string'?n.input:JSON.stringify(n.input,null,2))}</pre>`:''}${n.output!==undefined?`<b>输出 / 返回</b><pre>${esc(typeof n.output==='string'?n.output:JSON.stringify(n.output,null,2))}</pre>`:''}${n.design?`<b>设计原因与代价</b><p>${esc(n.design)}</p>`:''}${n.failure?`<b>错误、取消与边界</b><p>${esc(n.failure)}</p>`:''}</article>`; }
  function code() {
    const data=window.SOURCE_FILES[current];if(!data)return;
    const lines=data.text.split('\n'), perLine=new Map();
    for(const r of data.refs){if(!perLine.has(r.line))perLine.set(r.line,[]);perLine.get(r.line).push(r);}
    const noteLines=new Map();
    for(const n of D.analysis.notes||[])if(n.file===current){if(!noteLines.has(n.line))noteLines.set(n.line,[]);noteLines.get(n.line).push(n);}
    const foldable=new Map();
    for(const id of fileMap.get(current).symbols||[]){const s=symMap.get(id);if(s.end>s.line+3)foldable.set(s.line,s);}
    let offset=0,tokenIndex=0,skipUntil=0;const html=[];
    for(let i=0;i<lines.length;i++){
      const line=i+1,text=lines[i],end=offset+text.length;
      while(tokenIndex<data.tokens.length&&data.tokens[tokenIndex][1]<=offset)tokenIndex++;
      const tokens=[];for(let t=tokenIndex;t<data.tokens.length&&data.tokens[t][0]<end;t++)tokens.push(data.tokens[t]);
      if(line>skipUntil){
        const refs=perLine.get(line)||[],bounds=new Set([0,text.length]);
        for(const t of tokens){bounds.add(Math.max(0,t[0]-offset));bounds.add(Math.min(text.length,t[1]-offset));}
        for(const r of refs){bounds.add(r.col);bounds.add(r.col+r.length);}
        const q=$('find-input').value;const hits=[];
        if(q){let p=text.toLowerCase().indexOf(q.toLowerCase());while(p>=0){hits.push([p,p+q.length]);bounds.add(p);bounds.add(p+q.length);p=text.toLowerCase().indexOf(q.toLowerCase(),p+Math.max(1,q.length));}}
        const points=[...bounds].filter(p=>p>=0&&p<=text.length).sort((a,b)=>a-b);let body='';
        for(let j=0;j<points.length-1;j++){
          const a=points[j],b=points[j+1],token=tokens.find(t=>t[0]<=offset+a&&t[1]>=offset+b),r=refs.find(r=>r.col<=a&&r.col+r.length>=b);
          const hit=hits.some(([x,y])=>a>=x&&b<=y);
          const classes=[token?'token '+token[2]:'',r?'identifier':'',r?.targets.includes(symbol?.id)?'chosen':'',hit?'search-hit':''].filter(Boolean).join(' ');
          body+=`<span class="${classes}"${r?` data-ref="${esc(r.targets.join('|'))}" title="点击查看关系；双击或 Ctrl/⌘ 点击跳定义"`:''}>${esc(text.slice(a,b))}</span>`;
        }
        const f=foldable.get(line),marked=marks.some(m=>m.file===current&&m.line===line);
        html.push(`<div class="source-row ${line===selectedLine?'selected':''} ${symbol&&line>=symbol.line&&line<=symbol.end?'in-symbol':''}" data-line="${line}"><span class="gutter">${f?`<button data-fold="${esc(f.id)}" title="折叠或展开">${folded.has(f.id)?'▸':'▾'}</button>`:''}${marked?'★ ':''}<button data-select-line="${line}" style="width:auto" title="选择行">${line}</button></span><span class="source-text">${body||' '}${f&&folded.has(f.id)?' <span class="muted">… '+(f.end-f.line)+' 行已折叠</span>':''}</span></div>`);
        for(const n of noteLines.get(line)||[])html.push(`<div class="annotation"><small>源码讲解 · 非原始注释</small><strong> ${esc(n.title)}</strong><p>${esc(n.body)}</p></div>`);
        if(f&&folded.has(f.id))skipUntil=f.end;
      }
      offset=end+1;
    }
    $('code').innerHTML=html.join('');
  }
  async function open(file,line=1,id){
    const f=fileMap.get(file);if(!f?.readable){status('该文件未收录为可读文本');return;}
    const token=++generation;status('读取 '+file);
    try{await load(file);}catch(e){status(e.message);return;}if(token!==generation)return;
    if(current!==file){folded.clear();$('find-input').value='';}
    current=file;selectedLine=Math.max(1,Math.min(Number(line)||1,f.lines));
    symbol=id?symMap.get(id):D.symbols.filter(s=>s.file===file&&s.line<=selectedLine&&s.end>=selectedLine).sort((a,b)=>(a.end-a.line)-(b.end-b.line))[0];
    for(const id of [...folded]){const s=symMap.get(id);if(selectedLine>s.line&&selectedLine<=s.end)folded.delete(id);}
    if(!tabs.includes(file))tabs.push(file);renderTabs();fileTree();outline();code();inspect();graph();
    $('breadcrumb').textContent=file+(symbol?' › '+symbol.qualified:'');
    $('code').querySelector(`[data-line="${selectedLine}"]`)?.scrollIntoView({block:'center'});
    status(`${file}:${selectedLine} · ${symbol?.kind||f.language} · 快照 ${f.hash.slice(0,10)}`);
    save(':last',{file,line:selectedLine,id:symbol?.id});
  }
  function choose(id){const s=symMap.get(id);if(!s)return;symbol=s;outline();inspect();graph();document.querySelectorAll('.identifier').forEach(el=>el.classList.toggle('chosen',el.dataset.ref.split('|').includes(id)));}
  const certainty = c => c.certainty==='unresolved'?'未解析 / 外部':c.certainty==='contract'?'接口或声明目标':'静态绑定';
  function inspect(){
    const s=symbol;
    $('symbol-head').innerHTML=s?`<small>${esc(s.kind)} · ${esc(s.file)}:${s.line}</small><strong>${esc(s.qualified)}</strong>${s.signature?`<div class="signature">${esc(s.signature)}</div>`:''}<button data-symbol="${esc(s.id)}">跳到定义 ↗</button>`:`<strong>${esc(current?.split('/').pop()||D.title)}</strong><small>选择代码中的符号，查看定义、引用与调用关系。</small>`;
    document.querySelectorAll('[data-panel]').forEach(el=>el.classList.toggle('active',el.dataset.panel===panel));
    if(panel==='explain'){
      const notes=notesFor(s);let text=notes.map(noteHTML).join('');
      if(!text)text=`<p class="empty">${s?'此符号暂无人工深入讲解。下面的注释来自源码，不代表已经分析。':'选择一个已讲解的关键函数，或者从调用链开始。'}</p>`;
      if(s?.doc)text+=`<article class="note"><small>源码文档注释</small><p>${esc(s.doc)}</p></article>`;
      if(chain){text+=`<article class="note"><h3>${esc(chain.title)}</h3><p>${esc(chain.summary)}</p>${chain.steps.map((step,i)=>`<button class="chain-step ${step.symbolId===s?.id?'active':''}" data-chain-step="${i}"><b>${i+1}. ${esc(step.title||step.symbol)}</b><small>${esc(step.relation||'经源码核对的阅读路径')}</small><p>${esc(step.text)}</p></button>`).join('')}</article>`;}
      else text+=`<article class="note"><h3>从关键调用链开始</h3>${(D.analysis.chains||[]).map((c,i)=>`<button class="relation" data-chain="${i}">${esc(c.title)}<small>${esc(c.summary)}</small></button>`).join('')}</article>`;
      $('inspector').innerHTML=text;return;
    }
    if(!s){$('inspector').innerHTML='<p class="empty">先选择代码或符号列表中的一个符号。</p>';return;}
    const items=panel==='references'?(references.get(s.id)||[]):panel==='callers'?(incoming.get(s.id)||[]):(outgoing.get(s.id)||[]);
    $('inspector').innerHTML=`<p class="muted">${items.length} 处${panel==='references'?'编译器符号引用；不含定义':'静态调用位置；并非实际运行次数'}</p>`+items.slice(0,600).map(r=>{
      const target=panel==='callees'?r.to?.[0]:r.from||r.owner;const other=symMap.get(target);
      return `<div class="relation"><button data-file="${esc(r.file)}" data-line="${r.line}" title="跳到使用位置">${esc(r.expression||other?.qualified||'引用')} <small>${esc(r.file)}:${r.line}</small></button>${r.certainty?`<span class="tag">${certainty(r)}${r.deferred?' · 回调中':''}</span>`:''}${other?`<button data-symbol="${esc(other.id)}" title="跳到关联定义">${esc(other.qualified)} ↗</button>`:''}</div>`;
    }).join('')+(items.length>600?'<p>列表截取前 600 处；索引保留完整数据。</p>':'');
  }
  function graph(){
    let center=symbol?.id,nodes=new Map(),edges=[];
    const add=(id,col)=>{if(!nodes.has(id)&&nodes.size<45)nodes.set(id,{id,col});};
    if(graphMode==='imports'){
      center=current;if(!center)return;add(center,1);
      for(const e of D.imports){if(e.from===center&&e.to){add(e.to,2);edges.push({from:center,to:e.to});}else if(e.to===center){add(e.from,0);edges.push({from:e.from,to:center});}}
    }else{
      if(!center){$('graph').innerHTML='<p class="empty">选中函数后显示调用图，选中类或接口可查看类型关系。</p>';return;}
      add(center,depth);
      if(graphMode==='types'){
        for(const e of D.inheritance){if(e.from===center||e.to===center){add(e.from,e.from===center?depth:depth-1);add(e.to,e.to===center?depth:depth+1);edges.push(e);}}
      }else{
        for(const direction of [-1,1]){
          let frontier=[center];const visited=new Set([center]);
          for(let d=1;d<=depth;d++){
            const next=[];
            for(const id of frontier){const rels=direction<0?incoming.get(id)||[]:outgoing.get(id)||[];
              for(const r of rels)for(const target of direction<0?[r.from]:r.to){if(!symMap.has(target))continue;add(target,depth+direction*d);edges.push({from:direction<0?target:id,to:direction<0?id:target,certainty:r.certainty});if(!visited.has(target)){visited.add(target);next.push(target);}}
            }frontier=next;
          }
        }
      }
    }
    edges=edges.filter(e=>nodes.has(e.from)&&nodes.has(e.to));
    const unique=new Map(edges.map(e=>[e.from+'>'+e.to,e]));edges=[...unique.values()];
    const counts=new Map();for(const n of nodes.values()){const row=counts.get(n.col)||0;counts.set(n.col,row+1);n.x=30+n.col*240;n.y=35+row*86;}
    const width=(Math.max(...[...nodes.values()].map(n=>n.col))+1)*240+30,height=Math.max(160,Math.max(...counts.values())*86+45);
    $('graph').innerHTML=`<svg viewBox="0 0 ${width} ${height}" style="width:${Math.max(100,width/8)*zoom}%;min-height:${Math.min(height,450)*zoom}px" aria-label="静态关系图"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--muted)"/></marker></defs>${edges.map(e=>{const a=nodes.get(e.from),b=nodes.get(e.to),right=b.x>a.x;const sx=a.x+(right?190:0),ex=b.x+(right?0:190);return `<path class="graph-edge ${e.certainty==='contract'?'contract':''}" d="M${sx} ${a.y+27} C${(sx+ex)/2} ${a.y+27},${(sx+ex)/2} ${b.y+27},${ex} ${b.y+27}" marker-end="url(#arrow)"><title>${esc(e.kind||e.certainty||'调用 / 依赖')}</title></path>`;}).join('')}${[...nodes.values()].map(n=>{const s=symMap.get(n.id),name=s?.qualified||n.id.split('/').pop(),sub=s?`${s.kind} · L${s.line}`:n.id;return `<g class="graph-node ${n.id===center?'selected':''}" ${s?`data-symbol="${esc(n.id)}"`:`data-file="${esc(n.id)}"`} tabindex="0" role="button" aria-label="${esc(name)}"><title>${esc(name+'\n'+sub)}</title><rect x="${n.x}" y="${n.y}" width="190" height="58" rx="8"/><text x="${n.x+10}" y="${n.y+23}">${esc(name.length>25?name.slice(0,23)+'…':name)}</text><text class="sub" x="${n.x+10}" y="${n.y+43}">${esc(sub.length>30?'…'+sub.slice(-28):sub)}</text></g>`;}).join('')}</svg>`;
    $('graph-title').textContent=graphMode==='imports'?'文件依赖':graphMode==='types'?'extends / implements':'调用者 → 当前 → 调用目标';
    $('graph-caption').textContent=`${nodes.size} 个节点${nodes.size>=45?' · 达到 45 个节点上限':''}。${graphMode==='both'?'实线：静态绑定；虚线：接口或声明。未解析调用见右侧。':'箭头指向依赖或基类型，不代表运行顺序。'}`;
  }
  function search(mode=searchMode){searchMode=mode;$('search-dialog').showModal();document.querySelectorAll('[data-search]').forEach(b=>b.classList.toggle('active',b.dataset.search===mode));$('search-input').value='';$('search-input').focus();results();}
  function showResults(items,label){$('search-status').textContent=label;$('results').innerHTML=items.join('')||'<p class="empty">没有结果。</p>';}
  async function results(runText=false){
    const version=++searchVersion,q=$('search-input').value.toLowerCase().trim();
    const result=(title,sub,attrs,excerpt='')=>`<button class="result" ${attrs}><b>${esc(title)}</b><small>${esc(sub)}</small>${excerpt?`<pre>${esc(excerpt)}</pre>`:''}</button>`;
    if(searchMode==='files') {const found=D.files.filter(f=>f.readable&&f.id.toLowerCase().includes(q));showResults(found.slice(0,250).map(f=>result(f.id.split('/').pop(),f.id,`data-file="${esc(f.id)}"`)),`${found.length} 个文件 · 显示前 250 个`);}
    else if(searchMode==='symbols'){const found=D.symbols.filter(s=>(s.qualified+' '+s.file).toLowerCase().includes(q));showResults(found.slice(0,250).map(s=>result(s.qualified,s.kind+' · '+s.file+':'+s.line,`data-symbol="${esc(s.id)}"`)),`${found.length} 个符号 · 显示前 250 个`);}
    else if(searchMode==='chains'){showResults((D.analysis.chains||[]).map((c,i)=>({c,i})).filter(({c})=>(c.title+c.summary).toLowerCase().includes(q)).map(({c,i})=>result(c.title,c.summary,`data-chain="${i}"`)),'人工分析的阅读路径；步骤可以包含已明确标注的动态边界。');}
    else if(searchMode==='bookmarks'){showResults(marks.filter(m=>m.file.toLowerCase().includes(q)).map(m=>result(m.file.split('/').pop()+':'+m.line,m.file,`data-file="${esc(m.file)}" data-line="${m.line}"`)),'书签仅保存在当前浏览器。');}
    else if(!runText||!q){showResults([],'输入文本后按 Enter；读取离线源码快照，不访问网络。');}
    else {
      const rows=[];let scanned=0;const readable=D.files.filter(f=>f.readable);let capped=false;
      for(const f of readable){if(version!==searchVersion)return;const data=await load(f.id);if(version!==searchVersion)return;scanned++;
        for(const [i,line] of data.text.split('\n').entries())if(line.toLowerCase().includes(q)){rows.push(result(f.id.split('/').pop()+':'+(i+1),f.id,`data-file="${esc(f.id)}" data-line="${i+1}"`,line.trim().slice(0,220)));if(rows.length>=300){capped=true;break;}}
        if(scanned%40===0){showResults(rows,`已搜索 ${scanned}/${readable.length} 个文件…`);await new Promise(r=>setTimeout(r,0));}if(capped)break;
      }if(version===searchVersion)showResults(rows,`${rows.length} 处匹配 · 已搜索 ${scanned}/${readable.length} 个文件${capped?' · 达到 300 处上限':''}`);
    }
  }
  function find(delta=1){
    const q=$('find-input').value.toLowerCase(),data=window.SOURCE_FILES[current];if(!data)return;
    matches=data.text.split('\n').flatMap((line,i)=>q&&line.toLowerCase().includes(q)?[i+1]:[]);
    matchCursor=matches.length?(matchCursor+delta+matches.length)%matches.length:-1;
    if(matchCursor>=0)selectedLine=matches[matchCursor];folded.clear();code();$('code').querySelector(`[data-line="${selectedLine}"]`)?.scrollIntoView({block:'center'});
    $('find-count').textContent=`${matchCursor+1}/${matches.length} 行`;
  }
  function help(){
    $('info').innerHTML=`<h2>从源码跳转到关系，再读解释</h2><p>${esc(D.analysis.intro||'选择一个文件或关键调用链开始。')}</p><p>单击代码符号查看关系，双击或 Ctrl/⌘ 点击跳到定义。右侧引用与调用列表中的文件位置跳到使用处，名字跳到声明。接口目标不等于实际运行的实现。回调中的静态调用单独标记。</p><p>Ctrl/⌘ P 搜索文件，Ctrl/⌘ T 搜索符号，Ctrl/⌘ Shift F 搜索全文，Ctrl/⌘ F 文件内查找，Ctrl/⌘ L 跳行，F12 跳定义，Alt + 左右方向键后退/前进。拖动分隔线调整区域；折叠函数、书签、标签页和主题用于连续阅读。</p><h3>索引范围</h3><p>${D.coverage.limitations.map(esc).join('<br>')}</p><p>编译器 ${esc(D.compiler)} · 配置 ${esc(D.config||'默认配置')}<br>当前工作区快照 ${esc(D.revision)}${D.dirty?'（有未提交修改）':''}<br>${esc(D.generated)}<br>${D.coverage.unresolvedCalls} 处调用未解析到收录的本地声明。</p><p>这是只读离线源码分析器，不包含编译、调试、重构、实时语言服务器或所有语言的语义分析。真实文件更新后需重新生成；打开编辑器会进入当前文件，可能与快照不同。</p>${D.diagnostics.length?`<details><summary>${D.diagnostics.length} 项配置 / 语法诊断</summary><pre class="sample">${esc(D.diagnostics.join('\n'))}</pre></details>`:''}`;
    $('info-dialog').showModal();
  }
  document.addEventListener('click',async event=>{
    const close=event.target.closest('[data-close-tab]');if(close){event.stopPropagation();tabs=tabs.filter(f=>f!==close.dataset.closeTab);renderTabs();if(current===close.dataset.closeTab&&tabs.length)go(tabs.at(-1));return;}
    const step=event.target.closest('[data-chain-step]');if(step&&chain){const s=chain.steps[Number(step.dataset.chainStep)];go(s.file,s.line,s.symbolId);return;}
    const c=event.target.closest('[data-chain]');if(c){chain=D.analysis.chains[Number(c.dataset.chain)];panel='explain';$('search-dialog').close();const s=chain.steps[0];go(s.file,s.line,s.symbolId);return;}
    const s=event.target.closest('[data-symbol]');if(s){$('search-dialog').close();jump(s.dataset.symbol);return;}
    const f=event.target.closest('[data-file]');if(f&&!f.disabled){$('search-dialog').close();go(f.dataset.file,Number(f.dataset.line)||1);return;}
    const r=event.target.closest('[data-ref]');if(r){const id=r.dataset.ref.split('|')[0];if(event.ctrlKey||event.metaKey)jump(id);else choose(id);return;}
    const fold=event.target.closest('[data-fold]');if(fold){const id=fold.dataset.fold;folded.has(id)?folded.delete(id):folded.add(id);const top=$('code').scrollTop;code();$('code').scrollTop=top;return;}
    const line=event.target.closest('[data-select-line]');if(line){go(current,Number(line.dataset.selectLine));return;}
    const p=event.target.closest('[data-panel]');if(p){panel=p.dataset.panel;inspect();return;}
    const g=event.target.closest('[data-graph]');if(g){graphMode=g.dataset.graph;document.querySelectorAll('[data-graph]').forEach(el=>el.classList.toggle('active',el===g));graph();return;}
    const mode=event.target.closest('[data-search]');if(mode){searchMode=mode.dataset.search;document.querySelectorAll('[data-search]').forEach(el=>el.classList.toggle('active',el===mode));results();return;}
    const a=event.target.closest('[data-action]')?.dataset.action;if(!a)return;
    if(a==='back')history.back();else if(a==='forward')history.forward();else if(a==='search')search('files');else if(a==='chains')search('chains');else if(a==='bookmarks')search('bookmarks');
    else if(a==='search-close'){$('search-dialog').close();searchVersion++;}else if(a==='info-close')$('info-dialog').close();else if(a==='help')help();
    else if(a==='sidebar')document.body.classList.toggle(matchMedia('(max-width:720px)').matches?'mobile-left':'hidden-left');
    else if(a==='inspector')document.body.classList.toggle(matchMedia('(max-width:720px)').matches?'mobile-right':'hidden-right');
    else if(a==='graph')document.body.classList.toggle('hidden-graph');
    else if(a==='theme'){const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('source-theme',theme);}catch{}}
    else if(a==='fullscreen'){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){status('浏览器未允许全屏：'+e.message);}}
    else if(a==='wrap')$('code').classList.toggle('wrap');
    else if(a==='copy'){const lines=window.SOURCE_FILES[current].text.split('\n'),text=symbol?lines.slice(symbol.line-1,symbol.end).join('\n'):lines.join('\n');try{await navigator.clipboard.writeText(text);status('已复制原始源码（不含讲解）');}catch{status('浏览器不允许剪贴板写入，可在代码中选择文本复制。');}}
    else if(a==='editor')location.href='vscode://file/'+(D.root+'/'+current).split('/').map(encodeURIComponent).join('/')+':'+selectedLine;
    else if(a==='bookmark'){const i=marks.findIndex(m=>m.file===current&&m.line===selectedLine);if(i>=0)marks.splice(i,1);else marks.push({file:current,line:selectedLine});save(':marks',marks);code();}
    else if(a==='find'){$('findbar').hidden=false;$('find-input').focus();}
    else if(a==='find-close'){$('findbar').hidden=true;$('find-input').value='';code();}
    else if(a==='find-next')find(1);else if(a==='find-prev')find(-1);
    else if(a==='line'){$('info').innerHTML='<h2>跳到行</h2><form id="line-form"><input id="line-input" type="number" min="1" max="'+fileMap.get(current).lines+'" value="'+selectedLine+'" aria-label="行号"><button>跳转</button></form>';$('info-dialog').showModal();$('line-input').select();$('line-form').onsubmit=e=>{e.preventDefault();const l=Number($('line-input').value);$('info-dialog').close();go(current,l);};}
    else if(a==='depth'){depth=depth===1?2:1;event.target.closest('button').textContent=depth+' 层';graph();}
    else if(a==='zoom-in'||a==='zoom-out'){zoom=Math.min(3,Math.max(.5,zoom+(a==='zoom-in'?.2:-.2)));graph();}
  });
  document.addEventListener('dblclick',event=>{const r=event.target.closest('[data-ref]');if(r)jump(r.dataset.ref.split('|')[0]);});
  $('file-filter').oninput=fileTree;$('symbol-filter').oninput=outline;
  $('search-input').oninput=()=>results();$('search-input').onkeydown=e=>{if(e.key==='Enter'){if(searchMode==='text')results(true);else $('results button')?.click();}if(e.key==='ArrowDown'){e.preventDefault();$('results button')?.focus();}};
  $('results').onkeydown=e=>{if(!['ArrowDown','ArrowUp'].includes(e.key))return;e.preventDefault();const buttons=[...$('results').querySelectorAll('button')],i=buttons.indexOf(document.activeElement);buttons[Math.max(0,Math.min(buttons.length-1,i+(e.key==='ArrowDown'?1:-1)))]?.focus();};
  $('search-dialog').addEventListener('close',()=>searchVersion++);
  $('find-input').oninput=()=>{matchCursor=-1;find();};$('find-input').onkeydown=e=>{if(e.key==='Enter')find(e.shiftKey?-1:1);};
  document.addEventListener('keydown',e=>{
    if(e.target.closest('input,textarea,dialog'))return;
    const mod=e.ctrlKey||e.metaKey;
    if(mod&&['p','t','f','l'].includes(e.key.toLowerCase())){e.preventDefault();const k=e.key.toLowerCase();if(k==='p')search('files');if(k==='t')search('symbols');if(k==='f'){if(e.shiftKey)search('text');else document.querySelector('[data-action=find]').click();}if(k==='l')document.querySelector('[data-action=line]').click();}
    if(e.key==='F12'&&symbol){e.preventDefault();jump(symbol.id);}if(e.altKey&&e.key==='ArrowLeft'){e.preventDefault();history.back();}if(e.altKey&&e.key==='ArrowRight'){e.preventDefault();history.forward();}
    if(e.key==='Enter'&&e.target.matches('.graph-node'))e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    if(['ArrowDown','ArrowUp','PageDown','PageUp'].includes(e.key)&&!mod&&!e.altKey){e.preventDefault();$('code').scrollBy(0,(e.key==='ArrowUp'||e.key==='PageUp'?-1:1)*(e.key.startsWith('Page')?$('code').clientHeight*.8:69));}
  });
  for(const [id,variable,axis,sign,min,max] of [['left-resizer','--left','clientX',1,150,450],['right-resizer','--right','clientX',-1,240,650],['graph-resizer','--graph','clientY',-1,120,600]]){
    $(id).onpointerdown=e=>{e.preventDefault();const start=e[axis],size=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(variable));$(id).setPointerCapture(e.pointerId);$(id).onpointermove=m=>document.documentElement.style.setProperty(variable,Math.max(min,Math.min(max,size+(m[axis]-start)*sign))+'px');$(id).onpointerup=()=>{$(id).onpointermove=null;};};
  }
  function hash(){const p=new URLSearchParams(location.hash.slice(1));if(p.has('file'))open(p.get('file'),Number(p.get('line'))||1,p.get('symbol'));}
  window.addEventListener('hashchange',hash);fileTree();
  if(location.hash.startsWith('#file='))hash();else{const first=D.analysis.start||saved(':last')||{file:D.files.find(f=>f.readable&&f.language==='typescript')?.id||D.files.find(f=>f.readable)?.id,line:1};if(first.file)go(first.file,first.line,first.symbolId||first.id);}
})();
