// ============================================
// VNportal — DJ Mix
// Spotify Web Playback SDK (Premium = full tracks)
// + Jamendo fallback (free CC music)
// + Local file drag-drop (always works)
// ============================================
const DJMix = (() => {
  const JID  = '9b0a3bf0';
  const JAPI = 'https://api.jamendo.com/v3.0';

  // Spotify SDK player (shared — one VNportal device)
  let spPlayer = null, spDeviceId = null, spReady = false;

  // Web Audio for local/Jamendo files
  let audioCtx=null, masterGain=null;

  const decks = {
    A: { mode:null, audio:null, gainNode:null, playing:false, trackName:'', uri:null, blobUrl:null },
    B: { mode:null, audio:null, gainNode:null, playing:false, trackName:'', uri:null, blobUrl:null },
  };
  let crossfade=0.5, tapTimes=[], animFrame=null;
  let activeDeck = null; // which deck is using Spotify (only 1 at a time)

  // ── Web Audio ─────────────────────────────
  function ensureCtx(){
    if(audioCtx) return;
    audioCtx = new(window.AudioContext||window.webkitAudioContext)();
    masterGain = audioCtx.createGain(); masterGain.gain.value=0.8;
    masterGain.connect(audioCtx.destination);
    ['A','B'].forEach(id=>{
      decks[id].gainNode = audioCtx.createGain();
      decks[id].gainNode.connect(masterGain);
    });
  }

  // ── Spotify SDK ───────────────────────────
  function loadSpotifySDK(){
    if(document.getElementById('spSdkScript')) return;
    const s=document.createElement('script');
    s.id='spSdkScript';
    s.src='https://sdk.scdn.co/spotify-player.js';
    document.head.appendChild(s);
  }

  window.onSpotifyWebPlaybackSDKReady = function(){
    if(typeof SpotifyAuth==='undefined'||!SpotifyAuth.isPremium()) return;
    SpotifyAuth.getToken().then(token=>{
      if(!token) return;
      spPlayer = new Spotify.Player({
        name: 'VNportal DJ',
        getOAuthToken: cb => SpotifyAuth.getToken().then(cb),
        volume: 0.8,
      });
      spPlayer.addListener('ready', ({device_id})=>{
        spDeviceId=device_id; spReady=true;
        Notify.success('Spotify player ready on VNportal DJ ♫');
      });
      spPlayer.addListener('not_ready', ()=>{ spReady=false; spDeviceId=null; });
      spPlayer.addListener('player_state_changed', state=>{
        if(!state) return;
        // Sync all Spotify decks — SDK has one stream so only one can be playing
        ['A','B'].forEach(id=>{
          if(decks[id].mode==='spotify'){
            const isActive=activeDeck===id;
            const playing=isActive&&!state.paused;
            if(decks[id].playing!==playing){ decks[id].playing=playing; updateUI(id,playing); }
          }
        });
      });
      spPlayer.connect();
    });
  };

  function init(){
    // Load SDK lazily — only if user is already connected as Premium
    if(typeof SpotifyAuth!=='undefined'&&SpotifyAuth.isPremium()) loadSpotifySDK();
    populateDecks();
    bindControls();
    initDropZones();
    startVisualizer();
  }

  function populateDecks(){
    const{vinyls}=Store.get();
    ['A','B'].forEach(id=>{
      const sel=document.getElementById(`deck${id}Select`); if(!sel) return;
      sel.innerHTML='<option value="">— From your vinyl —</option>';
      vinyls.forEach(v=>(v.tracks||[]).forEach((t,ti)=>{
        const o=document.createElement('option');
        o.value=`${v.id}:${ti}`;
        o.textContent=`${t.title} — ${t.artist}`;
        sel.appendChild(o);
      }));
    });
  }

  function initDropZones(){
    ['A','B'].forEach(id=>{
      renderIdle(id);
      const deck=document.getElementById(`deck${id}`); if(!deck) return;
      deck.addEventListener('dragover',e=>{e.preventDefault();deck.classList.add('deck-drag-over');});
      deck.addEventListener('dragleave',()=>deck.classList.remove('deck-drag-over'));
      deck.addEventListener('drop',e=>{
        e.preventDefault(); deck.classList.remove('deck-drag-over');
        const file=e.dataTransfer.files[0];
        if(file&&(file.type.startsWith('audio/')||file.type.startsWith('video/'))) loadLocalFile(id,file);
        else Notify.error('Drop an audio file');
      });
    });
  }

  function renderIdle(id){
    const wrap=document.getElementById(`deck${id}SpotifyEmbed`); if(!wrap) return;
    const spConnected = SpotifyAuth.isConnected();
    const spPremium   = SpotifyAuth.isPremium();
    wrap.style.display='block';
    wrap.innerHTML=`
      <div class="dj-drop-zone">
        <div class="dj-drop-icon">🎵</div>
        <div class="dj-drop-text">Load a track above or drop a file</div>
        ${spConnected&&spPremium
          ? `<div class="dj-sp-ready">✓ Spotify Premium ready</div>`
          : spConnected
            ? `<div class="dj-sp-free">Spotify free: 30s previews only</div>`
            : `<div class="dj-sp-hint">Connect Spotify in sidebar for streaming</div>`}
        <label class="dj-drop-browse" style="margin-top:.6rem">
          <input type="file" accept="audio/*,video/*" style="display:none" id="deckFile${id}"/>
          Browse audio files
        </label>
      </div>
    `;
    document.getElementById(`deckFile${id}`)?.addEventListener('change',e=>{
      if(e.target.files[0]) loadLocalFile(id,e.target.files[0]);
    });
  }

  async function loadFromVinyl(id, value){
    if(!value) return;
    const[vinylId,tiStr]=value.split(':'); const ti=parseInt(tiStr);
    const vinyl=Store.getVinyl(vinylId); if(!vinyl) return;
    const track=vinyl.tracks?.[ti]; if(!track) return;

    const cover=Store.getCover(vinylId);
    const coverSrc=typeof cover==='string'?cover:(cover?.src||null);
    const disc=document.getElementById(`disc${id}`);
    if(disc&&coverSrc){disc.style.backgroundImage=`url(${coverSrc})`;disc.style.backgroundSize='cover';}

    document.getElementById(`deck${id}TitleDisp`).textContent=track.title;
    document.getElementById(`deck${id}ArtistDisp`).textContent=track.artist;
    decks[id].trackName=`${track.title} — ${track.artist}`;

    const wrap=document.getElementById(`deck${id}SpotifyEmbed`);
    if(wrap) wrap.innerHTML=`<div style="padding:.75rem;text-align:center;color:var(--text-dim);font-size:.72rem">◎ Searching...</div>`;

    // 1. Local file from DB
    if(typeof DB!=='undefined'){
      const key=DB.trackKey(vinylId,ti);
      if(await DB.hasFile(key).catch(()=>false)){
        const url=await DB.getFileURL(key);
        setLocalAudio(id,url,track.title); return;
      }
    }

    // 2. Spotify (if connected + Premium)
    if(SpotifyAuth.isConnected()){
      const q=`${track.title} ${track.artist||''}`;
      const res=await SpotifyAuth.search(q,5);
      const tracks=res?.tracks?.items||[];
      if(tracks.length){
        showSpotifyResults(id,tracks,track,wrap); return;
      }
    }

    // 3. Jamendo fallback
    const jamResults=await searchJamendo(`${track.title} ${track.artist||''}`.trim());
    if(jamResults.length){
      showJamendoResults(id,jamResults,track,wrap); return;
    }

    // 4. Nothing found
    if(wrap) wrap.innerHTML=`
      <div class="dj-result-card" style="border-color:var(--accent2)">
        <div style="font-size:.72rem;color:var(--accent2);margin-bottom:.4rem">Not found in streaming libraries</div>
        <div style="font-size:.62rem;color:var(--text-dim);margin-bottom:.6rem">
          ${!SpotifyAuth.isConnected()?'Connect Spotify for mainstream music · ':''}
          Drop your own MP3 file onto this deck.
        </div>
        <label class="dj-drop-browse" style="display:block;text-align:center;cursor:pointer">
          <input type="file" accept="audio/*" style="display:none" id="deckFileNF${id}"/>
          📁 Browse files
        </label>
      </div>
    `;
    document.getElementById(`deckFileNF${id}`)?.addEventListener('change',e=>{
      if(e.target.files[0]) loadLocalFile(id,e.target.files[0]);
    });
    Notify.warn(`Not found — drop an MP3 for "${track.title}"`);
  }

  function showSpotifyResults(id, tracks, original, wrap){
    const best=tracks.find(t=>
      t.name.toLowerCase().includes(original.title.toLowerCase())
    )||tracks[0];

    decks[id].uri  = best.uri;
    decks[id].mode = 'spotify';

    if(wrap) wrap.innerHTML=`
      <div class="dj-result-card dj-sp-card">
        <div class="dj-result-main">
          ${best.album?.images?.[2]?.url?`<img src="${best.album.images[2].url}" class="dj-result-art"/>`:'<div class="dj-result-art-ph">♫</div>'}
          <div class="dj-result-info">
            <div class="dj-result-name">${esc(best.name)}</div>
            <div class="dj-result-artist">${esc(best.artists?.map(a=>a.name).join(', '))}</div>
            <div class="dj-result-badge" style="color:#1DB954">
              ${SpotifyAuth.isPremium()?'Spotify · Full track':'Spotify · 30s preview'}
            </div>
          </div>
        </div>
        ${tracks.length>1?`<div class="dj-result-alts">
          ${tracks.slice(1,4).map(t=>`
            <button class="dj-alt-btn" data-uri="${t.uri}"
              data-name="${esc(t.name)}" data-artist="${esc(t.artists?.map(a=>a.name).join(', '))}">
              ${esc(t.name)} — ${esc(t.artists?.[0]?.name||'')}
            </button>`).join('')}
        </div>`:''}
        <label class="dj-change-btn" style="margin-top:.4rem;cursor:pointer;display:block;width:fit-content">
          <input type="file" accept="audio/*" style="display:none" id="deckFileSp${id}"/>
          Use own file instead
        </label>
      </div>
    `;
    wrap?.querySelectorAll('.dj-alt-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        decks[id].uri=btn.dataset.uri;
        document.getElementById(`deck${id}TitleDisp`).textContent=btn.dataset.name;
        document.getElementById(`deck${id}ArtistDisp`).textContent=btn.dataset.artist;
        decks[id].trackName=`${btn.dataset.name} — ${btn.dataset.artist}`;
        Notify.info(`Deck ${id}: "${btn.dataset.name}" selected`);
      });
    });
    document.getElementById(`deckFileSp${id}`)?.addEventListener('change',e=>{
      if(e.target.files[0]) loadLocalFile(id,e.target.files[0]);
    });
    Notify.success(`Deck ${id}: "${best.name}" — press ▶ to play`);
  }

  function showJamendoResults(id, tracks, original, wrap){
    const best=tracks[0];
    setLocalAudio(id,best.audio,best.name);
    if(wrap) wrap.innerHTML=`
      <div class="dj-result-card">
        <div class="dj-result-main">
          ${best.image?`<img src="${best.image}" class="dj-result-art"/>`:'<div class="dj-result-art-ph">♫</div>'}
          <div class="dj-result-info">
            <div class="dj-result-name">${esc(best.name)}</div>
            <div class="dj-result-artist">${esc(best.artist_name)}</div>
            <div class="dj-result-badge">Jamendo · CC · Full track</div>
          </div>
        </div>
        ${tracks.length>1?`<div class="dj-result-alts">
          ${tracks.slice(1,4).map(t=>`
            <button class="dj-alt-btn" data-url="${t.audio}" data-name="${esc(t.name)}" data-artist="${esc(t.artist_name)}">
              ${esc(t.name)} — ${esc(t.artist_name)}
            </button>`).join('')}
        </div>`:''}
      </div>
    `;
    wrap?.querySelectorAll('.dj-alt-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{ setLocalAudio(id,btn.dataset.url,btn.dataset.name); Notify.info(`Switched to "${btn.dataset.name}"`); });
    });
    Notify.info(`Deck ${id}: Jamendo match (not exact — connect Spotify for "${original.title}")`);
  }

  async function searchJamendo(query){
    try{
      const urls=[
        `${JAPI}/tracks/?client_id=${JID}&format=json&limit=6&namesearch=${encodeURIComponent(query)}&audioformat=mp32`,
        `${JAPI}/tracks/?client_id=${JID}&format=json&limit=6&search=${encodeURIComponent(query)}&audioformat=mp32`,
      ];
      for(const url of urls){
        const res=await fetch(url);
        const data=await res.json();
        const r=(data.results||[]).filter(t=>t.audio);
        if(r.length) return r;
      }
    }catch{}
    return [];
  }

  const scrubbing={A:false,B:false};

  function addScrubListeners(bar,id,audio){
    function scrubTo(clientX){
      const r=bar.getBoundingClientRect();
      const pct=Math.max(0,Math.min(1,(clientX-r.left)/r.width));
      audio.currentTime=pct*(audio.duration||0);
      const fill=document.getElementById(`djFill${id}`);
      const time=document.getElementById(`djTime${id}`);
      if(fill) fill.style.width=(pct*100)+'%';
      if(time) time.textContent=fmt(audio.currentTime)+(audio.duration?' / '+fmt(audio.duration):'');
    }
    // Mouse
    bar.addEventListener('mousedown',e=>{
      scrubbing[id]=true; bar.classList.add('scrubbing');
      scrubTo(e.clientX); e.preventDefault();
    });
    document.addEventListener('mousemove',e=>{ if(scrubbing[id]) scrubTo(e.clientX); });
    document.addEventListener('mouseup',()=>{ if(scrubbing[id]){ scrubbing[id]=false; bar.classList.remove('scrubbing'); } });
    // Touch
    bar.addEventListener('touchstart',e=>{ scrubbing[id]=true; scrubTo(e.touches[0].clientX); },{passive:true});
    bar.addEventListener('touchmove',e=>{ if(scrubbing[id]) scrubTo(e.touches[0].clientX); },{passive:true});
    bar.addEventListener('touchend',()=>{ scrubbing[id]=false; });
  }

  function setLocalAudio(id, url, name){
    ensureCtx();
    const d=decks[id];
    if(d.audio){d.audio.pause();d.audio=null;}
    const audio=new Audio(url);
    audio.crossOrigin='anonymous';
    audio.addEventListener('ended',()=>stopDeck(id));
    d.audio=audio; d.mode='local'; d.uri=null;
    try{ const src=audioCtx.createMediaElementSource(audio); src.connect(d.gainNode); }catch{}
    applyCrossfade();

    // Show progress bar
    const wrap=document.getElementById(`deck${id}SpotifyEmbed`);
    if(wrap){
      const existing=wrap.querySelector('.dj-loaded-track');
      if(!existing){
        const prog=document.createElement('div');
        prog.className='dj-loaded-track';
        prog.innerHTML=`
          <div class="dj-loaded-name">♫ ${esc(name)}</div>
          <div class="dj-loaded-progress">
            <div class="dj-progress-bar" id="djProg${id}"><div class="dj-progress-fill" id="djFill${id}"></div></div>
            <span class="dj-time" id="djTime${id}">0:00</span>
          </div>
        `;
        wrap.appendChild(prog);
      }
      audio.addEventListener('timeupdate',()=>{
        if(scrubbing[id]) return;
        const pct=audio.currentTime/(audio.duration||1);
        const fill=document.getElementById(`djFill${id}`);
        const time=document.getElementById(`djTime${id}`);
        if(fill) fill.style.width=(pct*100)+'%';
        if(time) time.textContent=fmt(audio.currentTime)+(audio.duration?' / '+fmt(audio.duration):'');
      });
      // Drag-to-scrub
      const bar=document.getElementById(`djProg${id}`);
      if(bar) addScrubListeners(bar,id,audio);
    }
  }

  function loadLocalFile(id, file){
    if(decks[id].blobUrl) URL.revokeObjectURL(decks[id].blobUrl);
    const url=URL.createObjectURL(file);
    decks[id].blobUrl=url;
    const name=file.name.replace(/\.[^.]+$/,'');
    decks[id].trackName=name;
    document.getElementById(`deck${id}TitleDisp`).textContent=name;
    document.getElementById(`deck${id}ArtistDisp`).textContent='Local file';
    setLocalAudio(id,url,name);
    Notify.success(`Deck ${id}: "${name}" loaded`);
  }

  function fmt(s){s=Math.floor(s||0);return Math.floor(s/60)+':'+(s%60).toString().padStart(2,'0');}

  function bindControls(){
    ['A','B'].forEach(id=>{
      document.getElementById(`deck${id}Select`)?.addEventListener('change',e=>loadFromVinyl(id,e.target.value));
      document.getElementById(`deck${id}Play`)?.addEventListener('click',()=>toggleDeck(id));
      document.getElementById(`deck${id}Cue`)?.addEventListener('click',()=>cueDeck(id));
      document.getElementById(`deck${id}Speed`)?.addEventListener('input',e=>{
        if(decks[id].audio) decks[id].audio.playbackRate=+e.target.value;
      });
      ['Hi','Mid','Lo'].forEach(band=>{
        document.getElementById(`deck${id}${band}`)?.addEventListener('input',e=>{
          ensureCtx();
          const eq=decks[id][band.toLowerCase()+'EQ'];
          if(eq) eq.gain.setTargetAtTime(+e.target.value,audioCtx.currentTime,.01);
        });
      });
    });
    document.getElementById('crossfader')?.addEventListener('input',e=>{crossfade=+e.target.value;applyCrossfade();});
    document.getElementById('masterVol')?.addEventListener('input',e=>{
      ensureCtx(); if(masterGain) masterGain.gain.value=+e.target.value;
      if(spReady&&spDeviceId) SpotifyAuth.setVolume(spDeviceId,Math.round(+e.target.value*100));
    });
    document.getElementById('tapBpmBtn')?.addEventListener('click',tapBpm);
    document.getElementById('djExportBtn')?.addEventListener('click',exportMix);
  }

  async function toggleDeck(id){
    const d=decks[id];
    if(d.mode==='spotify'){
      if(!spReady||!spDeviceId){ Notify.warn('Spotify player not ready'); return; }
      if(d.playing){
        await SpotifyAuth.pause(spDeviceId); d.playing=false; updateUI(id,false);
      } else {
        if(!d.uri){ Notify.warn('No Spotify track selected'); return; }
        activeDeck=id;
        await SpotifyAuth.play(spDeviceId,[d.uri]);
        d.playing=true; updateUI(id,true);
        applyCrossfade();
      }
    } else if(d.mode==='local'&&d.audio){
      ensureCtx();
      if(audioCtx.state==='suspended') audioCtx.resume();
      if(d.playing){ d.audio.pause(); d.playing=false; updateUI(id,false); }
      else{ d.audio.play().then(()=>{ d.playing=true; updateUI(id,true); applyCrossfade(); }).catch(()=>Notify.warn('Click play again')); }
    } else {
      Notify.warn(`Deck ${id}: Load a track first`);
    }
  }

  function cueDeck(id){
    if(decks[id].audio) decks[id].audio.currentTime=0;
    if(decks[id].mode==='spotify'&&spReady&&spDeviceId) SpotifyAuth.seek(spDeviceId,0);
  }

  function stopDeck(id){ decks[id].playing=false; updateUI(id,false); }

  function updateUI(id,playing){
    const btn=document.getElementById(`deck${id}Play`);
    if(btn){btn.textContent=playing?'⏸':'▶';btn.classList.toggle('active',playing);}
    document.getElementById(`disc${id}`)?.classList.toggle('playing',playing);
    document.getElementById(`arm${id}`)?.classList.toggle('playing',playing);
    const screen=document.getElementById('djScreenText');
    if(screen&&playing) screen.textContent=decks[id].trackName;
  }

  function applyCrossfade(){
    const vA=Math.cos(crossfade*Math.PI/2), vB=Math.cos((1-crossfade)*Math.PI/2);
    if(audioCtx){
      decks.A.gainNode?.gain.setTargetAtTime(vA,audioCtx.currentTime,.02);
      decks.B.gainNode?.gain.setTargetAtTime(vB,audioCtx.currentTime,.02);
    }
    // Spotify volume
    if(spReady&&spDeviceId){
      const spDeck=activeDeck;
      if(spDeck){
        const vol=spDeck==='A'?vA:vB;
        SpotifyAuth.setVolume(spDeviceId,Math.round(vol*100));
      }
    }
  }

  function tapBpm(){
    tapTimes.push(Date.now());if(tapTimes.length>8)tapTimes.shift();
    if(tapTimes.length>=2){
      const avg=tapTimes.slice(1).map((t,i)=>t-tapTimes[i]).reduce((a,b)=>a+b)/(tapTimes.length-1);
      document.getElementById('bpmDisplay').textContent=Math.round(60000/avg)+' BPM';
    }
  }

  function exportMix(){
    const tracks=[decks.A,decks.B].filter(d=>d.trackName).map((d,i)=>`Deck ${i?'B':'A'}: ${d.trackName}`);
    if(!tracks.length){Notify.warn('Load tracks first!');return;}
    const text=`VNportal DJ Mix\n${new Date().toLocaleDateString()}\n\n${tracks.join('\n')}\n\nhttps://github.com/huangd-816/VNportal`;
    const blob=new Blob([text],{type:'text/plain'});
    const a=document.createElement('a');a.download='vnportal-mix.txt';a.href=URL.createObjectURL(blob);a.click();
    Notify.success('Mix exported!');
    if(navigator.share)navigator.share({title:'VNportal Mix',text,url:'https://github.com/huangd-816/VNportal'}).catch(()=>{});
  }

  function startVisualizer(){
    const cA=document.getElementById('vuCanvasA'),cB=document.getElementById('vuCanvasB');
    if(!cA||!cB) return;
    const ctxA=cA.getContext('2d'),ctxB=cB.getContext('2d');
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
  function _loadFile(id,file,blobUrl){
    if(decks[id].blobUrl) URL.revokeObjectURL(decks[id].blobUrl);
    decks[id].blobUrl=blobUrl;
    const name=file.name.replace(/\.[^.]+$/,'');
    decks[id].trackName=name;
    document.getElementById(`deck${id}TitleDisp`).textContent=name;
    document.getElementById(`deck${id}ArtistDisp`).textContent='Soundtrap export';
    setLocalAudio(id,blobUrl,name);
    Notify.success(`Deck ${id}: "${name}" imported from Soundtrap`);
  }
  function onShow(){populateDecks();}
  function enableSpotifySDK(){ loadSpotifySDK(); }
  return{init,onShow,_loadFile,enableSpotifySDK};
})();

// ── Soundtrack Studio ────────────────────
const SoundtrackStudio = (() => {
  function open(app){
    if(app==='logic') window.open('https://www.apple.com/logic-pro/','_blank');
  }

  function openDjay(){
    const vinyl = typeof Store!=='undefined' ? Store.getCurrentVinyl() : null;
    const track = vinyl?.tracks?.[0];
    const query = track ? `${track.title} ${track.artist}`.trim() : '';

    if(track && typeof App!=='undefined') App.navigate('mix');

    // Use hidden <a> click — triggers URL scheme without navigating the page
    const scheme = query ? `djay://search?q=${encodeURIComponent(query)}` : 'djay://';
    const a = document.createElement('a');
    a.href = scheme;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 200);

    if(query) Notify.success(`Opening djay — search "${track.title}" by ${track.artist}`);
    else Notify.info('Opening djay — select a vinyl to auto-load a track');
  }

  window.SoundtrackStudio={open,openDjay};
  return window.SoundtrackStudio;
})();
