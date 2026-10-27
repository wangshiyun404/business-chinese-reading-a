/* 公开版名单：默认显示学生编号；教师可导入本机姓名文件，姓名只保存在当前浏览器，不发送到任何服务器。 */
(function () {
  'use strict';
  var source = window.BUSINESS_COURSE;
  if (!source || !Array.isArray(source.students)) return;
  var KEY = 'business-reading-sie4351b-2026-local-roster-v1', FORMAT = 'business-reading-local-roster';
  var defaults = source.students.map(function (s) { return { id: String(s.id), name: s.name }; });
  var ids = defaults.map(function (s) { return s.id; });
  var NUMBERED = '当前使用学生编号。导入教师本机名单后，可在此浏览器显示姓名。';
  var info = { mode: 'numbered', message: NUMBERED };

  function validate(obj) {
    if (Array.isArray(obj)) obj = { format: FORMAT, students: obj };
    if (!obj || obj.format !== FORMAT || !Array.isArray(obj.students) || obj.students.length !== ids.length) {
      throw new Error('请使用本课完整的 ' + ids.length + ' 人名单文件，当前名单未更改。');
    }
    var names = Object.create(null);
    obj.students.forEach(function (s) {
      var id = s && s.id != null ? String(s.id) : '';
      if (!id || ids.indexOf(id) < 0 || Object.prototype.hasOwnProperty.call(names, id) ||
          typeof s.name !== 'string' || !s.name.trim() || s.name.length > 60 || /[\u0000-\u001f\u007f]/.test(s.name)) {
        throw new Error('名单包含未知或重复编号、空姓名或过长姓名，当前名单未更改。');
      }
      names[id] = s.name.trim();
    });
    return { format: FORMAT, students: ids.map(function (id) { return { id: id, name: names[id] }; }) };
  }
  function parse(text) {
    if (typeof text !== 'string' || text.length > 32768) throw new Error('名单文件过大或无法读取，当前名单未更改。');
    var obj;
    try { obj = JSON.parse(text.replace(/^\uFEFF/, '')); } catch (e) { throw new Error('名单不是有效的 JSON 文件，当前名单未更改。'); }
    return validate(obj);
  }
  function apply(list, mode, message) {
    var names = Object.create(null);
    list.forEach(function (s) { names[s.id] = s.name; });
    source.students.forEach(function (s) { s.name = names[String(s.id)]; });
    info = { mode: mode, message: message };
    window.dispatchEvent(new Event('business:roster-change'));
  }
  function hydrate(raw) {
    if (!raw) { apply(defaults, 'numbered', NUMBERED); return; }
    apply(parse(raw).students, 'local', '已使用本机名单（' + ids.length + ' 人）。姓名仅保存在当前浏览器，不会上传。');
  }
  try { hydrate(localStorage.getItem(KEY)); }
  catch (e) { info.message = '当前使用学生编号。本机名单暂时无法读取，请重新导入完整名单或检查浏览器存储设置。'; }

  var api = window.BusinessLocalRoster = {
    storageKey: KEY,
    getInfo: function () { return { mode: info.mode, message: info.message, count: ids.length }; },
    importText: function (text) {
      var roster = parse(text), serialized = JSON.stringify(roster);
      try {
        localStorage.setItem(KEY, serialized);
        if (localStorage.getItem(KEY) !== serialized) throw new Error('verify');
      } catch (e) { throw new Error('浏览器未能保存名单，本次未切换姓名。请检查浏览器存储设置后重试。'); }
      apply(roster.students, 'local', '已导入并保存本机名单（' + ids.length + ' 人）。姓名仅保存在当前浏览器，不会上传。');
      return api.getInfo();
    },
    reset: function () {
      try {
        localStorage.removeItem(KEY);
        if (localStorage.getItem(KEY) !== null) throw new Error('verify');
      } catch (e) { throw new Error('浏览器未能清除本机名单，本次未切换。请检查浏览器存储设置后重试。'); }
      apply(defaults, 'numbered', '已恢复学生编号，并清除当前浏览器保存的姓名；抽问记录和授课进度保留。');
      return api.getInfo();
    }
  };
  window.addEventListener('storage', function (event) {
    if (event.key !== KEY && event.key !== null) return;
    try { hydrate(localStorage.getItem(KEY)); }
    catch (e) { apply(defaults, 'numbered', '本机名单暂时无法读取，已使用学生编号。请重新导入本课完整名单。'); }
  });

  /* 在“随机抽问 → 管理参与名单”中加入导入/恢复按钮（不改动 student-picker.js）。 */
  function reopenPicker(message) {
    var W = window.BusinessWorkbench;
    if (W && W.closeModal) W.closeModal();
    if (window.BusinessPicker) window.BusinessPicker.open();
    var status = document.querySelector('[data-local-roster="status"]');
    if (status && message) status.textContent = message;
    if (W && W.toast && message) W.toast(message);
  }
  function enhance() {
    var roster = document.querySelector('[data-picker="roster"]');
    if (!roster || roster.parentNode.querySelector('[data-local-roster]')) return;
    var box = document.createElement('div');
    box.setAttribute('data-local-roster', 'tools');
    box.innerHTML =
      '<p class="wb-muted" id="wbLocalRosterHelp">公开网页默认使用学生编号。可选择教师本机名单文件（JSON），仅在当前浏览器保存姓名；换电脑或浏览器后需重新导入。教学记录备份不包含姓名。</p>' +
      '<p class="wb-muted" data-local-roster="status" role="status" aria-live="polite"></p>' +
      '<div class="wb-actions"><button type="button" class="wb-button" data-local-roster="import">导入本机名单</button>' +
      '<button type="button" class="wb-button" data-local-roster="reset">恢复学生编号</button></div>' +
      '<input type="file" data-local-roster="file" accept=".json,application/json" aria-label="选择教师本机名单 JSON 文件" hidden>';
    roster.parentNode.insertBefore(box, roster.parentNode.querySelector('p') || roster);
    var status = box.querySelector('[data-local-roster="status"]');
    var file = box.querySelector('[data-local-roster="file"]');
    status.textContent = info.message;
    box.querySelector('[data-local-roster="reset"]').disabled = info.mode !== 'local';
    box.querySelector('[data-local-roster="import"]').addEventListener('click', function () { file.value = ''; file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      if (f.size > 32768) { status.textContent = '名单文件过大，请选择教师本机名单 JSON 文件。当前名单未更改。'; return; }
      var reader = new FileReader();
      reader.onload = function () {
        try { api.importText(String(reader.result)); reopenPicker('本机名单已保存，抽问记录和授课进度保留。'); }
        catch (e) { status.textContent = e.message || '名单无法导入，当前名单未更改。'; }
      };
      reader.onerror = function () { status.textContent = '无法读取所选文件，当前名单未更改。'; };
      reader.readAsText(f, 'utf-8');
    });
    box.querySelector('[data-local-roster="reset"]').addEventListener('click', function () {
      try { api.reset(); reopenPicker('已恢复学生编号；抽问记录和授课进度保留。'); }
      catch (e) { status.textContent = e.message; }
    });
  }
  function watch() {
    new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
    enhance();
  }
  if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);
})();
