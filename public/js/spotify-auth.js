const SpotifyAuth = (() => {
  const CLIENT_ID = '032428c33a9b4c1d86e37f48f18180c6';
  const REDIRECT  = 'http://127.0.0.1:4000';
  const SCOPES    = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing';

  let accessToken=null, tokenExpiry=0, isPremiumUser=false, userProfile=null;

  // PKCE — verified working implementation
  function generateVerifier(){
    const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const arr=new Uint8Array(64);
    crypto.getRandomValues(arr);
    return Array.from(arr,b=>chars[b%chars.length]).join('');
  }

  async function generateChallenge(verifier){
    const data=new TextEncoder().encode(verifier);
    const hash=await crypto.subtle.digest('SHA-256',data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }

  async function login(){
    // Clear any stale state first
    localStorage.removeItem('sp_pkce_verifier');
    localStorage.removeItem('sp_pkce_state');

    const verifier=generateVerifier();
    const challenge=await generateChallenge(verifier);
    const state=Math.random().toString(36).substring(2,15);

    // Store BOTH in localStorage (sessionStorage unreliable across redirects)
    localStorage.setItem('sp_pkce_verifier',verifier);
    localStorage.setItem('sp_pkce_state',state);

    const url=new URL('https://accounts.spotify.com/authorize');
    url.searchParams.set('client_id',CLIENT_ID);
    url.searchParams.set('response_type','code');
    url.searchParams.set('redirect_uri',REDIRECT);
    url.searchParams.set('scope',SCOPES);
    url.searchParams.set('code_challenge_method','S256');
    url.searchParams.set('code_challenge',challenge);
    url.searchParams.set('state',state);
    window.location.href=url.toString();
  }

  async function handleCallback(code,returnedState){
    const verifier=localStorage.getItem('sp_pkce_verifier');
    const savedState=localStorage.getItem('sp_pkce_state');

    if(!verifier){
      Notify.error('Spotify auth failed: verifier missing — please try connecting again');
      return;
    }
    // State check optional but good practice
    if(savedState&&returnedState&&savedState!==returnedState){
      Notify.error('Spotify auth failed: state mismatch');
      return;
    }

    localStorage.removeItem('sp_pkce_verifier');
    localStorage.removeItem('sp_pkce_state');

    const body=new URLSearchParams({
      client_id:CLIENT_ID,
      grant_type:'authorization_code',
      code,
      redirect_uri:REDIRECT,
      code_verifier:verifier,
    });

    const res=await fetch('https://accounts.spotify.com/api/token',{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:body.toString(),
    });
    const data=await res.json();

    if(data.error){
      Notify.error(`Spotify: ${data.error_description||data.error}`);
      console.error('Spotify token error:',data);
      return;
    }
    storeTokens(data);
    window.history.replaceState({},'','/');
    await loadProfile();
  }

  function storeTokens(data){
    accessToken=data.access_token;
    tokenExpiry=Date.now()+(data.expires_in||3600)*1000;
    localStorage.setItem('sp_token',accessToken);
    localStorage.setItem('sp_expiry',String(tokenExpiry));
    if(data.refresh_token) localStorage.setItem('sp_refresh',data.refresh_token);
  }

  async function doRefresh(){
    const rt=localStorage.getItem('sp_refresh'); if(!rt) return false;
    const res=await fetch('https://accounts.spotify.com/api/token',{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:CLIENT_ID,grant_type:'refresh_token',refresh_token:rt}).toString(),
    });
    const data=await res.json();
    if(!data.access_token) return false;
    storeTokens(data); return true;
  }

  async function getToken(){
    if(accessToken&&Date.now()<tokenExpiry-30000) return accessToken;
    if(await doRefresh()) return accessToken;
    return null;
  }

  async function api(path,opts={}){
    const token=await getToken(); if(!token) return null;
    const res=await fetch(`https://api.spotify.com/v1${path}`,{
      ...opts,
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(opts.headers||{})},
    });
    if(res.status===204||res.status===202) return {};
    if(!res.ok){ console.warn('Spotify API',path,res.status); return null; }
    return res.json();
  }

  async function loadProfile(){
    const p=await api('/me'); if(!p) return;
    userProfile=p; isPremiumUser=p.product==='premium';
    updateUI();
    if(isPremiumUser) Notify.success(`Spotify ✦ Premium connected — ${p.display_name}`);
    else Notify.info(`Spotify connected (Free) — ${p.display_name} · 30s previews only`);
  }

  function updateUI(){
    const btn=document.getElementById('spotifyBtn');
    const lbl=document.getElementById('spotifyBtnLabel');
    if(!btn) return;
    if(userProfile){
      if(lbl) lbl.textContent=`${userProfile.display_name}${isPremiumUser?' ✦':''}`;
      btn.classList.add('connected');
      btn.onclick=disconnect;
    } else {
      if(lbl) lbl.textContent='Connect Spotify';
      btn.classList.remove('connected');
      btn.onclick=login;
    }
  }

  function disconnect(){
    accessToken=null; tokenExpiry=0; userProfile=null; isPremiumUser=false;
    ['sp_token','sp_expiry','sp_refresh'].forEach(k=>localStorage.removeItem(k));
    updateUI(); Notify.info('Spotify disconnected');
  }

  async function search(q,limit=8){
    return api(`/search?q=${encodeURIComponent(q)}&type=track&limit=${limit}`);
  }
  async function play(did,uris){ return api(`/me/player/play?device_id=${did}`,{method:'PUT',body:JSON.stringify({uris})}); }
  async function pause(did){ return api(`/me/player/pause?device_id=${did}`,{method:'PUT'}); }
  async function seek(did,ms){ return api(`/me/player/seek?position_ms=${ms}&device_id=${did}`,{method:'PUT'}); }
  async function setVolume(did,pct){ return api(`/me/player/volume?volume_percent=${Math.round(pct)}&device_id=${did}`,{method:'PUT'}); }

  async function init(){
    const params=new URLSearchParams(window.location.search);
    const code=params.get('code');
    const state=params.get('state');
    const error=params.get('error');

    if(error){ Notify.error(`Spotify auth denied: ${error}`); window.history.replaceState({},'','/'); return; }
    if(code){ await handleCallback(code,state); return; }

    // Restore session
    const saved=localStorage.getItem('sp_token');
    const expiry=parseInt(localStorage.getItem('sp_expiry')||'0');
    if(saved&&Date.now()<expiry-30000){
      accessToken=saved; tokenExpiry=expiry; await loadProfile();
    } else if(localStorage.getItem('sp_refresh')){
      if(await doRefresh()) await loadProfile();
    }
    updateUI();
  }

  return{init,login,api,search,play,pause,seek,setVolume,getToken,
    isConnected:()=>!!accessToken&&Date.now()<tokenExpiry,
    isPremium:()=>isPremiumUser, getProfile:()=>userProfile};
})();
