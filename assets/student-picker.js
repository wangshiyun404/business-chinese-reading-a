/* Real-student classroom picker. Course data and storage belong to BusinessWorkbench. */
(function () {
  'use strict';

  function randomIndex(length) {
    if (window.crypto && window.crypto.getRandomValues) {
      var sample = new Uint32Array(1);
      var limit = Math.floor(4294967296 / length) * length;
      do { window.crypto.getRandomValues(sample); } while (sample[0] >= limit);
      return sample[0] % length;
    }
    return Math.floor(Math.random() * length);
  }

  function open() {
    var W = window.BusinessWorkbench;
    if (!W) { return; }
    var students = [];
    var byId = new Map();
    var nameCounts = new Map();
    ((W.course && W.course.students) || []).forEach(function (source, index) {
      if (!source || source.id == null || !String(source.name || '').trim()) { return; }
      var id = String(source.id);
      if (!id || byId.has(id)) { return; }
      var student = { id: id, name: String(source.name).trim(), ordinal: index + 1 };
      students.push(student);
      byId.set(id, student);
      nameCounts.set(student.name, (nameCounts.get(student.name) || 0) + 1);
    });
    students.forEach(function (student) {
      student.label = student.name + (nameCounts.get(student.name) > 1 ? '（名单第 ' + student.ordinal + ' 位）' : '');
    });

    var body = W.modal('随机抽问 · 真实学生',
      '<p class="wb-muted">使用本课程学生名单。本轮抽完前不重复；抽取记录和参与设置会自动保存。</p>' +
      '<p data-picker="counts"></p>' +
      '<section class="wb-card" aria-live="polite" aria-atomic="true" role="status">' +
        '<p class="wb-muted" data-picker="result-label"></p>' +
        '<div class="wb-picker-name" data-picker="name"></div>' +
        '<p class="wb-muted" data-picker="previous"></p>' +
      '</section>' +
      '<div class="wb-actions">' +
        '<button type="button" class="wb-button wb-primary" data-picker="draw">抽取一位同学</button>' +
        '<button type="button" class="wb-button" data-picker="undo">撤销最近抽取</button>' +
      '</div>' +
      '<p class="wb-muted" data-picker="pool-note"></p>' +
      '<div class="wb-actions"><button type="button" class="wb-button" data-picker="new-round">开始新一轮</button></div>' +
      '<section class="wb-card" data-picker="confirm" hidden>' +
        '<p data-picker="confirm-text"></p>' +
        '<div class="wb-actions"><button type="button" class="wb-button wb-primary" data-picker="confirm-round">确认开始新一轮</button>' +
        '<button type="button" class="wb-button" data-picker="cancel-round">取消</button></div>' +
      '</section>' +
      '<details><summary data-picker="history-summary">本轮已抽与待抽</summary>' +
        '<div class="wb-grid"><section><h3 data-picker="drawn-title">已抽取</h3><div class="wb-actions" data-picker="drawn"></div></section>' +
        '<section><h3 data-picker="waiting-title">待抽取</h3><div class="wb-actions" data-picker="waiting"></div></section></div>' +
      '</details>' +
      '<details><summary data-picker="roster-summary">管理参与名单</summary>' +
        '<p class="wb-muted">勾选表示参与抽问。取消勾选可临时排除缺席同学；设置会保留到下次打开。开始新一轮也会保留暂不参与的名单。</p>' +
        '<div class="wb-actions"><button type="button" class="wb-button" data-picker="include-all">恢复全部参与</button>' +
        '<button type="button" class="wb-button" data-picker="exclude-all">全部暂不参与</button></div>' +
        '<div class="wb-roster" data-picker="roster"></div>' +
      '</details>');
    if (!body) { return; }

    var resultKind = 'latest';
    var confirming = false;
    var rows = [];
    function el(name) { return body.querySelector('[data-picker="' + name + '"]'); }
    function knownUnique(values) {
      var seen = new Set();
      return (Array.isArray(values) ? values : []).map(String).filter(function (id) {
        if (!byId.has(id) || seen.has(id)) { return false; }
        seen.add(id);
        return true;
      });
    }
    function read() {
      var state = W.getState() || {};
      var p = state.picker || {};
      return { drawn: knownUnique(p.drawn), excluded: knownUnique(p.excluded) };
    }
    function remaining(p) {
      var unavailable = new Set(p.drawn.concat(p.excluded));
      return students.filter(function (student) { return !unavailable.has(student.id); });
    }
    function save(p, label) {
      W.commit(label, function (state) {
        state.picker = Object.assign({}, state.picker || {}, {
          drawn: p.drawn.slice(), excluded: p.excluded.slice()
        });
      });
      render();
    }
    function chips(target, ids, emptyText) {
      target.textContent = '';
      if (!ids.length) {
        var empty = document.createElement('span');
        empty.className = 'wb-muted';
        empty.textContent = emptyText;
        target.appendChild(empty);
        return;
      }
      ids.forEach(function (id, index) {
        var chip = document.createElement('span');
        chip.className = 'wb-badge';
        chip.textContent = (target === el('drawn') ? (index + 1) + '. ' : '') + byId.get(id).label;
        target.appendChild(chip);
      });
    }

    students.forEach(function (student) {
      var row = document.createElement('label');
      row.className = 'wb-card';
      var check = document.createElement('input');
      check.type = 'checkbox';
      check.setAttribute('aria-label', student.label + '参与抽问');
      var name = document.createElement('span');
      name.textContent = ' ' + student.label + ' ';
      var status = document.createElement('span');
      status.className = 'wb-muted';
      row.appendChild(check);
      row.appendChild(name);
      row.appendChild(status);
      el('roster').appendChild(row);
      rows.push({ student: student, check: check, status: status });
      check.addEventListener('change', function () {
        var p = read();
        p.excluded = p.excluded.filter(function (id) { return id !== student.id; });
        if (!check.checked) { p.excluded.push(student.id); }
        confirming = false;
        save(p, check.checked ? '恢复学生参与抽问' : '临时排除缺席学生');
      });
    });

    function render() {
      var p = read();
      var pool = remaining(p);
      var lastId = p.drawn[p.drawn.length - 1];
      var previousId = p.drawn[p.drawn.length - 2];
      el('counts').textContent = '全班 ' + students.length + ' 人 · 已抽 ' + p.drawn.length + ' 人 · 待抽 ' + pool.length + ' 人 · 暂不参与 ' + p.excluded.length + ' 人';
      el('result-label').textContent = lastId ? (resultKind === 'current' ? '本次抽到' : '最近一次抽到') : '准备开始';
      el('name').textContent = lastId ? byId.get(lastId).label : (students.length ? '下一位，会是谁？' : '暂无学生名单');
      el('previous').textContent = previousId ? '前一位：' + byId.get(previousId).label : (lastId ? '这是本轮第 1 次抽取' : '点击下方按钮，随机邀请一位同学');
      el('draw').disabled = !pool.length;
      el('draw').textContent = pool.length ? '抽取一位同学' : (!students.length ? '暂无可用名单' : (p.excluded.length === students.length ? '暂无参与同学' : '本轮可参与同学已抽完'));
      el('undo').disabled = !p.drawn.length;
      el('new-round').disabled = !p.drawn.length;
      el('include-all').disabled = !p.excluded.length;
      el('exclude-all').disabled = !students.length || p.excluded.length === students.length;
      el('pool-note').textContent = !students.length ? '暂无可用学生名单，请检查本课程名单材料。' :
        (p.excluded.length === students.length ? '所有同学暂不参与。请展开“管理参与名单”，勾选到场同学或恢复全部参与。' :
          (!pool.length ? '本轮可参与同学已抽完。可开始新一轮，或恢复尚未抽过的同学参与。' : '还有 ' + pool.length + ' 位同学等待参与。'));
      el('history-summary').textContent = '本轮已抽与待抽（已抽 ' + p.drawn.length + ' / 待抽 ' + pool.length + '）';
      el('drawn-title').textContent = '已抽取（' + p.drawn.length + '）';
      el('waiting-title').textContent = '待抽取（' + pool.length + '）';
      chips(el('drawn'), p.drawn, '本轮尚未抽取');
      chips(el('waiting'), pool.map(function (student) { return student.id; }), '暂无待抽同学');
      el('roster-summary').textContent = '管理参与名单（' + (students.length - p.excluded.length) + ' / ' + students.length + ' 人参与）';
      rows.forEach(function (row) {
        var excluded = p.excluded.indexOf(row.student.id) !== -1;
        var drawn = p.drawn.indexOf(row.student.id) !== -1;
        row.check.checked = !excluded;
        row.status.textContent = excluded ? (drawn ? '已抽 · 暂不参与' : '暂不参与') : (drawn ? '本轮已抽' : '等待参与');
      });
      el('confirm').hidden = !confirming;
      el('confirm-text').textContent = '开始新一轮将清空本轮 ' + p.drawn.length + ' 条抽取记录。' +
        (p.excluded.length ? '暂不参与的 ' + p.excluded.length + ' 位同学仍保持排除。' : '全班同学将重新进入待抽名单。');
    }

    el('draw').addEventListener('click', function () {
      var p = read();
      var pool = remaining(p);
      if (!pool.length) { render(); return; }
      p.drawn.push(pool[randomIndex(pool.length)].id);
      resultKind = 'current';
      confirming = false;
      save(p, '抽取一位真实学生');
    });
    el('undo').addEventListener('click', function () {
      var p = read();
      if (!p.drawn.length) { return; }
      var id = p.drawn.pop();
      resultKind = 'latest';
      confirming = false;
      save(p, '撤销最近一次学生抽问');
      W.toast('已撤销：' + byId.get(id).label + (p.excluded.indexOf(id) === -1 ? '，已回到待抽名单' : '，该同学仍暂不参与'));
    });
    el('new-round').addEventListener('click', function () {
      if (!read().drawn.length) { return; }
      confirming = true;
      render();
      el('confirm-round').focus();
    });
    el('cancel-round').addEventListener('click', function () {
      confirming = false;
      render();
      el('new-round').focus();
    });
    el('confirm-round').addEventListener('click', function () {
      if (!confirming) { return; }
      var p = read();
      p.drawn = [];
      resultKind = 'latest';
      confirming = false;
      save(p, '开始新一轮学生抽问');
      W.toast('已开始新一轮；参与名单设置已保留');
      if (!el('draw').disabled) { el('draw').focus(); }
    });
    el('include-all').addEventListener('click', function () {
      var p = read();
      p.excluded = [];
      confirming = false;
      save(p, '恢复全部学生参与抽问');
      W.toast('已恢复全部参与；本轮已抽同学仍不会重复抽取');
    });
    el('exclude-all').addEventListener('click', function () {
      var p = read();
      p.excluded = students.map(function (student) { return student.id; });
      confirming = false;
      save(p, '全部学生暂不参与抽问');
      W.toast('已设为全部暂不参与；可勾选到场同学');
    });
    render();
    if (students.length && !el('draw').disabled) { el('draw').focus(); }
  }

  window.BusinessPicker = { open: open };
}());
