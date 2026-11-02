/* 图作为页面入口，正文把职责、数据与源码连接起来。 */
(() => {
  const g = window.GUIDE;
  const main = document.querySelector("main");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  document.title = g.title;
  document.querySelector("#project-home").textContent = g.title;
  document.querySelector("#revision").textContent = g.revision.slice(0, 12);

  const featured = g.lesson ? [] : g.pages.filter(page => page.featuredLabel);
  const featuredLinks = featured.map(page => `<a href="#${esc(page.id)}" data-featured="${esc(page.id)}">${esc(page.featuredLabel)}</a>`).join('');
  if (featured.length) {
    document.querySelector('#project-home').insertAdjacentHTML('afterend', `<nav class="featured-nav" aria-label="专题">${featuredLinks}</nav>`);
    document.querySelector('#project-sidebar').insertAdjacentHTML('afterbegin', `<nav class="featured-sidebar" aria-label="专题">${featuredLinks}</nav>`);
  }
  if (g.lesson) document.querySelector('#project-home').insertAdjacentHTML('afterend', '<a href="#lesson/0">连续讲解</a>');
  function featuredHtml() {
    return featured.map(page => `<a class="featured-card" href="#${esc(page.id)}"><div><strong>${esc(page.featuredLabel)}</strong><p>${esc(page.featuredDescription || page.summary)}</p></div><span>查看图解 →</span></a>`).join('');
  }

  function exchangeHtml(flow) {
    if (!flow) return '';
    const packet = (side) => `<div class="packet"><h3>${esc(side.label)}</h3><small>${esc(side.format)}</small><pre>${esc(typeof side.sample === 'string' ? side.sample : JSON.stringify(side.sample,null,2))}</pre><p>${esc(side.text)}</p></div>`;
    return `<section class="exchange"><h2>${esc(flow.title)}</h2><p class="evidence">${esc(flow.evidence)}</p><div class="exchange-track">${packet(flow.input)}<div class="exchange-action"><span aria-hidden="true">→</span><h3>${esc(flow.action)}</h3><p>${esc(flow.text)}</p><span aria-hidden="true">→</span></div>${packet(flow.output)}</div></section>`;
  }

  function render() {
    window.disposeLesson?.();
    window.disposeLesson = undefined;
    window.disposeWalkthrough?.();
    window.disposeWalkthrough = undefined;
    const route = location.hash.slice(1) || "overview";
    const lesson = window.lessonRoute(route);
    const id = lesson?.invalid ? '' : lesson ? lesson.slide.page : route.replace(/^reference\//, '');
    document.querySelectorAll('[data-featured]').forEach(link => {
      let current = g.pages.find(page => page.id === id);
      while (current && current.id !== link.dataset.featured) current = g.pages.find(page => page.id === current.parent);
      if (current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (id === 'history' || id.startsWith('history/')) { window.renderHistory(id); return; }
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
    main.innerHTML = `<header class="hero"><div class="eyebrow">第 ${ancestors.length} 层 · ${esc({overview:'系统全景',subsystem:'子架构',module:'模块',flow:'运行过程',code:'实现与代码'}[page.kind])}</div><h1>${esc(page.title)}</h1><p class="lead">${esc(page.summary)}</p>${page.id === "overview" ? featuredHtml() : ""}</header>${exchangeHtml(page.exchange)}<article class="explanation">${page.sections.map(s => `<section class="section" id="section-${esc(s.id)}" tabindex="-1"><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p>${s.media ? `<figure class="product-screen"><img src="${esc(s.media.src)}" alt="${esc(s.media.alt)}" loading="lazy"><figcaption>${esc(s.media.caption)}</figcaption></figure>` : ''}${s.data ? `<div class="samples">${Object.entries(s.data).map(([label,value]) => `<details class="sample" open><summary>${esc(label)}</summary><pre>${esc(typeof value === 'string' ? value : JSON.stringify(value,null,2))}</pre></details>`).join('')}</div>` : ''}${(s.refs || []).map(r => `<div class="code-evidence"><p>${esc(r.note || '从这里看对应实现')}</p><button class="source-link" data-source="${esc(r.path)}" data-line="${r.line}">${esc(r.path)}:${r.line} · 打开完整源码</button><details ${page.kind === 'code' ? 'open' : ''}><summary>查看关键片段（从第 ${r.line} 行起）</summary><pre>${esc(r.excerpt)}</pre></details></div>`).join('')}</section>`).join('')}</article>${page.parent ? `<footer><a href="#${esc(page.parent)}">← 返回上层架构图</a></footer>` : ''}`;
    window.renderAtlasVisuals(page.id);
    window.renderWalkthrough(page, lesson?.slide);
    if (lesson && !lesson.invalid) window.renderLesson(page, lesson);
    window.decorateSourceExcerpts();
    window.scrollTo(0,0);
  }

  window.addEventListener("hashchange", render);
  render();
})();
