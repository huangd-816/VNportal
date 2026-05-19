// ============================================
// VNportal — Groove Snake v2
// Smooth, portal walls, vinyl tile food,
// cover-art-based color palette
// ============================================

const Snake = (() => {
  const CELL  = 24;
  const COLS  = 20;
  const ROWS  = 20;
  const W     = CELL * COLS;
  const H     = CELL * ROWS;

  let canvas, ctx;
  let snake, dir, nextDir, food, score, highScore;
  let loop, alive, paused;
  let coverImg  = null;
  let palette   = ['#f5c518','#e8734a','#4a9edd','#27ae60'];

  const SPEED_BASE = 130;

  function init() {
    canvas    = document.getElementById('snakeCanvas');
    ctx       = canvas.getContext('2d');
    canvas.width  = W;
    canvas.height = H;
    highScore = parseInt(localStorage.getItem('vnportal_snake_best') || '0');

    document.getElementById('playSnakeBtn').addEventListener('click',  show);
    document.getElementById('closeSnake').addEventListener('click',   hide);
    document.getElementById('shareSnakeBtn').addEventListener('click', shareScore);

    window.addEventListener('keydown', handleKey);

    // Touch swipe
    let tx=0, ty=0;
    canvas.addEventListener('touchstart', e => { tx=e.touches[0].clientX; ty=e.touches[0].clientY; e.preventDefault(); }, { passive:false });
    canvas.addEventListener('touchend', e => {
      const dx=e.changedTouches[0].clientX-tx, dy=e.changedTouches[0].clientY-ty;
      if (Math.abs(dx)>Math.abs(dy)) setDir(dx>0?{x:1,y:0}:{x:-1,y:0});
      else setDir(dy>0?{x:0,y:1}:{x:0,y:-1});
    });
  }

  function show() {
    document.getElementById('snakeContainer').classList.remove('hidden');
    // Try to extract cover palette from current vinyl
    loadCoverPalette();
    startGame();
  }

  function hide() {
    document.getElementById('snakeContainer').classList.add('hidden');
    clearInterval(loop);
  }

  function loadCoverPalette() {
    const vinyl = Store.getCurrentVinyl();
    if (!vinyl) return;
    const cover = Store.getCover(vinyl.id);
    if (!cover) return;
    const img  = new Image();
    img.onload = () => {
      coverImg = img;
      // Sample 4 colors from cover corners
      const sampleCtx = document.createElement('canvas').getContext('2d');
      sampleCtx.canvas.width = sampleCtx.canvas.height = 4;
      sampleCtx.drawImage(img, 0, 0, 4, 4);
      const d = sampleCtx.getImageData(0,0,4,4).data;
      palette = [];
      for (let i=0; i<4; i++) {
        const pi=i*4*4;
        palette.push(`rgb(${d[pi]},${d[pi+1]},${d[pi+2]})`);
      }
    };
    img.src = cover;
  }

  function startGame() {
    clearInterval(loop);
    snake    = [{x:10,y:10},{x:9,y:10},{x:8,y:10},{x:7,y:10}];
    dir      = {x:1,y:0};
    nextDir  = {x:1,y:0};
    score    = 0;
    alive    = true;
    paused   = false;
    placeFood();
    updateHUD();
    loop = setInterval(tick, SPEED_BASE);
    draw();
  }

  function tick() {
    if (!alive || paused) return;
    dir = {...nextDir};
    const head = {
      x: (snake[0].x + dir.x + COLS) % COLS,
      y: (snake[0].y + dir.y + ROWS) % ROWS,
    };
    // Self collision
    if (snake.some(s=>s.x===head.x&&s.y===head.y)) { die(); return; }
    snake.unshift(head);

    if (head.x===food.x && head.y===food.y) {
      score++;
      if (score > highScore) {
        highScore = score;
        localStorage.setItem('vnportal_snake_best', highScore);
      }
      updateHUD();
      placeFood();
      // Speed up slightly every 5 points
      clearInterval(loop);
      const speed = Math.max(55, SPEED_BASE - Math.floor(score/5)*8);
      loop = setInterval(tick, speed);
    } else {
      snake.pop();
    }
    draw();
  }

  function die() {
    alive = false;
    clearInterval(loop);
    drawDeath();
  }

  function placeFood() {
    do {
      food = { x: Math.floor(Math.random()*COLS), y: Math.floor(Math.random()*ROWS) };
    } while (snake.some(s=>s.x===food.x&&s.y===food.y));
  }

  function draw() {
    // Background
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = '#161616';
    ctx.lineWidth = .5;
    for (let x=0;x<=W;x+=CELL) { ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke(); }
    for (let y=0;y<=H;y+=CELL) { ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke(); }

    // Food — vinyl record tile
    drawVinylTile(food.x, food.y);

    // Snake body
    snake.forEach((seg, i) => {
      const isHead = i === 0;
      const pct    = 1 - (i / snake.length) * 0.5;
      const col    = palette[i % palette.length];

      // Rounded segment
      const x = seg.x*CELL, y = seg.y*CELL;
      const pad = isHead ? 1 : 2;
      ctx.fillStyle = isHead ? '#f5c518' : col;
      ctx.globalAlpha = pct;
      roundRect(ctx, x+pad, y+pad, CELL-pad*2, CELL-pad*2, isHead ? 6 : 4);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Eyes on head
      if (isHead) {
        ctx.fillStyle = '#000';
        const eyeR = 2;
        const [ex1,ey1,ex2,ey2] = getEyePositions(seg.x*CELL, seg.y*CELL);
        ctx.beginPath(); ctx.arc(ex1,ey1,eyeR,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex2,ey2,eyeR,0,Math.PI*2); ctx.fill();
      }
    });
  }

  function drawVinylTile(gx, gy) {
    const x  = gx*CELL, y = gy*CELL;
    const cx = x+CELL/2, cy = y+CELL/2;
    const r  = CELL/2 - 2;

    // If we have the cover, draw a tiny patch
    if (coverImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.clip();
      // Sample a portion of the cover
      const sx = (gx/COLS)*coverImg.width;
      const sy = (gy/ROWS)*coverImg.height;
      const sw = coverImg.width/COLS;
      const sh = coverImg.height/ROWS;
      ctx.drawImage(coverImg, sx, sy, sw*2, sh*2, cx-r, cy-r, r*2, r*2);
      ctx.restore();
    } else {
      // Default vinyl record drawing
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.fillStyle = '#1a1a1a'; ctx.fill();
      // Grooves
      for (let gr=r*.3; gr<r; gr+=2) {
        ctx.beginPath(); ctx.arc(cx,cy,gr,0,Math.PI*2);
        ctx.strokeStyle='#282828'; ctx.lineWidth=.6; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(cx,cy,r*.3,0,Math.PI*2);
      ctx.fillStyle=palette[0]||'#f5c518'; ctx.fill();
    }
    // Center hole
    ctx.beginPath(); ctx.arc(cx,cy,2,0,Math.PI*2);
    ctx.fillStyle='#000'; ctx.fill();
  }

  function getEyePositions(hx, hy) {
    const c = CELL/2, off=5;
    if (dir.x===1)  return [hx+c+off, hy+c-off, hx+c+off, hy+c+off];
    if (dir.x===-1) return [hx+c-off, hy+c-off, hx+c-off, hy+c+off];
    if (dir.y===1)  return [hx+c-off, hy+c+off, hx+c+off, hy+c+off];
    return [hx+c-off, hy+c-off, hx+c+off, hy+c-off];
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
    ctx.closePath();
  }

  function drawDeath() {
    draw();
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillRect(0,0,W,H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8e0d5';
    ctx.font = `bold 36px "Bebas Neue",sans-serif`;
    ctx.fillText('SIDE B OVER', W/2, H/2-20);
    ctx.fillStyle = '#f5c518';
    ctx.font = `14px "DM Mono",monospace`;
    ctx.fillText(`Score: ${score}   Best: ${highScore}`, W/2, H/2+14);
    ctx.fillStyle = '#6a6260';
    ctx.font = `11px "DM Mono",monospace`;
    ctx.fillText('SPACE to replay · Arrow keys to move', W/2, H/2+40);
    ctx.textAlign = 'left';
  }

  function updateHUD() {
    document.getElementById('snakeScore').textContent = score;
    document.getElementById('snakeHigh').textContent  = highScore;
  }

  function setDir(d) {
    if (d.x===-dir.x&&d.y===-dir.y) return;
    nextDir = d;
  }

  function handleKey(e) {
    const map = {
      ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},
      w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0},
    };
    if (e.key===' ') {
      if (!alive) startGame();
      else { paused=!paused; if (!paused) draw(); }
      e.preventDefault(); return;
    }
    const d = map[e.key];
    if (d) { setDir(d); e.preventDefault(); }
  }

  async function shareScore() {
    const text = `I scored ${score} on Groove Snake in VNportal! 🐍🎵`;
    if (navigator.share) {
      try { await navigator.share({ title:'VNportal Snake', text }); return; } catch {}
    }
    await navigator.clipboard.writeText(text);
    alert('Score copied to clipboard!');
  }

  return { init };
})();
