// ============================================
// VNportal — DJ Mix (Phase 3)
// Uses YouTube IFrame API — no local files needed
// Local files still work as priority source
// ============================================
const DJMix = (() => {
  let ytReady=false;
  const players={A:null, B:null};
  const state={
    A:{playing:false,trackName:'',volume:100,vinylId:null},
    B:{playing:false,trackName:'',volume:100,vinylId:null},
  };
  let crossfade=0.5, tapTimes=[], animFrame=null;

  // ── YouTube API bootstrap ──────────────────
  function loadYTApi(){
    if(window.YT||document.getElementById('ytDjScript')) return;
    const s=document.createElement('script');
    s.id='ytDjScript'; s.src='https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }

  window.onYouTubeIframeAPIReady=function(){
    ytReady=true;
    ['A','B'].forEach(id=>{
      const containerId=`ytDeck${id}`;
      let el=document.getElementById(containerId);
      if(!el){
        el=document.createElement('div'); el.id=containerId;
        document.body.appendChild(el);
      }
      players[id]=new YT.Player(containerId,{
        width:'1', height:'1',
        playerVars:{autoplay:0,controls:0,rel:0,enablejsapi:1},
        events:{
          onStateChange: e=>onStateChange(id,e),
          onError: e=>{ Notify.warn(`Deck ${id}: YouTube error — try another track`); },
        }
      });
    });
  };

  function onStateChange(id, e){
    // 1=playing, 2=paused, 0=ended
    if(e.data===YT.PlayerState.PLAYING){
      state[id].playing=true;
      updateDeckUI(id,true);
      applyCrossfade();
    } else if(e.data===YT.PlayerState.PAUSED||e.data===YT.PlayerState.ENDED){
      state[id].playing=false;
      updateDeckUI(id,false);
    }
  }

  function init(){ loadYTApi(); populateDecks(); bindControls(); startVisualizer(); }

  function populateDecks(){
    const{vinyls}=Store.get();
    ['A','B'].forEach(id=>{
      const sel=document.getElementById(`deck${id}Select`); if(!sel) return;
      sel.innerHTML='<option value="">— Load track —</option>';
      vinyls.forEach(v=>(v.tracks||[]).forEach((t,ti)=>{
        const o=document.createElement('option');
        o.value=`${v.id}:${ti}`;
        o.textContent=`${t.title} — ${t.artist}`;
        sel.appendChild(o);
      }));
    });
  }

  function bindControls(){
    ['A','B'].forEach(id=>{
      document.getElementById(`deck${id}Select`)?.addEventListener('change',e=>loadDeck(id,e.target.value));
      document.getElementById(`deck${id}Play`)?.addEventListener('click',()=>toggleDeck(id));
      document.getElementById(`deck${id}Cue`)?.addEventListener('click',()=>cue(id));
      document.getElementById(`deck${id}Speed`)?.addEventListener('input',e=>{
        // YouTube doesn't support speed via IFrame API directly, show info
        Notify.info(`Speed control requires local files. YouTube playback is fixed rate.`);
      });
    });
    document.getElementById('crossfader')?.addEventListener('input',e=>{crossfade=+e.target.value;applyCrossfade();});
    document.getElementById('masterVol')?.addEventListener('input',e=>{
      const vol=+e.target.value*100;
      ['A','B'].forEach(id=>{try{players[id]?.setVolume?.(vol*getCrossfadeVol(id));}catch{}});
    });
    document.getElementById('tapBpmBtn')?.addEventListener('click',tapBpm);
    document.getElementById('djExportBtn')?.addEventListener('click',exportMix);
  }

  async function loadDeck(id, value){
    if(!value) return;
    const[vinylId,tiStr]=value.split(':'); const ti=parseInt(tiStr);
    const vinyl=Store.getVinyl(vinylId); if(!vinyl) return;
    const track=vinyl.tracks?.[ti]; if(!track) return;

    state[id].trackName=`${track.title} — ${track.artist}`;
    state[id].vinylId=vinylId;
    document.getElementById(`deck${id}TitleDisp`).textContent=track.title;
    document.getElementById(`deck${id}ArtistDisp`).textContent=track.artist;

    // Cover on disc
    const cover=Store.getCover(vinylId);
    const coverSrc=typeof cover==='string'?cover:(cover?.src||null);
    const disc=document.getElementById(`disc${id}`);
    if(disc&&coverSrc){disc.style.backgroundImage=`url(${coverSrc})`;disc.style.backgroundSize='cover';}

    const loader=Notify.loading(`Loading "${track.title}" onto Deck ${id}...`);

    // Priority: local file → stored YouTube ID → auto-search YouTube
    let loaded=false;

    // 1. Try local file (uses Web Audio)
    if(typeof DB!=='undefined'){
      const key=DB.trackKey(vinylId,ti);
      const hasLocal=await DB.hasFile(key).catch(()=>false);
      if(hasLocal){
        // For local files, use a hidden <audio> element connected to Web Audio
        const url=await DB.getFileURL(key);
        loadLocalOnDeck(id,url,track.title);
        Notify.dismiss(loader);
        Notify.success(`Deck ${id}: "${track.title}" loaded (local)`);
        loaded=true;
      }
    }

    // 2. Try stored YouTube ID/URL
    if(!loaded&&track.youtubeId){
      loadYouTubeOnDeck(id,track.youtubeId);
      Notify.dismiss(loader);
      Notify.success(`Deck ${id}: "${track.title}" loaded`);
      loaded=true;
    }
    if(!loaded&&track.youtubeUrl){
      const ytId=extractYTId(track.youtubeUrl);
      if(ytId){
        loadYouTubeOnDeck(id,ytId);
        Notify.dismiss(loader);
        Notify.success(`Deck ${id}: "${track.title}" loaded`);
        loaded=true;
      }
    }

    // 3. Auto-search YouTube by track name
    if(!loaded){
      const query=encodeURIComponent(`${track.title} ${track.artist} official audio`);
      Notify.dismiss(loader);
      // Show YouTube search link — user picks the right one and pastes the URL
      showYTLinkPrompt(id, track, vinylId, ti);
    }
  }

  function loadYouTubeOnDeck(id, videoId){
    if(!ytReady||!players[id]){
      setTimeout(()=>loadYouTubeOnDeck(id,videoId),800); return;
    }
    try{ players[id].cueVideoById(videoId); }catch(e){ Notify.error(`Deck ${id}: Could not load YouTube video`); }
    document.getElementById(`deck${id}TitleDisp`).textContent=
      document.getElementById(`deck${id}TitleDisp`).textContent.replace(' (no local file)','');
  }

  function loadLocalOnDeck(id, blobUrl, title){
    // Store local audio in state — will use when play is pressed
    state[id].localUrl=blobUrl;
    state[id].useLocal=true;
    if(!state[id].localAudio){
      state[id].localAudio=new Audio();
      state[id].localAudio.addEventListener('ended',()=>stopDeck(id));
    }
    state[id].localAudio.src=blobUrl;
  }

  function showYTLinkPrompt(id, track, vinylId, ti){
    const query=encodeURIComponent(`${track.title} ${track.artist}`);
    const ytSearch=`https://music.youtube.com/search?q=${query}`;

    // In-page prompt
    const existing=document.getElementById('djYtPrompt');
    if(existing) existing.remove();
    const el=document.createElement('div');
    el.id='djYtPrompt';
    el.style.cssText='position:fixed;top:80px;right:1.5rem;z-index:8000;background:var(--surface);border:1px solid var(--accent);padding:1.25rem;width:340px;box-shadow:0 8px 32px rgba(0,0,0,.6)';
    el.innerHTML=`
      <div style="font-family:var(--font-d);font-size:1.1rem;color:var(--accent);margin-bottom:.5rem">Link YouTube — Deck ${id}</div>
      <div style="font-size:.72rem;color:var(--text-dim);margin-bottom:.75rem">No stored YouTube link for "<b style="color:var(--text)">${esc(track.title)}</b>". Find it on YouTube Music and paste the URL:</div>
      <input type="text" id="djYtUrl" placeholder="https://youtube.com/watch?v=..." style="width:100%;background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:.6rem .75rem;font-family:var(--font-m);font-size:.78rem;outline:none;margin-bottom:.5rem"/>
      <div style="display:flex;gap:.5rem">
        <a href="${ytSearch}" target="_blank" class="btn-secondary" style="flex:1;text-decoration:none;text-align:center;font-size:.7rem;padding:.45rem">🔍 Search YouTube</a>
        <button class="btn-primary" id="djYtLoad" style="flex:1;font-size:.7rem">Load on Deck ${id}</button>
      </div>
      <button onclick="this.parentElement.remove()" style="position:absolute;top:.75rem;right:.75rem;background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:.9rem">✕</button>
    `;
    document.body.appendChild(el);
    document.getElementById('djYtUrl')?.focus();
    document.getElementById('djYtLoad')?.addEventListener('click',()=>{
      const url=document.getElementById('djYtUrl')?.value?.trim();
      const ytId=url?extractYTId(url):null;
      if(!ytId){Notify.error('Invalid YouTube URL');return;}
      // Save to track
      const vinyl=Store.getVinyl(vinylId);
      if(vinyl?.tracks?.[ti]){vinyl.tracks[ti].youtubeId=ytId;Store.updateVinyl(vinylId,{tracks:vinyl.tracks});}
      loadYouTubeOnDeck(id,ytId);
      Notify.success(`Deck ${id}: track linked and loaded!`);
      el.remove();
    });
    document.getElementById('djYtUrl')?.addEventListener('keydown',e=>{
      if(e.key==='Enter') document.getElementById('djYtLoad')?.click();
    });
  }

  function toggleDeck(id){
    const s=state[id];
    const btn=document.getElementById(`deck${id}Play`);

    if(s.useLocal&&s.localAudio){
      // Local audio playback
      if(s.playing){ s.localAudio.pause(); }
      else { s.localAudio.play().catch(()=>Notify.error(`Deck ${id}: Could not play audio`)); }
      s.playing=!s.playing;
      updateDeckUI(id,s.playing);
    } else {
      // YouTube playback
      if(!ytReady||!players[id]){Notify.warn('YouTube player not ready yet — wait a moment');return;}
      try{
        if(s.playing){ players[id].pauseVideo(); }
        else { players[id].playVideo(); }
      }catch(e){
        Notify.error(`Deck ${id}: Load a track first`);
        return;
      }
    }
    applyCrossfade();
    updateScreenText();
  }

  function cue(id){
    if(state[id].useLocal&&state[id].localAudio){
      state[id].localAudio.currentTime=0;
    } else {
      try{players[id]?.seekTo?.(0,true);}catch{}
    }
  }

  function stopDeck(id){
    state[id].playing=false;
    updateDeckUI(id,false);
  }

  function updateDeckUI(id,playing){
    const btn=document.getElementById(`deck${id}Play`);
    if(btn){btn.textContent=playing?'⏸':'▶';btn.classList.toggle('active',playing);}
    document.getElementById(`disc${id}`)?.classList.toggle('playing',playing);
    document.getElementById(`arm${id}`)?.classList.toggle('playing',playing);
  }

  function getCrossfadeVol(id){
    // Crossfade: 0=full A, 1=full B
    if(id==='A') return Math.cos(crossfade*Math.PI/2);
    return Math.cos((1-crossfade)*Math.PI/2);
  }

  function applyCrossfade(){
    const masterVol=+( document.getElementById('masterVol')?.value||0.8)*100;
    ['A','B'].forEach(id=>{
      const vol=Math.round(getCrossfadeVol(id)*masterVol);
      state[id].volume=vol;
      if(state[id].useLocal&&state[id].localAudio){
        state[id].localAudio.volume=vol/100;
      } else {
        try{players[id]?.setVolume?.(vol);}catch{}
      }
    });
  }

  function updateScreenText(){
    const screen=document.getElementById('djScreenText'); if(!screen) return;
    const playing=[state.A,state.B].filter(s=>s.playing).map(s=>s.trackName);
    screen.textContent=playing[0]||'VNportal DJ';
  }

  function tapBpm(){
    tapTimes.push(Date.now()); if(tapTimes.length>8) tapTimes.shift();
    if(tapTimes.length>=2){
      const avg=tapTimes.slice(1).map((t,i)=>t-tapTimes[i]).reduce((a,b)=>a+b)/(tapTimes.length-1);
      document.getElementById('bpmDisplay').textContent=Math.round(60000/avg)+' BPM';
    }
  }

  function exportMix(){
    const tracks=[];
    if(state.A.trackName) tracks.push(`Deck A: ${state.A.trackName}`);
    if(state.B.trackName) tracks.push(`Deck B: ${state.B.trackName}`);
    if(!tracks.length){Notify.warn('Load tracks first!');return;}
    const text=`VNportal DJ Mix\n${new Date().toLocaleDateString()}\n\n${tracks.join('\n')}\n\nhttps://github.com/huangd-816/VNportal`;
    const blob=new Blob([text],{type:'text/plain'});
    const a=document.createElement('a'); a.download='vnportal-mix.txt'; a.href=URL.createObjectURL(blob); a.click();
    Notify.success('Mix exported!');
    if(navigator.share) navigator.share({title:'My VNportal Mix',text,url:'https://github.com/huangd-816/VNportal'}).catch(()=>{});
  }

  function startVisualizer(){
    const canvasA=document.getElementById('vuCanvasA'), canvasB=document.getElementById('vuCanvasB');
    if(!canvasA||!canvasB) return;
    const ctxA=canvasA.getContext('2d'), ctxB=canvasB.getContext('2d');
    function tick(){
      [['A',ctxA,canvasA],['B',ctxB,canvasB]].forEach(([id,c,cv])=>{
        const playing=state[id].playing;
        c.clearRect(0,0,cv.width,cv.height);
        const bars=12;
        for(let i=0;i<bars;i++){
          const h=playing?(0.2+Math.random()*0.8)*cv.height:4;
          const hue=id==='A'?240+i*5:140+i*5;
          c.fillStyle=`hsl(${hue},80%,55%)`;
          c.fillRect(i*(cv.width/bars)+1,cv.height-h,(cv.width/bars)-2,h);
        }
      });
      animFrame=requestAnimationFrame(tick);
    }
    tick();
  }

  function extractYTId(url){
    const m=url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
    return m?m[1]:null;
  }

  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  function onShow(){ populateDecks(); }
  return{init,onShow};
})();
