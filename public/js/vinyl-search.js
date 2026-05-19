// ============================================
// VNportal — Vinyl Search (MusicBrainz + Cover Art)
// Fixed: event.target undefined, CORS cover art,
//        404 fallbacks, willReadFrequently
// ============================================
const VinylSearch = (() => {
  const MB   = 'https://musicbrainz.org/ws/2';
  const CAA  = 'https://coverartarchive.org';
  const HDRS = {'User-Agent':'VNportal/1.0 (github.com/huangd-816/VNportal)'};
  let activeFilter = 'all';

  function init() {
    document.getElementById('vinylSearchBtn')?.addEventListener('click', doSearch);
    document.getElementById('vinylSearchInput')?.addEventListener('keydown', e=>{
      if(e.key==='Enter') doSearch();
    });
    document.querySelectorAll('.filter-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter=btn.dataset.filter;
      });
    });
  }

  async function doSearch() {
    const q=document.getElementById('vinylSearchInput')?.value?.trim();
    if(!q) return;
    const results=document.getElementById('searchResults');
    const empty=document.getElementById('searchEmpty');
    if(!results) return;
    results.innerHTML='<div class="search-loading">◎ Searching vinyl database...</div>';
    empty?.classList.add('hidden');

    try {
      let typeFilter='';
      if(activeFilter==='album')  typeFilter=' AND primarytype:Album';
      if(activeFilter==='ep')     typeFilter=' AND primarytype:EP';
      if(activeFilter==='single') typeFilter=' AND primarytype:Single';

      const url=`${MB}/release/?query=${encodeURIComponent(q)}${typeFilter}&fmt=json&limit=16`;
      const res=await fetch(url,{headers:HDRS});
      if(!res.ok) throw new Error('API error '+res.status);
      const data=await res.json();
      const releases=data.releases||[];

      if(!releases.length){
        results.innerHTML='';
        if(empty){empty.classList.remove('hidden');empty.textContent=`No results for "${q}"`;}
        return;
      }

      results.innerHTML='';
      releases.forEach(r=>renderCard(r,results));
    } catch(err) {
      results.innerHTML=`<div class="search-loading" style="color:var(--accent2)">Search failed — check connection. (${err.message})</div>`;
    }
  }

  function renderCard(release, container) {
    const mbid   = release.id;
    const title  = release.title||'Unknown';
    const artist = release['artist-credit']?.[0]?.name||'Unknown Artist';
    const year   = release.date?.split('-')[0]||'—';
    const tracks = release['track-count']||0;
    const type   = release['release-group']?.['primary-type']||'';
    const rgid   = release['release-group']?.id||'';

    const card=document.createElement('div');
    card.className='search-card';
    card.innerHTML=`
      <div class="search-card-art" id="art-${mbid}">
        <div class="search-art-placeholder">◎</div>
      </div>
      <div class="search-card-info">
        <div class="search-card-title" title="${esc(title)}">${esc(title)}</div>
        <div class="search-card-artist">${esc(artist)}</div>
        <div class="search-card-meta">${year} · ${type||'Release'} · ${tracks} tracks</div>
      </div>
      <div class="search-card-actions">
        <button class="btn-primary" style="font-size:.62rem;padding:.4rem .75rem" 
          data-mbid="${mbid}" data-rgid="${rgid}" 
          data-title="${esc(title)}" data-artist="${esc(artist)}" 
          data-year="${year}" data-type="${esc(type)}" data-tracks="${tracks}">
          + Add to Exhibit
        </button>
        <button class="btn-secondary" style="font-size:.62rem;padding:.4rem .65rem" 
          onclick="window.open('https://musicbrainz.org/release/${mbid}','_blank')">
          Details
        </button>
      </div>
    `;

    // Add button handler — pass button element directly, no event dependency
    const addBtn=card.querySelector('[data-mbid]');
    addBtn.addEventListener('click', function() {
      importRelease(this, release, rgid);
    });

    container.appendChild(card);

    // Load cover art — img tag avoids CORS issues for display
    loadCoverImg(mbid, rgid, card.querySelector(`#art-${mbid}`));
  }

  function loadCoverImg(mbid, rgid, artEl) {
    if(!artEl) return;
    const img=document.createElement('img');
    img.style.cssText='width:100%;height:100%;object-fit:cover;display:none';
    img.alt='';

    // Try release cover first, then release-group cover
    const tryUrls=[
      `${CAA}/release/${mbid}/front-250`,
      rgid?`${CAA}/release-group/${rgid}/front-250`:'',
    ].filter(Boolean);

    let idx=0;
    function tryNext(){
      if(idx>=tryUrls.length) return; // keep placeholder
      img.src=tryUrls[idx++];
    }

    img.onload=()=>{
      img.style.display='block';
      const ph=artEl.querySelector('.search-art-placeholder');
      if(ph) ph.style.display='none';
    };
    img.onerror=tryNext;

    artEl.appendChild(img);
    tryNext();
  }

  async function importRelease(btn, release, rgid) {
    const mbid  = release.id;
    const title = release.title;
    const artist= release['artist-credit']?.[0]?.name||'Unknown';
    const year  = release.date?.split('-')[0]||'';
    const type  = release['release-group']?.['primary-type']||'Album';

    btn.textContent='Loading...';
    btn.disabled=true;

    // Fetch tracklist
    let tracks=[];
    try {
      const res=await fetch(`${MB}/release/${mbid}?inc=recordings&fmt=json`,{headers:HDRS});
      const data=await res.json();
      (data.media||[]).forEach(m=>{
        (m.tracks||[]).forEach(t=>{
          tracks.push({
            title:  t.title,
            artist: t['artist-credit']?.[0]?.name||artist,
            hasLocal:false, youtubeUrl:null,
          });
        });
      });
    } catch{}

    const vinyl=Store.addVinyl({name:title,artist,year,type,genre:'unknown',mbid,source:'musicbrainz',tracks});

    // Save cover art — use img element to avoid CORS, then draw to canvas
    saveCoverArt(vinyl.id, mbid, rgid);

    Exhibit.render();
    btn.textContent='✓ Added!';
    btn.style.background='#27ae60';
    setTimeout(()=>{ btn.textContent='+ Add to Exhibit'; btn.style.background=''; btn.disabled=false; },2000);
    setTimeout(()=>App.navigate('exhibit'),1500);
  }

  function saveCoverArt(vinylId, mbid, rgid) {
    // Draw into an offscreen canvas via img element to handle CORS gracefully
    const tryUrls=[
      `${CAA}/release/${mbid}/front`,
      rgid?`${CAA}/release-group/${rgid}/front`:'',
    ].filter(Boolean);

    let idx=0;
    function tryNext(){
      if(idx>=tryUrls.length) return;
      const img=new Image();
      img.crossOrigin='anonymous';
      img.onload=()=>{
        try {
          const c=document.createElement('canvas');
          c.width=c.height=500;
          const cx=c.getContext('2d');
          cx.drawImage(img,0,0,500,500);
          Store.saveCover(vinylId,c.toDataURL('image/jpeg',0.85));
          Exhibit.render();
        } catch {
          // CORS blocked canvas taint — save img src as cover URL alternative
          // Store the URL directly so exhibit can use it as <img src>
          Store.saveCoverUrl(vinylId, img.src);
          Exhibit.render();
        }
      };
      img.onerror=tryNext;
      img.src=tryUrls[idx++];
    }
    tryNext();
  }

  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  return{init};
})();
