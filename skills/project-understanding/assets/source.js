/* 离线源码阅读：语法着色、行定位、查找与本地编辑器链接。 */
(() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dialog = document.querySelector('dialog');
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

  window.decorateSourceExcerpts = () => {
    document.querySelectorAll('.code-evidence').forEach(box=>{
      const ref=box.querySelector('[data-source]');
      const pre=box.querySelector('pre');
      if (!ref || !pre) return;
      pre.classList.add('source-excerpt');
      pre.innerHTML=rows(pre.textContent,ref.dataset.source,Number(ref.dataset.line),Number(ref.dataset.line));
    });
  };

  function jump(line) {
    if (!Number.isInteger(line) || line<1 || line>lines.length) {
      document.querySelector('#source-status').textContent=`请输入 1–${lines.length} 的行号`; return;
    }
    current=line;
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
    if (number && number.closest('dialog')) { jump(Number(number.dataset.goto)); return; }
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
    window.selectSourceFile(path);
    if (!dialog.open) dialog.show();
    jump(line);
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
  document.querySelector('#source-wrap').onclick=e=>{const active=code.classList.toggle('wrap');e.target.setAttribute('aria-pressed',String(active));};
  document.querySelector('#source-copy').onclick=()=>copy(lines.join('\n'));
  document.querySelector('#location-copy').onclick=()=>copy(`${window.GUIDE.sources[path].absolutePath}:${current}`);
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape')dialog.close();if((e.metaKey||e.ctrlKey)&&e.key==='f'){e.preventDefault();document.querySelector('#source-query').focus();}});
})();
