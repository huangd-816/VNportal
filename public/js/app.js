// ============================================
// VNportal — App Router & Init
// ============================================

const App = (() => {
  let currentPage = 'exhibit';

  function navigate(page) {
    // Deactivate all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Activate target
    const pageEl = document.getElementById(`page-${page}`);
    const navEl  = document.querySelector(`[data-page="${page}"]`);
    if (pageEl) pageEl.classList.add('active');
    if (navEl)  navEl.classList.add('active');

    currentPage = page;

    // Page-specific hooks
    if (page === 'exhibit') Exhibit.render();
    if (page === 'cover') {
      const vinyl = Store.getCurrentVinyl();
      if (vinyl) Cover.loadCover(vinyl.id);
    }
  }

  function init() {
    // Wire nav
    document.querySelectorAll('.nav-item').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        navigate(link.dataset.page);
      });
    });

    // Init modules
    Exhibit.init();
    Build.init();
    Cover.init();
    Snake.init();

    // Start on exhibit
    navigate('exhibit');

    // Load current vinyl into now-playing if exists
    const vinyl = Store.getCurrentVinyl();
    if (vinyl && vinyl.tracks?.length) {
      document.getElementById('npTitle').textContent  = vinyl.tracks[0].title;
      document.getElementById('npArtist').textContent = vinyl.tracks[0].artist;
    }
  }

  return { init, navigate };
})();

document.addEventListener('DOMContentLoaded', App.init);
