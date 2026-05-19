// ============================================
// VNportal — Exhibit Page
// Circular vinyl cards, player integration
// ============================================

const Exhibit = (() => {
  const GENRE_COLORS = {
    jazz:'#c0392b', soul:'#8e44ad', hiphop:'#2c3e50',
    electronic:'#16a085', rock:'#d35400', classical:'#2980b9',
    ambient:'#27ae60', pop:'#e91e8c', unknown:'#555'
  };

  function render() {
    const { vinyls } = Store.get();
    const grid  = document.getElementById('vinylGrid');
    const empty = document.getElementById('emptyState');
    if (!grid) return;

    grid.innerHTML = '';
    grid.removeEventListener('click', handleCardClick);
    grid.addEventListener('click', handleCardClick);

    if (!vinyls.length) {
      empty && empty.classList.add('visible');
      return;
    }
    empty && empty.classList.remove('visible');

    vinyls.forEach(vinyl => {
      const color = GENRE_COLORS[vinyl.genre] || '#555';
      const cover = Store.getCover(vinyl.id);
      const tracks = vinyl.tracks?.length || 0;
      const year   = vinyl.year ? ` · ${vinyl.year}` : '';

      const card = document.createElement('div');
      card.className = 'vinyl-card';
      card.dataset.id = vinyl.id;

      // Circular vinyl display
      card.innerHTML = `
        <div class="vinyl-disc-wrap">
          <div class="vinyl-disc-outer">
            ${cover
              ? `<img src="${cover}" class="vinyl-disc-cover" />`
              : `<div class="vinyl-disc-grooves">
                   <div class="vinyl-disc-label" style="background:${color}">
                     <span>${esc(vinyl.name.substring(0,12))}</span>
                   </div>
                 </div>`
            }
            <div class="vinyl-disc-hole"></div>
          </div>
        </div>
        <div class="vinyl-card-body">
          <div class="vinyl-card-name" title="${esc(vinyl.name)}">${esc(vinyl.name)}</div>
          <div class="vinyl-card-meta">${esc(vinyl.artist||vinyl.genre||'—')}${year} · ${tracks} tracks</div>
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
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'play')   playVinyl(id);
    if (action === 'cover')  openCover(id);
    if (action === 'delete') deleteVinyl(id);
  }

  function playVinyl(id) {
    Store.setCurrentVinyl(id);
    const vinyl = Store.getVinyl(id);
    if (!vinyl) return;
    const track = vinyl.tracks?.[0];
    if (track) {
      document.getElementById('npTitle').textContent  = track.title;
      document.getElementById('npArtist').textContent = track.artist;
      document.getElementById('npDisc').style.animationPlayState = 'running';
    }
    // Spin the card disc
    const card = document.querySelector(`.vinyl-card[data-id="${id}"] .vinyl-disc-outer`);
    if (card) card.classList.toggle('spinning');
    // Trigger player
    if (typeof Player !== 'undefined') Player.playVinyl(id);
  }

  function openCover(id) {
    Store.setCurrentVinyl(id);
    App.navigate('cover');
  }

  function deleteVinyl(id) {
    if (!confirm('Remove this vinyl from your exhibit?')) return;
    Store.deleteVinyl(id);
    render();
  }

  function init() {
    const addBtn = document.getElementById('addVinylBtn');
    if (addBtn) addBtn.addEventListener('click', () => App.navigate('search-vinyl'));
    render();
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init, render };
})();
