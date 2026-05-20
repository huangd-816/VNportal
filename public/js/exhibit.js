// Exhibit — fixed play, cover resolve, workshop recorder sync
const Exhibit = (() => {
  const GENRE_COLORS={jazz:'#c0392b',soul:'#8e44ad',hiphop:'#2c3e50',electronic:'#16a085',
    rock:'#d35400',classical:'#2980b9',ambient:'#27ae60',pop:'#e91e8c',unknown:'#555'};

  function resolveCover(vinylId){
    const c=Store.getCover(vinylId); if(!c) return null;
    return typeof c==='string'?c:(c?.src||null);
  }

  function render(){
    const{vinyls}=Store.get();
    const grid=document.getElementById('vinylGrid');
    const empty=document.getElementById('emptyState');
    if(!grid) return;
    grid.innerHTML='';
    grid.onclick=null;
    grid.addEventListener('click',handleCardClick);

    if(!vinyls.length){empty?.classList.add('visible');return;}
    empty?.classList.remove('visible');

    vinyls.forEach(vinyl=>{
      const color=GENRE_COLORS[vinyl.genre]||'#555';
      const coverSrc=resolveCover(vinyl.id);
      const tracks=vinyl.tracks?.length||0;
      const meta=[vinyl.artist||'—',vinyl.year,tracks+'t'].filter(Boolean).join(' · ');

      const card=document.createElement('div');
      card.className='vinyl-card'; card.dataset.id=vinyl.id;
      card.innerHTML=`
        <div class="vinyl-disc-wrap">
          <div class="vinyl-disc-outer" id="disc-${vinyl.id}">
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
    updatePlayingDisc();
  }

  function handleCardClick(e){
    const btn=e.target.closest('[data-action]'); if(!btn) return;
    const{action,id}=btn.dataset;
    if(action==='play')  playVinyl(id);
    if(action==='cover') {Store.setCurrentVinyl(id);App.navigate('cover');}
    if(action==='delete'){if(confirm('Remove this vinyl?')){Store.deleteVinyl(id);render();}}
  }

  function playVinyl(id){
    Store.setCurrentVinyl(id);
    const vinyl=Store.getVinyl(id); if(!vinyl) return;
    const track=vinyl.tracks?.[0];
    if(!track||!track.title){Notify.warn('This vinyl has no tracks to play.');return;}
    // Update now-playing
    document.getElementById('npTitle').textContent=track.title;
    document.getElementById('npArtist').textContent=track.artist;
    document.getElementById('npDisc').style.animationPlayState='running';
    // Spin the card disc
    updatePlayingDisc(id);
    // Try player if available
    if(typeof Player!=='undefined') Player.playVinyl(id);
    else Notify.info(`Playing: ${track.title} by ${track.artist}`);
    // Animate workshop recorder
    syncRecorder(true);
  }

  function updatePlayingDisc(activeId){
    document.querySelectorAll('.vinyl-disc-outer').forEach(d=>{
      d.classList.remove('spinning');
    });
    if(activeId){
      document.getElementById(`disc-${activeId}`)?.classList.add('spinning');
    }
  }

  function syncRecorder(playing){
    const recorder=document.querySelector('.recorder-vinyl');
    if(recorder) recorder.style.animationPlayState=playing?'running':'paused';
    const dots=document.querySelectorAll('.rec-light');
    dots.forEach(d=>d.style.animationPlayState=playing?'running':'paused');
  }

  function init(){
    document.getElementById('addVinylBtn')?.addEventListener('click',()=>App.navigate('search-vinyl'));
    render();
    // Recorder starts paused
    setTimeout(()=>syncRecorder(false), 100);
  }
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  return{init,render,syncRecorder};
})();
