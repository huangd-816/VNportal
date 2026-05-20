// ============================================
// VNportal — Vinyl 2048 (play2048.co style)
// Proper CSS transition with real DOM tile management
// ============================================
const Game2048 = (() => {
  const SIZE=4, TILE=110, GAP=8;
  let grid=[], tileEls={}, nextId=0, score=0, won=false;
  let best=parseInt(localStorage.getItem('vn_2048_best')||'0');
  let coverSrc=null, moving=false;

  // Very distinct colors per value
  const TILE_STYLES={
    2:   {bg:'#3d2c5a',fg:'#c8b0f0',border:'#6a4aaa'},
    4:   {bg:'#4a1a3a',fg:'#f0a0d0',border:'#aa3080'},
    8:   {bg:'#5a2800',fg:'#ffaa44',border:'#cc6600'},
    16:  {bg:'#7a1a00',fg:'#ff6633',border:'#ee3300'},
    32:  {bg:'#004a20',fg:'#44ff88',border:'#00aa44'},
    64:  {bg:'#003060',fg:'#44aaff',border:'#0066cc'},
    128: {bg:'#4a0060',fg:'#cc44ff',border:'#8800cc'},
    256: {bg:'#604000',fg:'#ffcc00',border:'#cc8800'},
    512: {bg:'#006040',fg:'#00ffcc',border:'#008855'},
    1024:{bg:'#600030',fg:'#ff4488',border:'#cc0055'},
    2048:{bg:'#f5c518',fg:'#000000',border:'#ffdd44'},
  };

  function init(){
    document.getElementById('play2048Btn')?.addEventListener('click', show);
    document.getElementById('close2048')?.addEventListener('click',  hide);
    document.getElementById('share2048Btn')?.addEventListener('click', shareScore);
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
    tileEls={}; nextId=0; score=0; won=false; moving=false;
    setupBoard();
    spawn(); spawn();
    updateHUD();
  }

  function setupBoard(){
    const b=document.getElementById('board2048');
    if(!b) return;
    b.innerHTML='';
    // Background cells
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      const bg=document.createElement('div');
      bg.className='g2048-bg-cell';
      bg.style.cssText=`left:${cellX(c)}px;top:${cellY(r)}px;width:${TILE}px;height:${TILE}px`;
      b.appendChild(bg);
    }
  }

  function cellX(c){ return GAP + c*(TILE+GAP); }
  function cellY(r){ return GAP + r*(TILE+GAP); }

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
    if(coverSrc && log2>=4){
      const pct=Math.min((log2-3)/8,1);
      const rPct=r/Math.max(SIZE-1,1)*100;
      const cPct=c/Math.max(SIZE-1,1)*100;
      el.style.backgroundImage=`url(${coverSrc})`;
      el.style.backgroundSize=`${SIZE*100}% ${SIZE*100}%`;
      el.style.backgroundPosition=`${cPct}% ${rPct}%`;
      el.style.opacity=0.35+pct*0.65;
      el.style.borderColor=st.border;
      el.style.border=`2px solid ${st.border}`;
    } else {
      el.style.background=st.bg;
      el.style.border=`2px solid ${st.border}`;
      el.style.opacity='1';
    }
    const lbl=el.querySelector('.g2048-label');
    if(lbl) lbl.style.color=st.fg;
  }

  function moveTileEl(id,r,c){
    const el=tileEls[id]; if(!el) return;
    el.style.left=cellX(c)+'px';
    el.style.top=cellY(r)+'px';
  }

  function removeTileEl(id){
    const el=tileEls[id]; if(!el) return;
    el.classList.add('g2048-merge-pop');
    setTimeout(()=>{el.remove();delete tileEls[id];},180);
  }

  function updateTileEl(id,val,r,c){
    const el=tileEls[id]; if(!el) return;
    el.querySelector('.g2048-label').textContent=val>=1000?(val/1000)+'k':val;
    applyTileStyle(el,val,r,c);
    el.classList.remove('g2048-merge-pop');
    void el.offsetWidth; // reflow
    el.classList.add('g2048-merge-pop');
  }

  function move(dir){
    if(moving) return;
    const prev=JSON.stringify(grid.map(r=>r.map(t=>t?{v:t.val}:null)));
    let gained=0;

    const rows=[0,1,2,3], cols=[0,1,2,3];
    if(dir==='left'||dir==='right'){
      const cs=dir==='right'?[3,2,1,0]:cols;
      rows.forEach(r=>{
        const line=cs.map(c=>grid[r][c]).filter(Boolean);
        const{merged,pts}=mergeArr(line);
        gained+=pts;
        cs.forEach((c,i)=>{
          if(merged[i]){
            grid[r][c]=merged[i];
            grid[r][c].r=r; grid[r][c].c=c;
            moveTileEl(merged[i].id,r,c);
          } else {
            grid[r][c]=null;
          }
        });
      });
    } else {
      const rs=dir==='down'?[3,2,1,0]:rows;
      cols.forEach(c=>{
        const line=rs.map(r=>grid[r][c]).filter(Boolean);
        const{merged,pts}=mergeArr(line);
        gained+=pts;
        rs.forEach((r,i)=>{
          if(merged[i]){
            grid[r][c]=merged[i];
            grid[r][c].r=r; grid[r][c].c=c;
            moveTileEl(merged[i].id,r,c);
          } else {
            grid[r][c]=null;
          }
        });
      });
    }

    const next2=JSON.stringify(grid.map(r=>r.map(t=>t?{v:t.val}:null)));
    if(prev===next2) return; // nothing moved

    score+=gained;
    if(score>best){best=score;localStorage.setItem('vn_2048_best',best);}

    moving=true;
    setTimeout(()=>{
      spawn();
      updateHUD();
      moving=false;
      if(!won) checkWin();
      if(!hasMoves()) setTimeout(gameOver,300);
    },160);
  }

  function mergeArr(tiles){
    let pts=0;
    const out=[];
    let i=0;
    while(i<tiles.length){
      if(i+1<tiles.length && tiles[i].val===tiles[i+1].val){
        const newVal=tiles[i].val*2; pts+=newVal;
        // Keep first tile, update its value, remove second
        const kept=tiles[i];
        removeTileEl(tiles[i+1].id);
        kept.val=newVal;
        updateTileEl(kept.id,newVal,kept.r,kept.c);
        out.push(kept); i+=2;
      } else {
        out.push(tiles[i]); i++;
      }
    }
    while(out.length<SIZE) out.push(null);
    return{merged:out,pts};
  }

  function checkWin(){
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      if(grid[r][c]?.val===2048){won=true;showWin();return;}
    }
  }

  function showWin(){
    const w=document.getElementById('game2048Container'); if(!w) return;
    const ov=document.createElement('div'); ov.className='g2048-overlay';
    ov.innerHTML=`
      <div class="g2048-win-title">2048!</div>
      <div class="g2048-win-sub">Cover revealed 🎵</div>
      ${coverSrc?`<img src="${coverSrc}" class="g2048-win-img"/>`:''}
      <button class="btn-primary" onclick="this.closest('.g2048-overlay').remove()">Keep Playing</button>
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

  function gameOver(){
    setTimeout(()=>{if(confirm(`Game over!\nScore: ${score}\nPlay again?`))startGame();},100);
  }

  function updateHUD(){
    const s=document.getElementById('score2048'),b=document.getElementById('best2048');
    if(s)s.textContent=score;if(b)b.textContent=best;
  }

  function handleKey(e){
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    if(document.getElementById('game2048Container')?.classList.contains('hidden')) return;
    const map={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
    if(map[e.key]){e.preventDefault();move(map[e.key]);}
  }

  async function shareScore(){
    const text=`I scored ${score} on Vinyl 2048 in VNportal! 🎵\nhttps://github.com/huangd-816/VNportal`;
    if(navigator.share){try{await navigator.share({title:'VNportal 2048',text,url:'https://github.com/huangd-816/VNportal'});return;}catch{}}
    try{await navigator.clipboard.writeText(text);Notify.success('Score + link copied!');}catch{alert(text);}
  }
  return{init};
})();
