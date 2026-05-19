const Exhibit = (() => {
  const GENRE_COLORS={
    jazz:'#c0392b',soul:'#8e44ad',hiphop:'#2c3e50',electronic:'#16a085',
    rock:'#d35400',classical:'#2980b9',ambient:'#27ae60',pop:'#e91e8c',unknown:'#555'
  };

  // Resolve cover — returns an img src string or null
  function resolveCover(vinylId) {
    const cover=Store.getCover(vinylId);
    if(!cover) return null;
    if(typeof cover==='string') return cover; // dataURL
    if(cover?.type==='url') return cover.src; // CORS fallback URL
    return null;
  }

  function render() {
    const {vinyls}=Store.get();
    const grid=document.getElementById('vinylGrid');
    const empty=document.getElementById('emptyState');
    if(!grid) return;

    grid.innerHTML='';
    grid.onclick=null;
    grid.addEventListener('click', handleCardClick);

    if(!vinyls.length){ empty?.classList.add('visible'); return; }
    empty?.classList.remove('visible');

    vinyls.forEach(vinyl=>{
      const color=GENRE_COLORS[vinyl.genre]||'#555';
      const coverSrc=resolveCover(vinyl.id);
      const tracks=vinyl.tracks?.length||0;
      const meta=[vinyl.artist||vinyl.genre||'—', vinyl.year, tracks+'t'].filter(Boolean).join(' · ');

      const card=document.createElement('div');
      card.className='vinyl-card'; card.dataset.id=vinyl.id;
      card.innerHTML=`
        <div class="vinyl-disc-wrap">
          <div class="vinyl-disc-outer">
            ${coverSrc
              ? `<img src="${coverSrc}" class="vinyl-disc-cover" />`
              : `<div class="vinyl-disc-grooves">
                   <div class="vinyl-disc-label" style="background:${color}">
                     <span>${esc(vinyl.name.substring(0,14))}</span>
                   </div>
                 </div>`
            }
            <div class="vinyl-disc-hole"></div>
          </div>
        </div>
        <div class="vinyl-card-body">
          <div class="vinyl-card-name" title="${esc(vinyl.name)}">${esc(vinyl.name)}</div>
          <div class="vinyl-card-meta">${esc(meta)}</div>
          <div class="vinyl-card-actions">
            <button class="btn-primary" style="font-size:.62rem;padding:.38rem .8rem" data-action="play" data-id="${vinyl.id}">▶ Play</button>
            <button class="btn-secondary" style="font-size:.62rem;padding:.38rem .7rem" data-action="cover" data-id="${vinyl.id}">🎨</button>
            <button class="btn-secondary" style="font-size:.62rem;padding:.38rem .7rem;color:#e74c3c" data-action="delete" data-id="${vinyl.id}">✕</button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function handleCardClick(e) {
    const btn=e.target.closest('[data-action]');
    if(!btn) return;
    const{action,id}=btn.dataset;
    if(action==='play')  { Store.setCurrentVinyl(id); updateNP(id); if(typeof Player!=='undefined') Player.playVinyl(id); }
    if(action==='cover') { Store.setCurrentVinyl(id); App.navigate('cover'); }
    if(action==='delete'){ if(confirm('Remove this vinyl?')){ Store.deleteVinyl(id); render(); } }
  }

  function updateNP(id) {
    const vinyl=Store.getVinyl(id); if(!vinyl) return;
    const t=vinyl.tracks?.[0];
    if(t){ document.getElementById('npTitle').textContent=t.title; document.getElementById('npArtist').textContent=t.artist; }
    document.getElementById('npDisc').style.animationPlayState='running';
  }

  function init() {
    document.getElementById('addVinylBtn')?.addEventListener('click',()=>App.navigate('search-vinyl'));
    render();
  }

  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  return{init,render};
})();
