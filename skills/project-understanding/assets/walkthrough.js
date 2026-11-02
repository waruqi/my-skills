/* 按项目提供的步骤播放架构图，所有样本和节点由内容文件声明。 */
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pretty = value => typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  window.renderWalkthrough = page => {
    const flow = page.walkthrough;
    if (!flow) return;
    const card = [...document.querySelectorAll('.visual-card')].find(el => el.dataset.diagram === flow.diagram);
    const svg = card.querySelector('svg');
    const diagram = window.GUIDE.diagrams.find(d => d.id === flow.diagram);
    card.classList.add('walkthrough-card');
    card.querySelector('.visual-detail').hidden = true;
    const controls = document.createElement('section');
    controls.className = 'walkthrough-controls';
    const phases = [...new Set(flow.steps.map(step => step.phase))];
    controls.innerHTML = `<div class="walkthrough-toolbar"><button data-action="play" aria-pressed="false">播放</button><button data-action="previous">上一步</button><button data-action="next">下一步</button><button data-action="restart">从头开始</button><label>速度 <select aria-label="播放速度"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><span class="walkthrough-position" role="status"></span></div><label class="walkthrough-progress">步骤 <input type="range" min="0" max="${flow.steps.length - 1}" value="0" aria-label="演示进度"></label><nav class="walkthrough-phases" aria-label="演示阶段">${phases.map(phase => `<button data-step="${flow.steps.findIndex(s => s.phase === phase)}">${esc(phase)}</button>`).join('')}</nav><p class="walkthrough-evidence">${esc(flow.evidence)}</p><div class="walkthrough-story" aria-live="polite"></div>`;
    card.prepend(controls);
    const layout = document.createElement('div');
    layout.className = 'walkthrough-layout';
    const scroll = card.querySelector('.visual-scroll');
    scroll.before(layout);
    layout.append(scroll);
    const inspector = document.createElement('div');
    inspector.className = 'walkthrough-inspector';
    layout.append(inspector);
    let index = 0, playing = false, timer;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const play = controls.querySelector('[data-action="play"]');
    const range = controls.querySelector('input');
    const speed = controls.querySelector('select');
    function pause() {
      playing = false;
      clearTimeout(timer);
      play.textContent = index === flow.steps.length - 1 ? '重播' : '播放';
      play.setAttribute('aria-pressed', 'false');
      svg.pauseAnimations();
    }
    function schedule() {
      clearTimeout(timer);
      if (!playing) return;
      timer = setTimeout(() => {
        if (index < flow.steps.length - 1) { index++; draw(); schedule(); }
      }, 6500 / Number(speed.value));
    }
    function draw() {
      const step = flow.steps[index];
      if (index === flow.steps.length - 1) pause();
      if (!playing) play.textContent = index === flow.steps.length - 1 ? '重播' : '播放';
      range.value = index;
      range.setAttribute('aria-valuetext', `${index + 1} / ${flow.steps.length}：${step.title}`);
      controls.querySelector('.walkthrough-position').textContent = `${index + 1} / ${flow.steps.length} · ${step.phase}`;
      controls.querySelector('[data-action="previous"]').disabled = index === 0;
      controls.querySelector('[data-action="next"]').disabled = index === flow.steps.length - 1;
      controls.querySelectorAll('[data-step]').forEach(button => button.setAttribute('aria-current', String(flow.steps[Number(button.dataset.step)].phase === step.phase)));
      controls.querySelector('.walkthrough-story').innerHTML = `<h2>${esc(step.title)}</h2><p>${esc(step.text)}</p><small>${esc(step.evidence)}</small>`;
      svg.querySelectorAll('.visual-node').forEach(node => {
        node.classList.toggle('walkthrough-active', step.nodes.includes(node.dataset.node));
        node.classList.toggle('walkthrough-muted', !step.nodes.includes(node.dataset.node));
      });
      svg.querySelectorAll('.visual-edge').forEach((edge, i) => edge.classList.toggle('walkthrough-edge', step.edges.includes(i)));
      svg.querySelectorAll('.walkthrough-dot').forEach(dot => dot.remove());
      for (const edgeIndex of step.edges) {
        const path = svg.querySelectorAll('.visual-edge path')[edgeIndex];
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('class', 'walkthrough-dot');dot.setAttribute('r', '5');
        if (playing && !reduced.matches) {
          const motion = document.createElementNS('http://www.w3.org/2000/svg', 'animateMotion');
          motion.setAttribute('path', diagram.edges[edgeIndex].d);
          motion.setAttribute('dur', `${2 / Number(speed.value)}s`);motion.setAttribute('repeatCount', 'indefinite');
          dot.append(motion);
        } else {
          const point = path.getPointAtLength(path.getTotalLength() / 2);
          dot.setAttribute('cx', point.x);dot.setAttribute('cy', point.y);
        }
        svg.append(dot);
      }
      if (playing) svg.unpauseAnimations();
      const packet = (side, label) => `<section class="walkthrough-packet"><small>${esc(label)} · ${esc(side.format)}</small><h3>${esc(side.label)}</h3><pre>${esc(pretty(side.sample))}</pre></section>`;
      inspector.innerHTML = `${packet(step.input, '输入')}${packet(step.output, '输出')}<section class="walkthrough-screen"><h3>${esc(step.screen.title)}</h3><pre>${esc(step.screen.text)}</pre></section><div class="walkthrough-sources">${(step.refs || []).map(ref => `<button class="source-link" data-source="${esc(ref.path)}" data-line="${ref.line}">${esc(ref.path)}:${ref.line}</button>`).join('')}${step.page ? `<a href="#${esc(step.page)}">查看模块说明 →</a>` : ''}</div>${step.data ? `<details class="walkthrough-full"><summary>查看本步完整数据</summary>${Object.entries(step.data).map(([label, value]) => `<h3>${esc(label)}</h3><pre>${esc(pretty(value))}</pre>`).join('')}</details>` : ''}`;
    }
    controls.addEventListener('click', event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      const jump = event.target.closest('[data-step]');
      if (action === 'play') {
        if (playing) { pause(); return; }
        if (index === flow.steps.length - 1) index = 0;
        playing = true;play.textContent = '暂停';play.setAttribute('aria-pressed', 'true');draw();schedule();return;
      }
      if (action || jump) {
        pause();
        index = jump ? Number(jump.dataset.step) : action === 'restart' ? 0 : Math.max(0, Math.min(flow.steps.length - 1, index + (action === 'next' ? 1 : -1)));
        draw();
      }
    });
    range.addEventListener('input', () => { pause();index = Number(range.value);draw(); });
    speed.addEventListener('change', () => { draw();schedule(); });
    card.addEventListener('click', event => { if (event.target.closest('.source-link, .visual-node, .walkthrough-full, .walkthrough-sources a')) pause(); });
    card.addEventListener('keydown', event => { if (event.target.closest('.visual-node') && ['Enter', ' '].includes(event.key)) pause(); });
    const onVisibility = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.disposeWalkthrough = () => { pause();document.removeEventListener('visibilitychange', onVisibility); };
    draw();
  };
})();
