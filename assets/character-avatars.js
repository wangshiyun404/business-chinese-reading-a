/* These illustrations visualize fictional textbook characters, never students. */
(function(){
  'use strict';
  const B=window.BusinessBook;if(!B)return;
  const names=B.data.meta.characters.map(c=>c.name),source='assets/characters/人物头像图集.png';
  let ready=false;
  function personIndex(label,lesson){
    const exact=names.indexOf(label);if(exact>=0)return exact;
    const aliases={'小王':0,'高副总经理':1,'高副总':1,'吴经理':3,'陈经理':4,'小赵':5,'小李':6,'李总经理':7};
    if(label==='张经理')return lesson===5?8:2;
    return Object.prototype.hasOwnProperty.call(aliases,label)?aliases[label]:-1;
  }
  function portrait(node,index){
    if(!node||index<0)return;
    node.classList.add('wb-character-avatar');
    node.style.setProperty('--avatar-x',(index%4)/3*100+'%');
    node.style.setProperty('--avatar-y',Math.floor(index/4)/2*100+'%');
    node.style.backgroundColor='#e6edf4';
    node.textContent='';node.setAttribute('role','img');node.setAttribute('aria-label',names[index]+'，教学示意头像');node.title=names[index]+' · 教学示意头像';node.dataset.characterIndex=index;
  }
  function render(){
    if(!ready)return;
    const s=B.getState();
    document.querySelectorAll('.bubble-row[data-speaker]').forEach(row=>portrait(row.querySelector('.avatar'),personIndex(row.dataset.speaker,s.lesson)));
    document.querySelectorAll('.pcard').forEach(card=>portrait(card.querySelector('.avatar'),names.indexOf(card.querySelector('.pname').textContent)));
    if(s.view==='chars'&&!document.getElementById('wb-avatar-credit')){const note=document.createElement('p');note.id='wb-avatar-credit';note.className='wb-avatar-credit';note.textContent='人物头像为教学示意插画，非教材原图。';document.querySelector('#main .lesson-head').appendChild(note);}
  }
  const img=new Image();img.onload=()=>{ready=true;render();updateRole();};img.onerror=()=>console.warn('人物图集暂未加载，保留原文字头像。');img.src=source;
  const role=document.createElement('div');role.id='wb-role-portrait';role.className='avatar';role.hidden=true;document.getElementById('picker-disp').before(role);
  function updateRole(){const i=names.indexOf(document.getElementById('picker-disp').textContent.trim());role.hidden=!ready||i<0;if(ready&&i>=0)portrait(role,i);}
  new MutationObserver(updateRole).observe(document.getElementById('picker-disp'),{childList:true,characterData:true,subtree:true});
  document.addEventListener('business-render',render);
  window.BusinessCharacters={names,personIndex,render,source};
})();
