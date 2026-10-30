/* 图作为页面入口，正文把职责、数据与源码连接起来。 */
(() => {
  const g = window.GUIDE;
  const main = document.querySelector("main");
  const dialog = document.querySelector("dialog");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  let selectedSource = "";
  document.title = g.title;
  document.querySelector("#project-home").textContent = g.title;
  document.querySelector("#revision").textContent = g.revision.slice(0, 12);

  function exchangeHtml(flow) {
    if (!flow) return '';
    const packet = (side) => `<div class="packet"><h3>${esc(side.label)}</h3><small>${esc(side.format)}</small><pre>${esc(typeof side.sample === 'string' ? side.sample : JSON.stringify(side.sample,null,2))}</pre><p>${esc(side.text)}</p></div>`;
    return `<section class="exchange"><h2>${esc(flow.title)}</h2><p class="evidence">${esc(flow.evidence)}</p><div class="exchange-track">${packet(flow.input)}<div class="exchange-action"><span aria-hidden="true">→</span><h3>${esc(flow.action)}</h3><p>${esc(flow.text)}</p><span aria-hidden="true">→</span></div>${packet(flow.output)}</div></section>`;
  }

  function render() {
    const id = location.hash.slice(1) || "overview";
    const page = g.pages.find(p => p.id === id);
    if (!page) {
      main.innerHTML = '<p>该页面不存在。<a href="#overview">返回总架构图</a></p>';
      return;
    }
    const ancestors = [];
    let parent = page;
    while (parent) {
      ancestors.unshift(parent);
      parent = g.pages.find(p => p.id === parent.parent);
    }
    document.querySelector("#breadcrumbs").innerHTML = ancestors.map((p,i) => `${i ? '<span aria-hidden="true"> / </span>' : ''}${p.id === page.id ? `<span aria-current="page">${esc(p.title)}</span>` : `<a href="#${esc(p.id)}">${esc(p.title)}</a>`}`).join("");
    main.innerHTML = `<header class="hero"><div class="eyebrow">第 ${ancestors.length} 层 · ${esc({overview:'系统全景',subsystem:'子架构',module:'模块',flow:'运行过程',code:'实现与代码'}[page.kind])}</div><h1>${esc(page.title)}</h1><p class="lead">${esc(page.summary)}</p></header>${exchangeHtml(page.exchange)}<article class="explanation">${page.sections.map(s => `<section class="section" id="section-${esc(s.id)}" tabindex="-1"><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p>${s.media ? `<figure class="product-screen"><img src="${esc(s.media.src)}" alt="${esc(s.media.alt)}" loading="lazy"><figcaption>${esc(s.media.caption)}</figcaption></figure>` : ''}${s.data ? `<div class="samples">${Object.entries(s.data).map(([label,value]) => `<details class="sample" open><summary>${esc(label)}</summary><pre>${esc(typeof value === 'string' ? value : JSON.stringify(value,null,2))}</pre></details>`).join('')}</div>` : ''}${(s.refs || []).map(r => `<div class="code-evidence"><p>${esc(r.note || '从这里看对应实现')}</p><button class="source-link" data-source="${esc(r.path)}" data-line="${r.line}">${esc(r.path)}:${r.line} · 打开完整源码</button><details ${page.kind === 'code' ? 'open' : ''}><summary>查看关键片段（从第 ${r.line} 行起）</summary><pre>${esc(r.excerpt)}</pre></details></div>`).join('')}</section>`).join('')}</article>${page.parent ? `<footer><a href="#${esc(page.parent)}">← 返回上层架构图</a></footer>` : ''}`;
    window.renderAtlasVisuals(page.id);
    window.scrollTo(0,0);
  }

  function jump(line) {
    const rows = document.querySelectorAll("#source-code span");
    if (!Number.isInteger(line) || line < 1 || line > rows.length) return;
    rows.forEach(row => row.classList.remove("highlight"));
    rows[line-1].classList.add("highlight");
    document.querySelector("#source-line").value = line;
    rows[line-1].scrollIntoView({block:"center"});
  }

  document.addEventListener("click", event => {
    const source = event.target.closest("[data-source]");
    if (!source) return;
    selectedSource = source.dataset.source;
    const snapshot = g.sources[selectedSource];
    document.querySelector("#source-title").textContent = selectedSource;
    document.querySelector("#source-meta").textContent = `SHA-256 ${snapshot.sha256}`;
    document.querySelector("#source-code").innerHTML = snapshot.text.split('\n').map((line,i) => `<span data-line="${i+1}">${esc(line) || ' '}</span>`).join('');
    document.querySelector("#source-query").value = '';
    dialog.showModal();
    jump(Number(source.dataset.line));
  });
  document.querySelector("#close-source").onclick = () => dialog.close();
  document.querySelector("#jump-source").onclick = () => jump(Number(document.querySelector("#source-line").value));
  document.querySelector("#find-source").onclick = () => {
    const query = document.querySelector("#source-query").value.toLowerCase();
    if (!query) return;
    const lines = g.sources[selectedSource].text.split('\n');
    const start = Number(document.querySelector("#source-line").value);
    for (let offset = 0; offset < lines.length; offset++) {
      const i = (start+offset)%lines.length;
      if (lines[i].toLowerCase().includes(query)) { jump(i+1); break; }
    }
  };
  window.addEventListener("hashchange", render);
  render();
})();
