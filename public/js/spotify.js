// ============================================
// VNportal — Spotify Auth (PKCE)
// Client ID: 032428c33a9b4c1d86e37f48f18180c6
// Redirect: http://127.0.0.1:4000
// ============================================
const Spotify = (() => {
  const CLIENT_ID   = '032428c33a9b4c1d86e37f48f18180c6';
  const REDIRECT    = 'http://127.0.0.1:4000';
  const SCOPES      = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'playlist-read-private',
  ].join(' ');

  let token=null, expiry=0, player=null, deviceId=null, isPremium=false;

  // ── PKCE helpers ──────────────────────────
  function rnd(len=128){
    const arr=new Uint8Array(len); crypto.getRandomValues(arr);
    return btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  async function challenge(verifier){
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }

  // ── Login ─────────────────────────────────
  async function login(){
    const verifier=rnd();
    const ch=await challenge(verifier);
    sessionStorage.setItem('sp_verifier',verifier);
    const p=new URLSearchParams({
      client_id:CLIENT_ID, response_type:'code',
      redirect_uri:REDIRECT, code_challenge_method:'S256',
      code_challenge:ch, scope:SCOPES,
    });
    window.location.href='https://accounts.spotify.com/authorize?'+p;
  }

  // ── Handle callback ────────────────────────
  async function handleCallback(code){
    const verifier=sessionStorage.getItem('sp_verifier');
    const res=await fetch('https://accounts.spotify.com/api/token',{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({
        client_id:CLIENT_ID, grant_type:'authorization_code',
        code, redirect_uri:REDIRECT, code_verifier:verifier,
      }),
    });
    const data=await res.json();
    if(data.access_token){
      token=data.access_token;
      expiry=Date.now()+data.expires_in*1000;
      localStorage.setItem('sp_token',token);
      localStorage.setItem('sp_expiry',expiry);
      localStorage.setItem('sp_refresh',data.refresh_token||'');
      window.history.replaceState({},'','/');
      await loadProfile();
      initSDK();
      Notify.success('Connected to Spotify ♫');
    } else {
      Notify.error('Spotify auth failed: '+JSON.stringify(data));
    }
  }

  async function refreshToken(){
    const rt=localStorage.getItem('sp_refresh'); if(!rt) return false;
    const res=await fetch('https://accounts.spotify.com/api/token',{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({
        client_id:CLIENT_ID, grant_type:'refresh_token', refresh_token:rt,
      }),
    });
    const data=await res.json();
    if(data.access_token){
      token=data.access_token;
      expiry=Date.now()+data.expires_in*1000;
      localStorage.setItem('sp_token',token);
      localStorage.setItem('sp_expiry',expiry);
      if(data.refresh_token) localStorage.setItem('sp_refresh',data.refresh_token);
      return true;
    }
    return false;
  }

  async function getToken(){
    if(token&&Date.now()<expiry-30000) return token;
    if(await refreshToken()) return token;
    return null;
  }

  // ── Profile ───────────────────────────────
  async function loadProfile(){
    const t=await getToken(); if(!t) return;
    const res=await fetch('https://api.spotify.com/v1/me',{headers:{Authorization:'Bearer '+t}});
    const user=await res.json();
    isPremium=user.product==='premium';
    updateSidebarBtn(user.display_name, isPremium);
    if(!isPremium) Notify.warn('Spotify Free detected — 30s previews only. Premium = full tracks.');
  }

  function updateSidebarBtn(name, premium){
    const btn=document.getElementById('spotifyBtn');
    const lbl=document.getElementById('spotifyBtnLabel');
    if(!btn) return;
    if(lbl) lbl.textContent=`${name} ${premium?'✦':'(free)'}`;
    btn.classList.add('connected');
    btn.onclick=disconnect;
  }

  function disconnect(){
    token=null; expiry=0; isPremium=false;
    localStorage.removeItem('sp_token'); localStorage.removeItem('sp_expiry');
    localStorage.removeItem('sp_refresh');
    const lbl=document.getElementById('spotifyBtnLabel');
    if(lbl) lbl.textContent='Connect Spotify';
    const btn=document.getElementById('spotifyBtn');
    if(btn){btn.classList.remove('connected'); btn.onclick=login;}
    player?.disconnect();
    Notify.info('Disconnected from Spotify');
  }

  // ── Web Playback SDK ──────────────────────
  function initSDK(){
    if(!isPremium) return; // SDK requires Premium
    if(document.getElementById('spSdkScript')) return;
    const s=document.createElement('script');
    s.id='spSdkScript';
    s.src='https://sdk.scdn.co/spotify-player.js';
    document.head.appendChild(s);
    window.onSpotifyWebPlaybackSDKReady=()=>{
      player=new window.Spotify.Player({
        name:'VNportal DJ',
        getOAuthToken:cb=>getToken().then(cb),
        volume:0.8,
      });
      player.addListener('ready',({device_id})=>{
        deviceId=device_id;
        Notify.success('Spotify player ready on this device');
      });
      player.addListener('not_ready',()=>{ deviceId=null; });
      player.addListener('player_state_changed',state=>{
        if(!state) return;
        // Update now-playing in sidebar
        const track=state.track_window?.current_track;
        if(track){
          document.getElementById('npTitle').textContent=track.name;
          document.getElementById('npArtist').textContent=track.artists.map(a=>a.name).join(', ');
          document.getElementById('npDisc').style.animationPlayState='running';
        }
      });
      player.connect();
    };
  }

  // ── Playback API ──────────────────────────
  async function playTrack(spotifyUri){
    const t=await getToken(); if(!t||!deviceId){ Notify.warn('Spotify not ready'); return false; }
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,{
      method:'PUT',
      headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},
      body:JSON.stringify({uris:[spotifyUri]}),
    });
    return true;
  }

  async function pausePlayback(){
    const t=await getToken(); if(!t) return;
    await fetch('https://api.spotify.com/v1/me/player/pause',{
      method:'PUT', headers:{Authorization:'Bearer '+t},
    });
  }

  async function setVolume(pct){
    const t=await getToken(); if(!t) return;
    await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${Math.round(pct)}`,{
      method:'PUT', headers:{Authorization:'Bearer '+t},
    });
  }

  // ── Search ────────────────────────────────
  async function search(query, limit=8){
    const t=await getToken(); if(!t) return [];
    const res=await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
      {headers:{Authorization:'Bearer '+t}}
    );
    const data=await res.json();
    return data.tracks?.items||[];
  }

  // ── Import playlist ───────────────────────
  async function importPlaylist(url){
    const match=url.match(/playlist\/([A-Za-z0-9]+)/);
    if(!match){Notify.error('Invalid playlist URL');return;}
    const t=await getToken(); if(!t) return;
    const res=await fetch(`https://api.spotify.com/v1/playlists/${match[1]}`,{headers:{Authorization:'Bearer '+t}});
    const data=await res.json();
    if(!data.tracks){Notify.error('Could not load playlist');return;}
    const tracks=data.tracks.items.filter(i=>i.track).map(i=>({
      title:i.track.name,
      artist:i.track.artists.map(a=>a.name).join(', '),
      spotifyUri:i.track.uri,
      hasLocal:false,youtubeUrl:null,
    }));
    const vinyl=Store.addVinyl({
      name:data.name, artist:data.owner?.display_name||'Spotify',
      genre:'unknown', source:'spotify', tracks,
    });
    const img=data.images?.[0]?.url;
    if(img){
      const imgEl=new Image(); imgEl.crossOrigin='anonymous';
      imgEl.onload=()=>{
        try{
          const c=document.createElement('canvas');c.width=c.height=500;
          c.getContext('2d').drawImage(imgEl,0,0,500,500);
          Store.saveCover(vinyl.id,c.toDataURL('image/jpeg',.85));
        }catch{Store.saveCoverUrl(vinyl.id,img);}
        Exhibit.render();
      };
      imgEl.src=img;
    }
    Exhibit.render();
    App.navigate('exhibit');
    Notify.success(`"${data.name}" imported — ${tracks.length} tracks`);
  }

  // ── Init ─────────────────────────────────
  function init(){
    const params=new URLSearchParams(window.location.search);
    if(params.get('code')){
      handleCallback(params.get('code'));
      return;
    }
    const saved=localStorage.getItem('sp_token');
    const exp  =parseInt(localStorage.getItem('sp_expiry')||'0');
    if(saved&&Date.now()<exp){
      token=saved; expiry=exp;
      loadProfile().then(()=>initSDK());
    } else if(localStorage.getItem('sp_refresh')){
      refreshToken().then(ok=>{ if(ok){ loadProfile().then(()=>initSDK()); } });
    } else {
      document.getElementById('spotifyBtn')?.addEventListener('click',login);
    }
    document.getElementById('spotifyImportBtn')?.addEventListener('click',()=>{
      const url=prompt('Paste your Spotify playlist URL:');
      if(url) importPlaylist(url);
    });
  }

  return{init,login,search,playTrack,pausePlayback,setVolume,
    isReady:()=>!!(token&&deviceId), isPremium:()=>isPremium, getToken};
})();
