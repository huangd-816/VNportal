// ============================================
// VNportal — Spotify (Phase 2b)
// PKCE OAuth — no server needed
// Requires app to be hosted (not file://)
// ============================================

const Spotify = (() => {
  // ⚠️ Replace with your Spotify Developer Dashboard Client ID
  // Register at: https://developer.spotify.com/dashboard
  // Set Redirect URI to your hosted URL + /callback or just the root URL
  const CLIENT_ID    = 'YOUR_SPOTIFY_CLIENT_ID';
  const REDIRECT_URI = window.location.origin + window.location.pathname;
  const SCOPES       = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-read-playback-state',
    'user-modify-playback-state',
    'playlist-read-private',
    'playlist-read-collaborative',
  ].join(' ');

  let accessToken  = null;
  let tokenExpiry  = 0;
  let player       = null;
  let deviceId     = null;
  let isPremium    = false;

  // ── PKCE helpers ──────────────────────────
  function generateVerifier(len=128) {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }

  async function generateChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }

  async function login() {
    const verifier   = generateVerifier();
    const challenge  = await generateChallenge(verifier);
    sessionStorage.setItem('spotify_verifier', verifier);

    const params = new URLSearchParams({
      client_id:             CLIENT_ID,
      response_type:         'code',
      redirect_uri:          REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge:        challenge,
      scope:                 SCOPES,
    });
    window.location.href = `https://accounts.spotify.com/authorize?${params}`;
  }

  async function handleCallback(code) {
    const verifier = sessionStorage.getItem('spotify_verifier');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     CLIENT_ID,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  REDIRECT_URI,
        code_verifier: verifier,
      }),
    });
    const data = await res.json();
    if (data.access_token) {
      accessToken = data.access_token;
      tokenExpiry = Date.now() + data.expires_in * 1000;
      localStorage.setItem('spotify_token',  accessToken);
      localStorage.setItem('spotify_expiry', tokenExpiry);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      await loadProfile();
      initWebPlayback();
    }
  }

  async function loadProfile() {
    if (!accessToken) return;
    const res  = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const user = await res.json();
    isPremium  = user.product === 'premium';
    updateSidebarBtn(user.display_name, isPremium);
  }

  function initWebPlayback() {
    if (!isPremium) return; // SDK requires Premium
    const script = document.createElement('script');
    script.src   = 'https://sdk.scdn.co/spotify-player.js';
    document.head.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      player = new Spotify.Player({
        name: 'VNportal',
        getOAuthToken: cb => cb(accessToken),
        volume: 0.8,
      });
      player.addListener('ready', ({ device_id }) => { deviceId = device_id; });
      player.addListener('not_ready', () => { deviceId = null; });
      player.connect();
    };
  }

  async function importPlaylist(playlistUrl) {
    if (!accessToken) { alert('Connect Spotify first!'); return; }
    const match = playlistUrl.match(/playlist\/([A-Za-z0-9]+)/);
    if (!match) { alert('Invalid playlist URL'); return; }
    const playlistId = match[1];

    const res  = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data = await res.json();
    if (!data.tracks) { alert('Could not load playlist'); return; }

    const tracks = data.tracks.items
      .filter(item => item.track)
      .map(item => ({
        title:       item.track.name,
        artist:      item.track.artists.map(a=>a.name).join(', '),
        spotifyUri:  item.track.uri,
        hasLocal:    false,
        youtubeUrl:  null,
      }));

    const vinyl = Store.addVinyl({
      name:   data.name,
      artist: data.owner?.display_name || 'Spotify',
      genre:  'unknown',
      source: 'spotify',
      tracks,
    });

    // Save playlist cover if available
    const coverUrl = data.images?.[0]?.url;
    if (coverUrl) {
      try {
        const imgRes = await fetch(coverUrl);
        const blob   = await imgRes.blob();
        const reader = new FileReader();
        reader.onload = e => { Store.saveCover(vinyl.id, e.target.result); Exhibit.render(); };
        reader.readAsDataURL(blob);
      } catch {}
    }

    Exhibit.render();
    App.navigate('exhibit');
    return vinyl;
  }

  async function playTrack(uri) {
    if (!deviceId || !isPremium) return false;
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ uris: [uri] }),
    });
    return true;
  }

  function updateSidebarBtn(name, premium) {
    const btn   = document.getElementById('spotifyBtn');
    const label = document.getElementById('spotifyBtnLabel');
    if (!btn) return;
    label.textContent = `${name} ${premium ? '✦' : '(free)'}`;
    btn.classList.add('connected');
    btn.onclick = disconnectSpotify;
  }

  function disconnectSpotify() {
    accessToken = null;
    localStorage.removeItem('spotify_token');
    localStorage.removeItem('spotify_expiry');
    const label = document.getElementById('spotifyBtnLabel');
    if (label) label.textContent = 'Connect Spotify';
    const btn = document.getElementById('spotifyBtn');
    if (btn) btn.classList.remove('connected');
    btn.onclick = login;
  }

  function isConnected() { return !!accessToken && Date.now() < tokenExpiry; }

  function init() {
    // Check for OAuth callback
    const params = new URLSearchParams(window.location.search);
    if (params.get('code')) {
      handleCallback(params.get('code'));
      return;
    }

    // Restore saved token
    const saved   = localStorage.getItem('spotify_token');
    const expiry  = parseInt(localStorage.getItem('spotify_expiry') || '0');
    if (saved && Date.now() < expiry) {
      accessToken = saved;
      tokenExpiry = expiry;
      loadProfile();
      initWebPlayback();
    } else {
      document.getElementById('spotifyBtn').addEventListener('click', login);
    }

    // Import playlist button (if shown)
    document.getElementById('spotifyImportBtn')?.addEventListener('click', () => {
      const url = prompt('Paste your Spotify playlist URL:');
      if (url) importPlaylist(url);
    });
  }

  return { init, login, importPlaylist, playTrack, isConnected, isPremium: () => isPremium };
})();
