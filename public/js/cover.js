// ============================================
// VNportal — Cover Studio
// Two-canvas eraser, more filters, notifications
// ============================================
const Cover = (() => {
  let drawCanvas, drawCtx, bgCanvas, bgCtx, displayCanvas, displayCtx;
  let painting=false, currentTool='brush';
  let brushSize=10, brushOpacity=1, brushColor='#f5c518';
  let addingText=false, undoStack=[], MAX_UNDO=25;
  let currentVinylId=null;
  const W=500, H=500, R=250;

  function init() {
    displayCanvas=document.getElementById('coverCanvas');
    if(!displayCanvas) return;

    // Background canvas (cover image / vinyl base) — hidden
    bgCanvas=document.createElement('canvas'); bgCanvas.width=W; bgCanvas.height=H;
    bgCtx=bgCanvas.getContext('2d',{willReadFrequently:true});

    // Drawing canvas (transparent, user draws here)
    drawCanvas=document.createElement('canvas'); drawCanvas.width=W; drawCanvas.height=H;
    drawCtx=drawCanvas.getContext('2d',{willReadFrequently:true});

    // Display canvas — composites both for display and saving
    displayCanvas.width=W; displayCanvas.height=H;
    displayCtx=displayCanvas.getContext('2d',{willReadFrequently:true});

    initBg(); composite(); pushUndo();
    bindControls(); populateVinylSelect();
  }

  function initBg() {
    bgCtx.save();
    bgCtx.beginPath(); bgCtx.arc(R,R,R,0,Math.PI*2); bgCtx.clip();
    bgCtx.fillStyle='#1a1a1a'; bgCtx.fillRect(0,0,W,H);
    bgCtx.restore();
    drawHole(bgCtx);
  }

  function drawHole(ctx) {
    ctx.save();
    ctx.globalCompositeOperation='destination-out';
    ctx.beginPath(); ctx.arc(R,R,13,0,Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(R,R,13,0,Math.PI*2);
    ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1; ctx.stroke();
  }

  function composite() {
    displayCtx.clearRect(0,0,W,H);
    displayCtx.drawImage(bgCanvas,0,0);
    displayCtx.drawImage(drawCanvas,0,0);
  }

  function populateVinylSelect() {
    const sel=document.getElementById('coverVinylSelect'); if(!sel) return;
    const{vinyls}=Store.get();
    sel.innerHTML='<option value="">— Select a vinyl —</option>';
    vinyls.forEach(v=>{const o=document.createElement('option');o.value=v.id;o.textContent=v.name;sel.appendChild(o);});
    const cur=Store.getCurrentVinyl();
    if(cur){sel.value=cur.id;currentVinylId=cur.id;updateLabel(cur);}
  }

  function updateLabel(vinyl){
    const l=document.getElementById('coverVinylLabel');
    if(l&&vinyl) l.textContent=`Editing: ${vinyl.name}`;
  }

  function bindControls() {
    const s=(id,fn)=>{const e=document.getElementById(id);if(e)e.addEventListener('input',fn);};
    const c=(id,fn)=>{const e=document.getElementById(id);if(e)e.addEventListener('click',fn);};

    s('brushSize',    e=>brushSize=+e.target.value);
    s('brushOpacity', e=>brushOpacity=+e.target.value);
    s('brushColor',   e=>brushColor=e.target.value);

    document.querySelectorAll('.swatch').forEach(sw=>{
      sw.addEventListener('click',()=>{
        brushColor=sw.dataset.color;
        const bc=document.getElementById('brushColor'); if(bc)bc.value=sw.dataset.color;
      });
    });

    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.tool-btn[data-tool]').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active'); currentTool=btn.dataset.tool;
        displayCanvas.style.cursor=currentTool==='fill'?'cell':currentTool==='eyedropper'?'crosshair':'crosshair';
      });
    });

    c('addTextBtn',()=>{addingText=true;displayCanvas.style.cursor='text';});
    c('clearCanvas',()=>{drawCtx.clearRect(0,0,W,H);composite();pushUndo();Notify.info('Canvas cleared');});
    c('undoCover',  undo);
    c('saveCover',  saveToVinyl);
    c('exportCover',exportPNG);

    // Filter sliders
    ['filterBrightness','filterContrast','filterSaturation','filterBlur','filterSepia','filterGrayscale'].forEach(id=>{
      s(id, applyFilters);
    });

    // Preset filters
    document.querySelectorAll('.filter-preset').forEach(btn=>{
      btn.addEventListener('click',()=>applyPreset(btn.dataset.preset));
    });

    // Image upload (supports GIF)
    const imgUp=document.getElementById('coverImgUpload');
    if(imgUp){
      imgUp.addEventListener('change',e=>{
        const file=e.target.files[0]; if(!file) return;
        const url=URL.createObjectURL(file);
        const img=new Image();
        img.onload=()=>{
          pushUndo();
          bgCtx.save(); bgCtx.beginPath(); bgCtx.arc(R,R,R,0,Math.PI*2); bgCtx.clip();
          bgCtx.drawImage(img,0,0,W,H); bgCtx.restore(); drawHole(bgCtx);
          composite(); URL.revokeObjectURL(url);
          Notify.success('Image imported to canvas');
        };
        img.src=url;
      });
    }

    // Vinyl select
    const sel=document.getElementById('coverVinylSelect');
    if(sel){
      sel.addEventListener('change',e=>{
        if(!e.target.value) return;
        currentVinylId=e.target.value;
        Store.setCurrentVinyl(e.target.value);
        updateLabel(Store.getVinyl(e.target.value));
        loadExistingCover(e.target.value);
      });
    }

    // Canvas events
    displayCanvas.addEventListener('mousedown', startPaint);
    displayCanvas.addEventListener('mousemove', doPaint);
    displayCanvas.addEventListener('mouseup',   stopPaint);
    displayCanvas.addEventListener('mouseleave',stopPaint);
    displayCanvas.addEventListener('click',     handleClick);
    displayCanvas.addEventListener('touchstart',e=>{e.preventDefault();startPaint(t2m(e));},{passive:false});
    displayCanvas.addEventListener('touchmove', e=>{e.preventDefault();doPaint(t2m(e));},{passive:false});
    displayCanvas.addEventListener('touchend',  stopPaint);
  }

  function applyFilters() {
    const b=+( document.getElementById('filterBrightness')?.value||1);
    const c=+( document.getElementById('filterContrast')?.value||1);
    const s=+( document.getElementById('filterSaturation')?.value||1);
    const bl=+(document.getElementById('filterBlur')?.value||0);
    const sep=+(document.getElementById('filterSepia')?.value||0);
    const gr=+( document.getElementById('filterGrayscale')?.value||0);
    displayCanvas.style.filter=`brightness(${b}) contrast(${c}) saturate(${s}) blur(${bl}px) sepia(${sep}) grayscale(${gr})`;
  }

  function applyPreset(preset) {
    const presets={
      vintage:  {filterBrightness:'0.9',filterContrast:'1.1',filterSaturation:'0.7',filterSepia:'0.6',filterBlur:'0',filterGrayscale:'0'},
      bw:       {filterBrightness:'1.1',filterContrast:'1.3',filterSaturation:'0',filterSepia:'0',filterBlur:'0',filterGrayscale:'1'},
      neon:     {filterBrightness:'1.2',filterContrast:'1.4',filterSaturation:'2',filterSepia:'0',filterBlur:'0',filterGrayscale:'0'},
      dreamy:   {filterBrightness:'1.1',filterContrast:'0.85',filterSaturation:'1.3',filterSepia:'0.2',filterBlur:'1',filterGrayscale:'0'},
      reset:    {filterBrightness:'1',filterContrast:'1',filterSaturation:'1',filterSepia:'0',filterBlur:'0',filterGrayscale:'0'},
    };
    const p=presets[preset]; if(!p) return;
    Object.entries(p).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.value=val;});
    applyFilters();
  }

  function t2m(e){const t=e.touches[0];return{clientX:t.clientX,clientY:t.clientY};}

  function getPos(e){
    const r=displayCanvas.getBoundingClientRect();
    return{x:(e.clientX-r.left)*(W/r.width),y:(e.clientY-r.top)*(H/r.height)};
  }

  function inCircle(x,y){return(x-R)**2+(y-R)**2<=R**2;}

  function startPaint(e){
    if(currentTool==='fill'||currentTool==='eyedropper'||addingText) return;
    const{x,y}=getPos(e); if(!inCircle(x,y)) return;
    pushUndo(); painting=true;
    drawCtx.beginPath(); drawCtx.moveTo(x,y);
  }

  function doPaint(e){
    if(!painting) return;
    const{x,y}=getPos(e); if(!inCircle(x,y)){stopPaint();return;}
    drawCtx.globalAlpha=brushOpacity;
    if(currentTool==='eraser'){
      // TRUE eraser: remove paint from drawing layer, revealing bg below
      drawCtx.globalCompositeOperation='destination-out';
      drawCtx.strokeStyle='rgba(0,0,0,1)';
    } else {
      drawCtx.globalCompositeOperation='source-over';
      drawCtx.strokeStyle=brushColor;
    }
    drawCtx.lineWidth=brushSize; drawCtx.lineCap='round'; drawCtx.lineJoin='round';
    drawCtx.lineTo(x,y); drawCtx.stroke();
    drawCtx.beginPath(); drawCtx.moveTo(x,y);
    composite();
  }

  function stopPaint(){
    if(!painting) return;
    painting=false;
    drawCtx.globalCompositeOperation='source-over';
    drawCtx.globalAlpha=1; drawCtx.beginPath();
    composite();
  }

  function handleClick(e){
    const{x,y}=getPos(e); if(!inCircle(x,y)) return;
    if(currentTool==='eyedropper'){
      const px=displayCtx.getImageData(Math.round(x),Math.round(y),1,1).data;
      const hex='#'+[px[0],px[1],px[2]].map(v=>v.toString(16).padStart(2,'0')).join('');
      brushColor=hex;
      const bc=document.getElementById('brushColor');if(bc)bc.value=hex;
      Notify.info('Color picked: '+hex);
      return;
    }
    if(currentTool==='fill'){pushUndo();floodFill(Math.round(x),Math.round(y));return;}
    if(addingText){
      const text=document.getElementById('coverText')?.value?.trim();
      if(!text){addingText=false;return;}
      pushUndo();
      const size=+(document.getElementById('textSize')?.value||28);
      drawCtx.globalAlpha=brushOpacity;
      drawCtx.font=`bold ${size}px "Bebas Neue",sans-serif`;
      drawCtx.fillStyle=brushColor;
      drawCtx.fillText(text,x,y);
      drawCtx.globalAlpha=1;
      composite(); addingText=false; displayCanvas.style.cursor='crosshair';
    }
  }

  function pushUndo(){
    undoStack.push({bg:bgCanvas.toDataURL(),draw:drawCanvas.toDataURL()});
    if(undoStack.length>MAX_UNDO) undoStack.shift();
  }

  function undo(){
    if(undoStack.length<2){Notify.warn('Nothing to undo');return;}
    undoStack.pop();
    const state=undoStack[undoStack.length-1];
    const loadImg=(src,ctx,cb)=>{
      const img=new Image();img.onload=()=>{ctx.clearRect(0,0,W,H);ctx.drawImage(img,0,0);cb&&cb();};img.src=src;
    };
    loadImg(state.bg,bgCtx,()=>loadImg(state.draw,drawCtx,()=>composite()));
  }

  function floodFill(sx,sy){
    // Flood fill on the DRAWING layer
    const id=drawCtx.getImageData(0,0,W,H),d=id.data;
    const i=(sy*W+sx)*4;
    const[tR,tG,tB,tA]=[d[i],d[i+1],d[i+2],d[i+3]];
    const fc=hexToRgb(brushColor); if(!fc) return;
    if(fc.r===tR&&fc.g===tG&&fc.b===tB&&tA===255) return;
    const stack=[[sx,sy]],vis=new Uint8Array(W*H);
    const match=ii=>d[ii]===tR&&d[ii+1]===tG&&d[ii+2]===tB&&d[ii+3]===tA;
    while(stack.length){
      const[x,y]=stack.pop();
      if(x<0||x>=W||y<0||y>=H) continue;
      const pi=y*W+x;if(vis[pi])continue;
      const ii=pi*4;if(!match(ii))continue;
      if(!inCircle(x,y))continue;
      vis[pi]=1;d[ii]=fc.r;d[ii+1]=fc.g;d[ii+2]=fc.b;d[ii+3]=Math.round(brushOpacity*255);
      stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
    }
    drawCtx.putImageData(id,0,0); composite();
  }

  function hexToRgb(hex){const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);return r?{r:parseInt(r[1],16),g:parseInt(r[2],16),b:parseInt(r[3],16)}:null;}

  function loadExistingCover(vinylId){
    const raw=Store.getCover(vinylId);
    const src=typeof raw==='string'?raw:(raw?.src||null);
    if(!src){initBg();drawCtx.clearRect(0,0,W,H);composite();return;}
    const img=new Image();
    img.onload=()=>{
      bgCtx.clearRect(0,0,W,H);
      bgCtx.save();bgCtx.beginPath();bgCtx.arc(R,R,R,0,Math.PI*2);bgCtx.clip();
      bgCtx.drawImage(img,0,0,W,H);bgCtx.restore();drawHole(bgCtx);
      drawCtx.clearRect(0,0,W,H);composite();undoStack=[];pushUndo();
    };
    img.crossOrigin='anonymous'; img.src=src;
  }

  function saveToVinyl(){
    if(!currentVinylId){Notify.error('Select a vinyl first!');return;}
    // Merge bg + draw into final
    const final=document.createElement('canvas');final.width=W;final.height=H;
    const fc=final.getContext('2d');
    fc.drawImage(bgCanvas,0,0); fc.drawImage(drawCanvas,0,0);
    Store.saveCover(currentVinylId,final.toDataURL('image/jpeg',0.9));
    Exhibit.render();
    Notify.success('Cover saved to vinyl!');
    const btn=document.getElementById('saveCover');
    if(btn){btn.textContent='✓ Saved!';btn.style.background='#27ae60';}
    setTimeout(()=>{
      if(btn){btn.textContent='Save to Vinyl';btn.style.background='';}
      App.navigate('exhibit');
    },900);
  }

  function exportPNG(){
    const final=document.createElement('canvas');final.width=W;final.height=H;
    const fc=final.getContext('2d');fc.drawImage(bgCanvas,0,0);fc.drawImage(drawCanvas,0,0);
    const a=document.createElement('a');a.download='vnportal-cover.png';a.href=final.toDataURL('image/png');a.click();
    Notify.success('Cover exported as PNG');
  }

  function onShow(){populateVinylSelect();const cur=Store.getCurrentVinyl();if(cur){currentVinylId=cur.id;loadExistingCover(cur.id);}}
  return{init,onShow,loadExistingCover};
})();
