// ============================================
// VNportal — Track Match Memory Game (Phase 4)
// Flip cards to match track titles/artists
// ============================================
const TrackMatch = (() => {
  let cards=[], flipped=[], matched=[], locked=false;
  let moves=0, startTime=0, timerInterval=null;

  function init(){
    document.getElementById('playTrackMatchBtn')?.addEventListener('click', show);
    document.getElementById('closeTrackMatch')?.addEventListener('click',   hide);
    document.getElementById('shareTrackMatchBtn')?.addEventListener('click', shareScore);
    document.getElementById('trackMatchDiff')?.addEventListener('change', e=>{
      if(document.getElementById('trackMatchContainer')?.classList.contains('hidden')) return;
      buildGame(+e.target.value||6);
    });
  }

  function show(){
    document.getElementById('trackMatchContainer')?.classList.remove('hidden');
    buildGame(6);
  }
  function hide(){
    document.getElementById('trackMatchContainer')?.classList.add('hidden');
    clearInterval(timerInterval);
  }

  function buildGame(pairCount){
    const vinyl=Store.getCurrentVinyl();
    if(!vinyl||!vinyl.tracks?.length){Notify.warn('Select a vinyl with tracks in Games first!');return;}

    const tracks=[...vinyl.tracks];
    // Need at least pairCount tracks; duplicate/shuffle if needed
    while(tracks.length<pairCount) tracks.push(...vinyl.tracks);
    const selected=tracks.slice(0,pairCount);

    // Each track → 2 cards: one title, one artist
    const pairs=selected.flatMap(t=>[
      {id:t.title+'|'+t.artist, type:'title', text:t.title, artist:t.artist},
      {id:t.title+'|'+t.artist, type:'artist', text:t.artist, title:t.title},
    ]);
    // Shuffle
    for(let i=pairs.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pairs[i],pairs[j]]=[pairs[j],pairs[i]];}

    cards=pairs.map((p,i)=>({...p,index:i,faceUp:false,matched:false}));
    flipped=[]; matched=[]; locked=false; moves=0;
    startTime=Date.now();
    clearInterval(timerInterval);
    timerInterval=setInterval(updateTimer,1000);
    renderBoard();
    updateHUD();
    Notify.info(`Match ${pairCount} track titles with their artists!`);
  }

  function renderBoard(){
    const board=document.getElementById('trackMatchBoard'); if(!board) return;
    board.innerHTML='';
    const cols=Math.ceil(Math.sqrt(cards.length*1.5));
    board.style.gridTemplateColumns=`repeat(${cols},1fr)`;
    cards.forEach(card=>{
      const el=document.createElement('div');
      el.className='tmatch-card'+(card.faceUp||card.matched?' flipped':'')+(card.matched?' matched':'');
      el.dataset.index=card.index;
      el.innerHTML=`
        <div class="tmatch-front">${card.faceUp||card.matched?'<span class="tmatch-type-badge">'+(card.type==='title'?'♫':'◉')+'</span>'+esc(card.text):'?'}</div>
        <div class="tmatch-back">◎</div>
      `;
      if(!card.matched) el.addEventListener('click',()=>flipCard(card.index));
      board.appendChild(el);
    });
  }

  function flipCard(idx){
    if(locked) return;
    const card=cards[idx];
    if(card.faceUp||card.matched) return;
    card.faceUp=true;
    flipped.push(card);
    moves++;
    updateHUD();
    renderBoard();

    if(flipped.length===2){
      locked=true;
      const[a,b]=flipped;
      if(a.id===b.id&&a.type!==b.type){
        // Match!
        setTimeout(()=>{
          a.matched=b.matched=true; a.faceUp=b.faceUp=false;
          matched.push(a,b); flipped=[]; locked=false;
          renderBoard(); checkWin();
        },600);
      } else {
        // No match
        setTimeout(()=>{
          a.faceUp=b.faceUp=false; flipped=[]; locked=false;
          renderBoard();
        },1000);
      }
    }
  }

  function checkWin(){
    if(matched.length===cards.length){
      clearInterval(timerInterval);
      const secs=Math.floor((Date.now()-startTime)/1000);
      Notify.success(`All matched! ${moves} moves · ${secs}s 🎉`);
    }
  }

  function updateHUD(){
    const m=document.getElementById('trackMatchMoves'),p=document.getElementById('trackMatchPairs');
    if(m)m.textContent=moves;
    if(p)p.textContent=`${matched.length/2}/${cards.length/2}`;
  }

  function updateTimer(){
    const el=document.getElementById('trackMatchTimer'); if(!el) return;
    el.textContent=Math.floor((Date.now()-startTime)/1000)+'s';
  }

  async function shareScore(){
    const secs=Math.floor((Date.now()-startTime)/1000);
    const vinyl=Store.getCurrentVinyl();
    const text=`I matched all tracks on "${vinyl?.name||'Vinyl'}" in ${moves} moves on VNportal! 🎵\nhttps://github.com/huangd-816/VNportal`;
    if(navigator.share){try{await navigator.share({title:'VNportal Track Match',text,url:'https://github.com/huangd-816/VNportal'});return;}catch{}}
    try{await navigator.clipboard.writeText(text);Notify.success('Score + link copied!');}catch{alert(text);}
  }

  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  return{init};
})();
