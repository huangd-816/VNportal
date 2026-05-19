// ============================================
// VNportal — App Router
// ============================================

const App = (() => {
  let current = 'exhibit';

  function navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    const navEl  = document.querySelector(`[data-page="${page}"]`);
    if (pageEl) pageEl.classList.add('active');
    if (navEl)  navEl.classList.add('active');
    current = page;

    // Page lifecycle hooks
    if (page === 'exhibit')       Exhibit.render();
    if (page === 'cover')         Cover.onShow();
    if (page === 'mix')           DJMix.onShow();
  }

  function init() {
    document.querySelectorAll('.nav-item').forEach(link => {
      link.addEventListener('click', e => { e.preventDefault(); navigate(link.dataset.page); });
    });

    // Init all modules
    Exhibit.init();
    Build.init();
    Cover.init();
    VinylSearch.init();
    Snake.init();
    Game2048.init();
    DJMix.init();
    Player.initUI();
    Spotify.init();

    navigate('exhibit');

    // Restore now-playing
    const vinyl = Store.getCurrentVinyl();
    if (vinyl?.tracks?.length) {
      document.getElementById('npTitle').textContent  = vinyl.tracks[0].title;
      document.getElementById('npArtist').textContent = vinyl.tracks[0].artist;
    }

    // Button to add vinyl from exhibit → go to search or build
    document.getElementById('addVinylBtn').addEventListener('click', () => navigate('search-vinyl'));
  }

  return { init, navigate, current: () => current };
})();

document.addEventListener('DOMContentLoaded', App.init);
