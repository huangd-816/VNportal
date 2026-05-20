const App = (() => {
  function navigate(page) {
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    const pageEl=document.getElementById(`page-${page}`);
    const navEl =document.querySelector(`[data-page="${page}"]`);
    if(pageEl) pageEl.classList.add('active');
    if(navEl)  navEl.classList.add('active');

    if(page==='exhibit') Exhibit.render();
    if(page==='cover')   Cover.onShow();
    if(page==='popular') Workshop.onShow();
    if(page==='mix'&&typeof DJMix!=='undefined') DJMix.onShow();
  }

  function init() {
    document.querySelectorAll('.nav-item').forEach(link=>{
      link.addEventListener('click',e=>{e.preventDefault();navigate(link.dataset.page);});
    });

    Exhibit.init();
    Build.init();
    Cover.init();
    VinylSearch.init();
    Snake.init();
    Game2048.init();
    Puzzle.init();
    TrackMatch.init();
    if(typeof DJMix!=='undefined')   DJMix.init();
    if(typeof Player!=='undefined')  Player.initUI();
    if(typeof Spotify!=='undefined') Spotify.init();

    // Make new game cards active
    document.getElementById('sleevePuzzleCard')?.classList.remove('coming');
    document.getElementById('trackMatchCard')?.classList.remove('coming');

    // Force-hide all game containers on load
    ['snakeContainer','game2048Container','puzzleContainer','trackMatchContainer'].forEach(id=>{
      const el=document.getElementById(id);
      if(el){el.classList.add('hidden');el.style.display='none';}
    });

    // Override game container show/hide to use style.display
    const origPuzzleShow=document.getElementById('playPuzzleBtn');
    const origMatchShow=document.getElementById('playTrackMatchBtn');

    navigate('exhibit');

    const vinyl=Store.getCurrentVinyl();
    if(vinyl?.tracks?.length){
      document.getElementById('npTitle').textContent=vinyl.tracks[0].title;
      document.getElementById('npArtist').textContent=vinyl.tracks[0].artist;
    }
    document.getElementById('addVinylBtn')?.addEventListener('click',()=>navigate('search-vinyl'));

    // Track plays for workshop
    document.addEventListener('vnplay', e=>{
      if(e.detail?.vinylId) Workshop.trackPlay(e.detail.vinylId);
    });
  }

  return{init,navigate};
})();
document.addEventListener('DOMContentLoaded', App.init);
