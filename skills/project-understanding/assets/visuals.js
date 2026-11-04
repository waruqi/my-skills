/* 离线渲染分层架构图，节点直接进入子页或定位当前讲解。 */
(() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  window.renderAtlasVisuals = (page) => {
    const diagrams = (window.GUIDE.diagrams || []).filter((d) => d.pages.includes(page));
    if (!diagrams.length) return;
    const host = document.createElement("div");
    host.className = "visual-gallery";
    host.innerHTML = diagrams.map((d, index) => {
      const marker = `visual-arrow-${index}`;
      const nodes = d.nodes.map(n => {
        const w=n.w||180,h=n.h||70,cx=n.x+w/2,cy=n.y+h/2;
        const shape=n.shape||'box';
        const outline=shape==='decision' ? `<polygon class="node-shape" points="${cx},${n.y} ${n.x+w},${cy} ${cx},${n.y+h} ${n.x},${cy}"/>` : shape==='terminal' ? `<ellipse class="node-shape" cx="${cx}" cy="${cy}" rx="${w/2}" ry="${h/2}"/>` : `<rect class="node-shape" x="${n.x}" y="${n.y}" width="${w}" height="${h}" rx="${shape==='state'?h/2:shape==='record'?5:12}"/>`;
        const labelY=['decision','terminal','state'].includes(shape)?cy-(n.sub?5:-5):n.y+27;
        return `<g class="visual-node tone-${esc(n.tone||'green')} shape-${shape}" tabindex="0" role="button" aria-label="${esc(n.label)}" data-node="${esc(n.id)}">${outline}<text x="${cx}" y="${labelY}" text-anchor="middle">${esc(n.label)}</text>${n.sub?`<text class="node-sub" x="${cx}" y="${labelY+21}" text-anchor="middle">${esc(n.sub)}</text>`:''}${(n.rows||[]).map((row,i)=>`<line class="record-rule" x1="${n.x+10}" x2="${n.x+w-10}" y1="${n.y+66+i*40}" y2="${n.y+66+i*40}"/><text class="record-value" x="${n.x+15}" y="${n.y+91+i*40}">${esc(row)}</text>`).join('')}</g>`;
      }).join('');
      const edges = d.edges.map((e) => `<g class="visual-edge ${e.dashed?'dashed':''}"><path d="${esc(e.d)}" ${e.arrow === false ? '' : `marker-end="url(#${marker})"`}/><text x="${e.x}" y="${e.y}" text-anchor="middle">${esc(e.label)}</text></g>`).join("");
      return `<section class="visual-card" data-diagram="${esc(d.id)}" data-diagram-type="${esc(d.type||'architecture')}"><div class="visual-heading"><div><span class="eyebrow">${esc(d.kind)}</span><h2><span class="diagram-kind">${esc({sequence:'时序',swimlane:'泳道',state:'状态',hierarchy:'层级',dataflow:'数据流',comparison:'对照'}[d.type]||'架构')}</span>${esc(d.title)}</h2></div><div class="controls"><button data-zoom="-" aria-label="缩小图">−</button><button data-zoom="reset">适应宽度</button><button data-zoom="+" aria-label="放大图">＋</button></div></div><p class="visual-caption">${esc(d.caption)}</p><div class="visual-scroll"><svg class="atlas-svg" viewBox="0 0 ${d.width} ${d.height}" aria-label="${esc(d.title)}" role="group"><defs><marker id="${marker}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="#7794a7"/></marker></defs>${(d.bands || []).map((b) => `<rect class="visual-band" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="16"/><text class="band-title" x="${b.x+18}" y="${b.y+25}">${esc(b.label)}</text>`).join("")}${(d.lifelines || []).map((l) => `<line class="lifeline" x1="${l.x}" x2="${l.x}" y1="${l.y}" y2="${l.end}"/>`).join("")}${edges}${nodes}</svg></div><div class="visual-detail" aria-live="polite"><strong>点击图中任意节点</strong><p>查看它的职责、设计原因，以及对应的步骤或源码。</p></div></section>`;
    }).join("");
    document.querySelector("main .hero").after(host);
    for (const card of host.querySelectorAll(".visual-card")) {
      const d = diagrams.find((item) => item.id === card.dataset.diagram);
      if (d.after) document.getElementById(`section-${d.after}`).after(card);
      let zoom = 1;
      const select = (node) => {
        if (node.target) { if (window.navigateGuide) window.navigateGuide(node.target); else location.hash = node.target; return; }
        card.querySelectorAll(".visual-node").forEach((el) => el.classList.toggle("selected", el.dataset.node === node.id));
        if (node.section) {
          window.revealGuideSection?.(node.section);
          const section = document.getElementById(`section-${node.section}`);
          document.querySelectorAll('.section.selected').forEach(el => el.classList.remove('selected'));
          section.classList.add('selected');
          section.querySelectorAll('details').forEach(el => { el.open = true; });
          section.focus({preventScroll:true});
          section.scrollIntoView({block:'start'});
          return;
        }
        const ref = node.ref;
        if(ref && card.closest('.lesson-visual')) document.dispatchEvent(new CustomEvent('guide-code-ref',{detail:{path:ref.path,line:ref.line||1}}));
        card.querySelector(".visual-detail").innerHTML = `<strong>${esc(node.label)}</strong><p>${esc(node.detail || node.sub)}</p><div class="controls">${ref ? `<button class="source-link" data-source="${esc(ref.path)}" data-line="${ref.line || 1}">${esc(ref.path)}:${ref.line || 1}</button>` : ""}</div>`;
      };
      card.addEventListener("click", (event) => {
        const node = event.target.closest("[data-node]");
        if (node) select(d.nodes.find((item) => item.id === node.dataset.node));
        const button = event.target.closest("[data-zoom]");
        if (button) {
          zoom = button.dataset.zoom === 'reset' ? 1 : Math.max(0.6, Math.min(2.5, zoom + (button.dataset.zoom === '+' ? 0.25 : -0.25)));
          const svg = card.querySelector(".atlas-svg");
          svg.style.width = zoom === 1 ? '100%' : `${card.querySelector('.visual-scroll').clientWidth*zoom}px`;
          svg.style.height = zoom === 1 ? '100%' : 'auto';
          svg.style.maxHeight = zoom === 1 ? '100%' : 'none';
          svg.style.flexShrink = '0';
        }
      });
      card.addEventListener("keydown", (event) => {
        if (event.target.matches("[data-node]") && ['Enter',' '].includes(event.key)) {
          event.preventDefault();
          select(d.nodes.find((item) => item.id === event.target.dataset.node));
        }
      });
    }
  };
})();
