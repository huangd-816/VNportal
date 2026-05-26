const Discussion = (() => {
  const KEY='vn_disc', LIKED_KEY='vn_disc_liked';
  const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let tab='community';

  const SEED=[
    {id:'s1',user:'Maria L.',region:'Brazil',text:'Just found a mint 1973 Caetano Veloso pressing at a flea market. The sound is unreal!',genre:'MPB',artist:'Caetano Veloso',album:'',ts:Date.now()-172800000,likes:14},
    {id:'s2',user:'Takeshi M.',region:'Japan',text:'City pop revival is real — my Mariya Takeuchi collection has tripled in value since 2022.',genre:'City Pop',artist:'Mariya Takeuchi',album:'Variety',ts:Date.now()-86400000,likes:28},
    {id:'s3',user:'Clara W.',region:'UK',text:'Anyone else prefer the UK pressing of Dark Side of the Moon over the US? The bass is so much tighter.',genre:'Rock',artist:'Pink Floyd',album:'The Dark Side of the Moon',ts:Date.now()-28800000,likes:19},
    {id:'s4',user:'Ahmed K.',region:'Egypt',text:'First timer here — just set up my turntable. Any tips for storing vinyl in a humid climate?',genre:'',artist:'',album:'',ts:Date.now()-18000000,likes:7},
    {id:'s5',user:'Sofia R.',region:'Argentina',text:'Astor Piazzolla live recordings from the 70s are criminally underrated on vinyl.',genre:'Tango',artist:'Astor Piazzolla',album:'',ts:Date.now()-10800000,likes:11},
    {id:'s6',user:'Jake T.',region:'US',text:'Cleaned my stylus for the first time in 2 years. Feels like a completely new record collection.',genre:'',artist:'',album:'',ts:Date.now()-3600000,likes:31},
  ];

  function load(){ try{return JSON.parse(localStorage.getItem(KEY)||'[]');}catch{return[];} }
  function save(posts){ localStorage.setItem(KEY,JSON.stringify(posts)); }
  function loadLiked(){ try{return JSON.parse(localStorage.getItem(LIKED_KEY)||'[]');}catch{return[];} }
  function saveLiked(l){ localStorage.setItem(LIKED_KEY,JSON.stringify(l)); }

  function userName(){
    if(typeof Auth!=='undefined'&&Auth.getUser) return Auth.getUser()?.name||'You';
    return 'You';
  }

  function timeAgo(ts){
    const s=Math.floor((Date.now()-ts)/1000);
    if(s<60) return 'just now';
    if(s<3600) return `${Math.floor(s/60)}m ago`;
    if(s<86400) return `${Math.floor(s/3600)}h ago`;
    return `${Math.floor(s/86400)}d ago`;
  }

  function postHTML(p){
    return `
      <div class="disc-post">
        <div class="disc-post-meta">
          <div class="disc-post-avatar">${esc(p.user[0].toUpperCase())}</div>
          <span class="disc-post-user">${esc(p.user)}</span>
          ${p.region?`<span class="disc-badge disc-region">📍${esc(p.region)}</span>`:''}
          ${p.genre?`<span class="disc-badge disc-genre">${esc(p.genre)}</span>`:''}
          ${p.artist?`<span class="disc-badge disc-artist">${esc(p.artist)}</span>`:''}
          <span class="disc-post-time">${timeAgo(p.ts)}</span>
        </div>
        <div class="disc-post-text">${esc(p.text)}</div>
        ${p.album?`<div class="disc-post-album">💿 ${esc(p.album)}</div>`:''}
        <div class="disc-post-footer">
          <button class="disc-like-btn${p.liked?' liked':''}" data-id="${p.id}">♥ ${p.likes||0}</button>
          ${p.mine?`<button class="disc-del-btn" data-id="${p.id}" title="Delete">✕</button>`:''}
        </div>
      </div>`;
  }

  function fillSelect(id, items){
    const el=document.getElementById(id); if(!el) return;
    const first=el.options[0];
    el.innerHTML=''; el.appendChild(first);
    items.forEach(x=>{ const o=document.createElement('option'); o.value=x; o.textContent=x; el.appendChild(o); });
  }

  function populateFilters(){
    const {vinyls}=Store.get();
    const genres=[...new Set(vinyls.map(v=>v.genre).filter(Boolean))].sort();
    const artists=[...new Set(vinyls.flatMap(v=>(v.tracks||[]).map(t=>t.artist)).filter(Boolean))].sort();
    const albums=[...new Set(vinyls.map(v=>v.name).filter(Boolean))].sort();
    fillSelect('discFGenre',genres); fillSelect('discFArtist',artists); fillSelect('discFAlbum',albums);
    fillSelect('discPostGenre',genres); fillSelect('discPostArtist',artists); fillSelect('discPostAlbum',albums);
  }

  function renderCommunity(){
    const posts=load();
    const genre=document.getElementById('discFGenre')?.value||'';
    const artist=document.getElementById('discFArtist')?.value||'';
    const album=document.getElementById('discFAlbum')?.value||'';
    const region=(document.getElementById('discFRegion')?.value||'').toLowerCase();
    const liked=loadLiked();

    let filtered=posts.filter(p=>!p.scope||p.scope==='community');
    if(genre)  filtered=filtered.filter(p=>p.genre===genre);
    if(artist) filtered=filtered.filter(p=>p.artist===artist);
    if(album)  filtered=filtered.filter(p=>p.album===album);
    if(region) filtered=filtered.filter(p=>(p.region||'').toLowerCase().includes(region));
    filtered.reverse();

    const el=document.getElementById('discCommunityPosts'); if(!el) return;
    el.innerHTML=filtered.length
      ?filtered.map(p=>postHTML({...p,liked:liked.includes(p.id),mine:true})).join('')
      :'<div class="disc-empty">No posts yet — start the conversation!</div>';
    bindActions(el,'community');
  }

  function renderWorld(){
    const local=load().filter(p=>p.scope==='world');
    const liked=loadLiked();
    const all=[
      ...SEED.map(p=>({...p,liked:liked.includes(p.id),mine:false})),
      ...local.map(p=>({...p,liked:liked.includes(p.id),mine:true})),
    ].sort((a,b)=>b.ts-a.ts);

    const el=document.getElementById('discWorldPosts'); if(!el) return;
    el.innerHTML=all.map(p=>postHTML(p)).join('');
    bindActions(el,'world');
  }

  function bindActions(container, scope){
    container.querySelectorAll('.disc-like-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const id=btn.dataset.id;
        const liked=loadLiked();
        const posts=load();
        const p=posts.find(x=>x.id===id);
        if(liked.includes(id)){
          liked.splice(liked.indexOf(id),1);
          if(p) p.likes=Math.max(0,(p.likes||0)-1);
        } else {
          liked.push(id);
          if(p) p.likes=(p.likes||0)+1;
        }
        saveLiked(liked); save(posts);
        scope==='community'?renderCommunity():renderWorld();
      });
    });
    container.querySelectorAll('.disc-del-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        save(load().filter(p=>p.id!==btn.dataset.id));
        scope==='community'?renderCommunity():renderWorld();
      });
    });
  }

  function postTo(scope){
    const textId=scope==='community'?'discPostText':'discWorldText';
    const text=document.getElementById(textId)?.value.trim();
    if(!text){ Notify.warn('Write something first'); return; }
    const post={id:Date.now().toString(),user:userName(),text,ts:Date.now(),scope,likes:0};
    if(scope==='community'){
      post.genre=document.getElementById('discPostGenre')?.value||'';
      post.artist=document.getElementById('discPostArtist')?.value||'';
      post.album=document.getElementById('discPostAlbum')?.value||'';
      post.region=document.getElementById('discPostRegion')?.value||'';
    }
    const posts=load(); posts.push(post); save(posts);
    document.getElementById(textId).value='';
    scope==='community'?renderCommunity():renderWorld();
    Notify.success('Posted!');
  }

  function switchTab(t){
    tab=t;
    document.querySelectorAll('.disc-tab').forEach(el=>el.classList.toggle('active',el.dataset.tab===t));
    document.getElementById('discCommunity').style.display=t==='community'?'':'none';
    document.getElementById('discWorld').style.display=t==='world'?'':'none';
    t==='community'?renderCommunity():renderWorld();
  }

  function onShow(){ populateFilters(); tab==='community'?renderCommunity():renderWorld(); }

  function init(){
    document.querySelectorAll('.disc-tab').forEach(t=>t.addEventListener('click',()=>switchTab(t.dataset.tab)));
    ['discFGenre','discFArtist','discFAlbum','discFRegion'].forEach(id=>{
      document.getElementById(id)?.addEventListener('input',renderCommunity);
      document.getElementById(id)?.addEventListener('change',renderCommunity);
    });
    document.getElementById('discPostSend')?.addEventListener('click',()=>postTo('community'));
    document.getElementById('discWorldSend')?.addEventListener('click',()=>postTo('world'));
    document.getElementById('discPostText')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.ctrlKey)postTo('community');});
    document.getElementById('discWorldText')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.ctrlKey)postTo('world');});
  }

  return{init,onShow};
})();
