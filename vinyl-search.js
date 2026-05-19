// ============================================
// VNportal — Vinyl Search (MusicBrainz + Cover Art Archive)
// No API key needed — fully free
// ============================================

const VinylSearch = (() => {
  const MB_BASE  = 'https://musicbrainz.org/ws/2';
  const CAA_BASE = 'https://coverartarchive.org';
  const HEADERS  = { 'User-Agent': 'VNportal/1.0 (https://github.com/huangd-816/VNportal)' };
  let lastQuery  = '';
  let activeFilter = 'all';

  function init() {
    document.getElementById('vinylSearchBtn').addEventListener('click', doSearch);
    document.getElementById('vinylSearchInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch();
    });
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        if (lastQuery) doSearch();
      });
    });
  }

  async function doSearch() {
    const q = document.getElementById('vinylSearchInput').value.trim();
    if (!q) return;
    lastQuery = q;

    const results = document.getElementById('searchResults');
    const empty   = document.getElementById('searchEmpty');
    results.innerHTML = `<div class="search-loading">◎ Searching vinyl database...</div>`;
    empty.classList.add('hidden');

    try {
      // Build query — filter by release type if selected
      let typeFilter = '';
      if (activeFilter === 'album')  typeFilter = ' AND primarytype:Album';
      if (activeFilter === 'ep')     typeFilter = ' AND primarytype:EP';
      if (activeFilter === 'single') typeFilter = ' AND primarytype:Single';

      const url = `${MB_BASE}/release/?query=${encodeURIComponent(q)}${typeFilter}&fmt=json&limit=16`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      const releases = data.releases || [];
      if (!releases.length) {
        results.innerHTML = '';
        empty.classList.remove('hidden');
        empty.textContent = `No results for "${q}"`;
        return;
      }

      results.innerHTML = '';
      releases.forEach(release => renderCard(release, results));
    } catch (err) {
      results.innerHTML = `<div class="search-loading" style="color:var(--accent2)">
        Failed to search — check your connection and try again.
      </div>`;
    }
  }

  function renderCard(release, container) {
    const mbid    = release.id;
    const title   = release.title || 'Unknown';
    const artist  = release['artist-credit']?.[0]?.name || 'Unknown Artist';
    const year    = release.date?.split('-')[0] || '—';
    const tracks  = release['track-count'] || 0;
    const type    = release['release-group']?.['primary-type'] || '';

    const card = document.createElement('div');
    card.className = 'search-card';
    card.innerHTML = `
      <div class="search-card-art" id="art-${mbid}">
        <span class="search-card-art-placeholder">◎</span>
      </div>
      <div class="search-card-info">
        <div class="search-card-title" title="${esc(title)}">${esc(title)}</div>
        <div class="search-card-artist">${esc(artist)}</div>
        <div class="search-card-meta">${year} · ${type} · ${tracks} tracks</div>
      </div>
      <div class="search-card-actions">
        <button class="btn-primary" style="font-size:.62rem;padding:.4rem .75rem" data-action="add">+ Add to Exhibit</button>
        <button class="btn-secondary" style="font-size:.62rem;padding:.4rem .65rem" data-action="details">Details</button>
      </div>
    `;

    card.querySelector('[data-action="add"]').addEventListener('click', () => importRelease(release));
    card.querySelector('[data-action="details"]').addEventListener('click', () => {
      window.open(`https://musicbrainz.org/release/${mbid}`, '_blank');
    });

    container.appendChild(card);

    // Async cover art fetch
    loadCoverArt(mbid, card.querySelector(`#art-${mbid}`));
  }

  async function loadCoverArt(mbid, artEl) {
    // Try Cover Art Archive
    const imgUrl = `${CAA_BASE}/release/${mbid}/front-250`;
    const img    = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      artEl.innerHTML = '';
      artEl.appendChild(img);
    };
    img.onerror = () => {
      // Keep placeholder
    };
    img.src = imgUrl;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover';
  }

  async function importRelease(release) {
    const mbid   = release.id;
    const title  = release.title;
    const artist = release['artist-credit']?.[0]?.name || 'Unknown';
    const year   = release.date?.split('-')[0] || '';
    const type   = release['release-group']?.['primary-type'] || 'Album';

    // Show loading state on button
    const addBtn = document.querySelector(`[data-mbid="${mbid}"]`) || null;

    // Fetch full tracklist from MusicBrainz
    let tracks = [];
    try {
      const res  = await fetch(`${MB_BASE}/release/${mbid}?inc=recordings&fmt=json`, { headers: HEADERS });
      const data = await res.json();
      const media = data.media || [];
      media.forEach(m => {
        (m.tracks || []).forEach(t => {
          tracks.push({
            title:   t.title,
            artist:  t['artist-credit']?.[0]?.name || artist,
            hasLocal: false,
            youtubeUrl: null,
          });
        });
      });
    } catch {
      // Fallback — just add the album with no tracks listed
    }

    // Save vinyl with metadata
    const vinyl = Store.addVinyl({
      name:    title,
      artist,
      year,
      type,
      genre:   'unknown',
      mbid,
      source:  'musicbrainz',
      tracks,
    });

    // Try to save cover art into our store
    try {
      const imgUrl  = `${CAA_BASE}/release/${mbid}/front`;
      const imgResp = await fetch(imgUrl);
      if (imgResp.ok) {
        const blob   = await imgResp.blob();
        const reader = new FileReader();
        reader.onload = e => {
          Store.saveCover(vinyl.id, e.target.result);
          Exhibit.render();
        };
        reader.readAsDataURL(blob);
      }
    } catch {}

    Exhibit.render();

    // Flash and navigate
    const btn = event.target;
    const orig = btn.textContent;
    btn.textContent = '✓ Added!';
    btn.style.background = '#27ae60';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = '';
    }, 1800);

    setTimeout(() => App.navigate('exhibit'), 1500);
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init };
})();
