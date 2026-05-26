// ============================================
// VNportal — Apple Music (MusicKit JS v3)
// Requires a MusicKit developer token.
// Get one at: developer.apple.com → MusicKit
// ============================================

// Paste your MusicKit developer token here (JWT).
// Generate at: developer.apple.com → Certificates → MusicKit Keys
const APPLE_MUSIC_TOKEN = '';

const AppleMusic = (() => {
  let music = null;
  let userToken = null;
  let profile = null;

  async function loadMusicKit() {
    if (window.MusicKit) return true;
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  async function connect() {
    const token = APPLE_MUSIC_TOKEN || localStorage.getItem('am_dev_token');
    if (!token) { showSetup(); return; }

    const loaded = await loadMusicKit();
    if (!loaded) { Notify.error('Failed to load MusicKit — check your connection'); return; }

    try {
      await MusicKit.configure({ developerToken: token, app: { name: 'VNportal', build: '1.0' } });
      music = MusicKit.getInstance();
      userToken = await music.authorize();
      await loadProfile();
    } catch (e) {
      Notify.error('Apple Music sign-in failed — check your developer token');
    }
  }

  async function loadProfile() {
    if (!music || !userToken) return;
    try {
      const res = await music.api.music('/v1/me/account');
      const acct = res?.data?.attributes;
      profile = { name: acct?.storefront || 'Apple Music User', connected: true };
    } catch {
      profile = { name: 'Apple Music', connected: true };
    }
    updateUI();
    Notify.success(`Apple Music connected — ${profile.name}`);
    localStorage.setItem('am_connected', '1');
  }

  function disconnect() {
    music?.unauthorize?.();
    music = null; userToken = null; profile = null;
    localStorage.removeItem('am_connected');
    updateUI();
    Notify.info('Apple Music disconnected');
  }

  function updateUI() {
    const btn = document.getElementById('appleMusicBtn');
    const lbl = document.getElementById('appleMusicBtnLabel');
    if (!btn) return;
    if (profile) {
      if (lbl) lbl.textContent = profile.name;
      btn.classList.add('connected');
      btn.onclick = disconnect;
    } else {
      if (lbl) lbl.textContent = 'Connect Apple Music';
      btn.classList.remove('connected');
      btn.onclick = connect;
    }
  }

  function showSetup() {
    const msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:13000';
    msg.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);width:380px;max-width:94vw;padding:2rem;position:relative">
        <button onclick="this.closest('[style]').remove()" style="position:absolute;top:.75rem;right:.75rem;background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1rem">✕</button>
        <div style="font-size:1.2rem;font-family:var(--font-d);color:#FC3C44;margin-bottom:.75rem">Connect Apple Music</div>
        <p style="font-size:.76rem;color:var(--text-dim);line-height:1.8;margin-bottom:1rem">
          1. Go to <b style="color:var(--text)">developer.apple.com</b><br>
          2. Certificates, IDs &amp; Profiles → Keys → Add MusicKit key<br>
          3. Download the .p8 key file and generate a JWT developer token<br>
          4. Paste the token below
        </p>
        <input id="amTokenInput" placeholder="MusicKit developer token (JWT)" class="auth-input" style="margin-bottom:.75rem;font-size:.65rem"/>
        <button class="btn-primary" style="width:100%;background:#FC3C44;border-color:#FC3C44" onclick="
          const v=document.getElementById('amTokenInput').value.trim();
          if(!v) return;
          localStorage.setItem('am_dev_token',v);
          this.closest('[style]').remove();
          AppleMusic.connect();
        ">Save &amp; Connect</button>
      </div>
    `;
    document.body.appendChild(msg);
    msg.addEventListener('click', e => { if (e.target === msg) msg.remove(); });
    const saved = localStorage.getItem('am_dev_token');
    if (saved) document.getElementById('amTokenInput').value = saved;
  }

  async function search(q, limit = 8) {
    if (!music) return null;
    try {
      const res = await music.api.music(`/v1/catalog/us/search?term=${encodeURIComponent(q)}&types=songs&limit=${limit}`);
      return res?.data?.results?.songs?.data || [];
    } catch { return null; }
  }

  async function init() {
    updateUI();
    const token = APPLE_MUSIC_TOKEN || localStorage.getItem('am_dev_token');
    const wasCon = localStorage.getItem('am_connected');
    if (token && wasCon) {
      const loaded = await loadMusicKit();
      if (!loaded) return;
      try {
        await MusicKit.configure({ developerToken: token, app: { name: 'VNportal', build: '1.0' } });
        music = MusicKit.getInstance();
        if (music.isAuthorized) {
          userToken = music.musicUserToken;
          profile = { name: 'Apple Music', connected: true };
          updateUI();
        }
      } catch {}
    }
    document.getElementById('appleMusicBtn')?.addEventListener('click', connect);
  }

  window.AppleMusic = { init, connect, disconnect, search, isConnected: () => !!userToken };
  return window.AppleMusic;
})();
