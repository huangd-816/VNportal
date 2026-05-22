const Workshop = (() => {
  const SCORES_KEY='vn_scores', PLAYS_KEY='vn_plays', CHAT_KEY='vn_chat', NAME_KEY='vn_chat_name';

  function trackPlay(vinylId){
    try{const p=JSON.parse(localStorage.getItem(PLAYS_KEY)||'{}');p[vinylId]=(p[vinylId]||0)+1;localStorage.setItem(PLAYS_KEY,JSON.stringify(p));}catch{}
  }
  function getPlays(){try{return JSON.parse(localStorage.getItem(PLAYS_KEY)||'{}');}catch{return{};}}
  function addScore(game,data){
    try{const s=JSON.parse(localStorage.getItem(SCORES_KEY)||'[]');s.unshift({game,date:new Date().toISOString(),...data});if(s.length>50)s.length=50;localStorage.setItem(SCORES_KEY,JSON.stringify(s));}catch{}
  }
  function getMessages(){try{return JSON.parse(localStorage.getItem(CHAT_KEY)||'[]');}catch{return[];}}
  function saveMessages(m){localStorage.setItem(CHAT_KEY,JSON.stringify(m));}

  function initChat(){
    document.getElementById('chatSend')?.addEventListener('click', sendMessage);
    document.getElementById('chatMsg')?.addEventListener('keydown', e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}});
    // Minimize
    document.getElementById('chatMinimize')?.addEventListener('click', ()=>{
      const body=document.getElementById('chatBody');
      const btn=document.getElementById('chatMinimize');
      const isMin=body.style.display==='none';
      body.style.display=isMin?'':'none';
      btn.textContent=isMin?'—':'□';
    });
    // Make resizable via CSS resize
    const wrap=document.getElementById('chatWrap');
    if(wrap) wrap.style.resize='both';
    renderChat();
  }

  function sendMessage(){
    const msgInput=document.getElementById('chatMsg');
    const text=msgInput?.value?.trim(); if(!text) return;
    const user=typeof Auth!=='undefined'&&Auth.isLoggedIn()?Auth.getUser():null;
    const name=user?.name||(document.getElementById('chatName')?.value?.trim()||'Anonymous');
    if(!user) localStorage.setItem(NAME_KEY,name);

    const msgs=getMessages();
    msgs.push({
      id: Date.now().toString(),
      name, text,
      time: new Date().toISOString(),
      userId: user?.id||'anon',
      vinyl: Store.getCurrentVinyl()?.name||null,
    });
    if(msgs.length>200)msgs.splice(0,msgs.length-200);
    saveMessages(msgs);
    if(msgInput) msgInput.value='';
    renderChat();
  }

  function deleteMessage(id){
    const msgs=getMessages().filter(m=>m.id!==id);
    saveMessages(msgs); renderChat();
  }

  function renderChat(){
    const el=document.getElementById('chatMessages'); if(!el) return;
    const msgs=getMessages();
    const user=typeof Auth!=='undefined'&&Auth.isLoggedIn()?Auth.getUser():null;
    const myName=user?.name||localStorage.getItem(NAME_KEY)||'';
    const myId=user?.id;

    if(!msgs.length){
      el.innerHTML='<p style="color:var(--text-dim);font-size:.72rem;text-align:center;padding:2rem 0">No messages yet — start the discussion!</p>';
      return;
    }
    el.innerHTML=msgs.map(m=>{
      const isOwn=m.userId===myId||(m.userId==='anon'&&m.name===myName);
      const time=new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
      const vinylTag=m.vinyl?`<span style="color:var(--accent);opacity:.6;font-size:.55rem"> · ${esc(m.vinyl)}</span>`:'';
      const delBtn=isOwn?`<button class="chat-del-btn" data-id="${m.id}" title="Delete">✕</button>`:'';
      return `
        <div class="ws-chat-msg-item${isOwn?' own':''}">
          ${delBtn}
          <div class="ws-chat-bubble">${esc(m.text)}</div>
          <div class="ws-chat-meta">
            <span class="ws-chat-name-tag">${esc(m.name)}</span>
            <span>${time}</span>${vinylTag}
          </div>
        </div>
      `;
    }).join('');

    // Delete buttons
    el.querySelectorAll('.chat-del-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        if(confirm('Delete this message?')) deleteMessage(btn.dataset.id);
      });
    });
    el.scrollTop=el.scrollHeight;
  }

  function renderPopular(){
    const el=document.getElementById('workshopPopular'); if(!el) return;
    const plays=getPlays(), {vinyls}=Store.get();
    const sorted=[...vinyls].sort((a,b)=>(plays[b.id]||0)-(plays[a.id]||0));
    if(!sorted.length){el.innerHTML='<p class="ws-empty">Play some vinyls to see charts!</p>';return;}
    el.innerHTML=sorted.slice(0,8).map((v,i)=>{
      const p=plays[v.id]||0, src=Exhibit.resolveCover(v.id);
      return `<div class="ws-chart-row">
        <span class="ws-rank">${i+1}</span>
        ${src?`<img src="${src}" class="ws-thumb"/>`:'<div class="ws-thumb-placeholder">◎</div>'}
        <div class="ws-chart-info"><div class="ws-chart-title">${esc(v.name)}</div><div class="ws-chart-artist">${esc(v.artist||'—')}</div></div>
        <div class="ws-plays">${p}▶</div>
      </div>`;
    }).join('');
  }

  function renderScores(){
    const el=document.getElementById('workshopScores'); if(!el) return;
    const scores=JSON.parse(localStorage.getItem(SCORES_KEY)||'[]');
    if(!scores.length){el.innerHTML='<p class="ws-empty">Play games to see your scores!</p>';return;}
    const icons={snake:'🐍',puzzle:'🧩','track-match':'🎵','2048':'🟨'};
    el.innerHTML=scores.slice(0,10).map(s=>{
      const icon=icons[s.game]||'🎮', d=new Date(s.date).toLocaleDateString();
      let detail=s.score?`Score: ${s.score}`:'';
      if(s.moves) detail+=(detail?' · ':'')+`${s.moves} moves`;
      if(s.time)  detail+=(detail?' · ':'')+`${s.time}s`;
      if(s.vinylName)detail+=(detail?' · ':'')+s.vinylName;
      const t=`${detail||'Completed'} on VNportal! https://github.com/huangd-816/VNportal`;
      return `<div class="ws-score-row">
        <span class="ws-game-icon">${icon}</span>
        <div class="ws-score-info"><div class="ws-score-detail">${detail||'Completed'}</div><div class="ws-score-date">${d}</div></div>
        <button class="ws-share-btn" onclick="(async()=>{if(navigator.share)try{await navigator.share({title:'VNportal',text:${JSON.stringify(t)},url:'https://github.com/huangd-816/VNportal'});return;catch{}try{await navigator.clipboard.writeText(${JSON.stringify(t)});Notify.success('Copied!');}catch{}})()">Share</button>
      </div>`;
    }).join('');
  }

  function renderCoverGallery(){
    const el=document.getElementById('workshopCovers'); if(!el) return;
    const{vinyls}=Store.get();
    const withCovers=vinyls.filter(v=>Store.getCover(v.id));
    if(!withCovers.length){el.innerHTML='<p class="ws-empty">Design covers in Cover Studio!</p>';return;}
    el.innerHTML=withCovers.map(v=>{
      const src=Exhibit.resolveCover(v.id);
      return src?`<div class="ws-cover-item">
        <img src="${src}" class="ws-cover-img" title="${esc(v.name)}"/>
        <div class="ws-cover-name">${esc(v.name)}</div>
        <button class="ws-share-btn" style="width:100%;margin-top:.3rem;font-size:.58rem;padding:.2rem 0" onclick="Workshop._shareCover('${v.id}')">Share</button>
      </div>`:'';
    }).join('');
  }

  async function shareCover(vinylId){
    const vinyl=Store.getVinyl(vinylId); if(!vinyl) return;
    const text=`Check out my vinyl cover for "${vinyl.name}" on VNportal! 🎨\nhttps://github.com/huangd-816/VNportal`;
    if(navigator.share)try{await navigator.share({title:vinyl.name,text,url:'https://github.com/huangd-816/VNportal'});return;}catch{}
    try{await navigator.clipboard.writeText(text);Notify.success('Cover link copied!');}catch{alert(text);}
  }

  function onShow(){ renderPopular(); renderScores(); renderCoverGallery(); renderChat(); }
  function init(){ initChat(); }
  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  const api={init,onShow,trackPlay,addScore,_shareCover:shareCover};
  window.Workshop=api;
  return api;
})();
