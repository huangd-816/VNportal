// ============================================
// VNportal — DJ Mix
// Jamendo API — free in-browser streaming
// No external apps, real Web Audio crossfader
// Get a free client_id at devportal.jamendo.com
// ============================================
const DJMix = (() => {
  // ⚠️ Replace with your free Jamendo client_id from devportal.jamendo.com
  const JAMENDO_ID = '9b0a3bf0';
  const JAMENDO    = 'https://api.jamendo.com/v3.0';

  let audioCtx = null, masterGain = null;
  const decks = {
    A: { audio:null, source:null, gainNode:null, playing:false, trackName:'', url:null },
    B: { audio:null, source:null, gainNode:null, playing:false, trackName:'', url:null },
  };
  let crossfade=0.5, tapTimes=[], animFrame=null;

  function ensureCtx(){
    if(audioCtx) return;
    audioCtx  = new(window.AudioContext||window.webkitAudioContext)();
    masterGain = audioCtx.createGain(); masterGain.gain.value=0.8;
    masterGain.connect(audioCtx.destination);
    ['A','B'].forEach(id=>{
      decks[id].gainNode = audioCtx.createGain();
      decks[id].gainNode.connect(masterGain);
    });
  }

  function init(){ populateDecks(); bindControls(); startVisualizer(); }

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
      document.getElementById(`deck${id}Cue`)?.addEventListener('click',()=>cueDeck(id));
      document.getElementById(`deck${id}Speed`)?.addEventListener('input',e=>{
        if(decks[id].audio) decks[id].audio.playbackRate=+e.target.value;
      });
    });
    document.getElementById('crossfader')?.addEventListener('input',e=>{
      crossfade=+e.target.value; applyCrossfade();
    });
    document.getElementById('masterVol')?.addEventListener('input',e=>{
      ensureCtx(); if(masterGain) masterGain.gain.value=+e.target.value;
    });
    document.getElementById('tapBpmBtn')?.addEventListener('click',tapBpm);
    document.getElementById('djExportBtn')?.addEventListener('click',exportMix);
    ['Hi','Mid','Lo'].forEach(band=>{
      ['A','B'].forEach(id=>{
        document.getElementById(`deck${id}${band}`)?.addEventListener('input',()=>{
          Notify.info('EQ requires local files. Jamendo streams have fixed EQ.');
        });
      });
    });
  }

  async function loadDeck(id, value){
    if(!value) return;
    const[vinylId,tiStr]=value.split(':'); const ti=parseInt(tiStr);
    const vinyl=Store.getVinyl(vinylId); if(!vinyl) return;
    const track=vinyl.tracks?.[ti]; if(!track) return;

    decks[id].trackName=`${track.title} — ${track.artist}`;
    document.getElementById(`deck${id}TitleDisp`).textContent=track.title;
    document.getElementById(`deck${id}ArtistDisp`).textContent=track.artist;

    // Cover on disc
    const cover=Store.getCover(vinylId);
    const coverSrc=typeof cover==='string'?cover:(cover?.src||null);
    const disc=document.getElementById(`disc${id}`);
    if(disc&&coverSrc){ disc.style.backgroundImage=`url(${coverSrc})`; disc.style.backgroundSize='cover'; }

    const wrap=document.getElementById(`deck${id}SpotifyEmbed`);
    if(wrap) wrap.innerHTML='';

    const loader=Notify.loading(`Searching for "${track.title}"...`);

    // 1. Try local file first
    if(typeof DB!=='undefined'){
      const key=DB.trackKey(vinylId,ti);
      const hasLocal=await DB.hasFile(key).catch(()=>false);
      if(hasLocal){
        const url=await DB.getFileURL(key);
        Notify.dismiss(loader);
        setAudioSource(id, url, 'local');
        showDeckStatus(id, wrap, `📁 Local file loaded`, '#27ae60');
        return;
      }
    }

    // 2. Search Jamendo
    try{
      const q=encodeURIComponent(track.title);
      const artist=encodeURIComponent(track.artist||'');
      // Try exact name first, then broader search
      let url=`${JAMENDO}/tracks/?client_id=${JAMENDO_ID}&format=json&limit=5&namesearch=${q}&audioformat=mp32`;
      let res=await fetch(url);
      let data=await res.json();
      let results=data.results||[];

      // If no results, try searching just by name
      if(!results.length){
        url=`${JAMENDO}/tracks/?client_id=${JAMENDO_ID}&format=json&limit=5&search=${q}&audioformat=mp32`;
        res=await fetch(url);
        data=await res.json();
        results=data.results||[];
      }

      Notify.dismiss(loader);

      if(results.length){
        const t2=results[0];
        const streamUrl=t2.audio; // direct mp3 stream
        setAudioSource(id, streamUrl, 'jamendo');
        showDeckResults(id, wrap, results, t2);
        Notify.success(`Deck ${id}: Found "${t2.name}" by ${t2.artist_name} on Jamendo`);
      } else {
        Notify.dismiss(loader);
        showNoResults(id, wrap, track);
      }
    } catch(e){
      Notify.dismiss(loader);
      Notify.error(`Deck ${id}: Could not reach Jamendo — check connection`);
      showNoResults(id, wrap, track);
    }
  }

  function setAudioSource(id, url, source){
    ensureCtx();
    const d=decks[id];
    // Stop existing
    if(d.audio){ d.audio.pause(); d.audio=null; }
    if(d.source){ try{d.source.disconnect();}catch{} d.source=null; }

    d.url=url;
    const audio=new Audio();
    audio.crossOrigin='anonymous';
    audio.src=url;
    audio.preload='auto';
    audio.addEventListener('ended',()=>stopDeck(id));
    audio.addEventListener('error',e=>{
      Notify.error(`Deck ${id}: Stream error — try another track`);
      stopDeck(id);
    });
    d.audio=audio;
    d.source=source; // keep track of source type

    // Connect to Web Audio for crossfading
    try{
      const mediaSource=audioCtx.createMediaElementSource(audio);
      mediaSource.connect(d.gainNode);
      d.source=mediaSource;
    }catch(e){
      // Already connected or CORS issue - fall back to direct audio
      audio.volume=0.8;
    }
    applyCrossfade();
  }

  function showDeckResults(id, wrap, results, selected){
    if(!wrap) return;
    wrap.style.display='block';
    wrap.innerHTML=`
      <div class="dj-jamendo-result">
        <div class="dj-jam-track-info">
          ${selected.image?`<img src="${selected.image}" class="dj-jam-art"/>`:
            `<div class="dj-jam-art-placeholder">♫</div>`}
          <div>
            <div class="dj-jam-name">${esc(selected.name)}</div>
            <div class="dj-jam-artist">${esc(selected.artist_name)}</div>
            <div class="dj-jam-source">Jamendo · CC Licensed</div>
          </div>
        </div>
        ${results.length>1?`
        <div class="dj-jam-alts">
          <span style="font-size:.6rem;color:var(--text-dim)">Other results:</span>
          ${results.slice(1,4).map((t,i)=>`
            <button class="dj-jam-alt-btn" data-url="${t.audio}" data-name="${esc(t.name)}" data-artist="${esc(t.artist_name)}">
              ${esc(t.name)} — ${esc(t.artist_name)}
            </button>
          `).join('')}
        </div>
        `:''}
      </div>
    `;
    // Wire alt buttons
    wrap.querySelectorAll('.dj-jam-alt-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        setAudioSource(id,btn.dataset.url,'jamendo');
        document.getElementById(`deck${id}TitleDisp`).textContent=btn.dataset.name;
        document.getElementById(`deck${id}ArtistDisp`).textContent=btn.dataset.artist;
        decks[id].trackName=`${btn.dataset.name} — ${btn.dataset.artist}`;
        Notify.info(`Deck ${id}: Switched to "${btn.dataset.name}"`);
      });
    });
  }

  function showNoResults(id, wrap, track){
    if(!wrap) return;
    wrap.style.display='block';
    const q=encodeURIComponent(`${track.title} ${track.artist||''}`);
    wrap.innerHTML=`
      <div class="dj-jamendo-result" style="border-color:var(--accent2)">
        <div style="font-size:.72rem;color:var(--accent2);margin-bottom:.5rem">
          ⚠ No Jamendo match for "${esc(track.title)}"
        </div>
        <div style="font-size:.65rem;color:var(--text-dim);margin-bottom:.65rem">
          Jamendo has CC-licensed music. Try uploading the track as a local file in DIY Vinyl.
        </div>
        <a href="https://www.jamendo.com/search?q=${q}" target="_blank" 
           class="btn-secondary" style="font-size:.68rem;display:block;text-align:center;text-decoration:none">
          Browse Jamendo ↗
        </a>
      </div>
    `;
  }

  function showDeckStatus(id, wrap, msg, color){
    if(!wrap) return;
    wrap.style.display='block';
    wrap.innerHTML=`<div style="padding:.6rem .75rem;border:1px solid ${color};font-size:.72rem;color:${color};border-radius:2px">${msg}</div>`;
  }

  function toggleDeck(id){
    const d=decks[id];
    if(!d.audio||!d.url){ Notify.warn(`Deck ${id}: Load a track first`); return; }
    ensureCtx();
    if(audioCtx.state==='suspended') audioCtx.resume();
    if(d.playing){
      d.audio.pause(); d.playing=false; stopDeck(id);
    } else {
      d.audio.play().then(()=>{
        d.playing=true; updateDeckUI(id,true); applyCrossfade();
        document.getElementById('djScreenText').textContent=d.trackName;
      }).catch(e=>{
        Notify.error(`Deck ${id}: Playback blocked — click play again after interacting`);
      });
    }
  }

  function cueDeck(id){
    if(decks[id].audio) decks[id].audio.currentTime=0;
  }

  function stopDeck(id){
    decks[id].playing=false; updateDeckUI(id,false);
  }

  function updateDeckUI(id,playing){
    const btn=document.getElementById(`deck${id}Play`);
    if(btn){ btn.textContent=playing?'⏸':'▶'; btn.classList.toggle('active',playing); }
    document.getElementById(`disc${id}`)?.classList.toggle('playing',playing);
    document.getElementById(`arm${id}`)?.classList.toggle('playing',playing);
  }

  function applyCrossfade(){
    ensureCtx();
    const volA=Math.cos(crossfade*Math.PI/2);
    const volB=Math.cos((1-crossfade)*Math.PI/2);
    decks.A.gainNode?.gain.setTargetAtTime(volA,audioCtx.currentTime,.02);
    decks.B.gainNode?.gain.setTargetAtTime(volB,audioCtx.currentTime,.02);
    // Also set direct audio volume as fallback
    if(decks.A.audio) decks.A.audio.volume=volA;
    if(decks.B.audio) decks.B.audio.volume=volB;
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
    if(decks.A.trackName) tracks.push(`Deck A: ${decks.A.trackName}`);
    if(decks.B.trackName) tracks.push(`Deck B: ${decks.B.trackName}`);
    if(!tracks.length){Notify.warn('Load tracks first!');return;}
    const text=`VNportal DJ Mix\n${new Date().toLocaleDateString()}\n\n${tracks.join('\n')}\n\nhttps://github.com/huangd-816/VNportal`;
    const blob=new Blob([text],{type:'text/plain'});
    const a=document.createElement('a'); a.download='vnportal-mix.txt'; a.href=URL.createObjectURL(blob); a.click();
    Notify.success('Mix exported!');
    if(navigator.share) navigator.share({title:'VNportal Mix',text,url:'https://github.com/huangd-816/VNportal'}).catch(()=>{});
  }

  function startVisualizer(){
    const cA=document.getElementById('vuCanvasA'), cB=document.getElementById('vuCanvasB');
    if(!cA||!cB) return;
    const ctxA=cA.getContext('2d'), ctxB=cB.getContext('2d');
    let f=0;
    function tick(){
      f++;
      [['A',ctxA,cA],['B',ctxB,cB]].forEach(([id,c,cv])=>{
        const active=decks[id].playing;
        c.clearRect(0,0,cv.width,cv.height);
        for(let i=0;i<12;i++){
          const h=active?(0.15+Math.sin(f*.08+i*.5)*.25+Math.random()*.4)*cv.height:4;
          c.fillStyle=`hsl(${id==='A'?240+i*5:140+i*5},80%,${active?55:20}%)`;
          c.fillRect(i*(cv.width/12)+1,cv.height-h,(cv.width/12)-2,h);
        }
      });
      animFrame=requestAnimationFrame(tick);
    }
    tick();
  }

  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function onShow(){ populateDecks(); }
  return{init,onShow};
})();
