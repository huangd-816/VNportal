// ============================================
// VNportal — Exhibit Page
// ============================================

const Exhibit = (() => {
  const GENRE_COLORS = {
    jazz: '#c0392b', soul: '#8e44ad', hiphop: '#2c3e50',
    electronic: '#16a085', rock: '#d35400', classical: '#2980b9',
    ambient: '#27ae60', pop: '#e91e8c'
  };

  function render() {
    const { vinyls } = Store.get();
    const grid = document.getElementById('vinylGrid');
    const empty = document.getElementById('emptyState');

    grid.innerHTML = '';

    if (!vinyls.length) {
      empty.classList.add('visible');
      return;
    }
    empty.classList.remove('visible');

    vinyls.forEach(vinyl => {
      const color = GENRE_COLORS[vinyl.genre] || '#555';
      const cover = Store.getCover(vinyl.id);
      const card = document.createElement('div');
      card.className = 'vinyl-card';
      card.dataset.id = vinyl.id;

      card.innerHTML = `
        <div class="vinyl-sleeve">
          ${cover
            ? `<img src="${cover}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;" />`
            : `<div class="vinyl-sleeve-inner">
                <div class="vinyl-label-sm" style="background:${color}">
                  ${escHtml(vinyl.name)}
                </div>
              </div>`
          }
        </div>
        <div class="vinyl-card-name">${escHtml(vinyl.name)}</div>
        <div class="vinyl-card-meta">${vinyl.genre} · ${vinyl.tracks?.length || 0} tracks</div>
        <div style="display:flex;gap:0.5rem;margin-top:0.75rem;">
          <button class="btn-secondary" style="font-size:0.65rem;padding:0.4rem 0.75rem;" data-action="play" data-id="${vinyl.id}">▶ Play</button>
          <button class="btn-secondary" style="font-size:0.65rem;padding:0.4rem 0.75rem;" data-action="cover" data-id="${vinyl.id}">🎨 Cover</button>
          <button class="btn-secondary" style="font-size:0.65rem;padding:0.4rem 0.75rem;color:#e74c3c;" data-action="delete" data-id="${vinyl.id}">✕</button>
        </div>
      `;
      grid.appendChild(card);
    });

    // Delegate events
    grid.addEventListener('click', handleCardClick);
  }

  function handleCardClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'play')   playVinyl(id);
    if (action === 'cover')  openCoverForVinyl(id);
    if (action === 'delete') deleteVinyl(id);
  }

  function playVinyl(id) {
    Store.setCurrentVinyl(id);
    const vinyl = Store.getVinyl(id);
    if (!vinyl) return;
    const track = vinyl.tracks?.[0];
    document.getElementById('npTitle').textContent  = track?.title || vinyl.name;
    document.getElementById('npArtist').textContent = track?.artist || vinyl.genre;
    document.getElementById('npDisc').style.animationPlayState = 'running';
  }

  function openCoverForVinyl(id) {
    Store.setCurrentVinyl(id);
    App.navigate('cover');
  }

  function deleteVinyl(id) {
    if (!confirm('Remove this vinyl from your exhibit?')) return;
    Store.deleteVinyl(id);
    render();
  }

  function init() {
    document.getElementById('addVinylBtn').addEventListener('click', () => App.navigate('build'));
    render();
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init, render };
})();
