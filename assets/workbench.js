(function () {
  'use strict';
  const B = window.BusinessBook, C = window.BUSINESS_COURSE;
  if (!B || !C) { alert('工作台资料未加载。请保留 assets 文件夹，并从“打开工作台.html”进入。'); return; }
  const KEY = 'business-reading-sie4351b-2026-v1', FORMAT = 'business-reading-workbench', VERSION = 1;
  const $ = id => document.getElementById(id), main = $('main'), app = $('app');
  const clone = x => JSON.parse(JSON.stringify(x));
  const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const secKeys = B.sections.map(s => s[0]), sessionIds = C.sessions.map(s => s.id), studentIds = C.students.map(s => s.id);
  const realSections = B.realLifeSections, realKeys = realSections.map(s => s[0]);
  const teachingView = view => view === 'lesson' || view === 'reallife';
  const flushRealLife = () => window.BusinessRealLife?.flush();
  const isObject = x => x && typeof x === 'object' && !Array.isArray(x);
  const shortText = (x,max=5000) => typeof x === 'string' && x.length <= max;
  const today = () => { const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()); return ['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-'); };
  const dateText = date => { if (!date) return '日期待定'; const d=new Date(date+'T12:00:00+08:00'); return date.replace(/-/g,'/')+' 周'+'日一二三四五六'[d.getUTCDay()]; };
  const validDate = s => typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
  const btn = (label,id='',cls='') => '<button type="button" class="wb-button '+cls+'"'+(id?' id="'+id+'"':'')+'>'+esc(label)+'</button>';
  const contentText = s => Array.isArray(s.content) ? s.content.join('\n') : (s.content || '');
  function empty() { return {bookmark:null,browse:null,records:{},overrides:{},notes:{},realLife:{answers:{},checks:{}},picker:{drawn:[],excluded:[]},prefs:{font:2,answers:false,notes:false,sidebar:innerWidth>720}}; }
  function fail() { throw new Error('这份记录不符合本课程格式，现有记录没有被覆盖。'); }
  function validLocation(l,nullable=true) {
    if (l===null && nullable) return null;
    if (!isObject(l) || !['home','chars','vocab','lesson','reallife'].includes(l.view) || !Number.isInteger(l.lesson) || l.lesson<1 || l.lesson>B.data.lessons.length || !(l.view==='reallife' ? l.lesson===1 && realKeys.includes(l.section) : secKeys.includes(l.section)) || !Number.isFinite(l.scroll) || l.scroll<0 || l.scroll>1000000) fail();
    const out={view:l.view,lesson:l.lesson,section:l.section,scroll:l.scroll,anchor:null,open:[]};
    if(l.anchor!==null && l.anchor!==undefined) { if(!isObject(l.anchor)||!Number.isInteger(l.anchor.index)||l.anchor.index<0||l.anchor.index>2000||!Number.isFinite(l.anchor.offset)||Math.abs(l.anchor.offset)>100000) fail(); out.anchor={index:l.anchor.index,offset:l.anchor.offset}; }
    if(l.open!==undefined) { if(!Array.isArray(l.open)||l.open.length>200||l.open.some(n=>!Number.isInteger(n)||n<0||n>200)) fail(); out.open=l.open.slice(); }
    return out;
  }
  function validate(x) {
    if(!isObject(x)) fail(); const out=empty();
    if(x.bookmark!==null) { if(!isObject(x.bookmark)||!shortText(x.bookmark.savedAt,80)) fail(); out.bookmark={location:validLocation(x.bookmark.location,false),savedAt:x.bookmark.savedAt}; }
    out.browse=validLocation(x.browse);
    for(const key of ['records','overrides']) if(!isObject(x[key]) || Object.keys(x[key]).some(id=>!sessionIds.includes(id))) fail();
    Object.keys(x.records).forEach(id=> { const r=x.records[id]; if(!isObject(r)||!['unrecorded','in-progress','complete'].includes(r.status)||!shortText(r.note)||!(r.actualDate===''||validDate(r.actualDate))) fail(); out.records[id]={status:r.status,note:r.note,actualDate:r.actualDate,location:validLocation(r.location)}; });
    Object.keys(x.overrides).forEach(id=> { const o=x.overrides[id]; if(!isObject(o)||!validDate(o.date)||!shortText(o.period,100)||!shortText(o.time,100)||!shortText(o.title,250)||!o.title.trim()||!shortText(o.content)||!shortText(o.notice,2000)||typeof o.resolved!=='boolean'||!(o.lesson===null||(Number.isInteger(o.lesson)&&o.lesson>=1&&o.lesson<=B.data.lessons.length))||!secKeys.includes(o.section)) fail(); out.overrides[id]={date:o.date,period:o.period,time:o.time,title:o.title,content:o.content,notice:o.notice,resolved:o.resolved,lesson:o.lesson,section:o.section}; });
    if(!isObject(x.notes)||Object.keys(x.notes).length>150) fail();
    Object.keys(x.notes).forEach(k=> { const [l,s]=k.split(':'); const validKey=l==='real' ? k==='real:'+s && realKeys.includes(s) : k===l+':'+s && Number.isInteger(+l)&&+l>=1&&+l<=B.data.lessons.length&&secKeys.includes(s); if(!validKey||!shortText(x.notes[k])) fail(); out.notes[k]=x.notes[k]; });
    if(x.realLife!==undefined) {
      if(!isObject(x.realLife)) fail();
      ['answers','checks'].forEach(kind=> {
        const values=x.realLife[kind];
        if(!isObject(values)||Object.keys(values).length>120) fail();
        Object.keys(values).forEach(key=> {
          if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(key)||['constructor','prototype','__proto__'].includes(key)||(kind==='answers'?!shortText(values[key]):typeof values[key]!=='boolean')) fail();
          out.realLife[kind][key]=values[key];
        });
      });
    }
    if(!isObject(x.picker)) fail();
    ['drawn','excluded'].forEach(k=> { const a=x.picker[k]; if(!Array.isArray(a)||a.length>studentIds.length||new Set(a).size!==a.length||a.some(id=>!studentIds.includes(id))) fail(); out.picker[k]=a.slice(); });
    const p=x.prefs; if(!isObject(p)||![0,1,2,3,4,5,6].includes(p.font)||['answers','notes','sidebar'].some(k=>typeof p[k]!=='boolean')) fail(); out.prefs={font:p.font,answers:p.answers,notes:p.notes,sidebar:p.sidebar};
    return out;
  }
  function pack(data) {return {format:FORMAT,version:VERSION,courseId:C.id,exportedAt:new Date().toISOString(),data};}
  function unpack(obj) { if(!isObject(obj)||obj.format!==FORMAT||obj.version!==VERSION||obj.courseId!==C.id) fail(); return validate(obj.data); }
  let state=empty(), storageOK=true, corruptRaw=null, undo=[], lastJump=null, isRestoring=false, toastTimer, browseTimer, pendingImport=null, modalFocus=null;
  try { const raw=localStorage.getItem(KEY); if(raw) { try {state=unpack(JSON.parse(raw));} catch(e) {corruptRaw=raw;storageOK=false;} } const testKey=KEY+'-probe';localStorage.setItem(testKey,'1');localStorage.removeItem(testKey); } catch(e) {storageOK=false;}
  function save() { if(corruptRaw!==null) {storageOK=false;return false;} try {localStorage.setItem(KEY,JSON.stringify(pack(state)));storageOK=true;} catch(e){storageOK=false;} storageWarning();return storageOK; }
  function storageWarning() { if(!$('wb-storage'))return; $('wb-storage').hidden=storageOK; $('wb-storage').textContent=corruptRaw!==null?'原保存记录暂时无法读取，已保留原数据。可在“更多设置”导出原始记录或恢复备份。':'浏览器暂时不能保存。关闭前请到“更多设置”导出记录。'; }
  function commit(label,fn) { const next=clone(state); try {fn(next);const checked=validate(next);undo.push({label,data:clone(state),after:clone(checked)});if(undo.length>30)undo.shift();state=checked;save();refreshToolbar();return true;} catch(e) {toast(e.message || '未能保存，请检查填写内容。');return false;} }
  function undoLast() { flushNotes();flushRealLife();const step=undo.pop(); if(!step){toast('没有可以撤销的操作');return;} const beforeRealLife=JSON.stringify(state.realLife),restored=clone(state); if(step.after){Object.keys(step.data).forEach(key=>{if(JSON.stringify(step.data[key])!==JSON.stringify(step.after[key]))restored[key]=step.data[key];});state=restored;}else state=step.data;save();applyPrefs();if(beforeRealLife!==JSON.stringify(state.realLife))redrawRealLife();refreshToolbar();updateNotes();toast('已撤销：'+step.label); }
  function toast(text,action) {const t=$('wb-toast');t.textContent=text;t.hidden=false;clearTimeout(toastTimer);if(action){const b=document.createElement('button');b.textContent=action.label;b.onclick=action.run;t.appendChild(b);}toastTimer=setTimeout(()=>t.hidden=true,action?8000:4200);}
  const toolbar=document.createElement('div'); toolbar.className='wb-toolbar'; toolbar.innerHTML=btn('讲到这里','wb-mark','wb-mark')+btn('继续上次','wb-resume','wb-primary')+btn('随机抽问','wb-picker')+btn('课程安排','wb-agenda')+'<div class="wb-context" id="wb-context"></div>';
  app.before(toolbar);
  const warning=document.createElement('div');warning.id='wb-storage';warning.className='wb-warning';warning.hidden=true;app.before(warning);
  document.body.insertAdjacentHTML('beforeend','<div class="wb-note-panel" id="wb-notes-panel" hidden><label for="wb-note-text">教师备注<br><span id="wb-note-label"></span></label><textarea id="wb-note-text" maxlength="5000" placeholder="仅此教学环节的提示；输入后自动保存。投屏时可隐藏。"></textarea></div><div class="wb-readerbar">'+btn('上一环节','wb-prev')+'<span id="wb-position"></span>'+btn('下一环节','wb-next')+btn('返回跳转前','wb-back')+'</div><div id="wb-modal" class="wb-modal" role="dialog" aria-modal="true" aria-labelledby="wb-modal-title" hidden><div class="wb-dialog"><div class="wb-modal-head"><h2 id="wb-modal-title"></h2>'+btn('关闭','wb-modal-close')+'</div><div id="wb-modal-body" class="wb-modal-body"></div></div></div><div class="wb-toast" id="wb-toast" role="status" aria-live="polite" hidden></div><div class="wb-blackout" id="wb-blackout" hidden><button type="button">点击或按 B / Esc 返回课件</button></div><input type="file" accept=".json,application/json" id="wb-import" hidden>');
  const header=document.querySelector('body > header');
  const addHeader=(id,label,title)=> {const n=document.createElement('button');n.className='tbtn';n.id=id;n.textContent=label;n.title=title;header.appendChild(n);return n;};
  addHeader('wb-real-life','真实场景','第1课 · 求职面试真实场景');addHeader('wb-search','搜索','全文搜索（/）');addHeader('wb-overview','概览','各课教学环节');addHeader('wb-note-toggle','备注','显示或隐藏教师备注（N）');addHeader('wb-blank','黑屏','暂时遮住投屏（B）');addHeader('wb-settings','更多设置','记录、调课和备份');
  function modal(title,html) { flushNotes(); flushRealLife(); if($('wb-modal').hidden)modalFocus=document.activeElement; document.querySelectorAll('.fab-panel').forEach(n=>n.classList.remove('show'));$('wb-modal-title').textContent=title;$('wb-modal-body').innerHTML=html;
    if(title==='更多设置')$('wb-modal-body').insertAdjacentHTML('afterbegin','<section class="wb-card"><h3>第1课 · 真实场景</h3><p>顶部“真实场景”进入六个学习环节。教材内容、真实来源、据来源整理与新编教学材料分别标明。“讲到这里”和“继续上次”也适用于真实场景。</p><p class="wb-muted">填写的作品与自评随教学记录保存在当前浏览器，并包含在导出备份中。真实场景教师备注与教材备注分别保存；课堂画笔仍为临时笔迹。</p></section>');
    $('wb-modal').hidden=false;app.inert=true;header.inert=true;toolbar.inert=true;$('wb-modal-close').focus();return $('wb-modal-body'); }
  function closeModal() {$('wb-modal').hidden=true;app.inert=false;header.inert=false;toolbar.inert=false;if(modalFocus&&modalFocus.isConnected)modalFocus.focus();}
  $('wb-modal-close').onclick=closeModal;$('wb-modal').onclick=e=>{if(e.target===$('wb-modal'))closeModal();};
  function anchors() { const bs=B.getState();if(bs.view==='reallife')return Array.from(main.querySelectorAll('.rl-card'));const key=bs.section;const selectors={daodu:'.qcard',hexinjv:'.key-s',duihua:'.scene-line,.bubble-row',kewen:'.kewen-card p',sc1:'.vcard',sc2:'.vcard',yyd1:'.lp',yyd2:'.lp',lijie:'.ex-item,.match-wrap',lx1:'.ex-item,.match-wrap',lx2:'.ex-item,.match-wrap'};return Array.from(main.querySelectorAll('#sec-body '+(selectors[key]||'.card').split(',').join(',#sec-body '))); }
  function capture() {const bs=B.getState();const l={view:bs.view,lesson:bs.lesson,section:bs.section,scroll:main.scrollTop,anchor:null,open:[]};if(teachingView(bs.view)){const a=anchors(),top=main.getBoundingClientRect().top+(main.querySelector('.subnav')?.getBoundingClientRect().height||0)+12;const index=a.findIndex(n=>n.getBoundingClientRect().bottom>top);if(index>=0)l.anchor={index,offset:top-a[index].getBoundingClientRect().top};l.open=Array.from(main.querySelectorAll('.lp')).map((n,i)=>n.classList.contains('open')?i:-1).filter(i=>i>=0);}return l;}
  function describe(l) { if(!l)return '尚未标记';if(l.view==='home')return '教材首页';if(l.view==='chars')return '人物列表';if(l.view==='vocab')return '全书生词总表';if(l.view==='reallife')return '第1课 · 真实场景 · '+(realSections.find(s=>s[0]===l.section)?.[1]||'招聘会现场');const s=B.sections.find(x=>x[0]===l.section);return '第'+l.lesson+'课 '+B.data.lessons[l.lesson-1].title+' · 教材 · '+(s[2]==='导入'?'':s[2]+'·')+s[1]; }
  function go(l,remember=true) {if(!l)return;flushNotes();flushRealLife();if(remember)lastJump=capture();clearTimeout(browseTimer);isRestoring=true;B.go(l);Array.from(main.querySelectorAll('.lp')).forEach((n,i)=>n.classList.toggle('open',(l.open||[]).includes(i)));let y=l.scroll||0;if(l.anchor){const a=anchors()[l.anchor.index];if(a)y=main.scrollTop+a.getBoundingClientRect().top-main.getBoundingClientRect().top-(main.querySelector('.subnav')?.getBoundingClientRect().height||0)-12+l.anchor.offset;}main.scrollTop=Math.max(0,y);isRestoring=false;state.browse=capture();save();refreshToolbar();updateNotes();updateHash();if(innerWidth<=720){document.body.classList.add('wb-sidebar-hidden');} }
  // Pending drafts must be flushed before replacing state. Repaint from that new
  // state without invoking go(), which would save the old notes and browse data.
  function redrawRealLife(){
    if(B.getState().view!=='reallife')return;
    const loc=capture(),wasRestoring=isRestoring;clearTimeout(browseTimer);isRestoring=true;
    try{
      B.go(loc);let y=loc.scroll;
      if(loc.anchor){const a=anchors()[loc.anchor.index];if(a)y=main.scrollTop+a.getBoundingClientRect().top-main.getBoundingClientRect().top-12+loc.anchor.offset;}
      main.scrollTop=Math.max(0,y);
    }finally{isRestoring=wasRestoring;}
  }
  function target(lesson,section='daodu') {return {view:'lesson',lesson,section,scroll:0,anchor:null,open:[]};}
  function realTarget(section='scene') {return {view:'reallife',lesson:1,section,scroll:0,anchor:null,open:[]};}
  function updateHash() {const l=B.getState();const hash=l.view==='reallife'?'view=reallife&lesson=1&section='+l.section:l.view==='lesson'?'lesson='+l.lesson+'&section='+l.section:'view='+l.view;try{history.replaceState(null,'','#'+hash);}catch(e){}}
  function refreshToolbar() {const l=B.getState();$('wb-mark').disabled=!teachingView(l.view);$('wb-resume').disabled=!state.bookmark;$('wb-resume').title=state.bookmark?describe(state.bookmark.location):'讲完后点“讲到这里”';$('wb-context').innerHTML=state.bookmark?'<strong>已记住：</strong>'+esc(describe(state.bookmark.location)):'讲完点“讲到这里”，下次点“继续上次”';$('wb-position').textContent=describe({...l,scroll:0});const i=l.view==='reallife'?realKeys.indexOf(l.section):(l.lesson-1)*secKeys.length+secKeys.indexOf(l.section),total=l.view==='reallife'?realKeys.length:B.data.lessons.length*secKeys.length;$('wb-prev').disabled=!teachingView(l.view)||i===0;$('wb-next').disabled=!teachingView(l.view)||i===total-1;$('wb-back').disabled=!lastJump;$('wb-real-life').classList.toggle('on',l.view==='reallife');storageWarning();document.documentElement.style.setProperty('--wb-app-top',app.getBoundingClientRect().top+'px');}
  function mark() {if(!teachingView(B.getState().view))return;flushNotes();flushRealLife();const loc=capture();if(commit('标记授课位置',d=>d.bookmark={location:loc,savedAt:new Date().toISOString()}))toast((storageOK?'已记住：':'已临时记住：')+describe(loc),{label:'撤销',run:undoLast});}
  $('wb-mark').onclick=mark;$('wb-resume').onclick=()=>{if(state.bookmark){closeModal();go(state.bookmark.location);toast('已回到上次授课位置');}};
  function move(delta){const l=B.getState();if(l.view==='reallife'){const index=realKeys.indexOf(l.section)+delta;if(index>=0&&index<realKeys.length)go(realTarget(realKeys[index]));return;}if(l.view!=='lesson')return;const index=(l.lesson-1)*secKeys.length+secKeys.indexOf(l.section)+delta;if(index<0||index>=B.data.lessons.length*secKeys.length)return;go(target(Math.floor(index/secKeys.length)+1,secKeys[index%secKeys.length]));}
  $('wb-prev').onclick=()=>move(-1);$('wb-next').onclick=()=>move(1);$('wb-back').onclick=()=>{if(lastJump){const p=lastJump;go(p,false);lastJump=null;refreshToolbar();}};
  let noteKey=null;
  function flushNotes(){if(!noteKey||!$('wb-note-text'))return;const text=$('wb-note-text').value;if((state.notes[noteKey]||'')!==text){state.notes[noteKey]=text;save();}}
  function updateNotes(){const l=B.getState();noteKey=l.view==='reallife'?'real:'+l.section:l.view==='lesson'?l.lesson+':'+l.section:null;$('wb-notes-panel').hidden=!state.prefs.notes||!noteKey;$('wb-note-label').textContent=noteKey?describe(l):'';$('wb-note-text').value=noteKey?(state.notes[noteKey]||''):'';}
  $('wb-note-text').oninput=flushNotes;
  function applyPrefs(){B.setFont(state.prefs.font);document.body.classList.toggle('show-answers',state.prefs.answers);$('btn-ans').classList.toggle('on',state.prefs.answers);document.body.classList.toggle('wb-sidebar-hidden',!state.prefs.sidebar);$('wb-note-toggle').classList.toggle('on',state.prefs.notes);updateNotes();}
  $('wb-note-toggle').onclick=()=>{flushNotes();state.prefs.notes=!state.prefs.notes;save();applyPrefs();};
  $('wb-menu').onclick=()=>{state.prefs.sidebar=document.body.classList.contains('wb-sidebar-hidden');document.body.classList.toggle('wb-sidebar-hidden',!state.prefs.sidebar);save();};
  ['btn-ans'].forEach(id=>$(id).addEventListener('click',()=>{state.prefs.font=B.getState().fs;state.prefs.answers=document.body.classList.contains('show-answers');save();}));
  $('btn-full').replaceWith($('btn-full').cloneNode(true));$('btn-full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){toast('当前浏览器未进入全屏，可使用浏览器的全屏菜单。');}};
  function blackout(on){$('wb-blackout').hidden=!on;if(on)$('wb-blackout').querySelector('button').focus();else $('wb-blank').focus();}
  $('wb-blank').onclick=()=>blackout(true);$('wb-blackout').onclick=()=>blackout(false);
  function session(id){return {...C.sessions.find(s=>s.id===id),...(state.overrides[id]||{})};}
  function record(id){return state.records[id]||{status:'unrecorded',note:'',actualDate:'',location:null};}
  const pending=s=>!!s.pending&&!s.resolved;
  const ordered=()=>C.sessions.map(s=>session(s.id)).sort((a,b)=>a.date.localeCompare(b.date)||String(a.time).localeCompare(String(b.time)));
  const near=()=>ordered().find(s=>s.date>=today())||ordered().at(-1);
  function agenda(filter='all') {const n=near(),list=ordered().filter(s=>filter==='all'||(filter==='done'&&record(s.id).status==='complete')||(filter==='todo'&&record(s.id).status!=='complete')||(filter==='pending'&&pending(s)));const done=C.sessions.filter(s=>record(s.id).status==='complete').length;
    const body=modal('课程安排','<div class="wb-actions"><strong>已上完 '+done+' / '+C.sessions.length+' 次</strong><select id="wb-filter" aria-label="筛选课程"><option value="all">全部安排</option><option value="todo">未完成</option><option value="done">已完成</option><option value="pending">待调整</option></select>'+btn('定位近期','wb-near')+btn('更多设置','wb-agenda-more')+'</div><p class="wb-muted">勾选“已上完”可选；记住讲到哪里，只需使用顶部按钮。</p><div id="wb-session-list">'+list.map(s=>{const r=record(s.id);return '<article class="wb-agenda-row'+(s.id===n?.id?' wb-near':'')+(r.status==='complete'?' wb-done':'')+'" data-session="'+esc(s.id)+'"><div class="wb-agenda-top"><strong>'+esc(dateText(s.date))+(s.id===n?.id?'<span class="wb-badge">近期计划</span>':'')+(pending(s)?'<span class="wb-badge wb-pending">待调整</span>':'')+'</strong><label><input type="checkbox" data-complete="'+esc(s.id)+'" '+(r.status==='complete'?'checked':'')+'>已上完</label></div><div class="wb-muted">'+esc((s.period||'')+' · '+(s.time||'')+((s.location||s.room)?' · '+(s.location||s.room):''))+'</div><h3>'+esc(s.title)+'</h3><div class="wb-actions">'+(s.lesson?'<button class="wb-button wb-primary" data-open-session="'+esc(s.id)+'">打开教学内容</button>':'<span class="wb-muted">'+(s.kind==='exam'?'考试安排 · 本工作台未内置试卷':'本次没有固定教材入口')+'</span>')+'<button class="wb-button" data-edit-session="'+esc(s.id)+'">记录 / 调整</button></div>'+(s.notice?'<p class="wb-muted">'+esc(s.notice)+'</p>':'')+'<details><summary>教学内容与记录</summary><p>'+esc(contentText(s)).replace(/\n/g,'<br>')+'</p><p>实际状态：'+({unrecorded:'未记录','in-progress':'进行中',complete:'已完成'}[r.status])+(r.actualDate?' · '+esc(dateText(r.actualDate)):'')+'</p>'+(r.location?'<p>本次停止位置：'+esc(describe(r.location))+'</p>':'')+(r.note?'<p>备注：'+esc(r.note).replace(/\n/g,'<br>')+'</p>':'')+'</details></article>';}).join('')+(list.length?'':'<p class="wb-muted">没有符合条件的安排。</p>')+'</div>');
    $('wb-filter').value=filter;$('wb-filter').onchange=e=>agenda(e.target.value);$('wb-agenda-more').onclick=settings;$('wb-near').onclick=()=>{if(filter!=='all'){agenda();return;}body.querySelector('[data-session="'+n?.id+'"]')?.scrollIntoView({block:'center'});};
    body.querySelectorAll('[data-complete]').forEach(el=>el.onchange=()=>{const id=el.dataset.complete;if(commit(el.checked?'标记本次已上完':'取消完成标记',d=>{d.records[id]={...record(id),status:el.checked?'complete':'unrecorded',actualDate:el.checked?(record(id).actualDate||today()):record(id).actualDate};})){const pos=body.scrollTop;agenda(filter);$('wb-modal-body').scrollTop=pos;}});
    body.querySelectorAll('[data-open-session]').forEach(el=>el.onclick=()=>{const s=session(el.dataset.openSession);closeModal();go(target(s.lesson,s.section));});body.querySelectorAll('[data-edit-session]').forEach(el=>el.onclick=()=>editSession(el.dataset.editSession));
    if(filter==='all'&&n)body.querySelector('[data-session="'+n.id+'"]')?.scrollIntoView({block:'center'});
  }
  function lessonOptions(value,allowEmpty=false){return (allowEmpty?'<option value="">无固定教材入口</option>':'')+B.data.lessons.map(l=>'<option value="'+l.id+'" '+(l.id===value?'selected':'')+'>第'+l.id+'课 '+esc(l.title)+'</option>').join('');}
  function sectionOptions(value){return B.sections.map(s=>'<option value="'+s[0]+'" '+(s[0]===value?'selected':'')+'>'+esc(s[2]+' · '+s[1])+'</option>').join('');}
  function editSession(id){const s=session(id),r=record(id);let stop=r.location;const body=modal('记录与调课','<form id="wb-session-form"><h3>'+esc(s.title)+'</h3><div class="wb-grid"><label class="wb-field">实际状态<select id="wb-status"><option value="unrecorded">未记录</option><option value="in-progress">进行中</option><option value="complete">已完成</option></select></label><label class="wb-field">实际授课日期<input type="date" id="wb-actual" value="'+esc(r.actualDate)+'"></label></div><label class="wb-field">授课备注<textarea id="wb-session-note" maxlength="5000">'+esc(r.note)+'</textarea></label><div class="wb-actions">'+btn('记下当前教学位置','wb-record-current')+btn('清除本次停止位置','wb-record-clear')+'</div><p class="wb-muted" id="wb-stop-desc">'+(stop?esc(describe(stop)):'本次尚未记录停止位置')+'</p><details class="wb-card"><summary>调整计划日期、时间和教学内容</summary><div class="wb-grid"><label class="wb-field">计划日期<input type="date" id="wb-plan-date" required value="'+esc(s.date)+'"></label><label class="wb-field">节次<input id="wb-plan-period" maxlength="100" value="'+esc(s.period||'')+'"></label><label class="wb-field">时间<input id="wb-plan-time" maxlength="100" value="'+esc(s.time||'')+'"></label><label class="wb-field">计划标题<input id="wb-plan-title" required maxlength="250" value="'+esc(s.title)+'"></label></div><label class="wb-field">教学内容<textarea id="wb-plan-content" maxlength="5000">'+esc(contentText(s))+'</textarea></label><div class="wb-grid"><label class="wb-field">教材课次<select id="wb-plan-lesson">'+lessonOptions(s.lesson,true)+'</select></label><label class="wb-field">教学环节<select id="wb-plan-section">'+sectionOptions(s.section||'daodu')+'</select></label></div><label class="wb-field">安排提示<textarea id="wb-plan-notice" maxlength="2000">'+esc(s.notice||'')+'</textarea></label><label><input type="checkbox" id="wb-plan-resolved" '+(s.resolved?'checked':'')+'> 已核实本次待调整事项</label></details><div class="wb-actions"><button type="submit" class="wb-button wb-primary">保存修改</button>'+btn('返回课程安排','wb-edit-back')+'</div><p class="wb-muted">这里的停止位置属于本次记录。“继续上次”仍使用顶部按钮保存的授课位置。</p></form>');
    $('wb-status').value=r.status;$('wb-plan-lesson').value=s.lesson||'';$('wb-record-current').onclick=()=>{if(!teachingView(B.getState().view)){toast('先打开一个教学环节，再记录位置。');return;}flushRealLife();stop=capture();$('wb-stop-desc').textContent=describe(stop);};$('wb-record-clear').onclick=()=>{stop=null;$('wb-stop-desc').textContent='本次尚未记录停止位置';};$('wb-edit-back').onclick=()=>agenda();
    $('wb-session-form').onsubmit=e=>{e.preventDefault();const o={date:$('wb-plan-date').value,period:$('wb-plan-period').value,time:$('wb-plan-time').value,title:$('wb-plan-title').value.trim(),content:$('wb-plan-content').value,notice:$('wb-plan-notice').value,lesson:$('wb-plan-lesson').value?+$('wb-plan-lesson').value:null,section:$('wb-plan-section').value,resolved:$('wb-plan-resolved').checked};const rec={status:$('wb-status').value,actualDate:$('wb-actual').value,note:$('wb-session-note').value,location:stop};if(commit('修改授课记录与安排',d=>{d.records[id]=rec;d.overrides[id]=o;})){agenda();toast('已保存修改');}};
  }
  function download(name,text){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);}
  function exportBackup(){flushNotes();flushRealLife();state.browse=capture();download('商务精读_教学记录_'+today()+'.json',JSON.stringify(pack(state),null,2));toast('已导出教学记录；请将文件保存在容易找到的位置。');}
  function settings(){const body=modal('更多设置','<p class="wb-muted">日常上课只需“讲到这里”和“继续上次”。</p><div class="wb-grid"><section class="wb-card"><h3>授课记录</h3><div class="wb-actions">'+btn('记录与调课','wb-records')+btn('撤销上一步','wb-undo')+'</div><p class="wb-muted">'+(undo.length?'可撤销：'+esc(undo.at(-1).label):'本次打开后还没有可撤销的操作')+'</p></section><section class="wb-card"><h3>备份与恢复</h3><div class="wb-actions">'+btn('导出记录','wb-export','wb-primary')+btn('恢复记录','wb-restore')+'</div><p class="wb-muted">自动保存在这台电脑的当前浏览器。换浏览器、换电脑或移动工作台前，请先导出记录。</p>'+(corruptRaw!==null?btn('导出原始记录','wb-raw'):'')+'</section></div><section class="wb-card"><h3>课堂显示</h3><div class="wb-actions">'+btn(state.prefs.notes?'隐藏教师备注':'显示教师备注','wb-settings-notes')+btn(state.prefs.answers?'隐藏参考答案':'显示参考答案','wb-settings-answers')+'</div><p class="wb-muted">备注按具体教学环节保存。原教材的答案、生词卡、互动练习、计时和抽角色均保留。</p></section><details class="wb-card"><summary>学期里程碑与安排依据</summary>'+(C.milestones||[]).map(m=>'<p><strong>'+esc((m.date||'')+(m.endDate?' 至 '+m.endDate:''))+' '+esc(m.title)+'</strong><br><span class="wb-muted">'+esc(m.note||'')+'</span></p>').join('')+'<hr>'+(C.sources||[]).map(s=>'<p><strong>'+esc(s.title)+'</strong><br><span class="wb-muted">'+esc(s.note||'')+'</span></p>').join('')+(C.notes||[]).map(n=>'<p class="wb-muted">'+esc(n)+'</p>').join('')+'</details><details class="wb-card"><summary>使用与快捷键</summary><p>课程目录用左上角“商”展开或收起。概览可跳到任意课次及环节，全文搜索可定位教材中的句子。</p><p class="wb-muted">K 记进度 · Q 抽学生 · T 课程安排 · / 搜索 · N 教师备注 · B 黑屏 · F 全屏 · 左右方向键切换环节 · Esc 关闭弹窗。输入文字时快捷键不触发。</p><p class="wb-muted">课件目前没有配套音频文件。没有添加虚构音频，也不会连接在线语音服务。</p><p class="wb-muted">请将整个“工作台”文件夹一起保存。浏览位置和授课位置分别记录；浏览、搜索和查看其他课次不会覆盖“继续上次”。</p></details>');
    $('wb-records').onclick=()=>{const body=modal('选择要修改的课次','<label class="wb-field">课次<select id="wb-record-select">'+ordered().map(s=>'<option value="'+esc(s.id)+'">'+esc(s.date+' '+s.title)+'</option>').join('')+'</select></label>'+btn('打开记录','wb-record-open','wb-primary'));$('wb-record-select').value=near()?.id;$('wb-record-open').onclick=()=>editSession($('wb-record-select').value);};$('wb-undo').disabled=!undo.length;$('wb-undo').onclick=()=>{undoLast();settings();};$('wb-export').onclick=exportBackup;$('wb-restore').onclick=()=>{$('wb-import').value='';$('wb-import').click();};if($('wb-raw'))$('wb-raw').onclick=()=>download('商务精读_原始未读取记录_'+today()+'.json',corruptRaw);$('wb-settings-notes').onclick=()=>{$('wb-note-toggle').click();settings();};$('wb-settings-answers').onclick=()=>{$('btn-ans').click();settings();};
  }
  $('wb-import').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;if(file.size>2*1024*1024){toast('文件过大，请选择本工作台导出的教学记录。');return;}
    try{
      const envelope=JSON.parse(await file.text());pendingImport=unpack(envelope);
      const completed=Object.values(pendingImport.records).filter(r=>r.status==='complete').length;
      modal('恢复前确认','<div class="wb-card"><p>课程：'+esc(C.title)+'</p><p>备份时间：'+esc(envelope.exportedAt||'未标注')+'</p><p>授课位置：'+esc(pendingImport.bookmark?describe(pendingImport.bookmark.location):'未标记')+'</p><p>已完成 '+completed+' 次 · 本轮已抽 '+pendingImport.picker.drawn.length+' 人</p></div><p>恢复后将替换当前浏览器中的本课程记录。可以先导出当前记录。</p><div class="wb-actions">'+btn('先导出当前记录','wb-before-import')+btn('确认恢复','wb-confirm-import','wb-primary')+btn('取消','wb-cancel-import')+'</div>');
      $('wb-before-import').onclick=exportBackup;$('wb-cancel-import').onclick=()=>{pendingImport=null;settings();};
      $('wb-confirm-import').onclick=()=>{
        if(!pendingImport)return;flushNotes();flushRealLife();
        undo.push({label:'恢复备份',data:clone(state)});if(undo.length>30)undo.shift();
        state=pendingImport;pendingImport=null;corruptRaw=null;save();applyPrefs();redrawRealLife();refreshToolbar();settings();
        toast(storageOK?'记录已恢复。点“继续上次”即可接着讲。':'记录已载入，但浏览器无法保存，请保留备份文件。');
      };
    }catch(err){pendingImport=null;toast(err.message==='Unexpected end of JSON input'?'文件不完整，原记录未修改。':(err.message?.includes('本课程')?err.message:'无法读取这份备份，现有记录没有被覆盖。'));}
  };
  function flatten(x){if(typeof x==='string')return x;if(Array.isArray(x))return x.map(flatten).join(' ');if(isObject(x))return Object.values(x).map(flatten).join(' ');return '';}
  const searchIndex=B.data.lessons.flatMap(l=>B.sections.map(s=>({view:'lesson',lesson:l.id,section:s[0],title:'教材内容 · 第'+l.id+'课 '+l.title+' · '+s[2]+'·'+s[1],text:flatten(B.sectionData(l.id,s[0]))})));
  function allSearchItems(){
    const extra=window.BusinessRealLife?.searchIndex;
    const rows=Array.isArray(extra)?extra:realSections.map(s=>({section:s[0],title:s[1],text:s[1]}));
    return searchIndex.concat(rows.filter(r=>realKeys.includes(r.section)).map(r=>({view:'reallife',lesson:1,section:r.section,title:'真实场景 · 第1课 · '+r.title,text:flatten(r.text)})));
  }
  function openSearch(){
    const hint='搜索全书教材及第1课真实场景；结果会标明材料所属。';
    modal('搜索教材与真实场景','<input class="wb-search" id="wb-query" type="search" placeholder="输入词语、句子或语言点" aria-label="搜索教材与真实场景"><p class="wb-muted" id="wb-search-count">'+hint+'</p><div id="wb-results"></div>');
    $('wb-query').focus();
    $('wb-query').oninput=e=>{
      const q=e.target.value.trim(),lower=q.toLocaleLowerCase();
      if(!q){$('wb-results').innerHTML='';$('wb-search-count').textContent=hint;return;}
      const hits=allSearchItems().filter(r=>(r.title+' '+r.text).toLocaleLowerCase().includes(lower));
      $('wb-search-count').textContent='找到 '+hits.length+' 个教学环节';
      $('wb-results').innerHTML=hits.map(r=>{
        const pos=r.text.toLocaleLowerCase().indexOf(lower),start=Math.max(0,pos-36),snip=r.text.slice(start,start+150),p=snip.toLocaleLowerCase().indexOf(lower);
        const safe=p>=0?esc(snip.slice(0,p))+'<mark>'+esc(snip.slice(p,p+q.length))+'</mark>'+esc(snip.slice(p+q.length)):esc(snip);
        return '<button class="wb-button wb-search-result" data-search-view="'+r.view+'" data-search-lesson="'+r.lesson+'" data-search-section="'+r.section+'"><strong>'+esc(r.title)+'</strong><span>'+(start?'…':'')+safe+'…</span></button>';
      }).join('');
      $('wb-results').querySelectorAll('button').forEach(el=>el.onclick=()=>{
        closeModal();go(el.dataset.searchView==='reallife'?realTarget(el.dataset.searchSection):target(+el.dataset.searchLesson,el.dataset.searchSection));
        const found=anchors().find(n=>n.textContent.toLocaleLowerCase().includes(lower))||main.querySelector('#sec-body');
        if(found){found.closest('.lp')?.classList.add('open');found.scrollIntoView({block:'center'});}
      });
    };
  }
  function overview(){const body=modal('全书概览','<section class="wb-card"><h3>第1课 · 真实场景</h3><p class="wb-muted">补充材料单独标明来源，可与教材来回切换。</p><div class="wb-actions">'+realSections.map(s=>'<button type="button" class="wb-button" data-overview-real="'+s[0]+'">'+esc(s[1])+'</button>').join('')+'</div></section><p class="wb-muted">以下为教材原有课次与教学环节。</p><div class="wb-overview">'+B.data.lessons.map(l=>'<section class="wb-card"><h3>教材 · 第'+l.id+'课 '+esc(l.title)+'</h3>'+B.sections.map(s=>'<button class="wb-button" data-overview-lesson="'+l.id+'" data-overview-section="'+s[0]+'" title="'+esc(s[2])+'">'+esc((s[2]==='课文部分'?'② ':s[2]==='对话部分'?'① ':'')+s[1])+'</button>').join('')+'</section>').join('')+'</div>');body.querySelectorAll('[data-overview-lesson]').forEach(el=>el.onclick=()=>{closeModal();go(target(+el.dataset.overviewLesson,el.dataset.overviewSection));});body.querySelectorAll('[data-overview-real]').forEach(el=>el.onclick=()=>{closeModal();go(realTarget(el.dataset.overviewReal));});}
  $('wb-real-life').onclick=()=>go(realTarget());$('wb-search').onclick=openSearch;$('wb-overview').onclick=overview;$('wb-settings').onclick=settings;$('wb-agenda').onclick=()=>agenda();$('wb-picker').onclick=()=>{if(window.BusinessPicker)window.BusinessPicker.open();else toast('抽问工具未加载，请重新打开工作台。');};
  function saveBrowse(){if(isRestoring)return;state.browse=capture();save();}
  function rendered(){if(isRestoring)return;flushNotes();refreshToolbar();updateNotes();state.browse=capture();save();updateHash();if(innerWidth<=720){document.body.classList.add('wb-sidebar-hidden');}}
  document.addEventListener('business-render',rendered);main.addEventListener('scroll',()=>{if(isRestoring)return;clearTimeout(browseTimer);browseTimer=setTimeout(saveBrowse,250);},{passive:true});main.addEventListener('click',()=>{clearTimeout(browseTimer);browseTimer=setTimeout(saveBrowse,250);});window.addEventListener('pagehide',()=>{flushNotes();flushRealLife();saveBrowse();});document.addEventListener('visibilitychange',()=>{if(document.hidden){flushNotes();flushRealLife();saveBrowse();}});
  window.addEventListener('resize',()=>refreshToolbar());
  function locationFromHash(){const p=new URLSearchParams(location.hash.slice(1));if(p.get('view')==='reallife'&&(!p.has('lesson')||p.get('lesson')==='1')&&realKeys.includes(p.get('section')))return realTarget(p.get('section'));if((!p.has('view')||p.get('view')==='lesson')&&p.has('lesson')&&Number.isInteger(+p.get('lesson'))&&+p.get('lesson')>=1&&+p.get('lesson')<=B.data.lessons.length&&secKeys.includes(p.get('section')))return target(+p.get('lesson'),p.get('section'));if(['home','chars','vocab'].includes(p.get('view')))return {...target(1),view:p.get('view')};return null;}
  window.addEventListener('hashchange',()=>{const loc=locationFromHash();if(loc)go(loc);});
  document.addEventListener('keydown',e=>{if(e.isComposing)return;if(!$('wb-blackout').hidden){if(['Escape','b','B'].includes(e.key)){e.preventDefault();blackout(false);}return;}if(!$('wb-modal').hidden){if(e.key==='Escape'){e.preventDefault();closeModal();return;}if(e.key==='Tab'){const nodes=Array.from($('wb-modal').querySelectorAll('button,input,select,textarea,summary,[tabindex="0"]')).filter(n=>!n.disabled&&n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}return;}if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;const key=e.key.toLowerCase();const actions={k:mark,q:()=>$('wb-picker').click(),t:()=>agenda(),'/':openSearch,n:()=>$('wb-note-toggle').click(),b:()=>blackout(true),f:()=>$('btn-full').click(),arrowleft:()=>move(-1),arrowright:()=>move(1),escape:()=>document.querySelectorAll('.fab-panel').forEach(p=>p.classList.remove('show'))};if(actions[key]){e.preventDefault();actions[key]();}});
  let touch=null;main.addEventListener('touchstart',e=>{if(e.touches.length===1&&!e.target.closest('input,textarea,select,button,video,a,canvas,[contenteditable],.vcard,.blank-sel')&&!window.BusinessWhiteboard?.enabled())touch={x:e.touches[0].clientX,y:e.touches[0].clientY};else touch=null;},{passive:true});main.addEventListener('touchend',e=>{if(!touch)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;if(Math.abs(dx)>110&&Math.abs(dy)<40&&!window.BusinessWhiteboard?.enabled())move(dx<0?1:-1);touch=null;},{passive:true});main.addEventListener('touchcancel',()=>{touch=null;},{passive:true});
  window.BusinessWorkbench={course:C,getState:()=>state,commit,modal,closeModal,escape:esc,toast,validate,pack,unpack,capture,go,describe,storageKey:KEY,exportBackup};
  applyPrefs();let initial=locationFromHash();if(initial&&state.browse?.view===initial.view&&state.browse.lesson===initial.lesson&&state.browse.section===initial.section)initial=state.browse;else if(!initial&&state.browse)initial=state.browse;if(initial)go(initial,false);refreshToolbar();storageWarning();
})();
