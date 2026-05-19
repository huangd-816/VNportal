// ============================================
// VNportal — Vinyl 2048
// Merge tiles to reveal your vinyl cover art
// ============================================

const Game2048 = (() => {
  const SIZE  = 4;
  let board   = [];
  let score   = 0;
  let best    = parseInt(localStorage.getItem('vnportal_2048_best') || '0');
  let won     = false;
  let coverImg = null;

  function init() {
    document.getElementById('play2048Btn').addEventListener('click', show);
    document.getElementById('close2048').addEventListener('click', hide);
    document.getElementById('share2048Btn').addEventListener('click', shareScore);

    // Keyboard
    window.addEventListener('keydown', e => {
      if (document.getElementById('game2048Container').classList.contains('hidden')) return;
      const moves = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down' };
      if (moves[e.key]) { e.preventDefault(); move(moves[e.key]); }
    });

    // Touch swipe
    let tx=0, ty=0;
    const board2048 = document.getElementById('board2048');
    board2048.addEventListener('touchstart', e=>{ tx=e.touches[0].clientX; ty=e.touches[0].clientY; e.preventDefault(); }, {passive:false});
    board2048.addEventListener('touchend', e=>{
      const dx=e.changedTouches[0].clientX-tx, dy=e.changedTouches[0].clientY-ty;
      if (Math.abs(dx)>Math.abs(dy)) move(dx>0?'right':'left');
      else move(dy>0?'down':'up');
    });
  }

  function show() {
    document.getElementById('game2048Container').classList.remove('hidden');
    loadCover();
    startGame();
  }

  function hide() {
    document.getElementById('game2048Container').classList.add('hidden');
  }

  function loadCover() {
    const vinyl = Store.getCurrentVinyl();
    if (!vinyl) return;
    const cover = Store.getCover(vinyl.id);
    if (!cover) return;
    const img = new Image();
    img.onload = () => { coverImg = img; renderBoard(); };
    img.src = cover;
  }

  function startGame() {
    board = Array.from({length:SIZE}, () => Array(SIZE).fill(0));
    score = 0;
    won   = false;
    addRandom(); addRandom();
    renderBoard();
    updateHUD();
  }

  function addRandom() {
    const empty = [];
    for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) if (!board[r][c]) empty.push([r,c]);
    if (!empty.length) return;
    const [r,c] = empty[Math.floor(Math.random()*empty.length)];
    board[r][c] = Math.random()<.9 ? 2 : 4;
  }

  function move(dir) {
    const prev = JSON.stringify(board);
    let gained = 0;

    for (let i=0; i<SIZE; i++) {
      let line = getLine(i, dir);
      const [merged, pts] = mergeLine(line);
      gained += pts;
      setLine(i, dir, merged);
    }

    if (JSON.stringify(board) !== prev) {
      score += gained;
      if (score > best) { best = score; localStorage.setItem('vnportal_2048_best', best); }
      addRandom();
      renderBoard();
      updateHUD();
      checkWin();
      checkLose();
    }
  }

  function getLine(i, dir) {
    if (dir==='left')  return board[i].slice();
    if (dir==='right') return board[i].slice().reverse();
    if (dir==='up')    return board.map(r=>r[i]);
    if (dir==='down')  return board.map(r=>r[i]).reverse();
  }

  function setLine(i, dir, line) {
    if (dir==='left')  board[i] = line;
    if (dir==='right') board[i] = line.reverse();
    if (dir==='up')    line.forEach((v,r)=>board[r][i]=v);
    if (dir==='down')  line.reverse().forEach((v,r)=>board[r][i]=v);
  }

  function mergeLine(line) {
    const vals   = line.filter(v=>v);
    let pts      = 0;
    const merged = [];
    let skip     = false;
    for (let i=0; i<vals.length; i++) {
      if (skip) { skip=false; continue; }
      if (vals[i]===vals[i+1]) {
        merged.push(vals[i]*2);
        pts += vals[i]*2;
        skip = true;
      } else {
        merged.push(vals[i]);
      }
    }
    while (merged.length < SIZE) merged.push(0);
    return [merged, pts];
  }

  function renderBoard() {
    const el = document.getElementById('board2048');
    el.innerHTML = '';

    // Background cells
    for (let i=0; i<SIZE*SIZE; i++) {
      const bg = document.createElement('div');
      bg.className = 'g2048-cell g2048-cell-bg';
      el.appendChild(bg);
    }

    // Tile cells on top
    for (let r=0; r<SIZE; r++) {
      for (let c=0; c<SIZE; c++) {
        const val  = board[r][c];
        const cell = document.createElement('div');
        cell.className  = 'g2048-cell';
        cell.style.gridRow    = r+1;
        cell.style.gridColumn = c+1;

        if (val) {
          cell.dataset.val = val;
          // If val >= 64 and we have a cover, show cover tile
          if (val >= 64 && coverImg) {
            const step = Math.log2(val) - 5; // 64=1st, 128=2nd ...
            const totalSteps = 11; // 64 to 2048
            const pct  = Math.min(step/totalSteps, 1);
            // Show cover with opacity based on value
            cell.style.cssText = `
              grid-row:${r+1};grid-column:${c+1};
              background-image:url(${coverImg.src});
              background-size:${SIZE*100}% ${SIZE*100}%;
              background-position:${c*100/(SIZE-1)}% ${r*100/(SIZE-1)}%;
              opacity:${0.4 + pct*0.6};
            `;
            // Add value label
            const lbl = document.createElement('span');
            lbl.style.cssText = 'position:absolute;bottom:4px;right:6px;font-size:.65rem;color:rgba(255,255,255,.8);text-shadow:0 1px 3px rgba(0,0,0,.8)';
            lbl.textContent = val >= 1000 ? (val/1000)+'k' : val;
            cell.appendChild(lbl);
          } else {
            cell.textContent = val >= 1000 ? (val/1000)+'k' : val;
          }
        }
        el.appendChild(cell);
      }
    }
  }

  function checkWin() {
    if (won) return;
    for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) {
      if (board[r][c]===2048) {
        won = true;
        setTimeout(showWin, 300);
        return;
      }
    }
  }

  function showWin() {
    const el = document.getElementById('board2048');
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:absolute;inset:0;background:rgba(0,0,0,.85);
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.75rem;
      font-family:"Bebas Neue",sans-serif;letter-spacing:.1em;z-index:10;
    `;
    overlay.innerHTML = `
      <div style="font-size:2.5rem;color:#f5c518">2048 REACHED!</div>
      <div style="font-size:1rem;color:#e8e0d5">Cover revealed 🎵</div>
      ${coverImg ? `<img src="${coverImg.src}" style="width:200px;height:200px;object-fit:cover;border-radius:50%;border:2px solid #f5c518"/>` : ''}
      <button onclick="this.parentElement.remove()" style="margin-top:.5rem;background:#f5c518;border:none;padding:.5rem 1.5rem;font-family:'DM Mono',monospace;font-size:.75rem;cursor:pointer">Keep Playing</button>
    `;
    el.style.position = 'relative';
    el.appendChild(overlay);
  }

  function checkLose() {
    for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) {
      if (!board[r][c]) return;
      if (c<SIZE-1 && board[r][c]===board[r][c+1]) return;
      if (r<SIZE-1 && board[r][c]===board[r+1][c]) return;
    }
    setTimeout(() => {
      if (confirm(`Game over! Score: ${score}\n\nPlay again?`)) startGame();
    }, 200);
  }

  function updateHUD() {
    document.getElementById('score2048').textContent = score;
    document.getElementById('best2048').textContent  = best;
  }

  async function shareScore() {
    const text = `I scored ${score} on Vinyl 2048 in VNportal! 🎵`;
    if (navigator.share) {
      try { await navigator.share({ title:'VNportal 2048', text }); return; } catch {}
    }
    await navigator.clipboard.writeText(text);
    alert('Score copied to clipboard!');
  }

  return { init };
})();
