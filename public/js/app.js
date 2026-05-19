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

    if (page === 'exhibit')      Exhibit.render();
    if (page === 'cover')        Cover.onShow();
    if (page === 'mix' && typeof DJMix !== 'undefined') DJMix.onShow();
  }

  function init() {
    document.querySelectorAll('.nav-item').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        navigate(link.dataset.page);
      });
    });

    // Init modules — guard each one
    Exhibit.init();
    Build.init();
    Cover.init();
    VinylSearch.init();
    Snake.init();
    Game2048.init();
    if (typeof DJMix !== 'undefined') DJMix.init();
    Player.initUI();
    if (typeof Spotify !== 'undefined') Spotify.init();

    // Make sure snake + 2048 containers start hidden
    document.getElementById('snakeContainer')?.classList.add('hidden');
    document.getElementById('game2048Container')?.classList.add('hidden');

    navigate('exhibit');

    const vinyl = Store.getCurrentVinyl();
    if (vinyl?.tracks?.length) {
      document.getElementById('npTitle').textContent  = vinyl.tracks[0].title;
      document.getElementById('npArtist').textContent = vinyl.tracks[0].artist;
    }

    document.getElementById('addVinylBtn')?.addEventListener('click', () => navigate('search-vinyl'));
  }

  return { init, navigate, current: () => current };
})();

document.addEventListener('DOMContentLoaded', App.init);
