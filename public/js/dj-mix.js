// ============================================
// VNportal — DJ Mix
// iTunes Search API — free, no key needed
// 30-second previews of mainstream music
// Plays directly in-browser via Web Audio
// ============================================
const DJMix = (() => {
  const ITUNES = 'https://itunes.apple.com/search';

  let audioCtx=null, masterGain=null;
  const decks={
    A:{audio:null,gainNode:null,playing:false,trackName:'',url:null},
    B:{audio:null,gainNode:null,playing:false,trackName:'',url:null},
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
        if(decks[id].audio) decks[id].audio.playbackRate=Math.max(0.5,Math.min(2,+e.target.value));
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

    // 1. Try local file first
    if(typeof DB!=='undefined'){
      const key=DB.trackKey(vinylId,ti);
      const hasLocal=await DB.hasFile(key).catch(()=>false);
      if(hasLocal){
        const url=await DB.getFileURL(key);
        setAudio(id,url);
        showStatus(wrap,'📁 Local file — full track','#27ae60');
        Notify.success(`Deck ${id}: local file loaded`);
        return;
      }
    }

    // 2. iTunes Search API — free, no key, 30s previews
    const loader=Notify.loading(`Finding "${track.title}"...`);
    try {
      const q=encodeURIComponent(`${track.title} ${track.artist||''}`);
      const url=`${ITUNES}?term=${q}&media=music&entity=song&limit=8`;
      // iTunes API requires a callback hack to avoid CORS on file://
      // Use a proxy-free approach: load via JSON-P or direct fetch
      const res=await fetch(url);
      const data=await res.json();
      Notify.dismiss(loader);

      const results=(data.results||[]).filter(r=>r.previewUrl);
      if(!results.length){
        showNoResults(wrap, track, q);
        Notify.warn(`Deck ${id}: No preview found for "${track.title}"`);
        return;
      }

      // Best match: prioritize title match
      const best=results.find(r=>
        r.trackName?.toLowerCase().includes(track.title.toLowerCase())
      ) || results[0];

      setAudio(id, best.previewUrl);
      showResults(id, wrap, results, best);
      Notify.success(`Deck ${id}: "${best.trackName}" — 30s preview ♫`);

    } catch(e){
      Notify.dismiss(loader);
      // CORS issue on file:// — show manual URL fallback
      showCorsNote(wrap, track);
    }
  }

  function setAudio(id, url){
    ensureCtx();
    const d=decks[id];
    if(d.audio){ d.audio.pause(); d.audio=null; }

    d.url=url;
    const audio=new Audio();
    audio.crossOrigin='anonymous';
    audio.src=url;
    audio.preload='none';
    audio.addEventListener('ended',()=>stopDeck(id));
    d.audio=audio;

    // Connect to Web Audio for real crossfading
    try{
      const src=audioCtx.createMediaElementSource(audio);
      src.connect(d.gainNode);
    }catch{}
    applyCrossfade();
  }

  function showResults(id, wrap, results, selected){
    if(!wrap) return;
    wrap.style.display='block';
    wrap.innerHTML=`
      <div class="dj-result-card">
        <div class="dj-result-main">
          ${selected.artworkUrl60?`<img src="${selected.artworkUrl60}" class="dj-result-art"/>`:'<div class="dj-result-art-ph">♫</div>'}
          <div class="dj-result-info">
            <div class="dj-result-name">${esc(selected.trackName)}</div>
            <div class="dj-result-artist">${esc(selected.artistName)}</div>
            <div class="dj-result-badge">Apple Music · 30s preview</div>
          </div>
        </div>
        ${results.length>1?`<div class="dj-result-alts">
          ${results.slice(0,4).filter(r=>r!==selected).map(r=>`
            <button class="dj-alt-btn" data-url="${r.previewUrl}" data-name="${esc(r.trackName)}" data-artist="${esc(r.artistName)}">
              ${esc(r.trackName)} — ${esc(r.artistName)}
            </button>`).join('')}
        </div>`:''}
      </div>
    `;
    wrap.querySelectorAll('.dj-alt-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        setAudio(id,btn.dataset.url);
        document.getElementById(`deck${id}TitleDisp`).textContent=btn.dataset.name;
        document.getElementById(`deck${id}ArtistDisp`).textContent=btn.dataset.artist;
        decks[id].trackName=`${btn.dataset.name} — ${btn.dataset.artist}`;
        Notify.info(`Deck ${id}: switched to "${btn.dataset.name}"`);
      });
    });
  }

  function showStatus(wrap, msg, color){
    if(!wrap) return;
    wrap.style.display='block';
    wrap.innerHTML=`<div style="padding:.6rem .75rem;border:1px solid ${color};color:${color};font-size:.72rem;border-radius:2px">${msg}</div>`;
  }

  function showNoResults(wrap, track, q){
    if(!wrap) return;
    wrap.style.display='block';
    wrap.innerHTML=`
      <div class="dj-result-card" style="border-color:var(--accent2)">
        <div style="font-size:.72rem;color:var(--accent2);margin-bottom:.4rem">No preview found for "${esc(track.title)}"</div>
        <div style="font-size:.65rem;color:var(--text-dim);margin-bottom:.6rem">Upload the track as a local file in DIY Vinyl for full playback.</div>
        <a href="https://music.apple.com/search?term=${q}" target="_blank" class="btn-secondary" style="font-size:.68rem;display:block;text-align:center;text-decoration:none">Search Apple Music ↗</a>
      </div>
    `;
  }

  function showCorsNote(wrap, track){
    if(!wrap) return;
    wrap.style.display='block';
    const q=encodeURIComponent(`${track.title} ${track.artist||''}`);
    wrap.innerHTML=`
      <div class="dj-result-card" style="border-color:var(--accent)">
        <div style="font-size:.72rem;color:var(--accent);margin-bottom:.4rem">⚠ Preview search needs a server</div>
        <div style="font-size:.65rem;color:var(--text-dim);margin-bottom:.6rem">
          Run <code style="color:var(--accent);background:var(--surface2);padding:.1rem .3rem">npx serve .</code> instead of opening index.html directly.
          Then previews load automatically.
        </div>
        <a href="https://music.apple.com/search?term=${q}" target="_blank" class="btn-secondary" style="font-size:.68rem;display:block;text-align:center;text-decoration:none">Search Apple Music ↗</a>
      </div>
    `;
  }

  function toggleDeck(id){
    const d=decks[id];
    if(!d.audio||!d.url){ Notify.warn(`Deck ${id}: Load a track first`); return; }
    ensureCtx();
    if(audioCtx.state==='suspended') audioCtx.resume();
    if(d.playing){
      d.audio.pause(); d.playing=false; updateDeckUI(id,false);
    } else {
      d.audio.play().then(()=>{ d.playing=true; updateDeckUI(id,true); applyCrossfade(); })
        .catch(()=>{ Notify.warn('Click play again — browser requires interaction first'); });
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
    const screen=document.getElementById('djScreenText');
    if(screen&&playing) screen.textContent=decks[id].trackName;
  }

  function applyCrossfade(){
    if(!audioCtx) return;
    const vA=Math.cos(crossfade*Math.PI/2), vB=Math.cos((1-crossfade)*Math.PI/2);
    decks.A.gainNode?.gain.setTargetAtTime(vA,audioCtx.currentTime,.02);
    decks.B.gainNode?.gain.setTargetAtTime(vB,audioCtx.currentTime,.02);
  }

  function tapBpm(){
    tapTimes.push(Date.now()); if(tapTimes.length>8) tapTimes.shift();
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
