/* A small optional video entrance; original course data and teaching state stay authoritative. */
(function(){
 'use strict';
 function mount(){
  if(location.protocol!=='file:')return; /* 视频在教师本机，在线版不显示 */
  const row=document.querySelector('.rl-page .rl-actions');
  if(!row||row.querySelector('[data-lesson-video]'))return;
  const link=document.createElement('a');
  link.className='rl-btn primary';link.dataset.lessonVideo='1';
  link.href="about:blank";
  link.target='_blank';link.rel='noopener';
  link.textContent='▶ 观看六章视频 · 日常语气版 · 25:18';
  link.style.textDecoration='none';
  link.title='六章完整三维教学动画，日常口吻AI配音；含章节定位、练习暂停点、字幕字号、播放进度与画笔';
  row.prepend(link);
 }
 document.addEventListener('business-render',mount);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
