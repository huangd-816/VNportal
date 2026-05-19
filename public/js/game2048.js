// ============================================
// VNportal — Vinyl 2048 (fixed)
// Single grid, cover art tiles, smooth CSS transitions
// ============================================
const Game2048 = (() => {
  const SIZE = 4;
  let board=[], score=0, won=false;
  let best = parseInt(localStorage.getItem('vn_2048_best')||'0');
  let coverSrc = null;

  function init() {
    document.getElementById('play2048Btn')?.addEventListener('click', show);
    document.getElementById('close2048')?.addEventListener('click', hide);
    document.getElementById('share2048Btn')?.addEventListener('click', shareScore);

    window.addEventListener('keydown', e => {
      if (document.getElementById('game2048Container')?.classList.contains('hidden')) return;
      const map={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'};
      if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
    });

    const b = document.getElementById('board2048');
    if (b) {
      let tx=0,ty=0;
      b.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;e.preventDefault();},{passive:false});
      b.addEventListener('touchend',e=>{
        const dx=e.changedTouches[0].clientX-tx, dy=e.changedTouches[0].clientY-ty;
        if(Math.abs(dx)>Math.abs(dy)) move(dx>0?'right':'left');
        else move(dy>0?'down':'up');
      });
    }
  }

  function show() {
    document.getElementById('game2048Container')?.classList.remove('hidden');
    loadCover();
    startGame();
  }

  function hide() {
    document.getElementById('game2048Container')?.classList.add('hidden');
  }

  function loadCover() {
    const vinyl = Store.getCurrentVinyl();
    coverSrc = vinyl ? (Store.getCover(vinyl.id) || null) : null;
  }

  function startGame() {
    board = Array.from({length:SIZE},()=>Array(SIZE).fill(0));
    score=0; won=false;
    addRandom(); addRandom();
    renderBoard(); updateHUD();
  }

  function addRandom() {
    const empty=[];
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(!board[r][c]) empty.push([r,c]);
    if(!empty.length) return;
    const [r,c]=empty[Math.floor(Math.random()*empty.length)];
    board[r][c]=Math.random()<.9?2:4;
  }

  function move(dir) {
    const prev=JSON.stringify(board); let gained=0;
    for(let i=0;i<SIZE;i++){
      let line=getLine(i,dir);
      const[merged,pts]=merge(line); gained+=pts;
      setLine(i,dir,merged);
    }
    if(JSON.stringify(board)!==prev){
      score+=gained;
      if(score>best){best=score;localStorage.setItem('vn_2048_best',best);}
      addRandom(); renderBoard(); updateHUD();
      checkWin(); if(!checkMoves()) gameOver();
    }
  }

  function getLine(i,dir){
    if(dir==='left')  return board[i].slice();
    if(dir==='right') return board[i].slice().reverse();
    if(dir==='up')    return board.map(r=>r[i]);
    return board.map(r=>r[i]).reverse();
  }
  function setLine(i,dir,line){
    if(dir==='left')  board[i]=line;
    if(dir==='right') board[i]=line.slice().reverse();
    if(dir==='up')    line.forEach((v,r)=>board[r][i]=v);
    else              line.slice().reverse().forEach((v,r)=>board[r][i]=v);
  }
  function merge(line){
    const vals=line.filter(v=>v); let pts=0;
    const out=[]; let skip=false;
    for(let i=0;i<vals.length;i++){
      if(skip){skip=false;continue;}
      if(vals[i]===vals[i+1]){out.push(vals[i]*2);pts+=vals[i]*2;skip=true;}
      else out.push(vals[i]);
    }
    while(out.length<SIZE) out.push(0);
    return[out,pts];
  }

  function renderBoard() {
    const el = document.getElementById('board2048');
    if (!el) return;
    el.innerHTML = '';

    for(let r=0;r<SIZE;r++){
      for(let c=0;c<SIZE;c++){
        const val=board[r][c];
        const cell=document.createElement('div');
        cell.className='g2048-cell';

        if(!val){
          cell.classList.add('g2048-empty');
        } else {
          cell.dataset.val=val;
          styleTile(cell, val, r, c);
        }
        el.appendChild(cell);
      }
    }
  }

  function styleTile(cell, val, row, col) {
    const log2val = Math.log2(val); // 2→1, 4→2 ... 2048→11

    if (coverSrc && log2val >= 3) {
      // 8+ → start showing cover art
      const pct = Math.min((log2val - 2) / 9, 1); // 8=11%, 2048=100%
      // Cover art tile: show the portion of the cover corresponding to grid position
      cell.style.backgroundImage  = `url(${coverSrc})`;
      cell.style.backgroundSize   = `${SIZE * 100}% ${SIZE * 100}%`;
      cell.style.backgroundPosition = `${col*100/(SIZE-1)||0}% ${row*100/(SIZE-1)||0}%`;
      cell.style.opacity          = 0.3 + pct * 0.7;
      cell.style.color            = 'rgba(255,255,255,0.9)';
      cell.style.textShadow       = '0 1px 4px rgba(0,0,0,0.9)';
    } else {
      // Low values — solid color tiles
      const colors={
        2:'#1e1e1e',4:'#2a2a2a',
      };
      cell.style.background=colors[val]||'#1e1e1e';
      cell.style.color=val<=4?'#888':'var(--text)';
    }

    // Value label
    const label=document.createElement('span');
    label.className='g2048-label';
    label.textContent=val>=1000?(val/1000)+'k':val;
    cell.appendChild(label);
  }

  function checkWin() {
    if(won) return;
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      if(board[r][c]===2048){
        won=true;
        showWinOverlay();
        return;
      }
    }
  }

  function showWinOverlay() {
    const wrap=document.getElementById('game2048Container');
    if(!wrap) return;
    const ov=document.createElement('div');
    ov.className='g2048-overlay';
    ov.innerHTML=`
      <div class="g2048-win-title">2048!</div>
      <div class="g2048-win-sub">Cover revealed 🎵</div>
      ${coverSrc?`<img src="${coverSrc}" class="g2048-win-img"/>`:'' }
      <button class="btn-primary" onclick="this.closest('.g2048-overlay').remove()">Keep Playing</button>
    `;
    wrap.style.position='relative';
    wrap.appendChild(ov);
  }

  function checkMoves(){
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      if(!board[r][c]) return true;
      if(c<SIZE-1&&board[r][c]===board[r][c+1]) return true;
      if(r<SIZE-1&&board[r][c]===board[r+1][c]) return true;
    }
    return false;
  }

  function gameOver(){
    setTimeout(()=>{ if(confirm(`Game over!\nScore: ${score}\n\nPlay again?`)) startGame(); },200);
  }

  function updateHUD(){
    const s=document.getElementById('score2048'),b=document.getElementById('best2048');
    if(s) s.textContent=score; if(b) b.textContent=best;
  }

  async function shareScore(){
    const text=`I scored ${score} on Vinyl 2048 in VNportal! 🎵`;
    if(navigator.share){try{await navigator.share({title:'VNportal 2048',text});return;}catch{}}
    try{await navigator.clipboard.writeText(text);alert('Copied!');}catch{alert(text);}
  }

  return{init};
})();
