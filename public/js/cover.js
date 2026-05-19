// ============================================
// VNportal — Cover Studio (Phase 2)
// Circular vinyl-shaped canvas, undo, filters
// ============================================

const Cover = (() => {
  let canvas, ctx;
  let painting    = false;
  let currentTool = 'brush';
  let brushSize   = 10;
  let brushOpacity = 1;
  let brushColor  = '#f5c518';
  let addingText  = false;
  let undoStack   = [];
  const MAX_UNDO  = 20;
  let brightness  = 1, contrast = 1, saturation = 1;

  function init() {
    canvas = document.getElementById('coverCanvas');
    ctx    = canvas.getContext('2d');
    initCanvas();
    populateVinylSelect();
    bindControls();
  }

  function initCanvas() {
    // Clip to circle — vinyl shape
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, canvas.width/2, 0, Math.PI*2);
    ctx.clip();
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    // Draw center hole
    drawVinylHole();
    pushUndo();
  }

  function drawVinylHole() {
    const cx = canvas.width/2, cy = canvas.height/2;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    // Redraw hole outline
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function populateVinylSelect() {
    const sel  = document.getElementById('coverVinylSelect');
    if (!sel) return;
    const { vinyls } = Store.get();
    sel.innerHTML = '<option value="">— Select a vinyl —</option>';
    vinyls.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.name;
      sel.appendChild(opt);
    });
    // Pre-select current
    const cur = Store.getCurrentVinyl();
    if (cur) sel.value = cur.id;
  }

  function bindControls() {
    document.getElementById('brushSize').addEventListener('input',    e => brushSize = +e.target.value);
    document.getElementById('brushOpacity').addEventListener('input', e => brushOpacity = +e.target.value);
    document.getElementById('brushColor').addEventListener('input',   e => brushColor = e.target.value);

    document.querySelectorAll('.swatch').forEach(s => {
      s.addEventListener('click', () => {
        brushColor = s.dataset.color;
        document.getElementById('brushColor').value = s.dataset.color;
      });
    });

    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
        canvas.style.cursor = currentTool === 'fill' ? 'cell'
          : currentTool === 'eyedropper' ? 'crosshair' : 'crosshair';
      });
    });

    document.getElementById('addTextBtn').addEventListener('click', () => {
      addingText = true;
      canvas.style.cursor = 'text';
    });

    document.getElementById('coverImgUpload').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        pushUndo();
        ctx.save();
        ctx.beginPath();
        ctx.arc(canvas.width/2, canvas.height/2, canvas.width/2, 0, Math.PI*2);
        ctx.clip();
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        drawVinylHole();
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });

    // Filters
    ['filterBrightness','filterContrast','filterSaturation'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        brightness = +document.getElementById('filterBrightness').value;
        contrast   = +document.getElementById('filterContrast').value;
        saturation = +document.getElementById('filterSaturation').value;
        canvas.style.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
      });
    });

    document.getElementById('clearCanvas').addEventListener('click',  () => { pushUndo(); initCanvas(); });
    document.getElementById('undoCover').addEventListener('click',    undo);
    document.getElementById('saveCover').addEventListener('click',    saveToVinyl);
    document.getElementById('exportCover').addEventListener('click',  exportPNG);

    document.getElementById('coverVinylSelect').addEventListener('change', e => {
      if (e.target.value) {
        Store.setCurrentVinyl(e.target.value);
        loadExistingCover(e.target.value);
      }
    });

    // Canvas events
    canvas.addEventListener('mousedown',  startPaint);
    canvas.addEventListener('mousemove',  doPaint);
    canvas.addEventListener('mouseup',    stopPaint);
    canvas.addEventListener('mouseleave', stopPaint);
    canvas.addEventListener('touchstart', e => { e.preventDefault(); startPaint(touch2Mouse(e)); }, { passive: false });
    canvas.addEventListener('touchmove',  e => { e.preventDefault(); doPaint(touch2Mouse(e));    }, { passive: false });
    canvas.addEventListener('touchend',   stopPaint);
    canvas.addEventListener('click',      handleClick);
  }

  function touch2Mouse(e) {
    const t = e.touches[0];
    return { clientX: t.clientX, clientY: t.clientY };
  }

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width  / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height),
    };
  }

  function inCircle(x, y) {
    const cx = canvas.width/2, cy = canvas.height/2, r = canvas.width/2;
    return (x-cx)**2 + (y-cy)**2 <= r**2;
  }

  function startPaint(e) {
    if (currentTool === 'fill' || currentTool === 'eyedropper' || addingText) return;
    const { x, y } = getPos(e);
    if (!inCircle(x, y)) return;
    pushUndo();
    painting = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function doPaint(e) {
    if (!painting) return;
    const { x, y } = getPos(e);
    if (!inCircle(x, y)) { stopPaint(); return; }

    ctx.globalAlpha = brushOpacity;
    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brushColor;
    }
    ctx.lineWidth = brushSize;
    ctx.lineCap   = 'round';
    ctx.lineJoin  = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function stopPaint() {
    if (!painting) return;
    painting = false;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.beginPath();
  }

  function handleClick(e) {
    const { x, y } = getPos(e);
    if (!inCircle(x, y)) return;

    if (currentTool === 'eyedropper') {
      const px = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
      brushColor = `rgb(${px[0]},${px[1]},${px[2]})`;
      document.getElementById('brushColor').value = rgbToHex(px[0], px[1], px[2]);
      return;
    }

    if (currentTool === 'fill') {
      pushUndo();
      floodFill(Math.round(x), Math.round(y), brushColor);
      return;
    }

    if (addingText) {
      const text = document.getElementById('coverText').value.trim();
      if (!text) { addingText = false; return; }
      pushUndo();
      const size = +document.getElementById('textSize').value;
      ctx.globalAlpha = brushOpacity;
      ctx.globalCompositeOperation = 'source-over';
      ctx.font      = `bold ${size}px 'Bebas Neue', sans-serif`;
      ctx.fillStyle = brushColor;
      ctx.fillText(text, x, y);
      ctx.globalAlpha = 1;
      addingText = false;
      canvas.style.cursor = 'crosshair';
    }
  }

  // Undo stack
  function pushUndo() {
    undoStack.push(canvas.toDataURL());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }

  function undo() {
    if (undoStack.length < 2) return;
    undoStack.pop();
    const prev = undoStack[undoStack.length - 1];
    const img  = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = prev;
  }

  // Flood fill
  function floodFill(sx, sy, fillColor) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data    = imgData.data;
    const idx     = (sy * canvas.width + sx) * 4;
    const tR = data[idx], tG = data[idx+1], tB = data[idx+2], tA = data[idx+3];
    const fc  = hexToRgb(fillColor);
    if (!fc || (fc.r===tR && fc.g===tG && fc.b===tB)) return;
    const stack   = [[sx, sy]];
    const visited = new Uint8Array(canvas.width * canvas.height);
    const matches = i => data[i]===tR && data[i+1]===tG && data[i+2]===tB && data[i+3]===tA;
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x<0||x>=canvas.width||y<0||y>=canvas.height) continue;
      const pi = y*canvas.width+x;
      if (visited[pi]) continue;
      const i = pi*4;
      if (!matches(i)) continue;
      visited[pi]=1;
      data[i]=fc.r; data[i+1]=fc.g; data[i+2]=fc.b; data[i+3]=255;
      stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? { r:parseInt(r[1],16), g:parseInt(r[2],16), b:parseInt(r[3],16) } : null;
  }

  function rgbToHex(r,g,b) {
    return '#'+ [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
  }

  function loadExistingCover(vinylId) {
    const dataURL = Store.getCover(vinylId);
    if (!dataURL) { initCanvas(); return; }
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.beginPath();
      ctx.arc(canvas.width/2, canvas.height/2, canvas.width/2, 0, Math.PI*2);
      ctx.clip();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      drawVinylHole();
      pushUndo();
    };
    img.src = dataURL;
  }

  function saveToVinyl() {
    const vinyl = Store.getCurrentVinyl();
    if (!vinyl) { alert('Select a vinyl first!'); return; }
    const dataURL = canvas.toDataURL('image/png');
    Store.saveCover(vinyl.id, dataURL);
    Exhibit.render();
    const btn = document.getElementById('saveCover');
    btn.textContent = '✓ Saved!';
    btn.style.background = '#27ae60';
    setTimeout(() => {
      btn.textContent = 'Save to Vinyl';
      btn.style.background = '';
      // Auto-navigate to exhibit
      App.navigate('exhibit');
    }, 1000);
  }

  function exportPNG() {
    const a     = document.createElement('a');
    a.download  = 'vnportal-cover.png';
    a.href      = canvas.toDataURL('image/png');
    a.click();
  }

  function onShow() {
    populateVinylSelect();
    const cur = Store.getCurrentVinyl();
    if (cur) loadExistingCover(cur.id);
  }

  return { init, onShow, loadExistingCover };
})();
