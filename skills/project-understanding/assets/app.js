/* Offline architecture atlas: authored explanations, boundary samples and source snapshots. */
(() => {
  "use strict";
  const g = window.GUIDE;
  const main = document.querySelector("main");
  const nav = document.querySelector("nav");
  const dialog = document.querySelector("dialog");
  const pages = [...g.modules, ...g.chapters, ...g.flows, ...(g.comparison ? [g.comparison] : [])];
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const json = (value) => typeof value === "string" ? value : JSON.stringify(value, null, 2);
  let current = "overview";
  let step = 0;
  let view = "";
  let selectedSource = "";
  let compareLeft = 0;
  let compareRight = 1;
  let compareView = "";
  let completed = [];
  try { completed = JSON.parse(localStorage.getItem(`atlas:${g.title}`) || "[]"); } catch { /* Storage is optional on file URLs. */ }
  if (!Array.isArray(completed)) completed = [];
  document.title = g.title;
  document.querySelector("#revision").textContent = `REV ${g.revision.slice(0, 12)}`;

  function refs(items = []) {
    return `<div class="refs">${items.map((r) => `<button type="button" class="source-link" data-source="${esc(r.path)}" data-line="${r.line || 1}" title="${esc(r.note || r.symbol || "查看完整源码")}">${esc(r.path)}:${r.line || 1}</button>`).join("")}</div>`;
  }

  function navigation(query = "") {
    const groups = [
      ["从这里开始", [{id:"overview",title:"00 · 全局地图"},{id:"graph",title:"01 · 模块依赖图"}]],
      ["运行与数据", [...g.flows, ...(g.comparison ? [g.comparison] : [])]],
      ["理解机制", g.chapters],
      ["逐个模块", g.modules],
      ["查阅", [{id:"sources",title:"源码索引"},{id:"glossary",title:"术语表"},{id:"about",title:"证据、更新与复用"}]],
    ];
    const q = query.toLowerCase();
    nav.innerHTML = groups.map(([label, items]) => {
      const filtered = items.filter((p) => !q || JSON.stringify(p).toLowerCase().includes(q));
      return filtered.length ? `<h3>${esc(label)}</h3>${filtered.map((p) => `<a href="#${esc(p.id)}" ${p.id === current ? 'aria-current="page"' : ""} class="${p.id === current ? "active" : ""} ${completed.includes(p.id) ? "done" : ""}">${esc(p.title)}</a>`).join("")}` : "";
    }).join("");
    if (!nav.textContent) nav.innerHTML = '<p class="empty">无匹配目录。可到源码索引搜索路径。</p>';
  }

  function heading(title, summary, label = "ARCHITECTURE / LEARNING MAP") {
    return `<div class="topline"><span>${esc(g.title)}</span><span>源码快照 · ${g.revision.slice(0,8)}</span></div><header class="hero"><div class="eyebrow">${esc(label)}</div><h1>${esc(title)}</h1><p class="lead">${esc(summary)}</p></header>`;
  }

  function overview() {
    return heading(g.subtitle, g.intro) + `<div class="stats"><div><strong>${g.modules.length}</strong><span>模块分解</span></div><div><strong>${g.flows.length}</strong><span>可步进流程</span></div><div><strong>${Object.keys(g.sources).length}</strong><span>源码快照</span></div></div>
      <h2>先抓住主要运行路径</h2><div class="diagram lanes">${(g.lanes || []).map((lane) => `<div class="lane"><span class="tag">${esc(lane.title)}</span>${lane.nodes.map((node,i) => `${i ? `<span class="arrow">↓ ${esc(node.via || "调用")}</span>` : ""}<a href="#${esc(node.id)}">${esc(node.text)}</a>`).join("")}</div>`).join("")}</div>
      <div class="callout"><p>${esc(g.overviewNote || "从具体运行流程进入，再沿源码引用理解模块职责。")}</p></div>
      <h2>建议阅读顺序</h2><div class="reading">${g.reading.map((p) => `<a href="#${p.id}"><div><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div></a>`).join("")}</div>
      <h2>模块地图</h2><div class="grid">${g.modules.map((m,i) => `<a class="card link" href="#${m.id}"><div class="num">${String(i+1).padStart(2,"0")} / ${esc(m.status)}</div><h3>${esc(m.title)}</h3><p class="muted">${esc(m.summary)}</p></a>`).join("")}</div>`;
  }

  function modulePage(m) {
    return heading(m.title, m.summary, `MODULE / ${m.status}`) + `<h2>为什么需要这个模块</h2><div class="grid"><section class="card"><span class="tag">问题 → 具体情景</span><h3>${esc(m.problem)}</h3><p>${esc(m.example)}</p></section><section class="card"><span class="tag">机制 → 代价</span><p>${esc(m.solution)}</p><p class="muted">${esc(m.tradeoff)}</p></section></div><h2>沿代码往下读</h2>${m.parts.map((p,i) => `<section class="section"><div class="num">${String(i+1).padStart(2,"0")}</div><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p>${refs([p])}</section>`).join("")}<h2>继续查阅</h2>${refs(m.refs)}`;
  }

  function chapterPage(c) {
    return heading(c.title,c.summary,"MECHANISM / WHY & HOW") + c.sections.map((s) => `<section class="section"><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p>${s.code === undefined ? "" : `<pre>${esc(json(s.code))}</pre>`}</section>`).join("") + refs(c.refs);
  }

  function flowPage(f) {
    const s = f.steps[step];
    const keys = Object.keys(s.data);
    if (!keys.includes(view)) view = keys[0];
    return heading(f.title,f.summary,"TRACE / DATA AT EACH BOUNDARY") + `<div class="flow-layout"><div class="steps" aria-label="流程步骤">${f.steps.map((v,i) => `<button type="button" data-step="${i}" class="${step === i ? "active" : ""}" aria-pressed="${step === i}">${String(i+1).padStart(2,"0")} · ${esc(v.title)}</button>`).join("")}</div><div><section class="card"><div class="num">STEP ${step+1} / ${f.steps.length}</div><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p><div class="callout"><h3>为什么这样做</h3><p>${esc(s.why)}</p></div>${refs(s.refs)}<div class="controls"><button type="button" data-step="${step-1}" ${step===0?"disabled":""}>← 上一步</button><button type="button" data-step="${step+1}" ${step===f.steps.length-1?"disabled":""}>下一步 →</button></div></section><div class="tabs" aria-label="数据视图">${keys.map((k) => `<button type="button" data-view="${esc(k)}" class="${k===view?"active":""}" aria-pressed="${k===view}">${esc(k)}</button>`).join("")}</div><p class="data-meta">${esc(view)} · JSON / 文本 · 可以横向滚动查看长行</p><pre>${esc(json(s.data[view]))}</pre></div></div>`;
  }

  function graphPage() {
    const positions = g.graphPositions || Object.fromEntries(g.packages.map((p,i) => [p.id,[40+(i%3)*280,35+Math.floor(i/3)*150]]));
    const graphHeight = Math.max(180,...Object.values(positions).map((p) => p[1]+85));
    const names = new Map(g.packages.map((p) => [p.name,p.id]));
    const edges = g.packages.flatMap((p) => p.dependencies.filter((d) => names.has(d)).map((d) => [p.id,names.get(d)]));
    const nodes = g.packages.filter((p) => positions[p.id]);
    const svgEdges = edges.map(([a,b]) => {
      if (!positions[a] || !positions[b]) return "";
      const [x,y] = positions[a], [u,v] = positions[b];
      return `<path class="edge" d="M${x+73},${y+43} C${x+73},${(y+v)/2+20} ${u+73},${(y+v)/2+20} ${u+73},${v-4}" marker-end="url(#arrow)"><title>${esc(a)} depends on ${esc(b)}</title></path>`;
    }).join("");
    return heading("模块依赖图",g.graphSummary || "箭头 A → B 表示已确认的内部依赖；它不代表执行先后。依赖依据见各模块的源码引用，开发依赖单独列出。") + `<div class="diagram"><svg class="graph-svg" viewBox="0 0 880 ${graphHeight}" role="img" aria-label="模块的直接依赖图"><defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="#b8c6d3"/></marker></defs>${svgEdges}${nodes.map((p) => {const [x,y]=positions[p.id];return `<a href="#${p.id}"><rect x="${x}" y="${y}" width="146" height="43" rx="7" fill="#fff" stroke="#c5d0dc"/><text x="${x+73}" y="${y+26}" text-anchor="middle">${esc(p.id)}</text></a>`;}).join("")}</svg></div><h2>逐条核对直接依赖</h2><div class="edge-list">${edges.map(([a,b]) => `<div><a href="#${a}">${a}</a> → <a href="#${b}">${b}</a></div>`).join("")}</div><h2>内部开发依赖</h2>${g.packages.filter((p) => p.devDependencies.some((d) => names.has(d))).map((p) => `<p>${esc(p.id)} → ${esc(p.devDependencies.filter((d) => names.has(d)).map((d) => names.get(d)).join(", "))}</p>`).join("")}`;
  }

  function comparisonPage() {
    const comparison = g.comparison;
    const keys = Object.keys(comparison.rounds[0].data);
    if (!keys.includes(compareView)) compareView = keys[0];
    const select = (id, value) => `<select id="${id}" aria-label="${id === 'compare-left' ? '左侧请求' : '右侧请求'}">${comparison.rounds.map((r,i) => `<option value="${i}" ${i===value?'selected':''}>${esc(r.label)}</option>`).join("")}</select>`;
    return heading(comparison.title,comparison.summary,"CONTEXT / SIDE BY SIDE") + `<div class="controls"><label for="compare-view">表示层</label><select id="compare-view">${keys.map((key) => `<option ${key===compareView?'selected':''}>${esc(key)}</option>`).join("")}</select></div><div class="grid comparison">${[["compare-left",compareLeft],["compare-right",compareRight]].map(([id,index]) => {const round=comparison.rounds[index];const value=round.data[compareView];return `<section><div class="controls">${select(id,index)}</div><p class="data-meta">${esc(round.note)} · 序列化字符数 ${JSON.stringify(value).length}（不是 token 数）</p><pre>${esc(json(value))}</pre></section>`;}).join("")}</div><div class="callout"><p>${esc(comparison.note)}</p></div>`;
  }

  function render() {
    navigation(document.querySelector("#search").value);
    const page = pages.find((p) => p.id === current);
    if (current === "overview") main.innerHTML = overview();
    else if (current === "graph") main.innerHTML = graphPage();
    else if (g.comparison && current === g.comparison.id) main.innerHTML = comparisonPage();
    else if (current === "sources") main.innerHTML = heading("源码索引","这里保存的是生成时的完整文件快照。点击代码引用会直接定位到对应行；修改项目后需要重新生成。") + '<div class="controls"><label for="file-filter">筛选文件</label><input id="file-filter" type="search" placeholder="路径、函数或源码内容"></div><div class="source-list" id="files"></div>';
    else if (current === "glossary") main.innerHTML = heading("先把词说清楚","遇到术语时，先用这个项目里的具体含义理解它。") + g.glossary.map((v) => `<section class="section"><h3>${esc(v.term)}</h3><p>${esc(v.meaning)}</p></section>`).join("");
    else if (current === "about") main.innerHTML = heading("证据、更新与复用","说明站点的证据边界，以及如何把这套方法用于下一份代码。") + g.scope.map((s) => `<section class="section"><p>${esc(s)}</p></section>`).join("") + `<h2>复用 skill</h2><p>Skill 的源文件位置与完整重建命令见生成目录中的 README.md；网站和项目样本保留在被分析项目，通用模板在 skill 源目录维护。</p><pre>$project-understanding 分析当前项目，生成中文架构学习网站，展示运行流程、中间数据和设计取舍。</pre><h2>重新生成快照</h2><pre>python3 /path/to/skill/scripts/build.py \\\n  --root . --content architecture-guide/content.json \\\n  --out architecture-guide/dist</pre><p>这条命令只重新打包已编写的说明和源码；代码变化后，需要先重新分析、更新说明及运行样本。</p>`;
    else if (page && g.modules.includes(page)) main.innerHTML = modulePage(page);
    else if (page && g.chapters.includes(page)) main.innerHTML = chapterPage(page);
    else if (page) main.innerHTML = flowPage(page);
    else main.innerHTML = heading("未找到页面","使用左侧目录继续阅读。");
    window.renderAtlasVisuals(current);
    if (current === "sources") filterSources("");
    if (page) {
      const index = g.reading.findIndex((p) => p.id === current);
      const next = g.reading[index+1];
      main.insertAdjacentHTML("beforeend", `<div class="footer-nav"><button type="button" id="mark-read">${completed.includes(current)?"取消已读":"标记为已读"}</button>${index>=0 && next ? `<a href="#${next.id}">继续：${esc(next.title)} →</a>` : '<a href="#overview">返回全局地图 →</a>'}</div>`);
    }
  }

  function filterSources(query) {
    const q = query.toLowerCase();
    const matches = Object.entries(g.sources).filter(([path,s]) => path.toLowerCase().includes(q) || s.text.toLowerCase().includes(q));
    document.querySelector("#files").innerHTML = matches.length ? matches.map(([path]) => refs([{path}])).join("") : '<p class="empty">没有匹配的源码快照。</p>';
  }

  function jump(line) {
    const target = document.querySelector(`#source-code [data-line="${line}"]`);
    if (!target) return;
    document.querySelectorAll("#source-code .highlight").forEach((e) => e.classList.remove("highlight"));
    target.classList.add("highlight");
    document.querySelector("#source-line").value = line;
    target.scrollIntoView({block:"center"});
  }

  document.addEventListener("click", (event) => {
    const source = event.target.closest("[data-source]");
    if (source) {
      selectedSource = source.dataset.source;
      const snapshot = g.sources[selectedSource];
      document.querySelector("#source-title").textContent = selectedSource;
      document.querySelector("#source-meta").textContent = `SHA-256 ${snapshot.sha256}`;
      document.querySelector("#source-code").innerHTML = snapshot.text.split("\n").map((line,i) => `<span data-line="${i+1}">${esc(line) || " "}</span>`).join("");
      document.querySelector("#source-query").value = "";
      dialog.showModal();
      jump(Number(source.dataset.line));
    }
    const stepButton = event.target.closest("[data-step]");
    if (stepButton) {
      const fromDiagram = Boolean(stepButton.closest(".visual-detail"));
      step = Number(stepButton.dataset.step);
      render();
      if (fromDiagram) document.querySelector(".flow-layout").scrollIntoView({block:"start"});
    }
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) { view = viewButton.dataset.view; render(); }
    if (event.target.id === "mark-read") {
      completed = completed.includes(current) ? completed.filter((id) => id !== current) : [...completed,current];
      try { localStorage.setItem(`atlas:${g.title}`, JSON.stringify(completed)); } catch { /* Optional persistence. */ }
      render();
    }
  });
  document.querySelector("#close-source").onclick = () => dialog.close();
  document.querySelector("#jump-source").onclick = () => jump(Number(document.querySelector("#source-line").value));
  document.querySelector("#find-source").onclick = () => {
    const query = document.querySelector("#source-query").value.toLowerCase();
    if (!query) return;
    const lines = g.sources[selectedSource].text.split("\n");
    const from = Number(document.querySelector("#source-line").value);
    for (let offset=0;offset<lines.length;offset++) {
      const i = (from+offset)%lines.length;
      if (lines[i].toLowerCase().includes(query)) { jump(i+1); return; }
    }
  };
  document.addEventListener("input", (event) => {
    if (event.target.id === "search") navigation(event.target.value);
    if (event.target.id === "file-filter") filterSources(event.target.value);
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "compare-left") compareLeft = Number(event.target.value);
    else if (event.target.id === "compare-right") compareRight = Number(event.target.value);
    else if (event.target.id === "compare-view") compareView = event.target.value;
    else return;
    render();
  });
  function route() {
    current = location.hash.slice(1) || "overview";
    step = 0;
    view = "";
    render();
    window.scrollTo(0,0);
  }
  window.addEventListener("hashchange", route);
  route();
})();
