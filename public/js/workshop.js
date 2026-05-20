const Workshop = (() => {
  const SCORES_KEY  = 'vn_scores';
  const PLAYS_KEY   = 'vn_plays';
  const CHAT_KEY    = 'vn_chat';
  const NAME_KEY    = 'vn_chat_name';

  // ── Play tracking ─────────────────────────
  function trackPlay(vinylId){
    try{
      const p=JSON.parse(localStorage.getItem(PLAYS_KEY)||'{}');
      p[vinylId]=(p[vinylId]||0)+1;
      localStorage.setItem(PLAYS_KEY,JSON.stringify(p));
    }catch{}
  }
  function getPlays(){try{return JSON.parse(localStorage.getItem(PLAYS_KEY)||'{}');}catch{return{};}}

  // ── Score tracking ────────────────────────
  function addScore(game,data){
    try{
      const s=JSON.parse(localStorage.getItem(SCORES_KEY)||'[]');
      s.unshift({game,date:new Date().toISOString(),...data});
      if(s.length>50)s.length=50;
      localStorage.setItem(SCORES_KEY,JSON.stringify(s));
    }catch{}
  }
  function getScores(){try{return JSON.parse(localStorage.getItem(SCORES_KEY)||'[]');}catch{return[];}}

  // ── Chat ──────────────────────────────────
  function getMessages(){try{return JSON.parse(localStorage.getItem(CHAT_KEY)||'[]');}catch{return[];}}
  function saveMessages(msgs){localStorage.setItem(CHAT_KEY,JSON.stringify(msgs));}

  function initChat(){
    const sendBtn=document.getElementById('chatSend');
    const msgInput=document.getElementById('chatMsg');
    const nameInput=document.getElementById('chatName');

    // Restore saved name
    const savedName=localStorage.getItem(NAME_KEY)||'';
    if(savedName&&nameInput) nameInput.value=savedName;

    sendBtn?.addEventListener('click', sendMessage);
    msgInput?.addEventListener('keydown', e=>{if(e.key==='Enter')sendMessage();});
    nameInput?.addEventListener('blur', ()=>{
      const n=nameInput.value.trim();
      if(n) localStorage.setItem(NAME_KEY,n);
    });
  }

  function sendMessage(){
    const nameInput=document.getElementById('chatName');
    const msgInput=document.getElementById('chatMsg');
    const name=(nameInput?.value?.trim()||'Anonymous').substring(0,20);
    const text=msgInput?.value?.trim(); if(!text) return;

    localStorage.setItem(NAME_KEY,name);
    const msgs=getMessages();
    msgs.push({
      name, text,
      time: new Date().toISOString(),
      own: true,
      vinyl: Store.getCurrentVinyl()?.name||null,
    });
    if(msgs.length>200)msgs.splice(0,msgs.length-200);
    saveMessages(msgs);
    if(msgInput) msgInput.value='';
    renderChat();
  }

  function renderChat(){
    const el=document.getElementById('chatMessages'); if(!el) return;
    const msgs=getMessages();
    const myName=localStorage.getItem(NAME_KEY)||'';

    if(!msgs.length){
      el.innerHTML='<p style="color:var(--text-dim);font-size:.72rem;text-align:center;margin-top:2rem">No messages yet — start the discussion!</p>';
      return;
    }
    el.innerHTML=msgs.map(m=>{
      const isOwn=m.own||m.name===myName;
      const time=new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
      const vinylTag=m.vinyl?`<span style="color:var(--accent);opacity:.7">· ${esc(m.vinyl)}</span>`:'';
      return `
        <div class="ws-chat-msg-item${isOwn?' own':''}">
          <div class="ws-chat-bubble">${esc(m.text)}</div>
          <div class="ws-chat-meta">
            <span class="ws-chat-name-tag">${esc(m.name)}</span>
            <span>${time}</span>
            ${vinylTag}
          </div>
        </div>
      `;
    }).join('');
    el.scrollTop=el.scrollHeight;
  }

  // ── Popular charts ────────────────────────
  function renderPopular(){
    const el=document.getElementById('workshopPopular'); if(!el) return;
    const plays=getPlays();
    const{vinyls}=Store.get();
    const sorted=[...vinyls].sort((a,b)=>(plays[b.id]||0)-(plays[a.id]||0));
    if(!sorted.length){el.innerHTML='<p class="ws-empty">Play some vinyls to see charts!</p>';return;}
    el.innerHTML=sorted.slice(0,8).map((v,i)=>{
      const p=plays[v.id]||0;
      const src=Exhibit.resolveCover(v.id);
      return `
        <div class="ws-chart-row">
          <span class="ws-rank">${i+1}</span>
          ${src?`<img src="${src}" class="ws-thumb"/>`:'<div class="ws-thumb-placeholder">◎</div>'}
          <div class="ws-chart-info">
            <div class="ws-chart-title">${esc(v.name)}</div>
            <div class="ws-chart-artist">${esc(v.artist||v.genre||'—')}</div>
          </div>
          <div class="ws-plays">${p}▶</div>
        </div>
      `;
    }).join('');
  }

  // ── Score board ───────────────────────────
  function renderScores(){
    const el=document.getElementById('workshopScores'); if(!el) return;
    const scores=getScores();
    if(!scores.length){el.innerHTML='<p class="ws-empty">Play games to see your scores here!</p>';return;}
    const icons={snake:'🐍',puzzle:'🧩','track-match':'🎵','2048':'🟨'};
    el.innerHTML=scores.slice(0,10).map(s=>{
      const icon=icons[s.game]||'🎮';
      const d=new Date(s.date).toLocaleDateString();
      let detail=s.score?`Score: ${s.score}`:'';
      if(s.moves)  detail+=(detail?' · ':'')+`${s.moves} moves`;
      if(s.time)   detail+=(detail?' · ':'')+`${s.time}s`;
      if(s.vinylName)detail+=(detail?' · ':'')+s.vinylName;
      const shareText=`${detail||'Completed'} on VNportal! https://github.com/huangd-816/VNportal`;
      return `
        <div class="ws-score-row">
          <span class="ws-game-icon">${icon}</span>
          <div class="ws-score-info">
            <div class="ws-score-detail">${detail||'Completed'}</div>
            <div class="ws-score-date">${d}</div>
          </div>
          <button class="ws-share-btn" onclick="(async()=>{
            const t=${JSON.stringify(shareText)};
            if(navigator.share){try{await navigator.share({title:'VNportal',text:t,url:'https://github.com/huangd-816/VNportal'});return;}catch{}}
            try{await navigator.clipboard.writeText(t);Notify.success('Copied!');}catch{}
          })()">Share</button>
        </div>
      `;
    }).join('');
  }

  // ── Cover gallery ─────────────────────────
  function renderCoverGallery(){
    const el=document.getElementById('workshopCovers'); if(!el) return;
    const{vinyls}=Store.get();
    const withCovers=vinyls.filter(v=>Store.getCover(v.id));
    if(!withCovers.length){el.innerHTML='<p class="ws-empty">Design covers in Cover Studio to show them here!</p>';return;}
    el.innerHTML=withCovers.map(v=>{
      const src=Exhibit.resolveCover(v.id);
      return src?`
        <div class="ws-cover-item">
          <img src="${src}" class="ws-cover-img" title="${esc(v.name)}"/>
          <div class="ws-cover-name">${esc(v.name)}</div>
          <button class="ws-share-btn" style="width:100%;margin-top:.3rem;font-size:.58rem;padding:.2rem 0" onclick="Workshop._shareCover('${v.id}')">Share</button>
        </div>
      `:'';
    }).join('');
  }

  async function shareCover(vinylId){
    const vinyl=Store.getVinyl(vinylId); if(!vinyl) return;
    const text=`Check out my vinyl cover for "${vinyl.name}" on VNportal! 🎨\nhttps://github.com/huangd-816/VNportal`;
    if(navigator.share){try{await navigator.share({title:vinyl.name,text,url:'https://github.com/huangd-816/VNportal'});return;}catch{}}
    try{await navigator.clipboard.writeText(text);Notify.success('Cover link copied!');}catch{alert(text);}
  }

  function onShow(){
    renderPopular(); renderScores(); renderCoverGallery(); renderChat();
  }

  function init(){
    initChat();
  }

  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  // Expose for inline onclick
  const api={init,onShow,trackPlay,addScore,getScores,_shareCover:shareCover};
  window.Workshop=api;
  return api;
})();
