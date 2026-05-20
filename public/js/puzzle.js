// ============================================
// VNportal — Sleeve Puzzle (Phase 4)
// Drag-and-drop jigsaw of vinyl cover art
// ============================================
const Puzzle = (() => {
  let canvas, ctx, W, H;
  let COLS=3, ROWS=3;
  let pieces=[], dragging=null, dragOff={x:0,y:0};
  let coverImg=null, solved=false, moveCount=0, startTime=0;
  let animFrame=null;

  function init(){
    canvas=document.getElementById('puzzleCanvas');
    if(!canvas) return;
    ctx=canvas.getContext('2d');
    document.getElementById('playPuzzleBtn')?.addEventListener('click', show);
    document.getElementById('closePuzzle')?.addEventListener('click',  hide);
    document.getElementById('puzzleShuffle')?.addEventListener('click', shuffle);
    document.getElementById('puzzleDiff')?.addEventListener('change',  e=>{
      const v=+e.target.value; COLS=v; ROWS=v; if(coverImg) startPuzzle();
    });
    document.getElementById('sharePuzzleBtn')?.addEventListener('click', shareScore);
    canvas.addEventListener('mousedown',  onDown);
    canvas.addEventListener('mousemove',  onMove);
    canvas.addEventListener('mouseup',    onUp);
    canvas.addEventListener('touchstart', e=>{e.preventDefault();onDown(t2m(e));},{passive:false});
    canvas.addEventListener('touchmove',  e=>{e.preventDefault();onMove(t2m(e));},{passive:false});
    canvas.addEventListener('touchend',   e=>{e.preventDefault();onUp(t2m(e));},{passive:false});
  }

  function show(){
    document.getElementById('puzzleContainer')?.classList.remove('hidden');
    loadCoverAndStart();
  }
  function hide(){
    document.getElementById('puzzleContainer')?.classList.add('hidden');
    cancelAnimationFrame(animFrame);
  }

  function loadCoverAndStart(){
    const vinyl=Store.getCurrentVinyl();
    if(!vinyl){Notify.warn('Select a vinyl in Games first!');return;}
    const c=Store.getCover(vinyl.id);
    const src=typeof c==='string'?c:(c?.src||null);
    if(!src){Notify.warn('This vinyl has no cover art — design one in Cover Studio first!');return;}
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>{coverImg=img;startPuzzle();};
    img.onerror=()=>{Notify.error('Could not load cover art');};
    img.src=src;
  }

  function startPuzzle(){
    W=canvas.width=canvas.height=Math.min(480, window.innerWidth-60);
    H=W;
    const pw=Math.floor(W/COLS), ph=Math.floor(H/ROWS);
    pieces=[];
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      pieces.push({
        id:r*COLS+c, targetRow:r, targetCol:c,
        x:c*pw, y:r*ph, w:pw, h:ph,
        sx:(c/COLS)*coverImg.width, sy:(r/ROWS)*coverImg.height,
        sw:coverImg.width/COLS, sh:coverImg.height/ROWS,
        correct:false,
      });
    }
    shuffle();
    solved=false; moveCount=0; startTime=Date.now();
    updateHUD();
    draw();
    Notify.success(`${COLS}×${COLS} puzzle — arrange the cover!`);
  }

  function shuffle(){
    // Place pieces randomly without overlap
    const pw=Math.floor(W/COLS), ph=Math.floor(H/ROWS);
    const positions=[];
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) positions.push({x:c*pw,y:r*ph});
    for(let i=positions.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [positions[i],positions[j]]=[positions[j],positions[i]];
    }
    pieces.forEach((p,i)=>{p.x=positions[i].x;p.y=positions[i].y;p.correct=false;});
    solved=false; moveCount=0; startTime=Date.now();
    draw();
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    // Background
    ctx.fillStyle='#0d0d0d'; ctx.fillRect(0,0,W,H);
    // Grid ghost
    const pw=Math.floor(W/COLS), ph=Math.floor(H/ROWS);
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=1;
      ctx.strokeRect(c*pw+.5,r*ph+.5,pw-1,ph-1);
      // Slot number
      ctx.fillStyle='rgba(255,255,255,0.04)';
      ctx.font='10px DM Mono'; ctx.textAlign='center';
      ctx.fillText(r*COLS+c+1, c*pw+pw/2, r*ph+ph/2+4);
    }

    // Pieces (non-dragging first)
    pieces.filter(p=>p!==dragging).forEach(drawPiece);
    if(dragging) drawPiece(dragging);

    ctx.textAlign='left';

    if(solved) drawWin();
    animFrame=requestAnimationFrame(draw);
  }

  function drawPiece(p){
    const pw=Math.floor(W/COLS), ph=Math.floor(H/ROWS);
    if(!coverImg) return;
    ctx.save();
    // Shadow for dragging
    if(p===dragging){ctx.shadowColor='rgba(245,197,24,0.5)';ctx.shadowBlur=16;}
    // Draw cover portion
    ctx.drawImage(coverImg, p.sx,p.sy,p.sw,p.sh, p.x,p.y,p.w,p.h);
    // Correct highlight
    if(p.correct){
      ctx.strokeStyle='rgba(39,174,96,0.7)'; ctx.lineWidth=2;
      ctx.strokeRect(p.x+1,p.y+1,p.w-2,p.h-2);
    } else {
      ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1;
      ctx.strokeRect(p.x+.5,p.y+.5,p.w-1,p.h-1);
    }
    ctx.restore();
  }

  function drawWin(){
    ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    ctx.fillStyle='#f5c518'; ctx.font='bold 38px Bebas Neue'; ctx.fillText('PUZZLE SOLVED!',W/2,H/2-20);
    const secs=Math.floor((Date.now()-startTime)/1000);
    ctx.fillStyle='#e8e0d5'; ctx.font='14px DM Mono';
    ctx.fillText(`${moveCount} moves · ${secs}s`,W/2,H/2+10);
    ctx.fillStyle='#7a7068'; ctx.font='11px DM Mono';
    ctx.fillText('Shuffle to play again',W/2,H/2+34);
    ctx.textAlign='left';
  }

  function getPos(e){
    const r=canvas.getBoundingClientRect();
    return{x:(e.clientX-r.left)*(W/r.width),y:(e.clientY-r.top)*(H/r.height)};
  }
  function t2m(e){const t=e.touches?.[0]||e.changedTouches?.[0];return{clientX:t.clientX,clientY:t.clientY};}

  function onDown(e){
    const{x,y}=getPos(e);
    // Find topmost piece
    for(let i=pieces.length-1;i>=0;i--){
      const p=pieces[i];
      if(x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h){
        dragging=p; dragOff={x:x-p.x,y:y-p.y};
        // Bring to front
        pieces.splice(i,1); pieces.push(p);
        return;
      }
    }
  }

  function onMove(e){
    if(!dragging) return;
    const{x,y}=getPos(e);
    dragging.x=Math.max(0,Math.min(W-dragging.w, x-dragOff.x));
    dragging.y=Math.max(0,Math.min(H-dragging.h, y-dragOff.y));
  }

  function onUp(){
    if(!dragging) return;
    const pw=Math.floor(W/COLS), ph=Math.floor(H/ROWS);
    // Snap to nearest slot
    const snapC=Math.round(dragging.x/pw), snapR=Math.round(dragging.y/ph);
    const sc=Math.max(0,Math.min(COLS-1,snapC)), sr=Math.max(0,Math.min(ROWS-1,snapR));
    dragging.x=sc*pw; dragging.y=sr*ph;
    dragging.correct=(sc===dragging.targetCol&&sr===dragging.targetRow);
    dragging=null; moveCount++;
    updateHUD();
    checkSolved();
  }

  function checkSolved(){
    if(pieces.every(p=>p.correct)){
      solved=true;
      const secs=Math.floor((Date.now()-startTime)/1000);
      Notify.success(`Puzzle complete! ${moveCount} moves in ${secs}s 🎉`);
      const vinyl=Store.getCurrentVinyl();
      Store.addScore?.('puzzle',{moves:moveCount,time:secs,vinylName:vinyl?.name});
    }
  }

  function updateHUD(){
    const m=document.getElementById('puzzleMoves'),t=document.getElementById('puzzleTimer');
    if(m) m.textContent=moveCount;
  }

  async function shareScore(){
    const secs=Math.floor((Date.now()-startTime)/1000);
    const vinyl=Store.getCurrentVinyl();
    const text=`I solved the "${vinyl?.name||'Vinyl'}" cover puzzle in ${moveCount} moves on VNportal! 🧩🎵\nhttps://github.com/huangd-816/VNportal`;
    if(navigator.share){try{await navigator.share({title:'VNportal Puzzle',text,url:'https://github.com/huangd-816/VNportal'});return;}catch{}}
    try{await navigator.clipboard.writeText(text);Notify.success('Score + link copied!');}catch{alert(text);}
  }

  return{init};
})();
