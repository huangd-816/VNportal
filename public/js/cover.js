// ============================================
// VNportal — DIY Cover Studio
// ============================================

const Cover = (() => {
  let canvas, ctx;
  let painting = false;
  let currentTool = 'brush';
  let brushSize  = 10;
  let brushColor = '#f5c518';
  let addingText = false;

  function init() {
    canvas = document.getElementById('coverCanvas');
    ctx    = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Controls
    document.getElementById('brushSize').addEventListener('input', e => brushSize = +e.target.value);
    document.getElementById('brushColor').addEventListener('input', e => brushColor = e.target.value);

    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
        canvas.style.cursor = currentTool === 'fill' ? 'cell' : 'crosshair';
      });
    });

    document.getElementById('addTextBtn').addEventListener('click', () => {
      addingText = true;
      canvas.style.cursor = 'text';
    });

    document.getElementById('clearCanvas').addEventListener('click', () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    document.getElementById('saveCover').addEventListener('click', saveToVinyl);
    document.getElementById('downloadCover').addEventListener('click', downloadCover);

    // Mouse events
    canvas.addEventListener('mousedown', startPaint);
    canvas.addEventListener('mousemove', doPaint);
    canvas.addEventListener('mouseup',   stopPaint);
    canvas.addEventListener('mouseleave', stopPaint);

    // Touch events
    canvas.addEventListener('touchstart', e => { e.preventDefault(); startPaint(toMouse(e)); }, { passive: false });
    canvas.addEventListener('touchmove',  e => { e.preventDefault(); doPaint(toMouse(e));  }, { passive: false });
    canvas.addEventListener('touchend',   stopPaint);

    // Text placement
    canvas.addEventListener('click', handleClick);
  }

  function toMouse(touch) {
    const t = touch.touches[0];
    return { clientX: t.clientX, clientY: t.clientY };
  }

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY
    };
  }

  function startPaint(e) {
    if (currentTool === 'fill') return;
    if (addingText) return;
    painting = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function doPaint(e) {
    if (!painting) return;
    const { x, y } = getPos(e);

    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brushColor;
    }

    ctx.lineWidth   = brushSize;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function stopPaint() {
    painting = false;
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
  }

  function handleClick(e) {
    if (currentTool === 'fill') {
      const { x, y } = getPos(e);
      floodFill(Math.round(x), Math.round(y), brushColor);
      return;
    }

    if (addingText) {
      const { x, y } = getPos(e);
      const text = document.getElementById('coverText').value.trim();
      if (!text) { addingText = false; canvas.style.cursor = 'crosshair'; return; }
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = `bold ${brushSize * 2 + 12}px 'Bebas Neue', sans-serif`;
      ctx.fillStyle = brushColor;
      ctx.fillText(text, x, y);
      addingText = false;
      canvas.style.cursor = 'crosshair';
    }
  }

  // Simple flood fill
  function floodFill(startX, startY, fillColor) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const idx = (startY * canvas.width + startX) * 4;
    const targetR = data[idx], targetG = data[idx+1], targetB = data[idx+2], targetA = data[idx+3];

    const fc = hexToRgb(fillColor);
    if (!fc) return;
    if (targetR === fc.r && targetG === fc.g && targetB === fc.b) return;

    const stack = [[startX, startY]];
    const visited = new Uint8Array(canvas.width * canvas.height);

    const matches = (i) =>
      data[i]===targetR && data[i+1]===targetG && data[i+2]===targetB && data[i+3]===targetA;

    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
      const pi = y * canvas.width + x;
      if (visited[pi]) continue;
      const i = pi * 4;
      if (!matches(i)) continue;
      visited[pi] = 1;
      data[i] = fc.r; data[i+1] = fc.g; data[i+2] = fc.b; data[i+3] = 255;
      stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? { r: parseInt(r[1],16), g: parseInt(r[2],16), b: parseInt(r[3],16) } : null;
  }

  function saveToVinyl() {
    const vinyl = Store.getCurrentVinyl();
    if (!vinyl) {
      alert('No vinyl selected. Press a vinyl first, then come back to design its cover!');
      return;
    }
    const dataURL = canvas.toDataURL('image/png');
    Store.saveCover(vinyl.id, dataURL);
    Exhibit.render();

    const btn = document.getElementById('saveCover');
    const orig = btn.textContent;
    btn.textContent = '✓ Saved!';
    btn.style.background = '#27ae60';
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1800);
  }

  function downloadCover() {
    const a = document.createElement('a');
    a.download = 'vnportal-cover.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  }

  function loadCover(vinylId) {
    const dataURL = Store.getCover(vinylId);
    if (!dataURL) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0); };
    img.src = dataURL;
  }

  return { init, loadCover };
})();
