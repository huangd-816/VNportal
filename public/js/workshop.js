// ============================================
// VNportal — Workshop / Phase 5
// Local community: scores, covers, popularity
// ============================================
const Workshop = (() => {
  const SCORES_KEY='vn_scores';
  const PLAYS_KEY='vn_plays';

  // Track a vinyl play for popularity
  function trackPlay(vinylId){
    try{
      const plays=JSON.parse(localStorage.getItem(PLAYS_KEY)||'{}');
      plays[vinylId]=(plays[vinylId]||0)+1;
      localStorage.setItem(PLAYS_KEY,JSON.stringify(plays));
    }catch{}
  }

  function getPlays(){
    try{return JSON.parse(localStorage.getItem(PLAYS_KEY)||'{}');}catch{return{};}
  }

  function addScore(game,data){
    try{
      const scores=JSON.parse(localStorage.getItem(SCORES_KEY)||'[]');
      scores.unshift({game,date:new Date().toISOString(),...data});
      if(scores.length>50) scores.length=50;
      localStorage.setItem(SCORES_KEY,JSON.stringify(scores));
    }catch{}
  }

  function getScores(){
    try{return JSON.parse(localStorage.getItem(SCORES_KEY)||'[]');}catch{return[];}
  }

  function render(){
    renderPopular();
    renderScores();
    renderCoverGallery();
  }

  function renderPopular(){
    const el=document.getElementById('workshopPopular'); if(!el) return;
    const plays=getPlays();
    const{vinyls}=Store.get();
    const sorted=[...vinyls].sort((a,b)=>(plays[b.id]||0)-(plays[a.id]||0));
    if(!sorted.length){el.innerHTML='<p class="ws-empty">Play some vinyls to see charts!</p>';return;}
    el.innerHTML=sorted.slice(0,8).map((v,i)=>{
      const p=plays[v.id]||0;
      const cover=Exhibit.resolveCover(v.id);
      return `
        <div class="ws-chart-row">
          <span class="ws-rank">${i+1}</span>
          ${cover?`<img src="${cover}" class="ws-thumb"/>`:'<div class="ws-thumb-placeholder">◎</div>'}
          <div class="ws-chart-info">
            <div class="ws-chart-title">${esc(v.name)}</div>
            <div class="ws-chart-artist">${esc(v.artist||v.genre||'—')}</div>
          </div>
          <div class="ws-plays">${p} ▶</div>
        </div>
      `;
    }).join('');
  }

  function renderScores(){
    const el=document.getElementById('workshopScores'); if(!el) return;
    const scores=getScores();
    if(!scores.length){el.innerHTML='<p class="ws-empty">Play games to see your scores here!</p>';return;}
    el.innerHTML=scores.slice(0,10).map(s=>{
      const gameIcons={snake:'🐍',puzzle:'🧩','track-match':'🎵','2048':'🟨'};
      const icon=gameIcons[s.game]||'🎮';
      const d=new Date(s.date).toLocaleDateString();
      let detail='';
      if(s.score)     detail=`Score: ${s.score}`;
      if(s.moves)     detail=`${s.moves} moves`;
      if(s.time)      detail+=(detail?' · ':'')+`${s.time}s`;
      if(s.vinylName) detail+=(detail?' · ':'')+s.vinylName;
      return `
        <div class="ws-score-row">
          <span class="ws-game-icon">${icon}</span>
          <div class="ws-score-info">
            <div class="ws-score-detail">${detail||'Completed'}</div>
            <div class="ws-score-date">${d}</div>
          </div>
          <button class="ws-share-btn" data-text="${esc(detail+' on VNportal! https://github.com/huangd-816/VNportal')}">Share</button>
        </div>
      `;
    }).join('');
    el.querySelectorAll('.ws-share-btn').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        const text=btn.dataset.text;
        if(navigator.share){try{await navigator.share({title:'VNportal',text,url:'https://github.com/huangd-816/VNportal'});return;}catch{}}
        try{await navigator.clipboard.writeText(text);Notify.success('Copied!');}catch{}
      });
    });
  }

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
          <button class="ws-share-btn btn-secondary" style="font-size:.58rem;padding:.25rem .5rem;margin-top:.4rem;width:100%"
            data-vinyl-id="${v.id}">Share Cover</button>
        </div>
      `:'';
    }).join('');
    el.querySelectorAll('.ws-share-btn').forEach(btn=>{
      btn.addEventListener('click',()=>shareCover(btn.dataset.vinylId));
    });
  }

  async function shareCover(vinylId){
    const vinyl=Store.getVinyl(vinylId); if(!vinyl) return;
    const text=`Check out my vinyl cover for "${vinyl.name}" on VNportal! 🎨\nhttps://github.com/huangd-816/VNportal`;
    const src=Exhibit.resolveCover(vinylId);
    if(navigator.share&&src){
      try{
        const res=await fetch(src);
        const blob=await res.blob();
        const file=new File([blob],'cover.jpg',{type:'image/jpeg'});
        if(navigator.canShare&&navigator.canShare({files:[file]})){
          await navigator.share({title:vinyl.name,text,files:[file]});
          return;
        }
      }catch{}
      try{await navigator.share({title:vinyl.name,text,url:'https://github.com/huangd-816/VNportal'});return;}catch{}
    }
    try{await navigator.clipboard.writeText(text);Notify.success('Cover link copied!');}catch{alert(text);}
  }

  function onShow(){ render(); }

  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  return{init:()=>{}, onShow, trackPlay, addScore, getScores};
})();

// Make Workshop accessible globally for score tracking
window.VNWorkshop=Workshop;
