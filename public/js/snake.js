// ============================================
// VNportal — Groove Snake v2
// ============================================

const Snake = (() => {
  const CELL = 24, COLS = 20, ROWS = 20;
  const W = CELL*COLS, H = CELL*ROWS;
  let canvas, ctx, snake, dir, nextDir, food, score, highScore, loop, alive, paused;
  let coverImg = null;
  let palette  = ['#f5c518','#e8734a','#4a9edd','#27ae60'];

  function init() {
    canvas = document.getElementById('snakeCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    canvas.width  = W;
    canvas.height = H;
    highScore = parseInt(localStorage.getItem('vn_snake_best') || '0');

    // Ensure hidden on init
    const container = document.getElementById('snakeContainer');
    if (container) container.classList.add('hidden');

    document.getElementById('playSnakeBtn')?.addEventListener('click', show);
    document.getElementById('closeSnake')?.addEventListener('click', hide);
    document.getElementById('shareSnakeBtn')?.addEventListener('click', shareScore);

    window.addEventListener('keydown', handleKey);

    let tx=0, ty=0;
    canvas.addEventListener('touchstart', e=>{ tx=e.touches[0].clientX; ty=e.touches[0].clientY; e.preventDefault(); },{passive:false});
    canvas.addEventListener('touchend', e=>{
      const dx=e.changedTouches[0].clientX-tx, dy=e.changedTouches[0].clientY-ty;
      if(Math.abs(dx)>Math.abs(dy)) setDir(dx>0?{x:1,y:0}:{x:-1,y:0});
      else setDir(dy>0?{x:0,y:1}:{x:0,y:-1});
    });
  }

  function show() {
    const container = document.getElementById('snakeContainer');
    if (!container) return;
    container.classList.remove('hidden');
    loadPalette();
    startGame();
  }

  function hide() {
    document.getElementById('snakeContainer')?.classList.add('hidden');
    clearInterval(loop);
    alive = false;
  }

  function loadPalette() {
    const vinyl = Store.getCurrentVinyl();
    if (!vinyl) return;
    const cover = Store.getCover(vinyl.id);
    if (!cover) return;
    const img = new Image();
    img.onload = () => {
      coverImg = img;
      const tmp = document.createElement('canvas');
      tmp.width = tmp.height = 4;
      const tc = tmp.getContext('2d');
      tc.drawImage(img, 0, 0, 4, 4);
      const d = tc.getImageData(0,0,4,4).data;
      palette = [];
      for (let i=0;i<4;i++) {
        const p=i*16;
        palette.push(`rgb(${d[p]},${d[p+1]},${d[p+2]})`);
      }
    };
    img.src = cover;
  }

  function startGame() {
    clearInterval(loop);
    snake    = [{x:10,y:10},{x:9,y:10},{x:8,y:10},{x:7,y:10}];
    dir      = {x:1,y:0};
    nextDir  = {x:1,y:0};
    score    = 0; alive = true; paused = false;
    placeFood();
    updateHUD();
    loop = setInterval(tick, 130);
    draw();
  }

  function tick() {
    if (!alive || paused) return;
    dir = {...nextDir};
    const head = { x:(snake[0].x+dir.x+COLS)%COLS, y:(snake[0].y+dir.y+ROWS)%ROWS };
    if (snake.some(s=>s.x===head.x&&s.y===head.y)) { die(); return; }
    snake.unshift(head);
    if (head.x===food.x && head.y===food.y) {
      score++;
      if (score>highScore) { highScore=score; localStorage.setItem('vn_snake_best',highScore); }
      updateHUD(); placeFood();
      clearInterval(loop);
      loop = setInterval(tick, Math.max(55, 130-Math.floor(score/5)*8));
    } else { snake.pop(); }
    draw();
  }

  function die() {
    alive=false; clearInterval(loop); drawDeath();
  }

  function placeFood() {
    do { food={x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)}; }
    while (snake.some(s=>s.x===food.x&&s.y===food.y));
  }

  function draw() {
    ctx.fillStyle='#0d0d0d'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#161616'; ctx.lineWidth=.5;
    for(let x=0;x<=W;x+=CELL){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<=H;y+=CELL){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    drawFood();
    snake.forEach((seg,i)=>{
      const isHead=i===0;
      ctx.globalAlpha = 1-(i/snake.length)*0.45;
      ctx.fillStyle   = isHead?'#f5c518':palette[i%palette.length];
      const x=seg.x*CELL, y=seg.y*CELL, pad=isHead?1:2;
      roundRect(ctx,x+pad,y+pad,CELL-pad*2,CELL-pad*2,isHead?6:3);
      ctx.fill();
      ctx.globalAlpha=1;
      if(isHead){
        ctx.fillStyle='#000';
        const [x1,y1,x2,y2]=eyes(seg.x*CELL,seg.y*CELL);
        ctx.beginPath();ctx.arc(x1,y1,2.2,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(x2,y2,2.2,0,Math.PI*2);ctx.fill();
      }
    });
  }

  function drawFood() {
    const cx=food.x*CELL+CELL/2, cy=food.y*CELL+CELL/2, r=CELL/2-2;
    if (coverImg) {
      ctx.save();
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
      const sx=(food.x/COLS)*coverImg.width, sy=(food.y/ROWS)*coverImg.height;
      ctx.drawImage(coverImg,sx,sy,coverImg.width/COLS*2,coverImg.height/ROWS*2,cx-r,cy-r,r*2,r*2);
      ctx.restore();
    } else {
      ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle='#1a1a1a';ctx.fill();
      for(let g=r*.3;g<r;g+=2){ctx.beginPath();ctx.arc(cx,cy,g,0,Math.PI*2);ctx.strokeStyle='#282828';ctx.lineWidth=.5;ctx.stroke();}
      ctx.beginPath();ctx.arc(cx,cy,r*.32,0,Math.PI*2);ctx.fillStyle=palette[0]||'#f5c518';ctx.fill();
    }
    ctx.beginPath();ctx.arc(cx,cy,2,0,Math.PI*2);ctx.fillStyle='#000';ctx.fill();
  }

  function eyes(hx,hy) {
    const c=CELL/2,o=5;
    if(dir.x===1)  return[hx+c+o,hy+c-o,hx+c+o,hy+c+o];
    if(dir.x===-1) return[hx+c-o,hy+c-o,hx+c-o,hy+c+o];
    if(dir.y===1)  return[hx+c-o,hy+c+o,hx+c+o,hy+c+o];
    return[hx+c-o,hy+c-o,hx+c+o,hy+c-o];
  }

  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();
  }

  function drawDeath() {
    draw();
    ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    ctx.fillStyle='#e8e0d5';ctx.font='bold 36px "Bebas Neue",sans-serif';
    ctx.fillText('SIDE B OVER',W/2,H/2-18);
    ctx.fillStyle='#f5c518';ctx.font='14px "DM Mono",monospace';
    ctx.fillText(`Score: ${score}   Best: ${highScore}`,W/2,H/2+12);
    ctx.fillStyle='#6a6260';ctx.font='11px "DM Mono",monospace';
    ctx.fillText('SPACE to replay · Arrow keys to move',W/2,H/2+38);
    ctx.textAlign='left';
  }

  function updateHUD() {
    const s=document.getElementById('snakeScore'), h=document.getElementById('snakeHigh');
    if(s) s.textContent=score;
    if(h) h.textContent=highScore;
  }

  function setDir(d) { if(d.x!==-dir.x||d.y!==-dir.y) nextDir=d; }

  function handleKey(e) {
    if(document.getElementById('snakeContainer')?.classList.contains('hidden')) return;
    const map={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},
               w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0}};
    if(e.key===' '){
      if(!alive) startGame(); else{paused=!paused;}
      e.preventDefault(); return;
    }
    const d=map[e.key];
    if(d){setDir(d);e.preventDefault();}
  }

  async function shareScore() {
    const text=`I scored ${score} on Groove Snake in VNportal! 🐍🎵`;
    if(navigator.share){try{await navigator.share({title:'VNportal',text});return;}catch{}}
    try{await navigator.clipboard.writeText(text);alert('Copied!');}catch{alert(text);}
  }

  return { init };
})();
