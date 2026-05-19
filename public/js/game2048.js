// ============================================
// VNportal — Vinyl 2048 — smooth CSS version
// Inspired by play2048.co tile animation style
// ============================================
const Game2048 = (() => {
  const SIZE=4;
  let tiles=[]; // [{id,val,row,col,merged}]
  let nextId=0, score=0, won=false;
  let best=parseInt(localStorage.getItem('vn_2048_best')||'0');
  let coverSrc=null;
  let moving=false;

  // Tile colors — distinct, vivid progression
  const COLORS={
    2:   {bg:'#1e1a2e',fg:'#8888aa'},
    4:   {bg:'#2a1a3e',fg:'#aa88cc'},
    8:   {bg:'#3d1a0a',fg:'#e8a060'},
    16:  {bg:'#5a2210',fg:'#f07030'},
    32:  {bg:'#0a3a20',fg:'#40d080'},
    64:  {bg:'#0a2a4a',fg:'#4090e0'},
    128: {bg:'#2a0a4a',fg:'#c060f0'},
    256: {bg:'#4a1a00',fg:'#f5c518'},
    512: {bg:'#004a3a',fg:'#00e8c0'},
    1024:{bg:'#4a0020',fg:'#ff4488'},
    2048:{bg:'#f5c518',fg:'#000000'},
  };

  function init() {
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

  function show() {
    document.getElementById('game2048Container')?.classList.remove('hidden');
    loadCover(); startGame();
  }
  function hide() { document.getElementById('game2048Container')?.classList.add('hidden'); }

  function loadCover(){
    const v=Store.getCurrentVinyl();
    coverSrc=v?Store.getCover(v.id)||null:null;
  }

  function startGame(){
    tiles=[]; nextId=0; score=0; won=false; moving=false;
    addRandom(); addRandom();
    renderAll(); updateHUD();
  }

  function addRandom(){
    const empty=[];
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++)
      if(!tiles.find(t=>t.row===r&&t.col===c&&!t.removing)) empty.push([r,c]);
    if(!empty.length) return;
    const[r,c]=empty[Math.floor(Math.random()*empty.length)];
    tiles.push({id:nextId++,val:Math.random()<.9?2:4,row:r,col:c});
  }

  function renderAll(){
    const board=document.getElementById('board2048');
    if(!board) return;
    // Remove tiles marked for removal
    tiles=tiles.filter(t=>!t.removing);
    // Clear and re-render all tiles
    board.innerHTML='';
    tiles.forEach(t=>board.appendChild(makeTileEl(t)));
  }

  function makeTileEl(t){
    const el=document.createElement('div');
    el.className='g2048-tile';
    el.dataset.id=t.id;
    el.style.setProperty('--r',t.row);
    el.style.setProperty('--c',t.col);

    const log2=Math.log2(t.val);
    const col=COLORS[t.val]||{bg:'#f5c518',fg:'#000'};

    if(coverSrc && log2>=4){
      // Show cover art patch for 16+
      const pct=Math.min((log2-3)/8,1);
      const rPct=t.row/Math.max(SIZE-1,1)*100;
      const cPct=t.col/Math.max(SIZE-1,1)*100;
      el.style.backgroundImage=`url(${coverSrc})`;
      el.style.backgroundSize=`${SIZE*100}% ${SIZE*100}%`;
      el.style.backgroundPosition=`${cPct}% ${rPct}%`;
      el.style.opacity=0.35+pct*0.65;
      el.style.setProperty('--fg','rgba(255,255,255,0.95)');
    } else {
      el.style.background=col.bg;
      el.style.setProperty('--fg',col.fg);
    }
    if(t.isNew) el.classList.add('g2048-new');
    if(t.merged) el.classList.add('g2048-merged');

    const lbl=document.createElement('span');
    lbl.className='g2048-label';
    lbl.textContent=t.val>=1000?(t.val/1000)+'k':t.val;
    lbl.style.color='var(--fg)';
    el.appendChild(lbl);
    return el;
  }

  function move(dir){
    if(moving) return;
    let moved=false, gained=0;
    const board=Array.from({length:SIZE},()=>Array(SIZE).fill(null));
    tiles.forEach(t=>board[t.row][t.col]=t);

    // Mark all as not merged this turn
    tiles.forEach(t=>{t.merged=false;t.isNew=false;});

    const rows=Array.from({length:SIZE},(_,i)=>i);
    const cols=Array.from({length:SIZE},(_,i)=>i);

    if(dir==='left'||dir==='right'){
      const cs=dir==='right'?[...cols].reverse():cols;
      rows.forEach(r=>{
        const line=cs.map(c=>board[r][c]).filter(Boolean);
        const[merged,pts]=mergeLine(line,dir==='right');
        gained+=pts;
        merged.forEach((t,i)=>{
          const c=dir==='right'?SIZE-1-i:i;
          if(t.row!==r||t.col!==c){t.row=r;t.col=c;moved=true;}
        });
      });
    } else {
      const rs=dir==='down'?[...rows].reverse():rows;
      cols.forEach(c=>{
        const line=rs.map(r=>board[r][c]).filter(Boolean);
        const[merged,pts]=mergeLine(line,dir==='down');
        gained+=pts;
        merged.forEach((t,i)=>{
          const r=dir==='down'?SIZE-1-i:i;
          if(t.row!==r||t.col!==c){t.row=r;t.col=c;moved=true;}
        });
      });
    }

    if(!moved&&gained===0) return;
    score+=gained;
    if(score>best){best=score;localStorage.setItem('vn_2048_best',best);}

    moving=true;
    renderAll();
    setTimeout(()=>{
      addRandom();
      renderAll();
      updateHUD();
      moving=false;
      if(!won) checkWin();
      if(!checkMoves()) setTimeout(gameOver,300);
    },130);
  }

  function mergeLine(line, reverse){
    if(reverse) line.reverse();
    let pts=0;
    for(let i=0;i<line.length-1;i++){
      if(line[i]&&line[i+1]&&line[i].val===line[i+1].val&&!line[i].merged&&!line[i+1].merged){
        line[i].val*=2; pts+=line[i].val;
        line[i].merged=true;
        line[i+1].removing=true;
        line.splice(i+1,1);
      }
    }
    if(reverse) line.reverse();
    return[line,pts];
  }

  function checkWin(){
    if(tiles.some(t=>t.val===2048)){
      won=true; showWin();
    }
  }

  function showWin(){
    const w=document.getElementById('game2048Container');
    if(!w) return;
    const ov=document.createElement('div');
    ov.className='g2048-overlay';
    ov.innerHTML=`
      <div class="g2048-win-title">2048 !</div>
      <div class="g2048-win-sub">Cover unlocked 🎵</div>
      ${coverSrc?`<img src="${coverSrc}" class="g2048-win-img"/>`:''}
      <button class="btn-primary" onclick="this.closest('.g2048-overlay').remove()">Keep Playing</button>
    `;
    w.style.position='relative'; w.appendChild(ov);
  }

  function checkMoves(){
    if(tiles.length<SIZE*SIZE) return true;
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      const t=tiles.find(t=>t.row===r&&t.col===c);
      if(!t) return true;
      if(c<SIZE-1){const n=tiles.find(t=>t.row===r&&t.col===c+1);if(n&&n.val===t.val)return true;}
      if(r<SIZE-1){const n=tiles.find(t=>t.row===r+1&&t.col===c);if(n&&n.val===t.val)return true;}
    }
    return false;
  }

  function gameOver(){
    setTimeout(()=>{if(confirm(`Game over!\nScore: ${score}\n\nPlay again?`))startGame();},200);
  }

  function updateHUD(){
    const s=document.getElementById('score2048'),b=document.getElementById('best2048');
    if(s)s.textContent=score; if(b)b.textContent=best;
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
    try{await navigator.clipboard.writeText(text);alert('Score + link copied!');}catch{alert(text);}
  }

  return{init};
})();
