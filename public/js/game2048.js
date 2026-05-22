const Game2048 = (() => {
  const SIZE=4, TILE=110, GAP=8;
  let grid=[], tileEls={}, nextId=0, score=0, won=false;
  let best=parseInt(localStorage.getItem('vn_2048_best')||'0');
  let coverSrc=null, moving=false;
  let history=[];  // undo stack: [{grid snapshot, score}]

  const TILE_STYLES={
    2:   {bg:'#2a2040',fg:'#9988cc',border:'#443366'},
    4:   {bg:'#3a1830',fg:'#cc88bb',border:'#662255'},
    8:   {bg:'#4a2200',fg:'#dd9944',border:'#884400'},
    16:  {bg:'#5a1800',fg:'#ee7733',border:'#992200'},
    32:  {bg:'#003a18',fg:'#33cc77',border:'#006633'},
    64:  {bg:'#002244',fg:'#4499dd',border:'#004488'},
    128: {bg:'#380050',fg:'#bb44ee',border:'#660099'},
    256: {bg:'#4a3000',fg:'#ddaa00',border:'#886600'},
    512: {bg:'#004438',fg:'#00ddbb',border:'#007755'},
    1024:{bg:'#440022',fg:'#ff3388',border:'#880044'},
    2048:{bg:'#f5c518',fg:'#000000',border:'#ffdd44'},
  };

  function init(){
    document.getElementById('play2048Btn')?.addEventListener('click', show);
    document.getElementById('close2048')?.addEventListener('click',  hide);
    document.getElementById('share2048Btn')?.addEventListener('click', shareScore);
    document.getElementById('undo2048Btn')?.addEventListener('click', undo);
    window.addEventListener('keydown', handleKey);
    const b=document.getElementById('board2048');
    if(b){
      let tx=0,ty=0;
      b.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;e.preventDefault();},{passive:false});
      b.addEventListener('touchend',e=>{
        const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
        if(Math.abs(dx)>Math.abs(dy))move(dx>0?'right':'left');
        else move(dy>0?'down':'up');
      });
    }
  }

  function show(){
    document.getElementById('game2048Container')?.classList.remove('hidden');
    loadCover(); startGame();
  }
  function hide(){ document.getElementById('game2048Container')?.classList.add('hidden'); }

  function loadCover(){
    const v=Store.getCurrentVinyl(); if(!v) return;
    const c=Store.getCover(v.id);
    coverSrc=typeof c==='string'?c:(c?.src||null);
  }

  function startGame(){
    grid=Array.from({length:SIZE},()=>Array(SIZE).fill(null));
    tileEls={}; nextId=0; score=0; won=false; moving=false; history=[];
    setupBoard();
    spawn(); spawn();
    updateHUD();
    removeOverlays();
  }

  function setupBoard(){
    const b=document.getElementById('board2048'); if(!b) return;
    b.innerHTML='';
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      const bg=document.createElement('div');
      bg.className='g2048-bg-cell';
      bg.style.cssText=`left:${cellX(c)}px;top:${cellY(r)}px;width:${TILE}px;height:${TILE}px`;
      b.appendChild(bg);
    }
  }

  function cellX(c){ return GAP+c*(TILE+GAP); }
  function cellY(r){ return GAP+r*(TILE+GAP); }

  // Save state for undo
  function saveHistory(){
    const snapshot={
      score,
      grid: grid.map(row=>row.map(t=>t?{val:t.val,id:t.id,r:t.r,c:t.c}:null))
    };
    history.push(snapshot);
    if(history.length>10) history.shift();
  }

  function undo(){
    if(history.length<1){Notify.warn('Nothing to undo!');return;}
    const prev=history.pop();
    score=prev.score;
    // Rebuild grid from snapshot
    Object.values(tileEls).forEach(el=>el.remove());
    tileEls={};
    grid=prev.grid.map(row=>row.map(t=>{
      if(!t) return null;
      const tile={val:t.val,id:t.id,r:t.r,c:t.c};
      createTileEl(tile.id,tile.val,tile.r,tile.c,false);
      // restore nextId if needed
      if(tile.id>=nextId) nextId=tile.id+1;
      return tile;
    }));
    won=false; removeOverlays();
    updateHUD();
    Notify.info('Undo!');
  }

  function spawn(){
    const empty=[];
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(!grid[r][c]) empty.push([r,c]);
    if(!empty.length) return;
    const[r,c]=empty[Math.floor(Math.random()*empty.length)];
    const val=Math.random()<.9?2:4;
    const id=nextId++;
    grid[r][c]={val,id,r,c};
    createTileEl(id,val,r,c,true);
  }

  function createTileEl(id,val,r,c,isNew){
    const b=document.getElementById('board2048'); if(!b) return;
    const el=document.createElement('div');
    el.className='g2048-tile'+(isNew?' g2048-spawn':'');
    el.id='tile'+id;
    el.style.cssText=`left:${cellX(c)}px;top:${cellY(r)}px;width:${TILE}px;height:${TILE}px`;
    applyTileStyle(el,val,r,c);
    const lbl=document.createElement('span');
    lbl.className='g2048-label';
    lbl.textContent=val>=1000?(val/1000)+'k':val;
    el.appendChild(lbl);
    b.appendChild(el);
    tileEls[id]=el;
  }

  function applyTileStyle(el,val,r,c){
    const log2=Math.log2(val);
    const st=TILE_STYLES[val]||TILE_STYLES[2048];
    if(coverSrc&&log2>=4){
      const pct=Math.min((log2-3)/8,1);
      el.style.backgroundImage=`url(${coverSrc})`;
      el.style.backgroundSize=`${SIZE*100}% ${SIZE*100}%`;
      el.style.backgroundPosition=`${c/Math.max(SIZE-1,1)*100}% ${r/Math.max(SIZE-1,1)*100}%`;
      el.style.opacity=0.35+pct*0.65;
      el.style.border=`2px solid ${st.border}`;
      const lbl=el.querySelector('.g2048-label');
      if(lbl) lbl.style.color=`rgba(255,255,255,${0.6+pct*0.4})`;
    } else {
      el.style.background=st.bg;
      el.style.border=`2px solid ${st.border}`;
      el.style.opacity='1';
      const lbl=el.querySelector('.g2048-label');
      if(lbl) lbl.style.color=st.fg;
    }
  }

  function moveTileEl(id,r,c){
    const el=tileEls[id]; if(!el) return;
    el.style.left=cellX(c)+'px'; el.style.top=cellY(r)+'px';
  }

  function removeTileEl(id){
    const el=tileEls[id]; if(!el) return;
    el.classList.add('g2048-merge-pop');
    setTimeout(()=>{el.remove();delete tileEls[id];},180);
  }

  function updateTileVal(id,val,r,c){
    const el=tileEls[id]; if(!el) return;
    const lbl=el.querySelector('.g2048-label');
    if(lbl) lbl.textContent=val>=1000?(val/1000)+'k':val;
    applyTileStyle(el,val,r,c);
    el.classList.remove('g2048-merge-pop');
    void el.offsetWidth;
    el.classList.add('g2048-merge-pop');
  }

  function move(dir){
    if(moving) return;
    saveHistory();
    const prev=JSON.stringify(grid.map(r=>r.map(t=>t?t.val:null)));
    let gained=0;

    const rows=[0,1,2,3], cols=[0,1,2,3];
    if(dir==='left'||dir==='right'){
      const cs=dir==='right'?[3,2,1,0]:cols;
      rows.forEach(r=>{
        const line=cs.map(c=>grid[r][c]).filter(Boolean);
        const{merged,pts}=mergeArr(line); gained+=pts;
        cs.forEach((c,i)=>{
          if(merged[i]){grid[r][c]=merged[i];grid[r][c].r=r;grid[r][c].c=c;moveTileEl(merged[i].id,r,c);}
          else grid[r][c]=null;
        });
      });
    } else {
      const rs=dir==='down'?[3,2,1,0]:rows;
      cols.forEach(c=>{
        const line=rs.map(r=>grid[r][c]).filter(Boolean);
        const{merged,pts}=mergeArr(line); gained+=pts;
        rs.forEach((r,i)=>{
          if(merged[i]){grid[r][c]=merged[i];grid[r][c].r=r;grid[r][c].c=c;moveTileEl(merged[i].id,r,c);}
          else grid[r][c]=null;
        });
      });
    }

    const next=JSON.stringify(grid.map(r=>r.map(t=>t?t.val:null)));
    if(prev===next){history.pop();return;} // nothing moved, discard history

    score+=gained;
    if(score>best){best=score;localStorage.setItem('vn_2048_best',best);}
    moving=true;
    setTimeout(()=>{
      spawn(); updateHUD(); moving=false;
      if(!won) checkWin();
      if(!hasMoves()) showGameOver();
    },160);
  }

  function mergeArr(tiles){
    let pts=0; const out=[]; let i=0;
    while(i<tiles.length){
      if(i+1<tiles.length&&tiles[i].val===tiles[i+1].val){
        const newVal=tiles[i].val*2; pts+=newVal;
        const kept=tiles[i];
        removeTileEl(tiles[i+1].id);
        kept.val=newVal;
        updateTileVal(kept.id,newVal,kept.r,kept.c);
        out.push(kept); i+=2;
      } else { out.push(tiles[i]); i++; }
    }
    while(out.length<SIZE) out.push(null);
    return{merged:out,pts};
  }

  function checkWin(){
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      if(grid[r][c]?.val===2048){won=true;showWin();return;}
    }
  }

  function removeOverlays(){
    document.querySelectorAll('.g2048-overlay').forEach(el=>el.remove());
  }

  function showWin(){
    const w=document.getElementById('game2048Container'); if(!w) return;
    removeOverlays();
    const ov=document.createElement('div'); ov.className='g2048-overlay';
    ov.innerHTML=`
      <div class="g2048-win-title">2048!</div>
      <div class="g2048-win-sub">Cover unlocked 🎵</div>
      ${coverSrc?`<img src="${coverSrc}" class="g2048-win-img"/>`:''}
      <div style="display:flex;gap:.75rem;margin-top:.5rem">
        <button class="btn-primary" onclick="this.closest('.g2048-overlay').remove()">Keep Playing</button>
        <button class="btn-secondary" onclick="Game2048._restart()">New Game</button>
      </div>
    `;
    w.style.position='relative'; w.appendChild(ov);
  }

  function showGameOver(){
    const w=document.getElementById('game2048Container'); if(!w) return;
    removeOverlays();
    const ov=document.createElement('div'); ov.className='g2048-overlay';
    ov.innerHTML=`
      <div class="g2048-win-title" style="color:var(--accent2)">Game Over</div>
      <div class="g2048-win-sub" style="font-size:1rem;margin:.5rem 0">Score: <b style="color:var(--accent)">${score}</b> &nbsp; Best: <b style="color:var(--accent)">${best}</b></div>
      <div style="display:flex;gap:.75rem;margin-top:.5rem">
        <button class="btn-primary" onclick="Game2048._restart()">Play Again</button>
        <button class="btn-secondary" onclick="Game2048._undo()">↩ Undo</button>
        <button class="btn-secondary" onclick="this.closest('.g2048-overlay').remove()">Close</button>
      </div>
    `;
    w.style.position='relative'; w.appendChild(ov);
  }

  function hasMoves(){
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      if(!grid[r][c]) return true;
      if(c<SIZE-1&&grid[r][c]?.val===grid[r][c+1]?.val) return true;
      if(r<SIZE-1&&grid[r][c]?.val===grid[r+1][c]?.val) return true;
    }
    return false;
  }

  function updateHUD(){
    const s=document.getElementById('score2048'),b=document.getElementById('best2048');
    if(s)s.textContent=score; if(b)b.textContent=best;
  }

  function handleKey(e){
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    if(document.getElementById('game2048Container')?.classList.contains('hidden')) return;
    const map={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
    if(e.key==='z'||e.key==='Z'){undo();return;}
    if(map[e.key]){e.preventDefault();move(map[e.key]);}
  }

  async function shareScore(){
    const text=`I scored ${score} on Vinyl 2048 in VNportal! 🎵\nhttps://github.com/huangd-816/VNportal`;
    if(navigator.share){try{await navigator.share({title:'VNportal 2048',text,url:'https://github.com/huangd-816/VNportal'});return;}catch{}}
    try{await navigator.clipboard.writeText(text);Notify.success('Score + link copied!');}catch{alert(text);}
  }

  // Expose for overlay buttons
  const api={init,_restart:()=>startGame(),_undo:undo};
  window.Game2048=api;
  return api;
})();
