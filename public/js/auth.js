// ============================================
// VNportal — Auth System
// Email works now. Google/Discord need hosting.
// Spotify handled separately via SpotifyAuth.
// ============================================
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

  function logout(){ currentUser=null; clearSession(); updateUI(); Notify.info('Logged out'); }
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
          </div>

          <div class="auth-form hidden" id="authFormSignup">
            <input type="text" id="signupName" placeholder="Display name" class="auth-input"/>
            <input type="email" id="signupEmail" placeholder="Email" class="auth-input"/>
            <input type="password" id="signupPw" placeholder="Password (6+ chars)" class="auth-input"/>
            <button class="btn-primary auth-submit" id="signupBtn">Create Account</button>
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
    const saved=localStorage.getItem(SESSION_KEY);
    if(saved) try{ currentUser=JSON.parse(saved); }catch{}
    updateUI();
  }

  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  const api={init,login,signup,logout,getUser,isLoggedIn,showModal,_logout:logout,_editProfile:editProfile};
  window.Auth=api; return api;
})();
