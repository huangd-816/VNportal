const Exhibit = (() => {
  const GENRE_COLORS={jazz:'#c0392b',soul:'#8e44ad',hiphop:'#2c3e50',electronic:'#16a085',
    rock:'#d35400',classical:'#2980b9',ambient:'#27ae60',pop:'#e91e8c',unknown:'#555'};
  let currentPlayingId=null;

  function resolveCover(vinylId){
    const c=Store.getCover(vinylId);if(!c)return null;
    return typeof c==='string'?c:(c?.src||null);
  }

  function render(){
    const{vinyls}=Store.get();
    const grid=document.getElementById('vinylGrid');
    const empty=document.getElementById('emptyState');
    if(!grid) return;
    grid.innerHTML='';
    grid.onclick=null; grid.addEventListener('click',handleCardClick);

    // Also populate games vinyl selector
    const gamesSel=document.getElementById('gamesVinylSelect');
    if(gamesSel){
      gamesSel.innerHTML='<option value="">— Pick a vinyl —</option>';
      vinyls.forEach(v=>{
        const o=document.createElement('option');
        o.value=v.id; o.textContent=v.name; gamesSel.appendChild(o);
      });
      const cur=Store.getCurrentVinyl();
      if(cur) gamesSel.value=cur.id;
      gamesSel.onchange=e=>{
        if(!e.target.value)return;
        Store.setCurrentVinyl(e.target.value);
        Notify.info(`Games now using "${Store.getVinyl(e.target.value)?.name}"`);
      };
    }

    if(!vinyls.length){empty?.classList.add('visible');return;}
    empty?.classList.remove('visible');

    vinyls.forEach(vinyl=>{
      const color=GENRE_COLORS[vinyl.genre]||'#555';
      const coverSrc=resolveCover(vinyl.id);
      const tracks=vinyl.tracks?.length||0;
      const meta=[vinyl.artist||'—',vinyl.year,tracks+'t'].filter(Boolean).join(' · ');
      const isPlaying=vinyl.id===currentPlayingId;

      const card=document.createElement('div');
      card.className='vinyl-card'; card.dataset.id=vinyl.id;
      card.innerHTML=`
        <div class="vinyl-disc-wrap">
          <div class="vinyl-disc-outer${isPlaying?' spinning':''}" id="disc-${vinyl.id}">
            ${coverSrc
              ?`<img src="${coverSrc}" class="vinyl-disc-cover"/>`
              :`<div class="vinyl-disc-grooves"><div class="vinyl-disc-label" style="background:${color}"><span>${esc(vinyl.name.substring(0,14))}</span></div></div>`
            }
            <div class="vinyl-disc-hole"></div>
          </div>
        </div>
        <div class="vinyl-card-body">
          <div class="vinyl-card-name" title="${esc(vinyl.name)}">${esc(vinyl.name)}</div>
          <div class="vinyl-card-meta">${esc(meta)}</div>
          <div class="vinyl-card-actions">
            <button class="btn-primary" style="font-size:.6rem;padding:.35rem .7rem" data-action="play" data-id="${vinyl.id}">▶ Play</button>
            <button class="btn-secondary" style="font-size:.6rem;padding:.35rem .6rem" data-action="cover" data-id="${vinyl.id}">🎨</button>
            <button class="btn-secondary" style="font-size:.6rem;padding:.35rem .6rem;color:#e74c3c" data-action="delete" data-id="${vinyl.id}">✕</button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function handleCardClick(e){
    const btn=e.target.closest('[data-action]'); if(!btn) return;
    const{action,id}=btn.dataset;
    if(action==='play')  playVinyl(id);
    if(action==='cover') {Store.setCurrentVinyl(id);App.navigate('cover');}
    if(action==='delete'){if(confirm('Remove this vinyl?')){Store.deleteVinyl(id);render();}}
  }

  function playVinyl(id){
    currentPlayingId=id;
    Store.setCurrentVinyl(id);
    const vinyl=Store.getVinyl(id); if(!vinyl) return;
    const track=vinyl.tracks?.[0];
    if(!track){Notify.warn('This vinyl has no tracks.');return;}

    // Update sidebar now-playing
    document.getElementById('npTitle').textContent=track.title;
    document.getElementById('npArtist').textContent=track.artist;
    document.getElementById('npDisc').style.animationPlayState='running';

    // Show cover in sidebar disc
    const coverSrc=resolveCover(id);
    const npDisc=document.getElementById('npDisc');
    if(npDisc&&coverSrc){
      npDisc.style.backgroundImage=`url(${coverSrc})`;
      npDisc.style.backgroundSize='cover';
    }

    // Update player bar
    updatePlayerBar(vinyl, track, coverSrc);

    // Spin disc on card
    document.querySelectorAll('.vinyl-disc-outer').forEach(d=>d.classList.remove('spinning'));
    document.getElementById(`disc-${id}`)?.classList.add('spinning');

    // Sync workshop recorder
    syncRecorder(true, coverSrc);

    // Show player bar
    document.getElementById('playerBar')?.classList.add('visible');

    Notify.info(`♫ Playing: ${track.title} — ${track.artist}`);
  }

  function updatePlayerBar(vinyl, track, coverSrc){
    const titleEl=document.getElementById('playerTrackTitle');
    const artistEl=document.getElementById('playerTrackArtist');
    const coverImg=document.getElementById('playerCoverImg');
    const disc=document.getElementById('playerDisc');
    const lyricsText=document.getElementById('playerLyricsText');
    const lyricsLink=document.getElementById('playerLyricsLink');

    if(titleEl)  titleEl.textContent=track.title;
    if(artistEl) artistEl.textContent=track.artist;

    // Cover art in player bar
    if(coverImg&&coverSrc){
      coverImg.src=coverSrc;
      coverImg.style.display='block';
      if(disc) disc.style.opacity='0.15'; // disc fades behind cover
    } else if(disc){
      disc.style.opacity='1';
    }

    // Lyrics line — link to Genius search
    const lyricsQuery=encodeURIComponent(`${track.title} ${track.artist} lyrics`);
    if(lyricsText) lyricsText.textContent=`♫ ${track.title} · ${vinyl.name}`;
    if(lyricsLink){
      lyricsLink.href=`https://genius.com/search?q=${lyricsQuery}`;
      lyricsLink.style.display='inline';
    }

    if(disc) disc.style.animationPlayState='running';
  }

  function syncRecorder(playing, coverSrc){
    const vinyl=document.getElementById('workshopVinyl');
    const label=document.getElementById('workshopLabel');
    if(vinyl){
      vinyl.style.animationPlayState=playing?'running':'paused';
      if(coverSrc&&label){
        label.style.backgroundImage=`url(${coverSrc})`;
        label.style.backgroundSize='cover';
        label.style.borderRadius='50%';
      }
    }
  }

  function init(){
    document.getElementById('addVinylBtn')?.addEventListener('click',()=>App.navigate('search-vinyl'));
    render();
    syncRecorder(false);
  }
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  return{init,render,syncRecorder,resolveCover};
})();
