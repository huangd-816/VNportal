// ============================================
// VNportal — Groove Snake Mini Game
// ============================================

const Snake = (() => {
  const CELL = 20;
  let canvas, ctx;
  let snake, dir, food, score, highScore, loop, alive;

  const COLORS = {
    bg:     '#161616',
    grid:   '#1a1a1a',
    snake:  '#f5c518',
    head:   '#ffd84d',
    food:   '#e8734a',
    text:   '#e8e0d5',
  };

  function init() {
    canvas   = document.getElementById('snakeCanvas');
    ctx      = canvas.getContext('2d');
    highScore = 0;

    document.getElementById('playSnakeBtn').addEventListener('click', show);
    document.getElementById('closeSnake').addEventListener('click', hide);

    window.addEventListener('keydown', handleKey);

    // Touch swipe
    let tx, ty;
    canvas.addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; });
    canvas.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - tx;
      const dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && dir.x !== -1) dir = {x:1,y:0};
        else if (dx < 0 && dir.x !== 1) dir = {x:-1,y:0};
      } else {
        if (dy > 0 && dir.y !== -1) dir = {x:0,y:1};
        else if (dy < 0 && dir.y !== 1) dir = {x:0,y:-1};
      }
    });
  }

  function show() {
    document.getElementById('snakeContainer').classList.remove('hidden');
    startGame();
  }

  function hide() {
    document.getElementById('snakeContainer').classList.add('hidden');
    clearInterval(loop);
  }

  function cols() { return canvas.width  / CELL; }
  function rows() { return canvas.height / CELL; }

  function startGame() {
    clearInterval(loop);
    snake = [
      { x: 10, y: 10 },
      { x:  9, y: 10 },
      { x:  8, y: 10 },
    ];
    dir   = { x: 1, y: 0 };
    score = 0;
    alive = true;
    placeFood();
    updateHUD();

    // Speed based on active vinyl — placeholder: 150ms
    const speed = 150;
    loop = setInterval(tick, speed);
  }

  function tick() {
    if (!alive) return;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // Wall collision
    if (head.x < 0 || head.x >= cols() || head.y < 0 || head.y >= rows()) {
      die(); return;
    }
    // Self collision
    if (snake.some(s => s.x === head.x && s.y === head.y)) {
      die(); return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score++;
      if (score > highScore) highScore = score;
      updateHUD();
      placeFood();
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
      food = { x: Math.floor(Math.random() * cols()), y: Math.floor(Math.random() * rows()) };
    } while (snake.some(s => s.x === food.x && s.y === food.y));
  }

  function draw() {
    // BG
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= canvas.width; x += CELL) {
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += CELL) {
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
    }

    // Food — vinyl record
    drawVinyl(food.x, food.y, COLORS.food);

    // Snake
    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? COLORS.head : COLORS.snake;
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);

      // Head details
      if (i === 0) {
        ctx.fillStyle = '#000';
        const eyeSize = 2.5;
        const ex = seg.x * CELL + (dir.x === 1 ? 14 : dir.x === -1 ? 4 : 7);
        const ey = seg.y * CELL + (dir.y === 1 ? 14 : dir.y === -1 ? 4 : 7);
        ctx.fillRect(ex, ey, eyeSize, eyeSize);
        const ex2 = seg.x * CELL + (dir.x === 1 ? 14 : dir.x === -1 ? 4 : 13);
        const ey2 = seg.y * CELL + (dir.y === 1 ? 14 : dir.y === -1 ? 4 : 13);
        ctx.fillRect(ex2, ey2, eyeSize, eyeSize);
      }
    });
  }

  function drawVinyl(gx, gy, color) {
    const cx = gx * CELL + CELL/2;
    const cy = gy * CELL + CELL/2;
    const r  = CELL/2 - 1;

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.fillStyle = '#222';
    ctx.fill();

    // Grooves
    for (let gr = r*0.3; gr < r; gr += 2) {
      ctx.beginPath();
      ctx.arc(cx, cy, gr, 0, Math.PI*2);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Label
    ctx.beginPath();
    ctx.arc(cx, cy, r*0.35, 0, Math.PI*2);
    ctx.fillStyle = color;
    ctx.fill();

    // Center hole
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI*2);
    ctx.fillStyle = '#000';
    ctx.fill();
  }

  function drawDeath() {
    draw();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 28px "Bebas Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SIDE B OVER', canvas.width/2, canvas.height/2 - 20);

    ctx.font = '13px "DM Mono", monospace';
    ctx.fillStyle = '#f5c518';
    ctx.fillText(`Score: ${score}   High: ${highScore}`, canvas.width/2, canvas.height/2 + 12);

    ctx.font = '11px "DM Mono", monospace';
    ctx.fillStyle = '#7a7068';
    ctx.fillText('Press SPACE or tap to replay', canvas.width/2, canvas.height/2 + 40);
    ctx.textAlign = 'left';
  }

  function updateHUD() {
    document.getElementById('snakeScore').textContent = score;
    document.getElementById('snakeHigh').textContent  = highScore;
  }

  function handleKey(e) {
    const map = {
      ArrowUp: {x:0,y:-1}, ArrowDown: {x:0,y:1}, ArrowLeft: {x:-1,y:0}, ArrowRight: {x:1,y:0},
      w: {x:0,y:-1}, s: {x:0,y:1}, a: {x:-1,y:0}, d: {x:1,y:0},
    };
    if (e.key === ' ' && !alive) { startGame(); return; }
    const newDir = map[e.key];
    if (!newDir) return;
    // Prevent reversing
    if (newDir.x === -dir.x && newDir.y === -dir.y) return;
    dir = newDir;
    e.preventDefault();
  }

  return { init };
})();
