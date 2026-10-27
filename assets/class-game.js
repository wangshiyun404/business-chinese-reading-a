/* 课堂游戏：投屏全屏闯关 + 随机抽人 + 个人积分榜。
   - 题库：assets/games/lessonNN.js（由 lessonNN-questions.json 生成）；没有题库的课显示“本课游戏制作中”。
   - 积分保存在教学记录（business-reading-sie4351b-2026-v1）的 games 字段：随“导出记录/恢复记录”和口令解锁后的云端同步一起走。
   - 只保存学生编号（sie4351b-student-NN），姓名来自工作台名单（编号 / 本机名单 / 口令解锁）。
   - 题目进度（第几题、已揭示）只存本机（GAME_PROGRESS_KEY），不进同步。
   本文件放在 workbench.js 之后加载（在 vocab-highlight.js 之后）；工作台启动时若本校验器尚未加载，会原样保留 games 字段，之后由本文件校验。界面在页面加载完成后初始化。 */
(function () {
  'use strict';
  var C = window.BUSINESS_COURSE || { students: [] };
  var IDS = (C.students || []).map(function (s) { return String(s.id); });
  var MAX_SESS = 400, MAX_LOG = 3000;
  function isO(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function int(x, lo, hi) { return Number.isInteger(x) && x >= lo && x <= hi; }
  function dateOK(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function uniqIds(a) { var seen = {}; return (Array.isArray(a) ? a : []).filter(function (id) { if (typeof id !== 'string' || IDS.indexOf(id) < 0 || seen[id]) return false; seen[id] = 1; return true; }); }
  /* 不抛错：返回清理后的副本（无效部分丢弃）。 */
  function validate(g) {
    if (!isO(g)) g = {};
    var p = isO(g.prefs) ? g.prefs : {}, k = isO(g.picker) ? g.picker : {};
    var gn = Array.isArray(p.groupNames) ? p.groupNames.filter(function (n) { return typeof n === 'string'; }).slice(0, 8).map(function (n) { return n.replace(/[\u0000-\u001f]/g, '').slice(0, 12) || '小组'; }) : [];
    if (gn.length < 2) gn = [1, 2, 3, 4, 5].map(function (i) { return '第' + i + '组'; });
    var out = { v: 1, rev: int(g.rev, 0, 1e12) ? g.rev : 0, updatedAt: int(g.updatedAt, 0, 1e14) ? g.updatedAt : 0,
      prefs: { mode: p.mode === 'group' ? 'group' : 'individual', timer: int(p.timer, 5, 120) ? p.timer : 20, sound: p.sound !== false, groupNames: gn, groupOf: {} },
      picker: { drawn: uniqIds(k.drawn), absent: uniqIds(k.absent), absentDate: dateOK(k.absentDate) ? k.absentDate : '' },
      sessions: [] };
    if (isO(p.groupOf)) Object.keys(p.groupOf).forEach(function (id) { if (IDS.indexOf(id) >= 0 && int(p.groupOf[id], 0, gn.length - 1)) out.prefs.groupOf[id] = p.groupOf[id]; });
    var seen = {};
    (Array.isArray(g.sessions) ? g.sessions : []).slice(-MAX_SESS).forEach(function (s) {
      if (!isO(s) || typeof s.id !== 'string' || !/^[\w-]{1,40}$/.test(s.id) || seen[s.id] || !int(s.lesson, 1, 99) || !dateOK(s.date) || !int(s.start, 0, 1e14)) return;
      seen[s.id] = 1;
      var log = (Array.isArray(s.log) ? s.log : []).filter(function (e) {
        return Array.isArray(e) && e.length === 4 && int(e[0], 0, 1e14) && (e[1] === '' || IDS.indexOf(e[1]) >= 0) && int(e[2], -1, 7) && int(e[3], -10, 10) && e[3] !== 0 && (e[1] !== '' || e[2] >= 0);
      }).slice(-MAX_LOG).map(function (e) { return e.slice(); });
      out.sessions.push({ id: s.id, lesson: s.lesson, date: s.date, start: s.start, end: int(s.end, 0, 1e14) ? s.end : 0, log: log });
    });
    return out;
  }
  window.BusinessGameStore = { validate: validate, version: 1 };

  var PROGRESS_KEY = 'business-reading-sie4351b-2026-game-progress-v1';
  var MIRROR_KEY = 'business-reading-sie4351b-2026-game-scores-mirror-v1';
  var EXPORT_FORMAT = 'business-reading-class-game-scores';

  function init() {
    var W = window.BusinessWorkbench, B = window.BusinessBook;
    if (!W || !B || !W.setGames || document.getElementById('cg')) return;
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var $ = function (sel) { return root.querySelector(sel); };
    var clone = function (x) { return JSON.parse(JSON.stringify(x)); };
    var today = function () { var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); return ['year', 'month', 'day'].map(function (k) { return p.find(function (x) { return x.type === k; }).value; }).join('-'); };
    var COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#475569'];
    var SRC_CLS = { '课本原题': 'o', '根据课本改编': 'a', '新编': 'n' };
    var LETTER = 'ABCDEFGH';
    var RULES = { L1: '看提示，选出正确的词语。', L2: '选出正确的词语或句型，完成句子。', L3: '根据课文内容判断对错或选择答案。', L4: '选出最得体的回答，并想一想：为什么其他回答不好？', L5: '随机抽一位同学，用屏幕上的词语说一句完整的话。说得完整、得体加 2 分，基本正确加 1 分。' }; /* 题库可用 levels[].rule 覆盖 */

    /* ---------- 名单（只读工作台的名单；姓名随解锁/本机名单变化） ---------- */
    function students() { return (C.students || []).map(function (s, i) { return { id: String(s.id), name: String(s.name || ('学生' + (i + 1))), no: i + 1 }; }); }
    function nameOf(id) { var s = (C.students || []).find(function (x) { return String(x.id) === id; }); return s ? String(s.name) : id; }
    function noOf(id) { return IDS.indexOf(id) + 1; }

    /* ---------- 积分数据（单一来源：工作台 state.games） ---------- */
    function current() { var g = W.getState().games; return g ? validate(clone(g)) : validate({}); }
    var lastEnded = null;
    function mutate(fn) {
      var g = current(); var r = fn(g); g.rev++; g.updatedAt = Date.now();
      var ok = W.setGames(g);
      try { localStorage.setItem(MIRROR_KEY, JSON.stringify(g)); } catch (e) {}
      if (ok === false) toast('浏览器暂时不能保存，请尽快在设置里“导出积分”。');
      return r;
    }
    (function restoreFromMirror() { /* 记录里没有积分（例如被旧版工作台覆盖）时，用本机副本恢复 */
      if (W.getState().games) return;
      try { var m = JSON.parse(localStorage.getItem(MIRROR_KEY)); if (m && Array.isArray(m.sessions) && m.sessions.length) { W.setGames(validate(m)); } } catch (e) {}
    })();
    function openSession(g) { return g.sessions.find(function (s) { return !s.end && s.date === today(); }) || null; }
    function closeStale(g) { var n = 0; g.sessions.forEach(function (s) { if (!s.end && s.date !== today()) { s.end = s.log.length ? s.log[s.log.length - 1][0] : s.start; n++; } }); return n; }
    function ensureSession(g) { closeStale(g); var s = openSession(g); if (s && s.lesson !== LESSON && !s.log.length) s.lesson = LESSON; if (!s) { s = { id: 's' + Date.now().toString(36), lesson: LESSON, date: today(), start: Date.now(), end: 0, log: [] }; g.sessions.push(s); lastEnded = null; } return s; }
    function pointsOf(list) { var m = {}; list.forEach(function (s) { s.log.forEach(function (e) { if (e[1]) m[e[1]] = (m[e[1]] || 0) + e[3]; }); }); return m; }
    function groupPts(s, n) { var a = []; for (var i = 0; i < n; i++) a.push(0); if (s) s.log.forEach(function (e) { if (e[2] >= 0 && e[2] < n) a[e[2]] += e[3]; }); return a; }
    function absentToday(g) { return g.picker.absentDate === today() ? g.picker.absent : []; }
    function present(g) { var ex = (W.getState().picker && W.getState().picker.excluded) || [], ab = absentToday(g); return IDS.filter(function (id) { return ex.indexOf(id) < 0 && ab.indexOf(id) < 0; }); }

    /* ---------- 本机题目进度 ---------- */
    function readProg() { try { var p = JSON.parse(localStorage.getItem(PROGRESS_KEY)); return isO(p) && isO(p.lessons) ? p : { lessons: {} }; } catch (e) { return { lessons: {} }; } }
    function P() { var all = readProg(); var p = all.lessons[LESSON]; if (!isO(p)) p = {}; if (!isO(p.revealed)) p.revealed = {}; if (!int(p.pos, -1, 9999)) p.pos = -1; if (!Array.isArray(p.levels)) p.levels = null; return p; }
    var PR = null;
    function saveProg() { var all = readProg(); PR.updated = Date.now(); all.lessons[LESSON] = PR; try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(all)); } catch (e) {} }

    /* ---------- 题库加载 ---------- */
    var banks = window.BusinessGameBanks = window.BusinessGameBanks || {}, loading = {};
    function loadBank(n) {
      if (banks[n]) return Promise.resolve(banks[n]);
      if (loading[n]) return loading[n];
      loading[n] = new Promise(function (res) {
        var s = document.createElement('script'); s.src = 'assets/games/lesson' + (n < 10 ? '0' : '') + n + '.js'; s.async = true;
        s.onload = function () { res(banks[n] || null); }; s.onerror = function () { delete loading[n]; s.remove(); res(null); };
        document.head.appendChild(s);
      });
      return loading[n];
    }

    /* ---------- DOM ---------- */
    var root = document.createElement('div'); root.id = 'cg'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', '课堂游戏');
    root.innerHTML = '<div class="cg-top"><div class="cg-brand"><span id="cg-brand-t">课堂游戏</span><small id="cg-brand-s"></small></div><div class="cg-lvltag" id="cg-lvl">准备开始</div><div class="cg-prog" id="cg-prog"></div><div class="cg-progtxt" id="cg-progtxt"></div>' +
      '<div class="cg-timer" id="cg-timer"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="3"/><circle id="cg-tarc" cx="18" cy="18" r="15.5" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="97.4" stroke-dashoffset="0" stroke-linecap="round"/></svg><span id="cg-tnum">20</span></div>' +
      '<button type="button" class="cg-tb" data-a="lb">积分榜</button><button type="button" class="cg-tb" data-a="settings">设置</button><button type="button" class="cg-tb" data-a="full">全屏</button><button type="button" class="cg-tb cg-exit" data-a="exit">退出游戏</button></div>' +
      '<div class="cg-stage" id="cg-stage"></div><div class="cg-ctrl" id="cg-ctrl"></div><div class="cg-board" id="cg-board"></div>' +
      '<div class="cg-pick" id="cg-pick" hidden></div><div class="cg-ov" id="cg-ov"><div class="cg-panel" id="cg-panel"></div></div><div class="cg-toast" id="cg-toast" hidden></div>' +
      '<input type="file" id="cg-file" accept=".json,application/json" hidden>';
    document.body.appendChild(root);

    var LESSON = 1, BANK = null, BANK_STATE = 'loading', VIEW = 'title', SL = [], CUR = null, toastT = null;
    var LV = {};
    function lvQs(id) { return BANK.questions.filter(function (q) { return q.level === id; }); }
    function levels() { var all = BANK.levels.map(function (l) { return l.id; }); var s = (PR.levels || []).filter(function (id) { return all.indexOf(id) >= 0; }); return s.length ? s : all; }
    function buildSlides() { SL = []; if (!BANK) return; levels().forEach(function (id) { SL.push({ k: 'intro', lv: id }); BANK.questions.forEach(function (q, i) { if (q.level === id) SL.push({ k: 'q', lv: id, qi: i }); }); }); SL.push({ k: 'end' }); }
    function meta() { return (BANK && isO(BANK.lesson)) ? BANK.lesson : {}; }
    function lessonTitle(n) { var m = n === LESSON ? meta() : {}; if (m.name) return String(m.name); var l = B.data.lessons[n - 1]; return l ? l.title : ''; }
    function lessonNo(n) { var m = n === LESSON ? meta() : {}; return m.no ? String(m.no) : '第' + cn(n) + '课'; }
    function ruleOf(id) { var r = meta().rules; return (isO(r) && r[id]) || (LV[id] && LV[id].rule) || RULES[id] || ''; }
    function roleOf(q) { return q.role || (LESSON === 1 ? '面试官' : '情景'); }
    function cn(n) { return '一二三四五六七八九十'.charAt(n - 1) || String(n); }

    /* ---------- 声音 ---------- */
    var AC = null;
    function tone(f, d, t, v, delay) { if (!current().prefs.sound) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); var o = AC.createOscillator(), gn = AC.createGain(); o.type = t || 'sine'; v = v || 0.08; o.frequency.value = f; o.connect(gn); gn.connect(AC.destination); var t0 = AC.currentTime + (delay || 0); gn.gain.setValueAtTime(v, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.start(t0); o.stop(t0 + d + 0.02); } catch (e) {} }
    var SND = { plus: function () { tone(660, 0.12); tone(880, 0.16, 'sine', 0.08, 0.1); }, minus: function () { tone(220, 0.22, 'triangle', 0.07); }, reveal: function () { tone(523, 0.15); tone(784, 0.25, 'sine', 0.07, 0.12); }, tick: function () { tone(1000, 0.05, 'square', 0.03); }, end: function () { tone(392, 0.35, 'triangle', 0.09); }, roll: function () { tone(700 + Math.random() * 300, 0.03, 'square', 0.015); } };

    /* ---------- 计时 ---------- */
    var tLeft = 0, tRun = false, tInt = null, timeUp = false;
    function T() { return current().prefs.timer; }
    function stopTimer() { clearInterval(tInt); tRun = false; }
    function resetTimer() { stopTimer(); timeUp = false; tLeft = T(); drawTimer(); }
    function drawTimer() { $('#cg-tnum').textContent = tLeft; var f = T() ? tLeft / T() : 0; var a = $('#cg-tarc'); a.style.strokeDashoffset = 97.4 * (1 - f); a.style.stroke = tLeft <= 5 && tRun ? '#ff8a80' : '#fff'; }
    function toggleTimer() { var sl = SL[PR.pos]; if (VIEW !== 'slide' || !sl || sl.k !== 'q') return; if (tRun) { stopTimer(); renderCtrl(); return; } if (tLeft <= 0) tLeft = T(); timeUp = false; tRun = true; renderCtrl(); tInt = setInterval(function () { tLeft--; drawTimer(); if (tLeft <= 5 && tLeft > 0) SND.tick(); if (tLeft <= 0) { stopTimer(); timeUp = true; SND.end(); render(); } }, 1000); drawTimer(); }

    /* ---------- 渲染 ---------- */
    function render() { renderTop(); renderStage(); renderCtrl(); renderBoard(); }
    function tint(hex) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255; r = Math.round(r + (255 - r) * 0.55); g = Math.round(g + (255 - g) * 0.55); b = Math.round(b + (255 - b) * 0.55); return 'rgb(' + r + ',' + g + ',' + b + ')'; }
    function renderTop() {
      $('#cg-brand-t').textContent = lessonNo(LESSON) + ' ' + lessonTitle(LESSON);
      $('#cg-brand-s').textContent = '课堂游戏 · ' + (current().prefs.mode === 'group' ? '个人＋小组积分' : '个人积分');
      var sl = VIEW === 'slide' ? SL[PR.pos] : null, p = $('#cg-prog'), tag = $('#cg-lvl'), pt = $('#cg-progtxt');
      p.innerHTML = BANK ? levels().map(function (id) { var n = lvQs(id).length, done = 0; if (sl && sl.lv) { var li = levels().indexOf(sl.lv), me = levels().indexOf(id); if (me < li) done = n; else if (me === li && sl.k === 'q') done = lvQs(id).indexOf(BANK.questions[sl.qi]) + 1; } else if (sl && sl.k === 'end') done = n; return '<div class="cg-seg"><i style="width:' + (n ? done / n * 100 : 0) + '%;background:' + tint(LV[id].color) + '"></i></div>'; }).join('') : '';
      tag.style.background = 'rgba(255,255,255,.14)'; pt.textContent = '';
      if (VIEW === 'board') tag.textContent = '个人积分榜';
      else if (!sl) tag.textContent = BANK_STATE === 'ok' ? '准备开始' : (BANK_STATE === 'loading' ? '正在载入' : '本课游戏制作中');
      else if (sl.k === 'end') tag.textContent = '闯关结束';
      else { var lv = LV[sl.lv]; tag.textContent = '第' + (levels().indexOf(sl.lv) + 1) + '关 · ' + lv.name; tag.style.background = lv.color; pt.textContent = sl.k === 'q' ? (lvQs(sl.lv).indexOf(BANK.questions[sl.qi]) + 1) + ' / ' + lvQs(sl.lv).length : lvQs(sl.lv).length + ' 题'; }
      $('#cg-timer').style.visibility = sl && sl.k === 'q' ? 'visible' : 'hidden';
    }
    function ansText(q, short) { if (q.type === 'mcq') return (short && q.options[q.answer].length > 12) ? LETTER[q.answer] : LETTER[q.answer] + '. ' + q.options[q.answer]; if (q.type === 'tf') return q.answer ? '对' : '错'; return q.reference || ''; }
    function PY() { return (BANK && BANK.py) || {}; }
    function renderStage() {
      var st = $('#cg-stage'); st.style.removeProperty('--u');
      if (VIEW === 'board') { st.innerHTML = boardHTML(); bindBoard(st); return; }
      if (VIEW === 'title' || !BANK) { st.innerHTML = titleHTML(); bindTitle(st); return; }
      var sl = SL[PR.pos];
      if (sl.k === 'intro') { var lv = LV[sl.lv]; st.innerHTML = '<div class="cg-center cg-intro" style="--c:' + lv.color + '"><div class="cg-num">第 ' + (levels().indexOf(sl.lv) + 1) + ' 关 · 共 ' + lvQs(sl.lv).length + ' 题</div><h1>' + esc(lv.name) + '</h1><div class="cg-lead">' + esc(lv.sub || '') + '</div><div class="cg-rule">' + esc(ruleOf(sl.lv)) + '</div></div>'; fit(st); return; }
      if (sl.k === 'end') { st.innerHTML = endHTML(); bindBoard(st); fit(st); return; }
      var q = BANK.questions[sl.qi], rv = !!PR.revealed[q.id], lvv = LV[q.level], no = lvQs(q.level).indexOf(q) + 1, py = PY();
      var h = '<div class="cg-qhead"><span class="cg-qn" style="color:' + lvv.color + '">第 ' + no + ' 题</span><span class="cg-chip">' + ({ mcq: '选择', tf: '判断', open: '抢答', speak: '口语挑战' }[q.type] || '') + (q.scenario ? ' · ' + esc(lvv.name) : '') + '</span><span class="cg-src"><span class="cg-tag ' + (SRC_CLS[q.source] || '') + '">' + esc(q.source) + '</span> ' + esc(q.ref) + '</span></div>';
      if (timeUp && !rv) h += '<div class="cg-timesup">时间到</div>';
      if (q.pinyin) h += '<div class="cg-vocab"><span class="cg-bigpy cg-py">' + esc(q.pinyin) + '</span><span class="cg-en cg-py">' + esc(q.en || '') + '</span><div class="cg-def">释义：' + esc(q.detail) + '</div></div>';
      else if (q.scenario) h += '<div class="cg-scenario"><span class="cg-who">' + esc(roleOf(q)) + '</span><div class="cg-prompt cg-bubble ' + (q.prompt.length > 30 ? 'long' : '') + '">' + esc(q.prompt.replace(/^（[^）]{1,10}）/, '')) + '</div></div>';
      else if (q.type === 'speak') { var pl = q.prompt.split('\n'); h += '<div class="cg-prompt ' + (pl[0].length > 30 ? 'long' : '') + '">' + esc(pl[0]) + '</div>' + (pl.length > 1 ? '<div class="cg-card">' + pl.slice(1).map(esc).join('<br>') + '</div>' : '') + '<div class="cg-words" style="--lc:' + lvv.color + '">' + (q.words || []).map(function (w) { return '<span>' + esc(w) + '<small class="cg-py">' + esc(py[w] || '') + '</small></span>'; }).join('') + '</div>'; }
      else h += '<div class="cg-prompt ' + (q.prompt.length > 34 ? 'long' : '') + '">' + esc(q.prompt) + '</div>';
      if (q.kw) h += '<div class="cg-kw">' + q.kw.map(function (k) { return '<span>' + esc(k[0]) + '<b class="cg-py">' + esc(k[1]) + '</b></span>'; }).join('') + '</div>';
      if (q.type === 'mcq') { var long = q.options.some(function (o) { return o.length > 12; }), cls = long ? 'one' : (q.options.length === 6 ? 'three' : ''); h += '<div class="cg-opts ' + cls + '">' + q.options.map(function (o, i) { return '<div class="cg-opt ' + (rv ? (i === q.answer ? 'right' : 'dim') : '') + '"><span class="cg-L">' + LETTER[i] + '</span><span>' + esc(o) + (rv && i === q.answer && q.level === 'L1' && py[o] ? ' <span class="cg-py cg-muted" style="font-size:.7em">' + esc(py[o]) + '</span>' : '') + '</span></div>'; }).join('') + '</div>'; }
      if (q.type === 'tf') h += '<div class="cg-tfrow"><div class="cg-tf ' + (rv ? (q.answer ? 'right' : 'dim') : '') + '">对 ✓</div><div class="cg-tf ' + (rv ? (!q.answer ? 'right' : 'dim') : '') + '">错 ✗</div></div>';
      h += '<div class="cg-explain ' + (rv ? '' : 'hide') + '"><span class="cg-ans">' + (q.type === 'mcq' || q.type === 'tf' ? '答案：' + esc(ansText(q, 1)) : '参考：' + esc(q.reference || '')) + '</span><br>' + esc(q.explain || '') + '</div>';
      st.innerHTML = h; fit(st);
    }
    /* 题目页自动缩放：内容（含未揭示的答案区）放不下时按比例缩小字号，避免出现滚动条 */
    function fit(st) {
      st.style.removeProperty('--u'); if (root.hidden) return;
      var u = Math.min(innerWidth * 0.0125, innerHeight * 0.02), k = 0;
      while (st.scrollHeight > st.clientHeight + 1 && k++ < 14) { u *= 0.93; st.style.setProperty('--u', u.toFixed(2) + 'px'); }
    }
    function lessonSelect() { return '<label class="cg-lsel">选择课次 <select id="cg-lesson">' + B.data.lessons.map(function (l) { return '<option value="' + l.id + '"' + (l.id === LESSON ? ' selected' : '') + '>第' + l.id + '课 ' + esc(l.title) + '</option>'; }).join('') + '</select></label>'; }
    function statusLine(g) { var ab = absentToday(g).length, open = openSession(g); return (g.prefs.mode === 'group' ? '个人＋小组积分（' + g.prefs.groupNames.length + ' 组）' : '个人积分') + ' · ' + IDS.length + ' 名学生' + (ab ? ' · 今日缺席 ' + ab + ' 人' : '') + (open ? ' · 本节课已开始计分' : ''); }
    function titleHTML() {
      var g = current();
      var head = '<div class="cg-center"><div class="cg-eyebrow">商务汉语精读A · 课堂游戏</div><h1>' + esc(lessonNo(LESSON)) + '　' + esc(lessonTitle(LESSON)) + '</h1>' + (meta().py || meta().en ? '<div class="cg-lpy"><span class="cg-py">' + esc(meta().py || '') + '</span>' + (meta().en ? ' · <span class="cg-py">' + esc(meta().en) + '</span>' : '') + '</div>' : '');
      if (BANK_STATE === 'loading') return head + '<div class="cg-lead">正在载入题目…</div></div>';
      if (!BANK) return head + '<div class="cg-lead">本课游戏制作中。可以先用随机抽人和积分榜，或选择其他课次。</div><div class="cg-btns">' + lessonSelect() + '<button class="cg-big ghost" data-a="lb">个人积分榜</button><button class="cg-big ghost" data-a="settings">设置</button></div><div class="cg-status">' + esc(statusLine(g)) + '</div></div>';
      var has = PR.started && PR.pos >= 0, total = levels().reduce(function (a, id) { return a + lvQs(id).length; }, 0);
      return head + '<div class="cg-lead">' + levels().length + ' 关 · ' + total + ' 题 · 每题 ' + g.prefs.timer + ' 秒 · 题目可随时随机抽人回答</div>' +
        '<div class="cg-lvlist">' + BANK.levels.map(function (l, i) { return '<div class="cg-lv ' + (levels().indexOf(l.id) >= 0 ? '' : 'off') + '" style="--c:' + l.color + '"><b>' + (i + 1) + '. ' + esc(l.name) + '</b><span>' + lvQs(l.id).length + ' 题</span></div>'; }).join('') + '</div>' +
        (has ? '<div class="cg-resume">上次进度：' + esc(progressLabel()) + '（' + new Date(PR.updated || Date.now()).toLocaleString('zh-CN', { hour12: false }) + '）</div>' : '') +
        '<div class="cg-btns">' + (has ? '<button class="cg-big" data-a="resume">继续上次</button><button class="cg-big ghost" data-a="restart">重新开始</button>' : '<button class="cg-big" data-a="start">开始</button>') + '<button class="cg-big ghost" data-a="lb">个人积分榜</button>' + lessonSelect() + '</div>' +
        '<div class="cg-status">' + esc(statusLine(g)) + '</div></div>';
    }
    function bindTitle(st) { var s = st.querySelector('#cg-lesson'); if (s) s.onchange = function () { openLesson(+s.value); }; }
    function progressLabel() { var sl = SL[PR.pos]; if (!sl) return ''; if (sl.k === 'end') return '已完成'; var lv = LV[sl.lv], i = levels().indexOf(sl.lv) + 1; return sl.k === 'intro' ? '第' + i + '关 ' + lv.name : '第' + i + '关 ' + lv.name + ' 第' + (lvQs(sl.lv).indexOf(BANK.questions[sl.qi]) + 1) + '题'; }
    function endHTML() { return '<div class="cg-center"><div class="cg-eyebrow">' + esc(lessonNo(LESSON)) + ' ' + esc(lessonTitle(LESSON)) + ' · 闯关结束</div><h1>今天的题目全部完成</h1><div class="cg-lead">查看积分榜；下课前点“本节课结束”，把今天的积分记入历史。</div><div class="cg-btns"><button class="cg-big" data-a="lb">个人积分榜</button><button class="cg-big ghost" data-a="endsession">本节课结束</button></div>' + (current().prefs.mode === 'group' ? groupRankHTML() : '') + '</div>'; }
    function groupRankHTML() { var g = current(), s = openSession(g), pts = groupPts(s, g.prefs.groupNames.length), mx = Math.max.apply(null, [1].concat(pts)); var order = pts.map(function (v, i) { return { v: v, i: i }; }).sort(function (a, b) { return b.v - a.v; }), rank = 0, prev = null; return '<div class="cg-rank">' + order.map(function (o, k) { if (o.v !== prev) { rank = k + 1; prev = o.v; } return '<div class="cg-rk"><span class="p">' + rank + '</span><span class="n" style="color:' + COLORS[o.i] + '">' + esc(g.prefs.groupNames[o.i]) + '</span><span class="b"><i style="width:' + Math.max(0, o.v) / mx * 100 + '%;background:' + COLORS[o.i] + '"></i></span><span class="s">' + o.v + '</span></div>'; }).join('') + '</div>'; }

    /* ---------- 积分榜 ---------- */
    var lbTab = 'all';
    function ranking() {
      var g = current(), tot = pointsOf(g.sessions), s = openSession(g), td = s ? pointsOf([s]) : {}, cnt = {};
      g.sessions.forEach(function (x) { var seen = {}; x.log.forEach(function (e) { if (e[1] && !seen[e[1]]) { seen[e[1]] = 1; cnt[e[1]] = (cnt[e[1]] || 0) + 1; } }); });
      var rows = students().map(function (st) { return { id: st.id, name: st.name, no: st.no, total: tot[st.id] || 0, today: td[st.id] || 0, times: cnt[st.id] || 0 }; });
      rows.sort(function (a, b) { return b.total - a.total || b.today - a.today || a.no - b.no; });
      var rank = 0, prev = null; rows.forEach(function (r, k) { if (r.total !== prev) { rank = k + 1; prev = r.total; } r.rank = rank; });
      return { rows: rows, g: g, open: s };
    }
    function fmtDate(d) { return d.slice(5).replace('-', '/'); }
    function boardHTML() {
      var R = ranking(), g = R.g, rows = R.rows, top = rows.filter(function (r) { return r.total > 0; }).slice(0, 10), mx = Math.max.apply(null, [1].concat(rows.map(function (r) { return r.total; })));
      var ended = g.sessions.filter(function (s) { return s.end; }).length;
      var sub = R.open ? '本节课：' + fmtDate(R.open.date) + ' 第' + R.open.lesson + '课 · 今日得分 ' + rows.filter(function (r) { return r.today; }).length + ' 人' : (lastEnded ? '本节课已结束，积分已记入历史。' : '本节课还没有开始计分。');
      var h = '<div class="cg-lb"><div class="cg-lbhead"><div><h1>个人积分榜</h1><div class="cg-lead">' + esc(sub) + ' · 共 ' + (ended + (R.open ? 1 : 0)) + ' 次课有积分记录</div></div><div class="cg-btns">' +
        '<button class="cg-big ghost" data-a="back">返回题目</button>' + (R.open ? '<button class="cg-big" data-a="endsession">本节课结束</button>' : (lastEnded ? '<button class="cg-big ghost" data-a="undo">撤销“本节课结束”</button>' : '')) + '</div></div><div class="cg-lbbody"><div class="cg-top10">' +
        (top.length ? top.map(function (r) { return '<div class="cg-t10' + (r.rank <= 3 ? ' m' + r.rank : '') + '"><span class="cg-t10r">' + r.rank + '</span><span class="cg-t10n">' + esc(r.name) + '</span><span class="cg-t10b"><i style="width:' + Math.max(0, r.total) / mx * 100 + '%"></i></span><span class="cg-t10d">' + (r.today ? (r.today > 0 ? '今日 +' : '今日 ') + r.today : '') + '</span><span class="cg-t10s">' + r.total + '</span></div>'; }).join('') : '<div class="cg-empty">还没有积分。抽人答题后用 +1 / +2 计分。</div>') + '</div>' +
        '<div class="cg-all"><div class="cg-tabs"><button data-tab="all" class="' + (lbTab === 'all' ? 'on' : '') + '">全班 ' + rows.length + ' 人</button><button data-tab="hist" class="' + (lbTab === 'hist' ? 'on' : '') + '">历次课堂</button></div><div class="cg-scroll">';
      if (lbTab === 'all') h += '<table><tr><th>名次</th><th>学生</th><th>今日</th><th>累计</th><th>得分课次</th></tr>' + rows.map(function (r) { return '<tr><td>' + (r.total ? r.rank : '—') + '</td><td>' + esc(r.name) + '</td><td>' + (r.today || '') + '</td><td><b>' + r.total + '</b></td><td>' + (r.times || '') + '</td></tr>'; }).join('') + '</table>';
      else h += '<table><tr><th>日期</th><th>课次</th><th>计分</th><th>得分人数</th><th>状态</th></tr>' + g.sessions.slice().reverse().map(function (s) { var pts = pointsOf([s]), n = Object.keys(pts).filter(function (k) { return pts[k]; }).length, sum = s.log.reduce(function (a, e) { return a + (e[1] ? e[3] : 0); }, 0); return '<tr><td>' + esc(s.date) + '</td><td>第' + s.lesson + '课</td><td>' + sum + '</td><td>' + n + '</td><td>' + (s.end ? '已结束' : '进行中') + '</td></tr>'; }).join('') + (g.sessions.length ? '' : '<tr><td colspan="5">暂无记录</td></tr>') + '</table>';
      return h + '</div></div></div></div>';
    }
    function bindBoard(st) { st.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { lbTab = b.dataset.tab; renderStage(); }; }); }

    /* ---------- 控制栏与计分栏 ---------- */
    function renderCtrl() {
      var c = $('#cg-ctrl'), g = current(), s = openSession(g), canUndo = (s && s.log.length) || (!s && lastEnded);
      if (VIEW !== 'slide') { c.innerHTML = VIEW === 'board' ? '' : ''; c.hidden = true; return; }
      c.hidden = false;
      var sl = SL[PR.pos], isQ = sl && sl.k === 'q', q = isQ ? BANK.questions[sl.qi] : null, rv = q && PR.revealed[q.id];
      c.innerHTML = '<button data-a="home">首页</button><button data-a="prev"' + (PR.pos <= 0 ? ' disabled' : '') + '>◀ 上一步<kbd>←</kbd></button>' +
        (isQ ? '<button data-a="timer"' + (rv ? ' disabled' : '') + '>' + (tRun ? '暂停计时' : '开始计时') + '<kbd>空格</kbd></button><button class="primary" data-a="reveal">' + (rv ? '隐藏答案' : '揭示答案') + '<kbd>回车</kbd></button>' : '') +
        '<button class="' + (isQ ? '' : 'primary') + '" data-a="next"' + (PR.pos >= SL.length - 1 ? ' disabled' : '') + '>' + (isQ && !rv ? '跳过 ▶' : '下一步 ▶') + '<kbd>→</kbd></button>' +
        '<button data-a="undo"' + (canUndo ? '' : ' disabled') + '>撤销计分<kbd>Z</kbd></button><button data-a="sources">题目来源</button>';
    }
    function renderBoard() {
      var b = $('#cg-board'), g = current(), s = openSession(g), td = s ? pointsOf([s]) : {}, tot = pointsOf(g.sessions), group = g.prefs.mode === 'group';
      var pr = present(g), drawnIn = g.picker.drawn.filter(function (id) { return pr.indexOf(id) >= 0; }).length;
      var curHTML = CUR ? '<div class="cg-cur"><div class="cg-curname"><span class="cg-curno">' + String(noOf(CUR)).padStart(2, '0') + '</span>' + esc(nameOf(CUR)) + (group && g.prefs.groupOf[CUR] !== undefined ? '<em style="color:' + COLORS[g.prefs.groupOf[CUR]] + '">' + esc(g.prefs.groupNames[g.prefs.groupOf[CUR]]) + '</em>' : '') + '</div><div class="cg-curpts">今日 ' + (td[CUR] || 0) + ' · 累计 ' + (tot[CUR] || 0) + '</div></div><div class="cg-sbtn"><button data-s="-1">−1</button><button class="plus" data-s="1">+1</button><button class="plus" data-s="2">+2</button></div>'
        : '<div class="cg-cur cg-muted">点“随机抽人”选一位同学回答<br><small>本轮已抽 ' + drawnIn + ' / ' + pr.length + ' 人</small></div>';
      var h = '<div class="cg-pickbox"><button class="cg-pickbtn" data-a="pick">随机抽人<kbd>R</kbd></button>' + curHTML + '</div>';
      if (group) {
        var gp = groupPts(s, g.prefs.groupNames.length), mx = Math.max.apply(null, [1].concat(gp)), top = Math.max.apply(null, gp);
        h += '<div class="cg-groups">' + g.prefs.groupNames.map(function (n, i) { return '<div class="cg-grp' + (gp[i] === top && top > 0 ? ' top1' : '') + '" style="--gc:' + COLORS[i] + '"><div class="row"><span class="nm">' + esc(n) + '</span><span class="sc">' + gp[i] + '</span></div><div class="bt"><button data-g="' + i + '" data-d="-1">−1</button><button class="plus" data-g="' + i + '" data-d="1">+1</button></div><div class="bar" style="width:' + Math.max(0, gp[i]) / mx * 100 + '%"></div></div>'; }).join('') + '</div>';
      } else {
        var R = ranking().rows.filter(function (r) { return r.today; }).sort(function (a, b) { return b.today - a.today || a.no - b.no; }).slice(0, 5);
        h += '<div class="cg-today"><div class="cg-todayh">今日得分</div>' + (R.length ? R.map(function (r) { return '<span class="cg-tchip"><b>' + esc(r.name) + '</b> ' + (r.today > 0 ? '+' : '') + r.today + '</span>'; }).join('') : '<span class="cg-muted">还没有人得分</span>') + '</div><button class="cg-lbbtn" data-a="lb">积分榜</button>';
      }
      b.innerHTML = h;
    }

    /* ---------- 动作 ---------- */
    function toast(t) { var el = $('#cg-toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; }, 3500); }
    function score(id, d) {
      mutate(function (g) { var s = ensureSession(g); var gi = g.prefs.mode === 'group' && g.prefs.groupOf[id] !== undefined ? g.prefs.groupOf[id] : -1; s.log.push([Date.now(), id, gi, d]); });
      (d > 0 ? SND.plus : SND.minus)(); renderBoard(); renderCtrl(); if (VIEW === 'board') renderStage(); updatePick();
      flash('.cg-cur');
    }
    function groupScore(i, d) { mutate(function (g) { ensureSession(g).log.push([Date.now(), '', i, d]); }); (d > 0 ? SND.plus : SND.minus)(); renderBoard(); renderCtrl(); }
    function flash(sel) { var el = root.querySelector(sel); if (el) { el.classList.remove('cg-flash'); void el.offsetWidth; el.classList.add('cg-flash'); } }
    function undo() {
      var msg = mutate(function (g) {
        var s = openSession(g);
        if (s && s.log.length) { var e = s.log.pop(); return '已撤销：' + (e[1] ? nameOf(e[1]) : g.prefs.groupNames[e[2]]) + ' ' + (e[3] > 0 ? '+' : '') + e[3]; }
        if (!s && lastEnded) { var x = g.sessions.find(function (y) { return y.id === lastEnded; }); if (x && x.date === today()) { x.end = 0; lastEnded = null; return '已撤销“本节课结束”，可以继续计分。'; } }
        return '';
      });
      if (msg) toast(msg); else toast('没有可以撤销的计分');
      renderBoard(); renderCtrl(); if (VIEW !== 'slide') renderStage(); updatePick();
    }
    function endSession() {
      var g = current(), s = openSession(g);
      if (!s) { toast('本节课还没有计分。'); return; }
      var pts = pointsOf([s]), n = Object.keys(pts).filter(function (k) { return pts[k]; }).length;
      if (!confirm('本节课结束：今天 ' + n + ' 位同学得分，记入累计积分。之后的计分算作新的一节课。\n确定吗？')) return;
      mutate(function (g2) { var x = openSession(g2); if (x) { x.end = Date.now(); lastEnded = x.id; } });
      CUR = null; VIEW = 'board'; lbTab = 'all'; stopTimer(); render(); toast('本节课已结束，积分已保存。');
    }
    function go(p) { VIEW = 'slide'; PR.pos = Math.max(0, Math.min(SL.length - 1, p)); PR.started = true; saveProg(); resetTimer(); render(); }
    function next() { if (VIEW === 'slide' && PR.pos < SL.length - 1) go(PR.pos + 1); }
    function prev() { if (VIEW === 'slide' && PR.pos > 0) go(PR.pos - 1); }
    function reveal() { var sl = SL[PR.pos]; if (VIEW !== 'slide' || !sl || sl.k !== 'q') return; var q = BANK.questions[sl.qi]; if (PR.revealed[q.id]) delete PR.revealed[q.id]; else { PR.revealed[q.id] = 1; stopTimer(); SND.reveal(); } saveProg(); render(); }
    function startGame() { PR.started = true; PR.revealed = {}; go(0); }
    function home() { stopTimer(); VIEW = 'title'; render(); }
    function showBoard() { stopTimer(); VIEW = 'board'; render(); }
    function back() { if (BANK && PR.started && PR.pos >= 0) go(PR.pos); else home(); }

    /* ---------- 随机抽人 ---------- */
    function rnd(n) { if (window.crypto && crypto.getRandomValues) { var a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n; do { crypto.getRandomValues(a); } while (a[0] >= lim); return a[0] % n; } return Math.floor(Math.random() * n); }
    var rolling = null;
    function pick() {
      var g = current(), pr = present(g);
      if (!pr.length) { toast('今天没有可抽的同学（请检查缺席设置或“管理参与名单”）。'); return; }
      var newRound = false;
      var chosen = mutate(function (g2) {
        var pool = pr.filter(function (id) { return g2.picker.drawn.indexOf(id) < 0; });
        if (!pool.length) { g2.picker.drawn = g2.picker.drawn.filter(function (id) { return pr.indexOf(id) < 0; }); pool = pr.slice(); newRound = true; if (pool.length > 1 && CUR) pool = pool.filter(function (id) { return id !== CUR; }); }
        var id = pool[rnd(pool.length)]; g2.picker.drawn.push(id); return id;
      });
      CUR = chosen; stopTimer();
      var el = $('#cg-pick'); el.hidden = false; el.className = 'cg-pick rolling';
      el.innerHTML = '<div class="cg-pickcard"><div class="cg-picklabel">随机抽人' + (newRound ? ' · 新一轮' : '') + '</div><div class="cg-pickname" id="cg-pickname"></div><div class="cg-pickinfo" id="cg-pickinfo">&nbsp;</div><div class="cg-pickbtns" id="cg-pickbtns"></div></div>';
      var nm = $('#cg-pickname'), steps = 0, total = 16;
      clearTimeout(rolling);
      (function roll() {
        if (steps < total) { nm.textContent = nameOf(pr[rnd(pr.length)]); SND.roll(); steps++; rolling = setTimeout(roll, 45 + steps * steps * 1.6); return; }
        nm.textContent = nameOf(chosen); el.className = 'cg-pick done'; tone(880, 0.18); updatePick(); renderBoard();
      })();
    }
    function updatePick() {
      var el = $('#cg-pick'); if (el.hidden || !CUR || el.className.indexOf('done') < 0) return;
      var g = current(), s = openSession(g), td = s ? pointsOf([s]) : {}, tot = pointsOf(g.sessions), pr = present(g), dn = g.picker.drawn.filter(function (id) { return pr.indexOf(id) >= 0; }).length;
      $('#cg-pickinfo').innerHTML = '编号 ' + String(noOf(CUR)).padStart(2, '0') + (g.prefs.mode === 'group' && g.prefs.groupOf[CUR] !== undefined ? ' · ' + esc(g.prefs.groupNames[g.prefs.groupOf[CUR]]) : '') + ' · 今日 <b>' + (td[CUR] || 0) + '</b> 分 · 累计 <b>' + (tot[CUR] || 0) + '</b> 分 · 本轮已抽 ' + dn + ' / ' + pr.length;
      $('#cg-pickbtns').innerHTML = '<button class="minus" data-s="-1">−1</button><button class="plus" data-s="1">+1</button><button class="plus" data-s="2">+2</button><span class="cg-sep"></span><button data-a="repick">换一位</button><button data-a="absent">不在（今日缺席）</button><button class="dark" data-a="closepick">关闭<kbd>Esc</kbd></button>';
    }
    function closePick() { clearTimeout(rolling); $('#cg-pick').hidden = true; renderBoard(); }
    function repick(markAbsent) {
      var id = CUR; if (!id) return;
      mutate(function (g) { g.picker.drawn = g.picker.drawn.filter(function (x) { return x !== id; }); if (markAbsent) { if (g.picker.absentDate !== today()) { g.picker.absentDate = today(); g.picker.absent = []; } if (g.picker.absent.indexOf(id) < 0) g.picker.absent.push(id); } });
      if (markAbsent) toast(nameOf(id) + ' 已标记为今日缺席'); CUR = markAbsent ? null : id;
      var keep = CUR; CUR = null; pick(); if (!markAbsent && CUR === keep) {}
    }

    /* ---------- 设置 ---------- */
    function panel(html) { $('#cg-panel').innerHTML = html; $('#cg-ov').classList.add('show'); }
    function closeOv() { $('#cg-ov').classList.remove('show'); }
    function openSettings() {
      stopTimer(); var g = current(), st = students(), ab = absentToday(g), group = g.prefs.mode === 'group';
      panel('<h2>课堂游戏设置</h2>' +
        '<h3>计分方式</h3><label><input type="radio" name="cgmode" value="individual"' + (group ? '' : ' checked') + '> 个人积分（推荐：适合大教室、座位分散）</label><label><input type="radio" name="cgmode" value="group"' + (group ? ' checked' : '') + '> 个人＋小组积分（学生得分同时计入所在小组）</label>' +
        '<div id="cg-groupset"' + (group ? '' : ' hidden') + '><h3>小组</h3><p>小组数量 <select id="cg-gn">' + [2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<option' + (n === g.prefs.groupNames.length ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select> 组 <button type="button" class="cg-pbtn" id="cg-autog">按编号轮流分组</button></p><div id="cg-gnames"></div><details><summary>每位学生所在小组（未分组的学生只计个人分）</summary><div class="cg-assign" id="cg-assign"></div></details></div>' +
        '<h3>今日缺席（随机抽人时跳过）</h3><div class="cg-absent">' + st.map(function (s) { return '<label class="cg-chk"><input type="checkbox" class="cg-ab" value="' + s.id + '"' + (ab.indexOf(s.id) >= 0 ? ' checked' : '') + '> ' + esc(s.name) + '</label>'; }).join('') + '</div><p class="cg-help">缺席设置只对今天有效。工作台“随机抽问 → 管理参与名单”里不参与的同学也会跳过。</p>' +
        '<details><summary>更多设置</summary>' +
        '<p><label>每题倒计时 <input type="number" id="cg-t" min="5" max="120" step="5" value="' + g.prefs.timer + '" style="width:5em"> 秒</label> <label><input type="checkbox" id="cg-snd"' + (g.prefs.sound ? ' checked' : '') + '> 提示音</label></p>' +
        (BANK ? '<p>本课使用的关卡：<br>' + BANK.levels.map(function (l, i) { return '<label><input type="checkbox" class="cg-lv" value="' + l.id + '"' + (levels().indexOf(l.id) >= 0 ? ' checked' : '') + '> ' + (i + 1) + '. ' + esc(l.name) + '（' + lvQs(l.id).length + '题）</label>'; }).join('') + '</p>' : '') +
        '<h3>积分备份</h3><p><button type="button" class="cg-pbtn dark" id="cg-exp">导出积分</button><button type="button" class="cg-pbtn" id="cg-imp">导入积分</button><button type="button" class="cg-pbtn" id="cg-newround">抽人重新开始一轮</button>' + (BANK ? '<button type="button" class="cg-pbtn" id="cg-clearprog">清除本课题目进度</button>' : '') + '</p>' +
        '<div class="cg-help">积分保存在工作台的教学记录里：“更多设置 → 导出记录 / 恢复记录”会一起带上；口令解锁后随授课进度云端同步。教室电脑可能清除浏览器数据，建议每次课后“导出积分”留一份文件。导出文件只含学生编号，不含姓名。<br>' +
        '<b>快捷键</b>：R 随机抽人；抽中后 1 / 2 加分、− 扣分；空格 计时；回车 揭示答案；← → 翻页；Z 撤销计分；L 积分榜；Esc 关闭弹窗或退出游戏。' + (group ? '小组模式下 Shift+数字 给对应小组加 1 分。' : '') + '</div>' +
        (BANK ? '<div class="cg-help"><b>题目来源说明</b>：' + (BANK.notes || []).map(esc).join('<br>') + '</div>' : '') + '</details>' +
        '<p class="cg-pact"><button type="button" class="cg-pbtn dark" id="cg-save">保存</button><button type="button" class="cg-pbtn" id="cg-cancel">取消</button></p>');
      var groupOf = clone(g.prefs.groupOf);
      function names(n, cur) { $('#cg-gnames').innerHTML = Array.from({ length: n }, function (_, i) { return '<label><span class="cg-dot" style="background:' + COLORS[i] + '"></span><input type="text" class="cg-gname" maxlength="12" value="' + esc((cur && cur[i]) || g.prefs.groupNames[i] || ('第' + (i + 1) + '组')) + '"></label>'; }).join(''); assign(n); }
      function assign(n) { $('#cg-assign').innerHTML = st.map(function (s) { var v = groupOf[s.id]; return '<label class="cg-chk">' + esc(s.name) + ' <select data-sid="' + s.id + '"><option value="">未分组</option>' + Array.from({ length: n }, function (_, i) { return '<option value="' + i + '"' + (v === i ? ' selected' : '') + '>' + (i + 1) + '</option>'; }).join('') + '</select></label>'; }).join(''); $('#cg-assign').querySelectorAll('select').forEach(function (sel) { sel.onchange = function () { if (sel.value === '') delete groupOf[sel.dataset.sid]; else groupOf[sel.dataset.sid] = +sel.value; }; }); }
      names(g.prefs.groupNames.length);
      root.querySelectorAll('input[name=cgmode]').forEach(function (r) { r.onchange = function () { $('#cg-groupset').hidden = root.querySelector('input[name=cgmode]:checked').value !== 'group'; }; });
      $('#cg-gn').onchange = function () { var n = +$('#cg-gn').value, cur = Array.from(root.querySelectorAll('.cg-gname')).map(function (x) { return x.value; }); Object.keys(groupOf).forEach(function (k) { if (groupOf[k] >= n) delete groupOf[k]; }); names(n, cur); };
      $('#cg-autog').onclick = function () { var n = +$('#cg-gn').value; IDS.forEach(function (id, i) { groupOf[id] = i % n; }); assign(n); toast('已按编号轮流分成 ' + n + ' 组'); };
      $('#cg-exp').onclick = exportScores; $('#cg-imp').onclick = function () { $('#cg-file').value = ''; $('#cg-file').click(); };
      $('#cg-newround').onclick = function () { mutate(function (x) { x.picker.drawn = []; }); toast('抽人已重新开始一轮'); };
      if ($('#cg-clearprog')) $('#cg-clearprog').onclick = function () { if (!confirm('清除本课的题目进度（不影响积分）？')) return; PR = { pos: -1, revealed: {}, levels: PR.levels }; saveProg(); buildSlides(); closeOv(); home(); };
      $('#cg-cancel').onclick = closeOv;
      $('#cg-save').onclick = function () {
        var mode = root.querySelector('input[name=cgmode]:checked').value, gn = Array.from(root.querySelectorAll('.cg-gname')).map(function (x, i) { return x.value.trim() || ('第' + (i + 1) + '组'); });
        var abs = Array.from(root.querySelectorAll('.cg-ab')).filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
        mutate(function (x) { x.prefs.mode = mode; x.prefs.groupNames = gn; x.prefs.groupOf = groupOf; x.prefs.timer = Math.max(5, Math.min(120, Math.round(+$('#cg-t').value / 1) || 20)); x.prefs.sound = $('#cg-snd').checked; x.picker.absentDate = today(); x.picker.absent = abs; });
        if (BANK) { var lv = Array.from(root.querySelectorAll('.cg-lv')).filter(function (x) { return x.checked; }).map(function (x) { return x.value; }); if (lv.length && lv.join() !== levels().join()) { var cur = SL[PR.pos]; PR.levels = lv; buildSlides(); var np = cur ? SL.findIndex(function (s) { return s.k === cur.k && s.lv === cur.lv && s.qi === cur.qi; }) : -1; PR.pos = PR.pos < 0 ? -1 : (np >= 0 ? np : 0); saveProg(); if (PR.pos < 0 && VIEW === 'slide') VIEW = 'title'; } }
        closeOv(); resetTimer(); render();
      };
    }
    function download(name, text) { var a = document.createElement('a'), url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' })); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 15000); }
    function exportScores() { download('商务精读_课堂积分_' + today() + '.json', JSON.stringify({ format: EXPORT_FORMAT, version: 1, courseId: C.id, exportedAt: new Date().toISOString(), games: current() }, null, 2)); toast('已导出积分（只含学生编号）。'); }
    function merge(a, b) { var byId = {}; a.sessions.forEach(function (s) { byId[s.id] = s; }); b.sessions.forEach(function (s) { var o = byId[s.id]; if (!o || s.log.length > o.log.length || (s.log.length === o.log.length && s.end && !o.end)) byId[s.id] = s; }); var out = clone(a); out.sessions = Object.keys(byId).map(function (k) { return byId[k]; }).sort(function (x, y) { return x.start - y.start; }); return out; }
    $('#cg-file').onchange = function () {
      var f = $('#cg-file').files[0]; if (!f) return; if (f.size > 3 * 1024 * 1024) { toast('文件过大，请选择课堂游戏导出的积分文件。'); return; }
      f.text().then(function (t) {
        var o; try { o = JSON.parse(t.replace(/^\uFEFF/, '')); } catch (e) { toast('不是有效的 JSON 文件，积分未改动。'); return; }
        var src = o && o.format === EXPORT_FORMAT ? o.games : (o && o.format === 'business-reading-workbench' && o.data ? o.data.games : null);
        if (!src || (o.courseId && o.courseId !== C.id)) { toast('这不是本课程的积分文件，积分未改动。'); return; }
        var inc = validate(src), cur = current();
        panel('<h2>导入积分</h2><p>文件：' + esc(f.name) + '<br>导出时间：' + esc(o.exportedAt || '未标注') + '<br>文件中有 ' + inc.sessions.length + ' 次课的积分；当前有 ' + cur.sessions.length + ' 次。</p><p class="cg-help">合并：保留两边的所有课次（同一节课取记录更完整的一份）。替换：用文件里的积分覆盖当前积分。</p><p class="cg-pact"><button type="button" class="cg-pbtn dark" id="cg-merge">合并（推荐）</button><button type="button" class="cg-pbtn" id="cg-replace">替换</button><button type="button" class="cg-pbtn" id="cg-cancel2">取消</button></p>');
        $('#cg-merge').onclick = function () { mutate(function (g) { var m = merge(g, inc); g.sessions = m.sessions; }); closeOv(); toast('积分已合并。'); render(); };
        $('#cg-replace').onclick = function () { if (!confirm('用文件中的积分替换当前积分？')) return; mutate(function (g) { g.sessions = inc.sessions; g.picker = inc.picker; g.prefs = inc.prefs; }); closeOv(); toast('积分已替换。'); render(); };
        $('#cg-cancel2').onclick = closeOv;
      });
    };
    function openSources() {
      if (!BANK) return;
      panel('<h2>题目来源一览</h2><div class="cg-help">' + esc(BANK.textbook || '') + '<br>' + (BANK.notes || []).map(esc).join('<br>') + '</div>' + BANK.levels.map(function (l, i) { var qs = lvQs(l.id), c = {}; qs.forEach(function (q) { c[q.source] = (c[q.source] || 0) + 1; }); return '<h3 style="color:' + l.color + '">第' + (i + 1) + '关 ' + esc(l.name) + '（' + qs.length + '题：' + Object.keys(c).map(function (k) { return k + ' ' + c[k]; }).join('，') + '）</h3><table><tr><th>题号</th><th>来源</th><th>课本位置</th><th>题目</th><th>答案</th></tr>' + qs.map(function (q) { return '<tr><td>' + esc(q.id) + '</td><td><span class="cg-tag ' + (SRC_CLS[q.source] || '') + '">' + esc(q.source) + '</span></td><td>' + esc(q.ref) + '</td><td>' + esc((q.pinyin ? q.pinyin + '（' + q.detail + '） ' : '') + q.prompt.replace(/\n/g, ' ')) + '</td><td>' + esc(ansText(q)) + '</td></tr>'; }).join('') + '</table>'; }).join('') + '<p class="cg-pact"><button type="button" class="cg-pbtn dark" id="cg-close">关闭</button></p>');
      $('#cg-close').onclick = closeOv;
    }

    /* ---------- 打开 / 关闭 ---------- */
    function openLesson(n) {
      LESSON = n; BANK = null; BANK_STATE = 'loading'; PR = P(); SL = []; VIEW = 'title'; CUR = null; resetTimer(); render();
      loadBank(n).then(function (bank) {
        if (LESSON !== n) return;
        BANK = bank && Array.isArray(bank.questions) && Array.isArray(bank.levels) ? bank : null; BANK_STATE = BANK ? 'ok' : 'missing';
        LV = {}; if (BANK) BANK.levels.forEach(function (l) { LV[l.id] = l; });
        buildSlides(); if (PR.pos >= SL.length) PR.pos = SL.length - 1; render();
      });
    }
    var prevFocus = null;
    window.addEventListener('resize', function () { if (!root.hidden && VIEW === 'slide') renderStage(); });
    function open(n) {
      if (!n) { var st = B.getState(); n = st.lesson || 1; }
      if (W.closeModal) W.closeModal();
      var closed = 0; if (W.getState().games) { var g = current(); if (g.sessions.some(function (s) { return !s.end && s.date !== today(); })) closed = mutate(function (x) { return closeStale(x); }); }
      prevFocus = document.activeElement; root.hidden = false; document.documentElement.classList.add('cg-open');
      openLesson(n);
      if (closed) toast('上次课没有点“本节课结束”，已自动记入历史。');
    }
    function exit() { stopTimer(); closePick(); closeOv(); root.hidden = true; document.documentElement.classList.remove('cg-open'); if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); if (prevFocus && prevFocus.focus) prevFocus.focus(); }
    window.BusinessClassGame = { open: open, close: exit, isOpen: function () { return !root.hidden; }, validate: validate };

    root.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t || !root.contains(t)) { if (e.target.id === 'cg-ov') closeOv(); if (e.target.id === 'cg-pick' && e.target.className.indexOf('done') >= 0) closePick(); return; }
      if (t.dataset.s && CUR) { score(CUR, +t.dataset.s); return; }
      if (t.dataset.g !== undefined && t.dataset.d) { groupScore(+t.dataset.g, +t.dataset.d); return; }
      var a = t.dataset.a; if (!a) return;
      ({ lb: showBoard, settings: openSettings, exit: exit, home: home, prev: prev, next: next, timer: toggleTimer, reveal: reveal, undo: undo, sources: openSources, pick: pick, closepick: closePick,
        repick: function () { repick(false); }, absent: function () { repick(true); }, start: startGame, resume: function () { go(PR.pos); }, back: back, endsession: endSession,
        restart: function () { if (confirm('从第一关重新开始（积分不受影响）？')) startGame(); },
        full: function () { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (err) { toast('请使用浏览器的全屏菜单。'); } } }[a] || function () {})();
    });
    window.addEventListener('keydown', function (e) {
      if (root.hidden || e.isComposing) return;
      if (document.querySelector('.bc-overlay')) return;
      var inInput = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
      e.stopPropagation();
      if ($('#cg-ov').classList.contains('show')) { if (e.key === 'Escape') { e.preventDefault(); closeOv(); } return; }
      if (inInput || e.ctrlKey || e.metaKey || e.altKey) return;
      var pickOpen = !$('#cg-pick').hidden, k = e.key, g = current();
      if (k === 'Escape') { e.preventDefault(); if (pickOpen) closePick(); else if (VIEW === 'board') back(); else exit(); return; }
      if (k === 'r' || k === 'R') { e.preventDefault(); pick(); return; }
      if (k === 'z' || k === 'Z') { e.preventDefault(); undo(); return; }
      if (k === 'l' || k === 'L') { e.preventDefault(); showBoard(); return; }
      if (g.prefs.mode === 'group' && e.shiftKey && /^Digit[1-8]$/.test(e.code)) { var gi = +e.code.slice(5) - 1; if (gi < g.prefs.groupNames.length) groupScore(gi, 1); e.preventDefault(); return; }
      if (CUR && (k === '1' || k === '2' || k === '+' || k === '=')) { e.preventDefault(); score(CUR, k === '2' ? 2 : 1); return; }
      if (CUR && (k === '-' || k === '_')) { e.preventDefault(); score(CUR, -1); return; }
      if (pickOpen) { if (k === 'Enter' || k === ' ') { e.preventDefault(); closePick(); } return; }
      if (k === ' ') { e.preventDefault(); toggleTimer(); }
      else if (k === 'Enter') { e.preventDefault(); if (VIEW === 'title' && BANK) { PR.started && PR.pos >= 0 ? go(PR.pos) : startGame(); } else reveal(); }
      else if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); next(); }
      else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); prev(); }
    }, true);
    window.addEventListener('business:roster-change', function () { if (!root.hidden) { renderBoard(); if (VIEW === 'board') renderStage(); updatePick(); } });

    /* ---------- 工作台入口 ---------- */
    var header = document.querySelector('body > header');
    if (header && !document.getElementById('wb-class-game')) {
      var hb = document.createElement('button'); hb.className = 'tbtn cg-entry'; hb.id = 'wb-class-game'; hb.type = 'button'; hb.textContent = '课堂游戏'; hb.title = '本课课堂游戏：闯关、随机抽人、个人积分榜（G）';
      hb.onclick = function () { open(); };
      var rl = document.getElementById('wb-real-life'); if (rl) header.insertBefore(hb, rl); else header.appendChild(hb);
    }
    document.addEventListener('keydown', function (e) {
      if (!root.hidden || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || e.repeat || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
      var m = document.getElementById('wb-modal'); if ((m && !m.hidden) || document.querySelector('.bc-overlay')) return;
      var bo = document.getElementById('wb-blackout'); if (bo && !bo.hidden) return;
      if (e.key === 'g' || e.key === 'G') { e.preventDefault(); open(); }
    });
    function enhanceOverview() {
      var t = document.getElementById('wb-modal-title'), body = document.getElementById('wb-modal-body');
      if (!t || !body || t.textContent !== '全书概览') return;
      body.querySelectorAll('.wb-overview > section.wb-card').forEach(function (sec) {
        if (sec.querySelector('[data-cg-lesson]')) return;
        var h = sec.querySelector('h3'), m = h && /第(\d+)课/.exec(h.textContent); if (!m) return;
        var b = document.createElement('button'); b.type = 'button'; b.className = 'wb-button cg-ovbtn'; b.dataset.cgLesson = m[1]; b.textContent = '课堂游戏';
        b.onclick = function () { open(+m[1]); };
        h.insertAdjacentElement('afterend', b);
      });
    }
    new MutationObserver(enhanceOverview).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
})();
