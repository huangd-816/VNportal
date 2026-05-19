// ============================================
// VNportal — Build Vinyl Page
// ============================================

const Build = (() => {
  let tracks = [];

  function init() {
    document.getElementById('addTrackBtn').addEventListener('click', addTrack);
    document.getElementById('pressVinylBtn').addEventListener('click', pressVinyl);
    document.getElementById('vinylName').addEventListener('input', updatePreview);

    document.getElementById('trackTitle').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('trackArtist').focus();
    });
    document.getElementById('trackArtist').addEventListener('keydown', e => {
      if (e.key === 'Enter') addTrack();
    });
  }

  function addTrack() {
    const title  = document.getElementById('trackTitle').value.trim();
    const artist = document.getElementById('trackArtist').value.trim();
    if (!title) return;

    tracks.push({ title, artist: artist || 'Unknown' });
    document.getElementById('trackTitle').value  = '';
    document.getElementById('trackArtist').value = '';
    document.getElementById('trackTitle').focus();
    renderTrackList();
  }

  function renderTrackList() {
    const list = document.getElementById('trackList');
    list.innerHTML = '';
    tracks.forEach((t, i) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="track-num">${String(i+1).padStart(2,'0')}</span>
        <span style="flex:1">${esc(t.title)}</span>
        <span style="color:var(--text-dim);font-size:0.7rem">${esc(t.artist)}</span>
        <button class="track-remove" data-i="${i}">✕</button>
      `;
      list.appendChild(li);
    });
    list.querySelectorAll('.track-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        tracks.splice(parseInt(btn.dataset.i), 1);
        renderTrackList();
      });
    });
  }

  function updatePreview() {
    const name = document.getElementById('vinylName').value || '?';
    document.getElementById('previewName').textContent = name;
  }

  function pressVinyl() {
    const name  = document.getElementById('vinylName').value.trim();
    const genre = document.getElementById('vinylGenre').value;

    if (!name) {
      alert('Give your vinyl a name first!');
      document.getElementById('vinylName').focus();
      return;
    }
    if (!tracks.length) {
      alert('Add at least one track!');
      return;
    }

    const vinyl = Store.addVinyl({ name, genre, tracks: [...tracks] });

    // Reset form
    document.getElementById('vinylName').value = '';
    document.getElementById('previewName').textContent = '?';
    tracks = [];
    renderTrackList();

    // Flash feedback
    const btn = document.getElementById('pressVinylBtn');
    const orig = btn.textContent;
    btn.textContent = '✓ Pressed!';
    btn.style.background = '#27ae60';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = '';
    }, 1800);

    Exhibit.render();
    setTimeout(() => App.navigate('exhibit'), 1200);
  }

  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init };
})();
