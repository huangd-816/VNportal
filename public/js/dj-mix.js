// ============================================
// VNportal — DJ Mix
// Jamendo API — free in-browser streaming
// CC-licensed music, full tracks, CORS-safe
// Falls back to genre/mood if exact match fails
// ============================================
const DJMix = (() => {
  // Free public client_id — get your own at devportal.jamendo.com
  const JID  = '9b0a3bf0';
  const JAPI = 'https://api.jamendo.com/v3.0';

  let audioCtx=null, masterGain=null;
  const decks={
    A:{audio:null,gainNode:null,hiEQ:null,midEQ:null,loEQ:null,playing:false,trackName:'',blobUrl:null},
    B:{audio:null,gainNode:null,hiEQ:null,midEQ:null,loEQ:null,playing:false,trackName:'',blobUrl:null},
  };
  let crossfade=0.5, tapTimes=[], animFrame=null;

  function ensureCtx(){
    if(audioCtx) return;
    audioCtx = new(window.AudioContext||window.webkitAudioContext)();
    masterGain = audioCtx.createGain(); masterGain.gain.value=0.8;
    masterGain.connect(audioCtx.destination);
    ['A','B'].forEach(id=>{
      const d=decks[id];
      d.gainNode = audioCtx.createGain();
      d.hiEQ  = mkEQ('highshelf',8000);
      d.midEQ = mkEQ('peaking',1000);
      d.loEQ  = mkEQ('lowshelf',200);
      d.gainNode.connect(d.hiEQ);
      d.hiEQ.connect(d.midEQ);
      d.midEQ.connect(d.loEQ);
      d.loEQ.connect(masterGain);
    });
  }

  function mkEQ(type,freq){
    const f=audioCtx.createBiquadFilter();
    f.type=type; f.frequency.value=freq; f.gain.value=0; return f;
  }

  function init(){ populateDecks(); bindControls(); initDropZones(); startVisualizer(); }

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
      const deck=document.getElementById(`deck${id}`); if(!deck) return;
      deck.addEventListener('dragover',e=>{e.preventDefault();deck.classList.add('deck-drag-over');});
      deck.addEventListener('dragleave',()=>deck.classList.remove('deck-drag-over'));
      deck.addEventListener('drop',e=>{
        e.preventDefault(); deck.classList.remove('deck-drag-over');
        const file=e.dataTransfer.files[0];
        if(file&&(file.type.startsWith('audio/')||file.type.startsWith('video/')))
          loadLocalFile(id,file);
        else Notify.error('Drop an audio file (MP3, WAV, FLAC...)');
      });
      renderDeckEmbed(id,'idle');
    });
  }

  function renderDeckEmbed(id, state, data={}){
    const wrap=document.getElementById(`deck${id}SpotifyEmbed`); if(!wrap) return;
    wrap.style.display='block';

    if(state==='idle'){
      wrap.innerHTML=`
        <div class="dj-drop-zone">
          <div class="dj-drop-icon">🎵</div>
          <div class="dj-drop-text">Drop audio file <em>or</em> search Jamendo</div>
          <div class="dj-drop-sub">MP3 · WAV · FLAC · any audio · CC music library</div>
          <div style="display:flex;gap:.4rem;justify-content:center;margin-top:.6rem">
            <label class="dj-drop-browse">
              <input type="file" accept="audio/*" style="display:none" id="deckFile${id}"/>
              Browse files
            </label>
          </div>
        </div>
      `;
      document.getElementById(`deckFile${id}`)?.addEventListener('change',e=>{
        if(e.target.files[0]) loadLocalFile(id,e.target.files[0]);
      });
    } else if(state==='loading'){
      wrap.innerHTML=`<div style="padding:.75rem;text-align:center;color:var(--text-dim);font-size:.72rem">◎ Searching Jamendo...</div>`;
    } else if(state==='results'){
      const tracks=data.tracks||[];
      const selected=data.selected||tracks[0];
      if(!selected){ renderDeckEmbed(id,'notfound',data); return; }
      wrap.innerHTML=`
        <div class="dj-result-card">
          <div class="dj-result-main">
            ${selected.image?`<img src="${selected.image}" class="dj-result-art"/>`:
              `<div class="dj-result-art-ph">♫</div>`}
            <div class="dj-result-info">
              <div class="dj-result-name">${esc(selected.name)}</div>
              <div class="dj-result-artist">${esc(selected.artist_name)}</div>
              <div class="dj-result-badge">Jamendo · CC Licensed · Full track</div>
            </div>
          </div>
          ${tracks.length>1?`<div class="dj-result-alts">
            <span style="font-size:.58rem;color:var(--text-dim)">Other results:</span>
            ${tracks.slice(1,5).map(t=>`
              <button class="dj-alt-btn"
                data-url="${t.audio}" data-name="${esc(t.name)}" data-artist="${esc(t.artist_name)}"
                data-img="${t.image||''}">
                ${esc(t.name)} — ${esc(t.artist_name)}
              </button>`).join('')}
          </div>`:''}
          <div style="display:flex;gap:.4rem;margin-top:.5rem;align-items:center">
            <label class="dj-change-btn" style="cursor:pointer">
              <input type="file" accept="audio/*" style="display:none" id="deckFileAlt${id}"/>
              Use own file instead
            </label>
          </div>
        </div>
      `;
      // Wire alt buttons
      wrap.querySelectorAll('.dj-alt-btn').forEach(btn=>{
        btn.addEventListener('click',()=>{
          setAudio(id,btn.dataset.url);
          document.getElementById(`deck${id}TitleDisp`).textContent=btn.dataset.name;
          document.getElementById(`deck${id}ArtistDisp`).textContent=btn.dataset.artist;
          decks[id].trackName=`${btn.dataset.name} — ${btn.dataset.artist}`;
          Notify.info(`Deck ${id}: switched to "${btn.dataset.name}"`);
        });
      });
      document.getElementById(`deckFileAlt${id}`)?.addEventListener('change',e=>{
        if(e.target.files[0]) loadLocalFile(id,e.target.files[0]);
      });
    } else if(state==='notfound'){
      wrap.innerHTML=`
        <div class="dj-result-card" style="border-color:var(--accent2)">
          <div style="font-size:.72rem;color:var(--accent2);margin-bottom:.4rem">
            ⚠ "${esc(data.query||'')}" not on Jamendo
          </div>
          <div style="font-size:.65rem;color:var(--text-dim);margin-bottom:.65rem;line-height:1.6">
            Jamendo has indie/CC music. Mainstream artists aren't available.<br/>
            Drop your own MP3 file onto the deck to play any track.
          </div>
          <label class="dj-drop-browse" style="display:block;text-align:center;cursor:pointer">
            <input type="file" accept="audio/*" style="display:none" id="deckFileNF${id}"/>
            📁 Browse for audio file
          </label>
        </div>
      `;
      document.getElementById(`deckFileNF${id}`)?.addEventListener('change',e=>{
        if(e.target.files[0]) loadLocalFile(id,e.target.files[0]);
      });
    } else if(state==='loaded'){
      wrap.innerHTML=`
        <div class="dj-loaded-track">
          <div class="dj-loaded-name">♫ ${esc(data.name||'Track loaded')}</div>
          <div class="dj-loaded-progress">
            <div class="dj-progress-bar" id="djProg${id}">
              <div class="dj-progress-fill" id="djFill${id}"></div>
            </div>
            <span class="dj-time" id="djTime${id}">0:00</span>
          </div>
          <label class="dj-change-btn">
            <input type="file" accept="audio/*" style="display:none" id="deckFileLoaded${id}"/>
            ↺ Change track
          </label>
        </div>
      `;
      document.getElementById(`deckFileLoaded${id}`)?.addEventListener('change',e=>{
        if(e.target.files[0]) loadLocalFile(id,e.target.files[0]);
      });
      wireProgress(id);
    }
  }

  async function searchJamendo(query){
    // Strategy: namesearch → broader search → artist search → tag search
    const strategies=[
      `${JAPI}/tracks/?client_id=${JID}&format=json&limit=8&namesearch=${encodeURIComponent(query)}&audioformat=mp32`,
      `${JAPI}/tracks/?client_id=${JID}&format=json&limit=8&search=${encodeURIComponent(query)}&audioformat=mp32`,
      `${JAPI}/tracks/?client_id=${JID}&format=json&limit=8&artist_name=${encodeURIComponent(query.split(' ')[0])}&audioformat=mp32`,
    ];
    for(const url of strategies){
      try{
        const res=await fetch(url);
        const data=await res.json();
        const results=(data.results||[]).filter(r=>r.audio);
        if(results.length) return results;
      }catch{}
    }
    return [];
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

    // 1. Try local file from DB
    if(typeof DB!=='undefined'){
      const key=DB.trackKey(vinylId,ti);
      const hasLocal=await DB.hasFile(key).catch(()=>false);
      if(hasLocal){
        const url=await DB.getFileURL(key);
        setAudio(id,url);
        decks[id].trackName=`${track.title} — ${track.artist}`;
        renderDeckEmbed(id,'loaded',{name:track.title});
        Notify.success(`Deck ${id}: "${track.title}" (local file)`);
        return;
      }
    }

    // 2. Search Jamendo
    renderDeckEmbed(id,'loading');
    const query=`${track.title} ${track.artist||''}`.trim();
    const results=await searchJamendo(query);

    if(results.length){
      setAudio(id,results[0].audio);
      decks[id].trackName=`${results[0].name} — ${results[0].artist_name}`;
      renderDeckEmbed(id,'results',{tracks:results,selected:results[0],query});
      Notify.success(`Deck ${id}: found on Jamendo ♫`);
    } else {
      renderDeckEmbed(id,'notfound',{query});
      Notify.warn(`Deck ${id}: not on Jamendo — drop an MP3 file`);
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
    setAudio(id,url);
    renderDeckEmbed(id,'loaded',{name});
    Notify.success(`Deck ${id}: "${name}" loaded`);
  }

  function setAudio(id, url){
    ensureCtx();
    const d=decks[id];
    if(d.audio){d.audio.pause();d.audio=null;}
    const audio=new Audio(url);
    audio.crossOrigin='anonymous';
    audio.preload='auto';
    audio.addEventListener('ended',()=>stopDeck(id));
    d.audio=audio;
    try{ const src=audioCtx.createMediaElementSource(audio); src.connect(d.gainNode); }catch{}
    applyCrossfade();
  }

  function wireProgress(id){
    const audio=decks[id].audio; if(!audio) return;
    audio.addEventListener('timeupdate',()=>{
      const pct=audio.currentTime/(audio.duration||1);
      const fill=document.getElementById(`djFill${id}`);
      const time=document.getElementById(`djTime${id}`);
      if(fill) fill.style.width=(pct*100)+'%';
      if(time) time.textContent=fmt(audio.currentTime)+(audio.duration?' / '+fmt(audio.duration):'');
    });
    document.getElementById(`djProg${id}`)?.addEventListener('click',e=>{
      const r=e.currentTarget.getBoundingClientRect();
      audio.currentTime=(e.clientX-r.left)/r.width*(audio.duration||0);
    });
  }

  function fmt(s){s=Math.floor(s||0);return Math.floor(s/60)+':'+(s%60).toString().padStart(2,'0');}

  function bindControls(){
    ['A','B'].forEach(id=>{
      document.getElementById(`deck${id}Select`)?.addEventListener('change',e=>loadFromVinyl(id,e.target.value));
      document.getElementById(`deck${id}Play`)?.addEventListener('click',()=>toggleDeck(id));
      document.getElementById(`deck${id}Cue`)?.addEventListener('click',()=>{if(decks[id].audio)decks[id].audio.currentTime=0;});
      document.getElementById(`deck${id}Speed`)?.addEventListener('input',e=>{if(decks[id].audio)decks[id].audio.playbackRate=+e.target.value;});
      ['Hi','Mid','Lo'].forEach(band=>{
        document.getElementById(`deck${id}${band}`)?.addEventListener('input',e=>{
          ensureCtx();
          const eq=decks[id][band.toLowerCase()+'EQ'];
          if(eq) eq.gain.setTargetAtTime(+e.target.value,audioCtx.currentTime,.01);
        });
      });
    });
    document.getElementById('crossfader')?.addEventListener('input',e=>{crossfade=+e.target.value;applyCrossfade();});
    document.getElementById('masterVol')?.addEventListener('input',e=>{ensureCtx();if(masterGain)masterGain.gain.value=+e.target.value;});
    document.getElementById('tapBpmBtn')?.addEventListener('click',tapBpm);
    document.getElementById('djExportBtn')?.addEventListener('click',exportMix);
  }

  function toggleDeck(id){
    const d=decks[id];
    if(!d.audio){Notify.warn(`Deck ${id}: Load a track first`);return;}
    ensureCtx();
    if(audioCtx.state==='suspended') audioCtx.resume();
    if(d.playing){d.audio.pause();d.playing=false;updateUI(id,false);}
    else{d.audio.play().then(()=>{d.playing=true;updateUI(id,true);applyCrossfade();}).catch(()=>Notify.warn('Click play again'));}
  }

  function stopDeck(id){decks[id].playing=false;updateUI(id,false);}

  function updateUI(id,playing){
    const btn=document.getElementById(`deck${id}Play`);
    if(btn){btn.textContent=playing?'⏸':'▶';btn.classList.toggle('active',playing);}
    document.getElementById(`disc${id}`)?.classList.toggle('playing',playing);
    document.getElementById(`arm${id}`)?.classList.toggle('playing',playing);
    const screen=document.getElementById('djScreenText');
    if(screen&&playing) screen.textContent=decks[id].trackName;
  }

  function applyCrossfade(){
    if(!audioCtx) return;
    decks.A.gainNode?.gain.setTargetAtTime(Math.cos(crossfade*Math.PI/2),audioCtx.currentTime,.02);
    decks.B.gainNode?.gain.setTargetAtTime(Math.cos((1-crossfade)*Math.PI/2),audioCtx.currentTime,.02);
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
  function onShow(){populateDecks();}
  return{init,onShow};
})();
