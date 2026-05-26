// ============================================
// VNportal — Auth System
// ============================================

// ── OAuth credentials ──────────────────────
// Google:  console.cloud.google.com → APIs & Services → Credentials
//          Create OAuth 2.0 Client ID (Web), add http://127.0.0.1:4000
//          as Authorized JavaScript Origin
// Discord: discord.com/developers → New App → OAuth2
//          Add http://127.0.0.1:4000 as redirect URI
const OAUTH_CONFIG = {
  google:  { clientId: '48697032427-lrl7d1cghrkni50ovrqsqfvrvnf33kli.apps.googleusercontent.com' },
  discord: { clientId: '1508773910013808660' },
};

const Auth = (() => {
  const USERS_KEY   = 'vn_users';
  const SESSION_KEY = 'vn_session';
  let currentUser   = null;

  function getUsers(){ try{return JSON.parse(localStorage.getItem(USERS_KEY)||'[]');}catch{return[];} }
  function saveUsers(u){ localStorage.setItem(USERS_KEY,JSON.stringify(u)); }
  function saveSession(s){ localStorage.setItem(SESSION_KEY,JSON.stringify(s)); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }

  async function hashPw(pw){
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pw+'vnportal_salt'));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function signup(name,email,password){
    if(!name||!email||!password){ Notify.error('All fields required'); return false; }
    if(password.length<6){ Notify.error('Password must be 6+ characters'); return false; }
    const users=getUsers();
    if(users.find(u=>u.email===email.toLowerCase())){ Notify.error('Email already registered'); return false; }
    const hash=await hashPw(password);
    const user={id:'local_'+Date.now(),name,email:email.toLowerCase(),hash,avatar:null,provider:'email',createdAt:new Date().toISOString()};
    users.push(user); saveUsers(users); setSession(user);
    Notify.success(`Welcome, ${name}! 🎵`); return true;
  }

  async function login(email,password){
    if(!email||!password){ Notify.error('Email and password required'); return false; }
    const users=getUsers();
    const user=users.find(u=>u.email===email.toLowerCase());
    if(!user){ Notify.error('No account found with that email'); return false; }
    if(await hashPw(password)!==user.hash){ Notify.error('Incorrect password'); return false; }
    setSession(user); Notify.success(`Welcome back, ${user.name}! 🎵`); return true;
  }

  function setSession(user){
    currentUser={id:user.id,name:user.name,email:user.email,avatar:user.avatar||null,provider:user.provider};
    saveSession(currentUser); updateUI(); closeModal();
  }

  function logout(){
    if(currentUser?.provider==='google'&&window.google?.accounts?.id){
      google.accounts.id.disableAutoSelect();
      google.accounts.id.revoke(currentUser.email,()=>{});
    }
    currentUser=null; clearSession(); updateUI(); Notify.info('Signed out');
  }
  function getUser(){ return currentUser; }
  function isLoggedIn(){ return !!currentUser; }

  function updateUI(){
    const btn=document.getElementById('authBtn');
    const avatar=document.getElementById('authAvatar');
    const nameEl=document.getElementById('authName');
    if(!btn) return;
    if(currentUser){
      btn.textContent='';
      if(avatar){avatar.style.display='flex';avatar.textContent=currentUser.name[0].toUpperCase();}
      if(nameEl) nameEl.textContent=currentUser.name;
      btn.onclick=showProfileMenu;
    } else {
      if(avatar) avatar.style.display='none';
      btn.textContent='Sign In';
      btn.onclick=()=>showModal('login');
    }
    const chatName=document.getElementById('chatName');
    if(chatName&&currentUser) chatName.value=currentUser.name;
  }

  function showModal(tab='login'){
    let modal=document.getElementById('authModal');
    if(!modal){
      modal=document.createElement('div');
      modal.id='authModal';
      modal.className='auth-modal-overlay';
      modal.innerHTML=`
        <div class="auth-modal">
          <button class="auth-close" id="authClose">✕</button>
          <div class="auth-logo">VN<span>portal</span></div>
          <div class="auth-tabs">
            <button class="auth-tab active" data-tab="login">Sign In</button>
            <button class="auth-tab" data-tab="signup">Join</button>
          </div>

          <div class="auth-form" id="authFormLogin">
            <input type="email" id="loginEmail" placeholder="Email" class="auth-input"/>
            <input type="password" id="loginPw" placeholder="Password" class="auth-input"/>
            <button class="btn-primary auth-submit" id="loginBtn">Sign In</button>
            <div class="auth-divider"><span>or</span></div>
            <div class="auth-oauth-row">
              <button class="auth-oauth-btn" data-provider="spotify" title="Spotify">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                Spotify
              </button>
              <button class="auth-oauth-btn auth-oauth-coming" data-provider="google" title="Google — needs hosting">
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google <span class="coming-badge">soon</span>
              </button>
              <button class="auth-oauth-btn auth-oauth-coming" data-provider="discord" title="Discord — needs hosting">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                Discord <span class="coming-badge">soon</span>
              </button>
            </div>
          </div>

          <div class="auth-form hidden" id="authFormSignup">
            <input type="text" id="signupName" placeholder="Display name" class="auth-input"/>
            <input type="email" id="signupEmail" placeholder="Email" class="auth-input"/>
            <input type="password" id="signupPw" placeholder="Password (6+ chars)" class="auth-input"/>
            <button class="btn-primary auth-submit" id="signupBtn">Create Account</button>
            <div class="auth-divider"><span>or</span></div>
            <div class="auth-oauth-row">
              <button class="auth-oauth-btn" data-provider="spotify">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                Spotify
              </button>
              <button class="auth-oauth-btn auth-oauth-coming" data-provider="google">
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google <span class="coming-badge">soon</span>
              </button>
              <button class="auth-oauth-btn auth-oauth-coming" data-provider="discord">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                Discord <span class="coming-badge">soon</span>
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Tab switching
      modal.querySelectorAll('.auth-tab').forEach(tab=>{
        tab.addEventListener('click',()=>{
          modal.querySelectorAll('.auth-tab').forEach(t=>t.classList.remove('active'));
          tab.classList.add('active');
          modal.querySelectorAll('.auth-form').forEach(f=>f.classList.add('hidden'));
          document.getElementById('authForm'+tab.dataset.tab.charAt(0).toUpperCase()+tab.dataset.tab.slice(1))?.classList.remove('hidden');
        });
      });

      // OAuth buttons
      modal.querySelectorAll('.auth-oauth-btn').forEach(btn=>{
        btn.addEventListener('click',()=>handleOAuth(btn.dataset.provider));
      });

      // Submit
      document.getElementById('loginBtn')?.addEventListener('click',async()=>{
        await login(document.getElementById('loginEmail')?.value, document.getElementById('loginPw')?.value);
      });
      document.getElementById('signupBtn')?.addEventListener('click',async()=>{
        await signup(document.getElementById('signupName')?.value, document.getElementById('signupEmail')?.value, document.getElementById('signupPw')?.value);
      });
      modal.querySelectorAll('.auth-input').forEach(inp=>{
        inp.addEventListener('keydown',e=>{if(e.key==='Enter') inp.closest('.auth-form')?.querySelector('.auth-submit')?.click();});
      });

      document.getElementById('authClose')?.addEventListener('click', closeModal);
      modal.addEventListener('click',e=>{if(e.target===modal) closeModal();});
    }
    modal.style.display='flex';
    modal.querySelectorAll('.auth-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
    modal.querySelectorAll('.auth-form').forEach(f=>f.classList.add('hidden'));
    document.getElementById(tab==='login'?'authFormLogin':'authFormSignup')?.classList.remove('hidden');
  }

  function handleOAuth(provider){
    if(provider==='spotify'){
      closeModal();
      if(typeof SpotifyAuth!=='undefined') SpotifyAuth.login();
      else Notify.warn('Spotify module not loaded');
      return;
    }
    if(provider==='google') return loginGoogle();
    if(provider==='discord') return loginDiscord();
  }

  // ── Google Sign-In (GIS popup, no backend needed) ──
  function loginGoogle(){
    const cid=OAUTH_CONFIG.google.clientId;
    if(!cid){ showOAuthSetup('google'); return; }
    closeModal();
    const load=()=>{
      google.accounts.id.initialize({
        client_id:cid,
        callback:(resp)=>{
          try{
            const payload=JSON.parse(atob(resp.credential.split('.')[1]));
            setSession({id:'google_'+payload.sub,name:payload.name,email:payload.email,avatar:payload.picture||null,provider:'google'});
            Notify.success(`Welcome, ${payload.name}!`);
          }catch{ Notify.error('Google sign-in failed'); }
        },
        ux_mode:'popup',
      });
      google.accounts.id.prompt((note)=>{
        if(note.isNotDisplayed()||note.isSkippedMoment()){
          // Fallback to renderButton approach
          const wrap=document.createElement('div');
          wrap.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:13000';
          wrap.innerHTML=`<div style="background:var(--surface);padding:2rem;border:1px solid var(--border);min-width:280px;text-align:center">
            <p style="color:var(--text-dim);font-size:.8rem;margin-bottom:1rem">Sign in with Google</p>
            <div id="gsiBtn"></div>
            <button class="btn-secondary" style="margin-top:1rem;font-size:.75rem" onclick="this.closest('[style]').remove()">Cancel</button>
          </div>`;
          document.body.appendChild(wrap);
          wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove();});
          google.accounts.id.renderButton(document.getElementById('gsiBtn'),{theme:'filled_black',size:'large',text:'signin_with'});
        }
      });
    };
    if(window.google?.accounts?.id){ load(); return; }
    const s=document.createElement('script');
    s.src='https://accounts.google.com/gsi/client';
    s.onload=load;
    s.onerror=()=>Notify.error('Failed to load Google Sign-In');
    document.head.appendChild(s);
  }

  // ── Discord Sign-In (implicit flow, no backend needed) ──
  function loginDiscord(){
    const cid=OAUTH_CONFIG.discord.clientId;
    if(!cid){ showOAuthSetup('discord'); return; }
    closeModal();
    localStorage.setItem('discord_oauth_pending','1');
    const params=new URLSearchParams({
      client_id:cid,
      redirect_uri:window.location.origin||'http://127.0.0.1:4000',
      response_type:'token',
      scope:'identify email',
    });
    window.location.href=`https://discord.com/api/oauth2/authorize?${params}`;
  }

  async function handleDiscordCallback(){
    const hash=new URLSearchParams(window.location.hash.replace('#',''));
    const token=hash.get('access_token');
    if(!token) return;
    window.history.replaceState({},'','/');
    localStorage.removeItem('discord_oauth_pending');
    try{
      const res=await fetch('https://discord.com/api/users/@me',{headers:{Authorization:`Bearer ${token}`}});
      const u=await res.json();
      const avatar=u.avatar?`https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png`:null;
      setSession({id:'discord_'+u.id,name:u.global_name||u.username,email:u.email||'',avatar,provider:'discord'});
      Notify.success(`Welcome, ${u.global_name||u.username}!`);
    }catch{ Notify.error('Discord sign-in failed'); }
  }

  // ── Setup prompt when client ID is missing ──
  function showOAuthSetup(provider){
    const cfg={
      google:{
        name:'Google',
        url:'console.cloud.google.com',
        steps:'1. Create a project → APIs &amp; Services → Credentials<br>2. Create OAuth 2.0 Client ID (Web application)<br>3. Add <code>http://127.0.0.1:4000</code> as Authorized JavaScript Origin<br>4. Copy the Client ID',
        field:'OAUTH_CONFIG.google.clientId',
      },
      discord:{
        name:'Discord',
        url:'discord.com/developers/applications',
        steps:'1. New Application → OAuth2 tab<br>2. Add <code>http://127.0.0.1:4000</code> as Redirect URI<br>3. Copy the Client ID (not secret)',
        field:'OAUTH_CONFIG.discord.clientId',
      },
    }[provider];
    const msg=document.createElement('div');
    msg.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:13000';
    msg.innerHTML=`
      <div style="background:var(--surface);border:1px solid var(--border);width:380px;max-width:94vw;padding:2rem;position:relative">
        <button onclick="this.closest('[style]').remove()" style="position:absolute;top:.75rem;right:.75rem;background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1rem">✕</button>
        <div style="font-size:1.2rem;font-family:var(--font-d);color:var(--accent);margin-bottom:.75rem">Set up ${cfg.name} Sign-In</div>
        <p style="font-size:.76rem;color:var(--text-dim);line-height:1.8;margin-bottom:1rem">${cfg.steps}</p>
        <input id="oauthClientIdInput" placeholder="${cfg.name} Client ID" class="auth-input" style="margin-bottom:.75rem"/>
        <button class="btn-primary" style="width:100%" onclick="
          const v=document.getElementById('oauthClientIdInput').value.trim();
          if(!v){return;}
          OAUTH_CONFIG.${provider}.clientId=v;
          localStorage.setItem('oauth_${provider}_cid',v);
          this.closest('[style]').remove();
          Auth._handleOAuth('${provider}');
        ">Save &amp; Sign In</button>
      </div>
    `;
    document.body.appendChild(msg);
    msg.addEventListener('click',e=>{if(e.target===msg)msg.remove();});
    // Pre-fill if previously saved
    const saved=localStorage.getItem('oauth_'+provider+'_cid');
    if(saved) document.getElementById('oauthClientIdInput').value=saved;
  }

  function closeModal(){ const m=document.getElementById('authModal'); if(m) m.style.display='none'; }

  function showProfileMenu(){
    const existing=document.getElementById('authProfileMenu'); if(existing){existing.remove();return;}
    const menu=document.createElement('div');
    menu.id='authProfileMenu'; menu.className='auth-profile-menu';
    menu.innerHTML=`
      <div class="apm-header">
        <div class="apm-avatar">${currentUser.name[0].toUpperCase()}</div>
        <div><div class="apm-name">${esc(currentUser.name)}</div><div class="apm-email">${esc(currentUser.email||currentUser.provider)}</div></div>
      </div>
      <div class="apm-divider"></div>
      <button class="apm-item" onclick="Auth._editProfile()">✏️ Edit Name</button>
      <button class="apm-item" onclick="Auth._logout()">↪ Sign Out</button>
    `;
    document.body.appendChild(menu);
    const btn=document.getElementById('authBtn');
    const r=btn.getBoundingClientRect();
    menu.style.cssText=`position:fixed;top:${r.bottom+6}px;left:${r.left}px;z-index:8000`;
    setTimeout(()=>document.addEventListener('click',()=>menu.remove(),{once:true}),10);
  }

  function editProfile(){
    const n=prompt('Display name:',currentUser.name); if(!n?.trim()) return;
    currentUser.name=n.trim(); saveSession(currentUser);
    const users=getUsers(); const u=users.find(u=>u.id===currentUser.id);
    if(u){u.name=n.trim();saveUsers(users);}
    updateUI(); Notify.success('Name updated!');
  }

  async function init(){
    // Restore saved OAuth client IDs
    const gCid=localStorage.getItem('oauth_google_cid');
    const dCid=localStorage.getItem('oauth_discord_cid');
    if(gCid) OAUTH_CONFIG.google.clientId=gCid;
    if(dCid) OAUTH_CONFIG.discord.clientId=dCid;

    // Handle Discord implicit-flow callback (token in URL hash)
    if(window.location.hash.includes('access_token')){
      await handleDiscordCallback(); return;
    }

    const saved=localStorage.getItem(SESSION_KEY);
    if(saved) try{ currentUser=JSON.parse(saved); }catch{}
    updateUI();
  }

  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  const api={init,login,signup,logout,getUser,isLoggedIn,showModal,_logout:logout,_editProfile:editProfile,_handleOAuth:handleOAuth};
  window.Auth=api; return api;
})();
