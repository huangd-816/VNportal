const VinylSearch = (() => {
  const MB   = 'https://musicbrainz.org/ws/2';
  const CAA  = 'https://coverartarchive.org';
  const HDRS = {'User-Agent':'VNportal/1.0 (github.com/huangd-816/VNportal)'};
  let activeFilter = 'all';
  let cache = {};

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

    const cacheKey=`${q}:${activeFilter}`;
    if(cache[cacheKey]){
      results.innerHTML=''; cache[cacheKey].forEach(r=>renderCard(r,results)); return;
    }

    results.innerHTML='<div class="search-loading">◎ Searching...</div>';
    empty?.classList.add('hidden');
    const loader=Notify.loading('Searching MusicBrainz database...');

    try {
      let typeFilter='';
      if(activeFilter==='album')  typeFilter=' AND primarytype:Album';
      if(activeFilter==='ep')     typeFilter=' AND primarytype:EP';
      if(activeFilter==='single') typeFilter=' AND primarytype:Single';

      const url=`${MB}/release/?query=${encodeURIComponent(q)}${typeFilter}&fmt=json&limit=16`;
      const res=await fetch(url,{headers:HDRS});
      if(!res.ok) throw new Error('MusicBrainz returned '+res.status);
      const data=await res.json();
      const releases=data.releases||[];
      Notify.dismiss(loader);

      if(!releases.length){
        results.innerHTML='';
        empty?.classList.remove('hidden');
        if(empty) empty.textContent=`No results for "${q}"`;
        Notify.warn(`No vinyl found for "${q}"`);
        return;
      }

      cache[cacheKey]=releases;
      results.innerHTML='';
      releases.forEach(r=>renderCard(r,results));
      Notify.success(`Found ${releases.length} results`);
    } catch(err) {
      Notify.dismiss(loader);
      results.innerHTML='';
      Notify.error(`Search failed: ${err.message}`);
      const errEl=document.createElement('div');
      errEl.className='search-error-inline';
      errEl.innerHTML=`<span style="color:var(--accent2)">✕</span> Could not reach MusicBrainz.<br>
        <span style="font-size:.65rem;color:var(--text-dim)">Check your internet connection and try again.</span>`;
      results.appendChild(errEl);
    }
  }

  function renderCard(release, container) {
    const mbid  =release.id;
    const title =release.title||'Unknown';
    const artist=release['artist-credit']?.[0]?.name||'Unknown Artist';
    const year  =release.date?.split('-')[0]||'—';
    const tracks=release['track-count']||0;
    const type  =release['release-group']?.['primary-type']||'';
    const rgid  =release['release-group']?.id||'';

    const ytQuery=encodeURIComponent(`${title} ${artist} full album`);
    const ytPreviewUrl=`https://www.youtube.com/results?search_query=${ytQuery}`;

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
        <button class="btn-primary" style="font-size:.6rem;padding:.35rem .65rem"
          data-mbid="${mbid}" data-rgid="${rgid}" data-title="${esc(title)}"
          data-artist="${esc(artist)}" data-year="${year}" data-type="${esc(type)}">
          + Add
        </button>
        <a class="btn-secondary" href="${ytPreviewUrl}" target="_blank"
          style="font-size:.6rem;padding:.35rem .55rem;text-decoration:none;display:inline-block">
          ▶ Preview
        </a>
        <button class="btn-secondary" style="font-size:.6rem;padding:.35rem .55rem"
          onclick="window.open('https://musicbrainz.org/release/${mbid}','_blank')">
          Details
        </button>
      </div>
    `;

    card.querySelector('[data-mbid]').addEventListener('click', function() {
      importRelease(this, release, rgid);
    });

    container.appendChild(card);
    loadCoverImg(mbid, rgid, card.querySelector(`#art-${mbid}`));
  }

  function loadCoverImg(mbid, rgid, artEl) {
    if(!artEl) return;
    const img=document.createElement('img');
    img.style.cssText='width:100%;height:100%;object-fit:cover;display:none';
    img.alt='';
    const urls=[
      `${CAA}/release/${mbid}/front-250`,
      rgid?`${CAA}/release-group/${rgid}/front-250`:'',
    ].filter(Boolean);
    let idx=0;
    function next(){
      if(idx>=urls.length) return;
      img.src=urls[idx++];
    }
    img.onload=()=>{
      img.style.display='block';
      artEl.querySelector('.search-art-placeholder')?.remove();
    };
    img.onerror=next;
    artEl.appendChild(img);
    next();
  }

  async function importRelease(btn, release, rgid) {
    const mbid  =release.id;
    const title =release.title;
    const artist=release['artist-credit']?.[0]?.name||'Unknown';
    const year  =release.date?.split('-')[0]||'';
    const type  =release['release-group']?.['primary-type']||'Album';

    btn.textContent='Loading...';
    btn.disabled=true;
    const loader=Notify.loading(`Importing "${title}"...`);

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
            youtubePreview:`https://www.youtube.com/results?search_query=${encodeURIComponent(t.title+' '+artist)}`
          });
        });
      });
    } catch(e){
      Notify.warn('Could not load full tracklist — album added with basic info');
    }

    const vinyl=Store.addVinyl({name:title,artist,year,type,genre:'unknown',mbid,source:'musicbrainz',tracks});
    saveCoverArt(vinyl.id, mbid, rgid);
    Exhibit.render();
    Notify.dismiss(loader);
    Notify.success(`"${title}" added to your exhibit!`);

    btn.textContent='✓ Added!';
    btn.style.background='#27ae60';
    setTimeout(()=>{ btn.textContent='+ Add'; btn.style.background=''; btn.disabled=false; },2000);
    setTimeout(()=>App.navigate('exhibit'),1500);
  }

  function saveCoverArt(vinylId, mbid, rgid) {
    const urls=[
      `${CAA}/release/${mbid}/front`,
      rgid?`${CAA}/release-group/${rgid}/front`:'',
    ].filter(Boolean);
    let idx=0;
    function tryNext(){
      if(idx>=urls.length) return;
      const img=new Image();
      img.crossOrigin='anonymous';
      img.onload=()=>{
        try {
          const c=document.createElement('canvas'); c.width=c.height=500;
          c.getContext('2d').drawImage(img,0,0,500,500);
          Store.saveCover(vinylId,c.toDataURL('image/jpeg',0.85));
          Exhibit.render();
        } catch {
          Store.saveCoverUrl(vinylId,img.src);
          Exhibit.render();
        }
      };
      img.onerror=tryNext;
      img.src=urls[idx++];
    }
    tryNext();
  }

  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  return{init};
})();
