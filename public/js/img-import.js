// ============================================
// VNportal — Image Import with Preview/Crop
// Supports: image, gif, video frame, memes
// ============================================
const ImgImport = (() => {
  let sourceImg=null, sourceVideo=null;
  let rotation=0, scale=1, panX=0, panY=0;
  let isDragging=false, dragStart={x:0,y:0};
  let onConfirmCb=null;
  let previewCanvas, previewCtx;

  function open(callback){
    onConfirmCb=callback;
    rotation=0; scale=1; panX=0; panY=0;
    sourceImg=null; sourceVideo=null;

    let overlay=document.getElementById('imgImportOverlay');
    if(!overlay){
      overlay=document.createElement('div');
      overlay.id='imgImportOverlay';
      overlay.className='img-import-overlay';
      overlay.innerHTML=`
        <div class="img-import-modal">
          <div class="img-import-header">
            <span class="img-import-title">Import Image</span>
            <button class="img-import-close" id="imgImportClose">✕</button>
          </div>

          <!-- Step 1: choose source -->
          <div id="imgImportStep1" class="img-import-step">
            <div class="img-drop-zone" id="imgDropZone">
              <div class="img-drop-icon">⬆</div>
              <div class="img-drop-text">Drop file here or click to browse</div>
              <div class="img-drop-sub">Images · GIFs · Videos · Memes</div>
              <input type="file" id="imgFileInput" accept="image/*,image/gif,video/*" style="display:none"/>
            </div>
            <div class="img-import-sources">
              <button class="img-src-btn" id="imgFromUrl">🔗 Paste URL</button>
              <button class="img-src-btn" id="imgFromMeme">😂 Meme Library</button>
              <button class="img-src-btn" id="imgFromVideo">🎬 Video Frame</button>
            </div>
            <div class="img-url-row hidden" id="imgUrlRow">
              <input type="text" id="imgUrlInput" placeholder="https://..." class="img-url-input"/>
              <button class="btn-primary" id="imgUrlLoad" style="font-size:.72rem;padding:.5rem .9rem">Load</button>
            </div>
          </div>

          <!-- Step 2: preview & adjust -->
          <div id="imgImportStep2" class="img-import-step hidden">
            <div class="img-preview-wrap">
              <canvas id="imgPreviewCanvas" width="400" height="400"></canvas>
              <div class="img-preview-hint">Drag to pan · Scroll to zoom</div>
            </div>
            <!-- Video frame scrubber -->
            <div class="img-video-controls hidden" id="imgVideoControls">
              <label style="font-size:.65rem;color:var(--text-dim)">Video frame:</label>
              <input type="range" id="imgVideoScrub" min="0" max="100" value="0" step="0.1" style="flex:1;accent-color:var(--accent)"/>
              <span id="imgVideoTime" style="font-size:.65rem;color:var(--text-dim)">0.0s</span>
            </div>
            <!-- Controls -->
            <div class="img-controls">
              <div class="img-ctrl-group">
                <label>Rotate</label>
                <div style="display:flex;gap:.35rem">
                  <button class="img-ctrl-btn" id="imgRotL">↺ -90°</button>
                  <button class="img-ctrl-btn" id="imgRotR">↻ +90°</button>
                </div>
              </div>
              <div class="img-ctrl-group">
                <label>Zoom</label>
                <input type="range" id="imgZoomSlider" min="0.1" max="5" step="0.05" value="1" style="accent-color:var(--accent);width:120px"/>
                <span id="imgZoomVal" style="font-size:.65rem;color:var(--text-dim);min-width:2.5rem">100%</span>
              </div>
              <div class="img-ctrl-group">
                <button class="img-ctrl-btn" id="imgResetView">⊙ Reset</button>
                <button class="img-ctrl-btn" id="imgFlipH">↔ Flip H</button>
                <button class="img-ctrl-btn" id="imgFlipV">↕ Flip V</button>
              </div>
            </div>
            <div class="img-import-footer">
              <button class="btn-secondary" id="imgImportBack">← Back</button>
              <button class="btn-primary" id="imgImportConfirm">✓ Import to Canvas</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      bindEvents(overlay);
    }
    overlay.style.display='flex';
    showStep(1);
  }

  function bindEvents(overlay){
    document.getElementById('imgImportClose').onclick=close;
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});

    // Drop zone
    const dropZone=document.getElementById('imgDropZone');
    const fileInput=document.getElementById('imgFileInput');
    dropZone.addEventListener('click',()=>fileInput.click());
    dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('drag-over');});
    dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop',e=>{
      e.preventDefault(); dropZone.classList.remove('drag-over');
      const file=e.dataTransfer.files[0]; if(file) loadFile(file);
    });
    fileInput.addEventListener('change',e=>{if(e.target.files[0])loadFile(e.target.files[0]);});

    // URL
    document.getElementById('imgFromUrl').onclick=()=>{
      document.getElementById('imgUrlRow').classList.toggle('hidden');
    };
    document.getElementById('imgUrlLoad').onclick=()=>{
      const url=document.getElementById('imgUrlInput').value.trim();
      if(url) loadURL(url);
    };
    document.getElementById('imgUrlInput').addEventListener('keydown',e=>{
      if(e.key==='Enter') document.getElementById('imgUrlLoad').click();
    });

    // Meme library
    document.getElementById('imgFromMeme').onclick=()=>showMemeLibrary();

    // Video frame
    document.getElementById('imgFromVideo').onclick=()=>{
      fileInput.setAttribute('accept','video/*');
      fileInput.click();
      fileInput.setAttribute('accept','image/*,image/gif,video/*');
    };

    // Step 2 controls
    document.getElementById('imgRotL').onclick=()=>{rotation=(rotation-90+360)%360;redraw();};
    document.getElementById('imgRotR').onclick=()=>{rotation=(rotation+90)%360;redraw();};
    document.getElementById('imgFlipH').onclick=()=>{scale*=-1;redraw();};
    document.getElementById('imgFlipV').onclick=()=>{scale=Math.abs(scale);/*simplified*/redraw();};
    document.getElementById('imgResetView').onclick=()=>{rotation=0;scale=1;panX=0;panY=0;document.getElementById('imgZoomSlider').value=1;document.getElementById('imgZoomVal').textContent='100%';redraw();};
    document.getElementById('imgZoomSlider').oninput=e=>{
      scale=+e.target.value;
      document.getElementById('imgZoomVal').textContent=Math.round(scale*100)+'%';
      redraw();
    };

    // Pan
    const pc=document.getElementById('imgPreviewCanvas');
    pc.addEventListener('mousedown',e=>{isDragging=true;dragStart={x:e.clientX-panX,y:e.clientY-panY};});
    pc.addEventListener('mousemove',e=>{if(!isDragging)return;panX=e.clientX-dragStart.x;panY=e.clientY-dragStart.y;redraw();});
    pc.addEventListener('mouseup',()=>isDragging=false);
    pc.addEventListener('mouseleave',()=>isDragging=false);
    pc.addEventListener('wheel',e=>{
      e.preventDefault();
      scale=Math.max(0.1,Math.min(5,scale-(e.deltaY>0?0.1:-0.1)));
      document.getElementById('imgZoomSlider').value=scale;
      document.getElementById('imgZoomVal').textContent=Math.round(scale*100)+'%';
      redraw();
    },{passive:false});

    // Video scrub
    document.getElementById('imgVideoScrub').oninput=e=>{
      if(!sourceVideo) return;
      const t=(+e.target.value/100)*sourceVideo.duration;
      sourceVideo.currentTime=t;
      document.getElementById('imgVideoTime').textContent=t.toFixed(1)+'s';
    };
    if(sourceVideo){
      sourceVideo.addEventListener('seeked',redraw);
    }

    // Back/confirm
    document.getElementById('imgImportBack').onclick=()=>showStep(1);
    document.getElementById('imgImportConfirm').onclick=confirm;
  }

  function loadFile(file){
    if(file.type.startsWith('video/')){
      const url=URL.createObjectURL(file);
      const video=document.createElement('video');
      video.src=url; video.muted=true;
      video.addEventListener('loadeddata',()=>{
        sourceVideo=video; sourceImg=null;
        document.getElementById('imgVideoControls').classList.remove('hidden');
        document.getElementById('imgVideoScrub').value=0;
        showStep(2); scale=1; panX=0; panY=0; rotation=0; redraw();
        video.addEventListener('seeked',redraw);
      });
      video.load();
    } else {
      const url=URL.createObjectURL(file);
      loadImgFromSrc(url, true);
    }
  }

  function loadURL(url){
    // For GIFs and external images
    loadImgFromSrc(url, false);
  }

  function loadImgFromSrc(src, revoke){
    const img=new Image();
    img.crossOrigin='anonymous';
    img.onload=()=>{
      sourceImg=img; sourceVideo=null;
      document.getElementById('imgVideoControls').classList.add('hidden');
      showStep(2); scale=1; panX=0; panY=0; rotation=0; redraw();
      if(revoke) setTimeout(()=>URL.revokeObjectURL(src),60000);
    };
    img.onerror=()=>Notify.error('Could not load image. Try downloading and uploading instead.');
    img.src=src;
  }

  function showMemeLibrary(){
    // Popular meme templates via imgflip's API (free)
    const memes=[
      {name:'Drake',url:'https://i.imgflip.com/30b1gx.jpg'},
      {name:'Distracted BF',url:'https://i.imgflip.com/1ur9b0.jpg'},
      {name:'Two Buttons',url:'https://i.imgflip.com/1g8my4.jpg'},
      {name:'Change My Mind',url:'https://i.imgflip.com/24y43o.jpg'},
      {name:'This Is Fine',url:'https://i.imgflip.com/wxica.jpg'},
      {name:'Bernie',url:'https://i.imgflip.com/4t0m5.jpg'},
      {name:'Surprised Pikachu',url:'https://i.imgflip.com/2kbn1e.jpg'},
      {name:'Expanding Brain',url:'https://i.imgflip.com/1jwhww.jpg'},
    ];
    const step1=document.getElementById('imgImportStep1');
    let memeGrid=document.getElementById('memeGrid');
    if(!memeGrid){
      memeGrid=document.createElement('div');
      memeGrid.id='memeGrid';
      memeGrid.className='meme-grid';
      memeGrid.innerHTML=memes.map(m=>`
        <div class="meme-item" data-url="${m.url}" title="${m.name}">
          <img src="${m.url}" alt="${m.name}" crossorigin="anonymous"/>
          <span>${m.name}</span>
        </div>
      `).join('');
      step1.appendChild(memeGrid);
      memeGrid.querySelectorAll('.meme-item').forEach(item=>{
        item.addEventListener('click',()=>loadURL(item.dataset.url));
      });
    }
    memeGrid.style.display=memeGrid.style.display==='grid'?'none':'grid';
  }

  function showStep(n){
    document.getElementById('imgImportStep1').classList.toggle('hidden',n!==1);
    document.getElementById('imgImportStep2').classList.toggle('hidden',n!==2);
    if(n===2){
      previewCanvas=document.getElementById('imgPreviewCanvas');
      previewCtx=previewCanvas.getContext('2d');
    }
  }

  function redraw(){
    if(!previewCtx) return;
    const W=previewCanvas.width, H=previewCanvas.height;
    const source=sourceVideo||sourceImg;
    if(!source) return;

    previewCtx.clearRect(0,0,W,H);
    // Checkered background
    for(let y=0;y<H;y+=20) for(let x=0;x<W;x+=20){
      previewCtx.fillStyle=(x/20+y/20)%2===0?'#1a1a1a':'#222';
      previewCtx.fillRect(x,y,20,20);
    }

    previewCtx.save();
    previewCtx.translate(W/2+panX, H/2+panY);
    previewCtx.rotate(rotation*Math.PI/180);
    previewCtx.scale(scale,scale);

    const sw=sourceVideo?sourceVideo.videoWidth:(source.naturalWidth||source.width);
    const sh=sourceVideo?sourceVideo.videoHeight:(source.naturalHeight||source.height);
    const aspect=sw/sh;
    let dw=280, dh=280/aspect;
    if(dh>280){dh=280;dw=280*aspect;}

    previewCtx.drawImage(source,-dw/2,-dh/2,dw,dh);
    previewCtx.restore();

    // Circular clip indicator
    previewCtx.beginPath();
    previewCtx.arc(W/2,H/2,W/2-2,0,Math.PI*2);
    previewCtx.strokeStyle='rgba(245,197,24,0.4)';
    previewCtx.lineWidth=2;
    previewCtx.stroke();
  }

  function confirm(){
    if(!onConfirmCb) return;
    // Export current view to 500x500 for cover canvas
    const out=document.createElement('canvas'); out.width=500; out.height=500;
    const octx=out.getContext('2d');
    const source=sourceVideo||sourceImg; if(!source) return;

    octx.save();
    octx.translate(250,250);
    octx.rotate(rotation*Math.PI/180);
    octx.scale(scale,scale);
    const sw=sourceVideo?sourceVideo.videoWidth:(source.naturalWidth||source.width);
    const sh=sourceVideo?sourceVideo.videoHeight:(source.naturalHeight||source.height);
    const aspect=sw/sh;
    let dw=350, dh=350/aspect;
    if(dh>350){dh=350;dw=350*aspect;}
    // Apply pan
    octx.translate(panX*(500/400), panY*(500/400));
    octx.drawImage(source,-dw/2,-dh/2,dw,dh);
    octx.restore();

    onConfirmCb(out);
    close();
  }

  function close(){
    const overlay=document.getElementById('imgImportOverlay');
    if(overlay) overlay.style.display='none';
  }

  return{open};
})();
