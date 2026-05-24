// ============================================
// VNportal — DJ Mix
// Opens Spotify app directly — no link pasting
// Uses spotify: URI scheme to launch desktop/mobile app
// ============================================
const DJMix = (() => {
  const state={
    A:{trackName:'',spotifyId:null,vinylId:null,track:null},
    B:{trackName:'',spotifyId:null,vinylId:null,track:null},
  };
  let crossfade=0.5, tapTimes=[], animFrame=null;

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
      document.getElementById(`deck${id}Play`)?.addEventListener('click',()=>playOnSpotify(id));
      document.getElementById(`deck${id}Cue`)?.addEventListener('click',()=>openSpotifySearch(id));
    });
    document.getElementById('tapBpmBtn')?.addEventListener('click',tapBpm);
    document.getElementById('djExportBtn')?.addEventListener('click',exportMix);
    document.getElementById('crossfader')?.addEventListener('input',e=>{ crossfade=+e.target.value; });
  }

  async function loadDeck(id, value){
    if(!value) return;
    const[vinylId,tiStr]=value.split(':'); const ti=parseInt(tiStr);
    const vinyl=Store.getVinyl(vinylId); if(!vinyl) return;
    const track=vinyl.tracks?.[ti]; if(!track) return;

    state[id].trackName=`${track.title} — ${track.artist}`;
    state[id].vinylId=vinylId;
    state[id].track=track;
    state[id].spotifyId=track.spotifyId||null;

    document.getElementById(`deck${id}TitleDisp`).textContent=track.title;
    document.getElementById(`deck${id}ArtistDisp`).textContent=track.artist;

    // Cover on disc
    const cover=Store.getCover(vinylId);
    const coverSrc=typeof cover==='string'?cover:(cover?.src||null);
    const disc=document.getElementById(`disc${id}`);
    if(disc&&coverSrc){disc.style.backgroundImage=`url(${coverSrc})`;disc.style.backgroundSize='cover';}

    // Show the deck action area
    updateDeckEmbed(id, track, vinylId, ti);
  }

  function updateDeckEmbed(id, track, vinylId, ti){
    const wrap=document.getElementById(`deck${id}SpotifyEmbed`);
    if(!wrap) return;

    const query=encodeURIComponent(`${track.title} ${track.artist}`);
    const spotifySearchUri=`spotify:search:${encodeURIComponent(track.title+' '+track.artist)}`;
    const spotifyWebUrl=`https://open.spotify.com/search/${query}`;

    // If we already have a saved Spotify track ID, show the embed
    if(track.spotifyId){
      wrap.innerHTML=`
        <iframe style="border-radius:8px;border:none;width:100%;height:80px"
          src="https://open.spotify.com/embed/track/${track.spotifyId}?utm_source=generator&theme=0"
          allow="autoplay;clipboard-write;encrypted-media;fullscreen;picture-in-picture" loading="lazy">
        </iframe>
        <div style="display:flex;gap:.4rem;margin-top:.4rem">
          <button class="deck-btn" style="flex:1;font-size:.65rem" onclick="DJMix._openApp('${id}')">♫ Open in Spotify</button>
          <button class="deck-btn" style="font-size:.65rem" onclick="DJMix._clearTrack('${id}','${vinylId}',${ti})">Unlink</button>
        </div>
      `;
      wrap.style.display='block';
      Notify.success(`Deck ${id}: "${track.title}" ready`);
    } else {
      // No saved ID — show two big buttons: open app or search web
      wrap.innerHTML=`
        <div class="dj-spotify-actions">
          <div class="dj-spotify-hint">Open in your Spotify app to play:</div>
          <div style="display:flex;gap:.5rem">
            <a href="${spotifySearchUri}" class="dj-spotify-open-btn" onclick="DJMix._markPlaying('${id}')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#000"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
              Open Spotify App
            </a>
            <a href="${spotifyWebUrl}" target="_blank" class="dj-spotify-web-btn">
              Web Player ↗
            </a>
          </div>
          <div class="dj-spotify-save-row">
            <span style="font-size:.6rem;color:var(--text-dim)">Save track link for embed:</span>
            <input type="text" placeholder="Paste Spotify track URL (optional)" class="dj-spotify-save-input" id="djSaveUrl${id}"/>
            <button class="deck-btn" style="font-size:.65rem" onclick="DJMix._saveSpotifyId('${id}','${vinylId}',${ti})">Save</button>
          </div>
        </div>
      `;
      wrap.style.display='block';
      Notify.info(`Deck ${id}: Click "Open Spotify App" to play`);
    }
  }

  function openSpotifySearch(id){
    const s=state[id]; if(!s.track) return;
    const uri=`spotify:search:${encodeURIComponent(s.track.title+' '+s.track.artist)}`;
    window.location.href=uri;
  }

  function playOnSpotify(id){
    const s=state[id]; if(!s.track) return;
    if(s.spotifyId){
      window.location.href=`spotify:track:${s.spotifyId}`;
    } else {
      openSpotifySearch(id);
    }
    markPlaying(id);
  }

  function markPlaying(id){
    const disc=document.getElementById(`disc${id}`);
    disc?.classList.add('playing');
    const arm=document.getElementById(`arm${id}`);
    arm?.classList.add('playing');
    const btn=document.getElementById(`deck${id}Play`);
    if(btn){btn.textContent='♫';btn.classList.add('active');}
    updateScreenText();
  }

  function saveSpotifyId(id, vinylId, ti){
    const input=document.getElementById(`djSaveUrl${id}`);
    const url=input?.value?.trim(); if(!url) return;
    const match=url.match(/track\/([A-Za-z0-9]+)/)||url.match(/spotify:track:([A-Za-z0-9]+)/);
    if(!match){Notify.error('Paste a Spotify track URL');return;}
    const spotifyId=match[1];
    const vinyl=Store.getVinyl(vinylId);
    if(vinyl?.tracks?.[ti]){
      vinyl.tracks[ti].spotifyId=spotifyId;
      Store.updateVinyl(vinylId,{tracks:vinyl.tracks});
      state[id].spotifyId=spotifyId;
    }
    updateDeckEmbed(id, vinyl.tracks[ti], vinylId, ti);
    Notify.success('Spotify track saved — embed loaded!');
  }

  function clearTrack(id, vinylId, ti){
    const vinyl=Store.getVinyl(vinylId);
    if(vinyl?.tracks?.[ti]){
      delete vinyl.tracks[ti].spotifyId;
      Store.updateVinyl(vinylId,{tracks:vinyl.tracks});
    }
    state[id].spotifyId=null;
    updateDeckEmbed(id, vinyl.tracks[ti], vinylId, ti);
  }

  function updateScreenText(){
    const screen=document.getElementById('djScreenText'); if(!screen) return;
    const playing=[state.A,state.B].filter(s=>s.track).map(s=>s.trackName);
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
    const cA=document.getElementById('vuCanvasA'), cB=document.getElementById('vuCanvasB');
    if(!cA||!cB) return;
    const ctxA=cA.getContext('2d'), ctxB=cB.getContext('2d');
    let f=0;
    function tick(){
      f++;
      [['A',ctxA,cA],['B',ctxB,cB]].forEach(([id,c,cv])=>{
        const active=!!state[id].track;
        c.clearRect(0,0,cv.width,cv.height);
        for(let i=0;i<12;i++){
          const h=active?(0.2+Math.sin(f*.08+i*.5)*.3+Math.random()*.35)*cv.height:4;
          c.fillStyle=`hsl(${id==='A'?240+i*5:140+i*5},80%,${active?55:20}%)`;
          c.fillRect(i*(cv.width/12)+1,cv.height-h,(cv.width/12)-2,h);
        }
      });
      animFrame=requestAnimationFrame(tick);
    }
    tick();
  }

  // Expose for inline onclick
  window.DJMix={
    _openApp: playOnSpotify,
    _markPlaying: markPlaying,
    _saveSpotifyId: saveSpotifyId,
    _clearTrack: clearTrack,
    init, onShow:()=>populateDecks()
  };
  return window.DJMix;
})();
