/* 生词高亮（2026-10-28 补充）：在“会话”“课文”正文中标出本部分生词。
   只读取 BOOK_DATA，不改动原教材数据、授课记录或同步数据；开关只保存在本机浏览器（bc-vocab-hl）。 */
(function () {
  "use strict";
  var PREF = "bc-vocab-hl";
  var on = true;
  try { on = localStorage.getItem(PREF) !== "0"; } catch (e) {}
  var B = function () { return window.BusinessBook; };
  var CN = "一二三四五六七八九十";

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  /* 生词条目 → 若干匹配式；长词优先，避免复合词被拆开 */
  function patterns(list) {
    var pats = [];
    (list || []).forEach(function (w, i) {
      String(w.word).split(/[\/／、]/).forEach(function (f) {
        f = f.replace(/[（(][^）)]*[）)]/g, "").trim();
        if (!f) return;
        var parts = f.split(/…+|\.{3,}|～|~/).filter(Boolean);
        var src = parts.length > 1 ? parts.map(reEsc).join("[^，。！？；：、,.!?;:\\s]{1,12}?") : reEsc(f);
        pats.push({ src: src, len: f.replace(/…|\./g, "").length, i: i });
      });
    });
    pats.sort(function (a, b) { return b.len - a.len; });
    return pats;
  }
  var cache = {};
  function matcher(lessonId, kind) {
    var k = lessonId + kind;
    if (cache[k]) return cache[k];
    var L = B().data.lessons.filter(function (l) { return l.id === lessonId; })[0];
    var list = L ? L[kind === "d" ? "duihua_shengci" : "kewen_shengci"] : [];
    var pats = patterns(list);
    var re = pats.length ? new RegExp("(" + pats.map(function (p) { return p.src; }).join(")|(") + ")", "g") : null;
    return (cache[k] = { list: list, pats: pats, re: re });
  }

  function wrapNode(node, m, kind, lessonId, found) {
    var text = node.nodeValue, re = m.re, last = 0, r, frag = document.createDocumentFragment(), hit = false;
    re.lastIndex = 0;
    while ((r = re.exec(text))) {
      var g = 1; while (g < r.length && r[g] === undefined) g++;
      var w = m.list[m.pats[g - 1].i];
      found[m.pats[g - 1].i] = true;
      if (r.index > last) frag.appendChild(document.createTextNode(text.slice(last, r.index)));
      var mk = document.createElement("mark");
      mk.className = "vhl vhl-" + kind;
      mk.setAttribute("data-vhl", m.pats[g - 1].i);
      mk.title = w.word + "　" + (w.pinyin || "") + "\n" + (w.pos ? "〔" + w.pos + "〕" : "") + (w.def || "");
      mk.textContent = r[0];
      frag.appendChild(mk);
      last = r.index + r[0].length; hit = true;
      if (!r[0].length) re.lastIndex++;
    }
    if (!hit) return;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }

  function legend(kind, n, total) {
    var name = kind === "d" ? "会话生词" : "课文生词";
    return '<div class="vhl-legend" data-vhl-legend><span class="vhl-sw vhl-' + kind + '">' + name + "</span>" +
      "<span>本部分 " + total + " 个生词，正文中标出 " + n + " 个</span><span class=\"vhl-tip\">点击高亮词可看拼音和释义 · 顶栏“生词高亮”可开关</span></div>";
  }

  function apply() {
    var st = B() && B().getState && B().getState();
    var body = document.getElementById("sec-body");
    if (!st || st.view !== "lesson" || !body) return;
    var kind = st.section === "duihua" ? "d" : st.section === "kewen" ? "k" : null;
    if (!kind || body.querySelector("[data-vhl-legend]")) return;
    var m = matcher(st.lesson, kind);
    if (!m.re) return;
    var targets = body.querySelectorAll(kind === "d" ? ".dlg-intro, .bubble .text, .scene-line span" : ".kewen-card p");
    var found = {};
    targets.forEach(function (t) {
      var walker = document.createTreeWalker(t, NodeFilter.SHOW_TEXT, null), nodes = [], n;
      while ((n = walker.nextNode())) if (!n.parentNode.closest(".vhl")) nodes.push(n);
      nodes.forEach(function (x) { wrapNode(x, m, kind, st.lesson, found); });
    });
    var title = body.querySelector(".sec-title");
    var lg = document.createElement("div"); lg.innerHTML = legend(kind, Object.keys(found).length, m.list.length);
    if (title) title.after(lg.firstChild); else body.prepend(lg.firstChild);
  }

  /* 点击显示拼音和释义（不阻止原有点击：遮住的台词仍按原逻辑处理） */
  var pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } }
  document.addEventListener("click", function (e) {
    var mk = e.target.closest && e.target.closest("mark.vhl");
    if (!mk || mk.closest(".text.masked") || !document.body.classList.contains("vhl-on")) { if (!(e.target.closest && e.target.closest(".vhl-pop"))) closePop(); return; }
    var st = B().getState(), m = matcher(st.lesson, mk.classList.contains("vhl-d") ? "d" : "k");
    var w = m.list[+mk.getAttribute("data-vhl")]; if (!w) return;
    closePop();
    pop = document.createElement("div");
    pop.className = "vhl-pop " + (mk.classList.contains("vhl-d") ? "vhl-pop-d" : "vhl-pop-k");
    pop.setAttribute("role", "tooltip");
    pop.innerHTML = '<div class="vhl-pop-w">' + esc(w.word) + '<span class="vhl-pop-py">' + esc(w.pinyin || "") + "</span></div>" +
      (w.pos ? '<div class="vhl-pop-pos">' + esc(w.pos) + "</div>" : "") + '<div class="vhl-pop-def">' + esc(w.def || "") + "</div>" +
      '<div class="vhl-pop-src">第' + CN[st.lesson - 1] + "课 · " + (mk.classList.contains("vhl-d") ? "会话生词" : "课文生词") + "</div>";
    document.body.appendChild(pop);
    var r = mk.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    var x = Math.max(8, Math.min(innerWidth - pw - 8, r.left + r.width / 2 - pw / 2));
    var y = r.bottom + 8; if (y + ph > innerHeight - 8) y = Math.max(8, r.top - ph - 8);
    pop.style.left = x + "px"; pop.style.top = y + "px";
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(); });
  document.addEventListener("scroll", closePop, true);

  function setOn(v) {
    on = v;
    document.body.classList.toggle("vhl-on", on);
    var b = document.getElementById("btn-vhl");
    if (b) { b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }
    try { localStorage.setItem(PREF, on ? "1" : "0"); } catch (e) {}
    if (!on) closePop();
  }
  function mountButton() {
    if (document.getElementById("btn-vhl")) return;
    var ref = document.getElementById("btn-ans");
    if (!ref) return;
    var b = document.createElement("button");
    b.className = "tbtn"; b.id = "btn-vhl"; b.type = "button";
    b.title = "在会话、课文中高亮本部分生词（会话生词蓝色实线，课文生词橙色虚线）";
    b.textContent = "生词高亮";
    b.addEventListener("click", function () { setOn(!on); });
    ref.after(b);
  }
  function init() { mountButton(); setOn(on); apply(); }
  document.addEventListener("business-render", function () { closePop(); apply(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.BusinessVocabHighlight = { apply: apply, set: setOn, patterns: patterns };
})();
