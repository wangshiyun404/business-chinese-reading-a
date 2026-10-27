(function () {
  'use strict';
  const scales = [1, 1.15, 1.3, 1.45, 1.6, 1.8, 2], defaultIndex = 2;
  const W = window.BusinessWorkbench, B = window.BusinessBook;
  const main = document.getElementById('main');
  if (!main || !W || !B) return;
  let index = defaultIndex;
  const normalize = value => Number.isInteger(value) ? Math.max(0, Math.min(scales.length - 1, value)) : defaultIndex;

  // Replace only these controls to remove the original, ineffective body-size handlers.
  function freshButton(id) {
    const old = document.getElementById(id);
    if (!old) return null;
    const copy = old.cloneNode(true);
    old.replaceWith(copy);
    copy.type = 'button';
    return copy;
  }
  const smaller = freshButton('btn-fs-dec'), larger = freshButton('btn-fs-inc');
  const value = document.createElement('button');
  value.id = 'btn-fs-value'; value.type = 'button'; value.className = 'tbtn';
  value.setAttribute('aria-live', 'polite');
  if (larger) larger.before(value);

  function visibleAnchor() {
    const top = main.getBoundingClientRect().top + (main.querySelector('.subnav')?.getBoundingClientRect().height || 0) + 12;
    const nodes = main.querySelectorAll('.qcard,.key-s,.bubble-row,.scene-line,.vcard,.lp,.kewen-card p,.ex-item,.match-wrap,.pcard,.vtab tbody tr,.lcard,.rl-card');
    for (const node of nodes) {
      const box = node.getBoundingClientRect();
      if (box.height > 0 && box.bottom > top) return {node, top:box.top};
    }
    return null;
  }

  function tableRegions() {
    main.querySelectorAll('.book-table,.vtab table').forEach(table => {
      if (table.parentElement.classList.contains('reading-table-scroll')) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'reading-table-scroll';
      wrapper.tabIndex = 0; wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('aria-label', '教材表格；内容较宽时可左右滚动');
      table.before(wrapper); wrapper.appendChild(table);
    });
  }

  function apply(next) {
    const anchor = visibleAnchor();
    index = normalize(next);
    document.documentElement.style.setProperty('--reading-scale', String(scales[index]));
    value.textContent = Math.round(scales[index] * 100) + '%';
    value.title = '当前教材字号 ' + value.textContent + '；点击恢复默认 130%';
    value.setAttribute('aria-label', value.title);
    if (smaller) { smaller.disabled = index === 0; smaller.title = '减小教材字号'; }
    if (larger) { larger.disabled = index === scales.length - 1; larger.title = '增大教材字号'; }
    tableRegions();
    // Keep the same visible paragraph/card without re-rendering or clearing answers.
    if (anchor && anchor.node.isConnected) main.scrollTop += anchor.node.getBoundingClientRect().top - anchor.top;
    return scales[index];
  }

  function choose(next) {
    next = normalize(next);
    if (next === index) return;
    if (W.commit('调整教材字号', state => { state.prefs.font = next; })) {
      B.setFont(next);
      // The call is harmless if setFont already invokes apply; supports gradual integration.
      if (index !== next) apply(next);
    }
  }
  if (smaller) smaller.addEventListener('click', () => choose(index - 1));
  if (larger) larger.addEventListener('click', () => choose(index + 1));
  value.addEventListener('click', () => choose(defaultIndex));
  window.BusinessReadingFont = {apply, scales:scales.slice(), defaultIndex};
  document.addEventListener('business-render', tableRegions);
  B.setFont(normalize(W.getState().prefs.font));
  apply(W.getState().prefs.font);
})();
