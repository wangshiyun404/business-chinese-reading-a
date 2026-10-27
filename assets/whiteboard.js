/* A session-only drawing layer for live classroom annotation. */
(function () {
  'use strict';
  const main = document.getElementById('main');
  const header = document.querySelector('body > header');
  const workbench = window.BusinessWorkbench;
  if (!main || !header || !workbench) return;

  let canvas = null;
  let active = false;
  let erasing = false;
  let colour = '#d43030';
  let width = 4;
  let strokes = [];
  let current = null;
  let raf = 0;

  function addHeaderButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tbtn';
    button.id = 'wb-pen';
    button.textContent = '画笔';
    button.title = '课堂圈画与勾画（P）';
    const settings = document.getElementById('wb-settings');
    if (settings) header.insertBefore(button, settings); else header.appendChild(button);
    button.addEventListener('click', () => setActive(!active));
    return button;
  }

  const penButton = addHeaderButton();
  const panel = document.createElement('aside');
  panel.className = 'wb-pen-panel';
  panel.id = 'wb-pen-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', '课堂画笔工具');
  panel.innerHTML = [
    '<h3>课堂画笔</h3>',
    '<p>拖动鼠标即可圈画。切换教材环节会自动清空当前笔迹。</p>',
    '<div class="wb-pen-row"><span>颜色</span>',
    '<button type="button" class="wb-pen-color" data-colour="#d43030" aria-label="红色" style="background:#d43030"></button>',
    '<button type="button" class="wb-pen-color" data-colour="#195fc3" aria-label="蓝色" style="background:#195fc3"></button>',
    '<button type="button" class="wb-pen-color" data-colour="#187948" aria-label="绿色" style="background:#187948"></button>',
    '<button type="button" class="wb-pen-color" data-colour="#242424" aria-label="黑色" style="background:#242424"></button></div>',
    '<div class="wb-pen-row"><span>粗细</span>',
    '<button type="button" class="wb-pen-size" data-width="3" aria-label="细" style="--pen-dot:5px"></button>',
    '<button type="button" class="wb-pen-size" data-width="5" aria-label="中" style="--pen-dot:9px"></button>',
    '<button type="button" class="wb-pen-size" data-width="8" aria-label="粗" style="--pen-dot:14px"></button></div>',
    '<div class="wb-actions">',
    '<button type="button" class="wb-button" id="wb-eraser">橡皮擦</button>',
    '<button type="button" class="wb-button" id="wb-pen-undo">撤销一笔</button>',
    '<button type="button" class="wb-button" id="wb-pen-clear">清除全部</button>',
    '</div>'
  ].join('');
  document.body.appendChild(panel);

  function syncControls() {
    penButton.classList.toggle('is-active', active);
    penButton.setAttribute('aria-pressed', String(active));
    penButton.textContent = active ? '画笔开' : '画笔';
    panel.hidden = !active;
    panel.querySelectorAll('[data-colour]').forEach(node => node.setAttribute('aria-pressed', String(!erasing && node.dataset.colour === colour)));
    panel.querySelectorAll('[data-width]').forEach(node => node.setAttribute('aria-pressed', String(+node.dataset.width === width)));
    document.getElementById('wb-eraser').classList.toggle('wb-primary', erasing);
    document.getElementById('wb-eraser').textContent = erasing ? '橡皮擦开' : '橡皮擦';
    document.getElementById('wb-pen-undo').disabled = !strokes.length;
    document.getElementById('wb-pen-clear').disabled = !strokes.length;
  }

  function dimensions() {
    return { width: Math.max(main.clientWidth, main.scrollWidth), height: Math.max(main.clientHeight, main.scrollHeight) };
  }

  function drawStroke(context, stroke) {
    if (!stroke.points.length) return;
    context.save();
    context.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
    context.strokeStyle = stroke.colour;
    context.lineWidth = stroke.width;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    if (stroke.points.length === 1) context.lineTo(stroke.points[0].x + 0.01, stroke.points[0].y + 0.01);
    else stroke.points.slice(1).forEach(point => context.lineTo(point.x, point.y));
    context.stroke();
    context.restore();
  }

  function renderCanvas() {
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const size = dimensions();
    canvas.style.width = size.width + 'px';
    canvas.style.height = size.height + 'px';
    canvas.width = Math.ceil(size.width * dpr);
    canvas.height = Math.ceil(size.height * dpr);
    const context = canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    strokes.forEach(stroke => drawStroke(context, stroke));
    syncControls();
  }

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function begin(event) {
    if (!active || event.button !== 0) return;
    event.preventDefault();
    current = { colour, width: erasing ? Math.max(20, width * 4) : width, erase: erasing, points: [point(event)] };
    strokes.push(current);
    canvas.setPointerCapture(event.pointerId);
    renderCanvas();
  }

  function move(event) {
    if (!current || !active) return;
    event.preventDefault();
    current.points.push(point(event));
    renderCanvas();
  }

  function finish(event) {
    if (!current) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    current = null;
    syncControls();
  }

  function mount() {
    if (canvas?.parentElement === main) canvas.remove();
    canvas = document.createElement('canvas');
    canvas.className = 'wb-whiteboard';
    canvas.classList.toggle('is-drawing', active);
    canvas.setAttribute('aria-label', '课堂圈画区域');
    canvas.addEventListener('pointerdown', begin);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
    main.appendChild(canvas);
    renderCanvas();
  }

  function scheduleResize() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(renderCanvas);
  }

  function setActive(next) {
    active = next;
    if (!active) { current = null; }
    if (canvas) canvas.classList.toggle('is-drawing', active);
    syncControls();
    workbench.toast(active ? '画笔已开启：在教材内容上拖动鼠标即可圈画。' : '画笔已关闭，可以继续操作教材。');
  }

  panel.querySelectorAll('[data-colour]').forEach(node => node.addEventListener('click', () => { colour = node.dataset.colour; erasing = false; syncControls(); }));
  panel.querySelectorAll('[data-width]').forEach(node => node.addEventListener('click', () => { width = +node.dataset.width; syncControls(); }));
  document.getElementById('wb-eraser').addEventListener('click', () => { erasing = !erasing; syncControls(); });
  document.getElementById('wb-pen-undo').addEventListener('click', () => { strokes.pop(); renderCanvas(); });
  document.getElementById('wb-pen-clear').addEventListener('click', () => { strokes = []; renderCanvas(); workbench.toast('当前教学环节的笔迹已清除。'); });
  document.addEventListener('business-render', () => { strokes = []; current = null; mount(); });
  new ResizeObserver(scheduleResize).observe(main);
  window.addEventListener('resize', scheduleResize);
  document.addEventListener('keydown', event => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable) return;
    if (event.key.toLowerCase() === 'p' && !document.getElementById('wb-modal').hidden) return;
    if (event.key.toLowerCase() === 'p') { event.preventDefault(); setActive(!active); }
    if (event.key === 'Escape' && active) { event.preventDefault(); setActive(false); }
  });
  mount();
  window.BusinessWhiteboard = { clear: () => { strokes = []; renderCanvas(); }, enabled: () => active };
}());
