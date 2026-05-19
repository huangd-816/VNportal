// ============================================
// VNportal — Cover Studio
// Fixed: real eraser, vinyl-linked, null guards
// ============================================
const Cover = (() => {
  let canvas, ctx;
  let painting = false, currentTool = 'brush';
  let brushSize = 10, brushOpacity = 1, brushColor = '#f5c518';
  let addingText = false;
  let undoStack = [], MAX_UNDO = 20;
  let currentVinylId = null;
  // Dark vinyl background color used by eraser
  const BG_COLOR = '#141414';

  function init() {
    canvas = document.getElementById('coverCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d', {willReadFrequently: true});
    initCanvas();
    bindControls();
    populateVinylSelect();
  }

  function initCanvas() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, canvas.width/2, 0, Math.PI*2);
    ctx.clip();
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    drawHole();
    undoStack = [];
    pushUndo();
  }

  function drawHole() {
    const cx = canvas.width/2, cy = canvas.height/2;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI*2);
    ctx.fillStyle = '#080808';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function populateVinylSelect() {
    const sel = document.getElementById('coverVinylSelect');
    if (!sel) return;
    const { vinyls } = Store.get();
    sel.innerHTML = '<option value="">— Select a vinyl —</option>';
    vinyls.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.name;
      sel.appendChild(opt);
    });
    const cur = Store.getCurrentVinyl();
    if (cur) { sel.value = cur.id; currentVinylId = cur.id; updateVinylLabel(cur); }
  }

  function updateVinylLabel(vinyl) {
    const label = document.getElementById('coverVinylLabel');
    if (label && vinyl) label.textContent = `Editing: ${vinyl.name}`;
  }

  function bindControls() {
    const safe = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('input', fn); };
    const safeClick = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };

    safe('brushSize',    e => brushSize = +e.target.value);
    safe('brushOpacity', e => brushOpacity = +e.target.value);
    safe('brushColor',   e => brushColor = e.target.value);

    document.querySelectorAll('.swatch').forEach(s => {
      s.addEventListener('click', () => {
        brushColor = s.dataset.color;
        const bc = document.getElementById('brushColor');
        if (bc) bc.value = s.dataset.color;
      });
    });

    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
        canvas.style.cursor = currentTool === 'fill' ? 'cell' : 'crosshair';
      });
    });

    safeClick('addTextBtn', () => { addingText = true; canvas.style.cursor = 'text'; });

    const imgUpload = document.getElementById('coverImgUpload');
    if (imgUpload) {
      imgUpload.addEventListener('change', e => {
        const file = e.target.files[0]; if (!file) return;
        const img = new Image(), url = URL.createObjectURL(file);
        img.onload = () => {
          pushUndo();
          ctx.save();
          ctx.beginPath();
          ctx.arc(canvas.width/2, canvas.height/2, canvas.width/2, 0, Math.PI*2);
          ctx.clip();
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          ctx.restore();
          drawHole();
          URL.revokeObjectURL(url);
        };
        img.src = url;
      });
    }

    ['filterBrightness','filterContrast','filterSaturation'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateFilter);
    });

    safeClick('clearCanvas', () => { pushUndo(); initCanvas(); });
    safeClick('undoCover',   undo);
    safeClick('saveCover',   saveToVinyl);
    safeClick('exportCover', exportPNG);

    const sel = document.getElementById('coverVinylSelect');
    if (sel) {
      sel.addEventListener('change', e => {
        if (!e.target.value) return;
        currentVinylId = e.target.value;
        Store.setCurrentVinyl(e.target.value);
        const vinyl = Store.getVinyl(e.target.value);
        updateVinylLabel(vinyl);
        loadExistingCover(e.target.value);
      });
    }

    canvas.addEventListener('mousedown',  startPaint);
    canvas.addEventListener('mousemove',  doPaint);
    canvas.addEventListener('mouseup',    stopPaint);
    canvas.addEventListener('mouseleave', stopPaint);
    canvas.addEventListener('click',      handleClick);
    canvas.addEventListener('touchstart', e => { e.preventDefault(); startPaint(t2m(e)); }, { passive:false });
    canvas.addEventListener('touchmove',  e => { e.preventDefault(); doPaint(t2m(e));   }, { passive:false });
    canvas.addEventListener('touchend',   stopPaint);
  }

  function updateFilter() {
    const b = document.getElementById('filterBrightness')?.value || 1;
    const c = document.getElementById('filterContrast')?.value   || 1;
    const s = document.getElementById('filterSaturation')?.value || 1;
    canvas.style.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;
  }

  function t2m(e) { const t=e.touches[0]; return {clientX:t.clientX,clientY:t.clientY}; }

  function getPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x:(e.clientX-r.left)*(canvas.width/r.width), y:(e.clientY-r.top)*(canvas.height/r.height) };
  }

  function inCircle(x,y) {
    const cx=canvas.width/2, cy=canvas.height/2;
    return (x-cx)**2+(y-cy)**2 <= (canvas.width/2)**2;
  }

  function startPaint(e) {
    if (currentTool==='fill'||currentTool==='eyedropper'||addingText) return;
    const {x,y} = getPos(e);
    if (!inCircle(x,y)) return;
    pushUndo();
    painting = true;
    ctx.beginPath(); ctx.moveTo(x,y);
  }

  function doPaint(e) {
    if (!painting) return;
    const {x,y} = getPos(e);
    if (!inCircle(x,y)) { stopPaint(); return; }

    ctx.globalAlpha = brushOpacity;

    if (currentTool === 'eraser') {
      // Paint with background color — true erase effect
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = BG_COLOR;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = brushColor;
    }
    ctx.lineWidth = brushSize;
    ctx.lineCap   = 'round';
    ctx.lineJoin  = 'round';
    ctx.lineTo(x,y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x,y);
  }

  function stopPaint() {
    if (!painting) return;
    painting = false;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath();
  }

  function handleClick(e) {
    const {x,y} = getPos(e);
    if (!inCircle(x,y)) return;

    if (currentTool === 'eyedropper') {
      const px = ctx.getImageData(Math.round(x),Math.round(y),1,1).data;
      const hex = '#'+[px[0],px[1],px[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
      brushColor = hex;
      const bc = document.getElementById('brushColor');
      if (bc) bc.value = hex;
      return;
    }

    if (currentTool === 'fill') {
      pushUndo();
      floodFill(Math.round(x), Math.round(y), brushColor);
      return;
    }

    if (addingText) {
      const text = document.getElementById('coverText')?.value?.trim();
      if (!text) { addingText=false; return; }
      pushUndo();
      const size = +( document.getElementById('textSize')?.value || 28);
      ctx.globalAlpha = brushOpacity;
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = `bold ${size}px "Bebas Neue",sans-serif`;
      ctx.fillStyle = brushColor;
      ctx.fillText(text, x, y);
      ctx.globalAlpha = 1;
      addingText = false;
      canvas.style.cursor = 'crosshair';
    }
  }

  function pushUndo() {
    undoStack.push(canvas.toDataURL());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }

  function undo() {
    if (undoStack.length < 2) return;
    undoStack.pop();
    const img = new Image();
    img.onload = () => { ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0); };
    img.src = undoStack[undoStack.length-1];
  }

  function floodFill(sx, sy, fillColor) {
    const id=ctx.getImageData(0,0,canvas.width,canvas.height), d=id.data;
    const i=(sy*canvas.width+sx)*4;
    const [tR,tG,tB,tA]=[d[i],d[i+1],d[i+2],d[i+3]];
    const fc=hexToRgb(fillColor); if(!fc) return;
    if(fc.r===tR&&fc.g===tG&&fc.b===tB) return;
    const stack=[[sx,sy]], vis=new Uint8Array(canvas.width*canvas.height);
    const match=i=>d[i]===tR&&d[i+1]===tG&&d[i+2]===tB&&d[i+3]===tA;
    while(stack.length){
      const [x,y]=stack.pop();
      if(x<0||x>=canvas.width||y<0||y>=canvas.height) continue;
      const pi=y*canvas.width+x; if(vis[pi]) continue;
      const ii=pi*4; if(!match(ii)) continue;
      vis[pi]=1; d[ii]=fc.r;d[ii+1]=fc.g;d[ii+2]=fc.b;d[ii+3]=255;
      stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
    }
    ctx.putImageData(id,0,0);
  }

  function hexToRgb(hex){const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);return r?{r:parseInt(r[1],16),g:parseInt(r[2],16),b:parseInt(r[3],16)}:null;}

  function loadExistingCover(vinylId) {
    const dataURL = Store.getCover(vinylId);
    if (!dataURL) { initCanvas(); return; }
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.save();
      ctx.beginPath();
      ctx.arc(canvas.width/2,canvas.height/2,canvas.width/2,0,Math.PI*2);
      ctx.clip();
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      ctx.restore();
      drawHole();
      undoStack=[];
      pushUndo();
    };
    img.src = dataURL;
  }

  function saveToVinyl() {
    if (!currentVinylId) { alert('Select a vinyl first!'); return; }
    const dataURL = canvas.toDataURL('image/png');
    Store.saveCover(currentVinylId, dataURL);
    Exhibit.render();
    const btn = document.getElementById('saveCover');
    if (btn) { btn.textContent='✓ Saved!'; btn.style.background='#27ae60'; }
    setTimeout(() => {
      if (btn) { btn.textContent='Save to Vinyl'; btn.style.background=''; }
      App.navigate('exhibit');
    }, 900);
  }

  function exportPNG() {
    const a=document.createElement('a');
    a.download='vnportal-cover.png';
    a.href=canvas.toDataURL('image/png');
    a.click();
  }

  function onShow() {
    populateVinylSelect();
    const cur = Store.getCurrentVinyl();
    if (cur) { currentVinylId=cur.id; loadExistingCover(cur.id); }
  }

  return { init, onShow, loadExistingCover };
})();
