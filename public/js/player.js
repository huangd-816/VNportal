// ============================================
// VNportal — Player (Phase 2a)
// Sources: Local files (IndexedDB) → YouTube
// ============================================

const Player = (() => {

  // ── State ──────────────────────────────────
  let vinyl       = null;   // current vinyl object
  let trackIndex  = 0;
  let isPlaying   = false;
  let mode        = 'idle'; // 'local' | 'youtube' | 'idle'
  let localAudio  = new Audio();
  let ytPlayer    = null;   // YouTube IFrame player instance
  let ytReady     = false;
  let volume      = 0.8;
  let blobURLs    = [];     // track for cleanup

  // ── YouTube API bootstrap ──────────────────
  // Loads the YT iframe API script once
  function loadYouTubeAPI() {
    if (window.YT || document.getElementById('yt-api-script')) return;
    const s = document.createElement('script');
    s.id  = 'yt-api-script';
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }

  // Called automatically by YouTube API when ready
  window.onYouTubeIframeAPIReady = function () {
    ytReady = true;
    // Player is created lazily on first playYouTube() call to avoid
    // postMessage origin errors from an idle playerless iframe
  };

  function ensureYTPlayer() {
    if (ytPlayer) return;
    ytPlayer = new YT.Player('ytPlayerInner', {
      height: '1', width: '1',
      playerVars: { autoplay: 0, controls: 0 },
      events: {
        onStateChange: onYTStateChange,
        onError: onYTError,
      }
    });
  }

  function onYTStateChange(e) {
    // 0 = ended
    if (e.data === YT.PlayerState.ENDED) next();
    // 1 = playing
    if (e.data === YT.PlayerState.PLAYING) {
      isPlaying = true;
      updateUI();
      startProgressPoll();
    }
    // 2 = paused
    if (e.data === YT.PlayerState.PAUSED) {
      isPlaying = false;
      updateUI();
    }
  }

  function onYTError(e) {
    showSourceBadge('yt-error');
    setTimeout(next, 1000);
  }

  // ── Local audio events ─────────────────────
  localAudio.addEventListener('ended', () => next());
  localAudio.addEventListener('timeupdate', updateProgress);
  localAudio.addEventListener('playing', () => {
    isPlaying = true; updateUI();
  });
  localAudio.addEventListener('pause', () => {
    isPlaying = false; updateUI();
  });

  // ── Public API ─────────────────────────────

  // Load a vinyl and start playing from trackIndex
  async function loadVinyl(v, index = 0) {
    stop();
    vinyl      = v;
    trackIndex = index;
    await playTrack();
  }

  async function playTrack() {
    if (!vinyl || !vinyl.tracks?.length) return;
    const track = vinyl.tracks[trackIndex];
    if (!track) return;

    updateNowPlaying(track);

    // Priority: local file → YouTube URL → YouTube search
    const key = DB.trackKey(vinyl.id, trackIndex);
    const hasLocal = await DB.hasFile(key);

    if (hasLocal) {
      await playLocal(key, track);
    } else if (track.youtubeId) {
      playYouTube(track.youtubeId);
    } else if (track.youtubeUrl) {
      const id = extractYTId(track.youtubeUrl);
      if (id) playYouTube(id);
      else playYouTubeSearch(track.title, track.artist);
    } else {
      // Auto-search YouTube by track name + artist
      playYouTubeSearch(track.title, track.artist);
    }
  }

  async function playLocal(key, track) {
    mode = 'local';
    pauseYT();
    const url = await DB.getFileURL(key);
    if (!url) { fallbackToYT(track); return; }
    blobURLs.push(url);
    localAudio.src    = url;
    localAudio.volume = volume;
    showSourceBadge('local');
    localAudio.play().catch(() => fallbackToYT(track));
  }

  function playYouTube(videoId) {
    mode = 'youtube';
    localAudio.pause();
    showSourceBadge('youtube');
    if (!ytReady) {
      setTimeout(() => playYouTube(videoId), 1000);
      return;
    }
    ensureYTPlayer();
    if (!ytPlayer?.loadVideoById) {
      setTimeout(() => playYouTube(videoId), 500);
      return;
    }
    ytPlayer.setVolume(volume * 100);
    ytPlayer.loadVideoById(videoId);
  }

  function playYouTubeSearch(title, artist) {
    // Open YouTube search in a small overlay the user can pick from
    // We can't auto-play search results without the Data API key
    // So we show a "Find on YouTube" prompt
    mode = 'youtube-search';
    showYTSearch(title, artist);
    showSourceBadge('yt-search');
  }

  function fallbackToYT(track) {
    if (track.youtubeId) playYouTube(track.youtubeId);
    else playYouTubeSearch(track.title, track.artist);
  }

  function togglePlay() {
    if (!vinyl) return;
    if (mode === 'local') {
      localAudio.paused ? localAudio.play() : localAudio.pause();
    } else if (mode === 'youtube' && ytPlayer) {
      const state = ytPlayer.getPlayerState?.();
      state === 1 ? ytPlayer.pauseVideo() : ytPlayer.playVideo();
    }
  }

  function next() {
    if (!vinyl) return;
    trackIndex = (trackIndex + 1) % vinyl.tracks.length;
    playTrack();
  }

  function prev() {
    if (!vinyl) return;
    // If >3s in, restart; else go to previous
    const cur = mode === 'local' ? localAudio.currentTime : (ytPlayer?.getCurrentTime?.() || 0);
    if (cur > 3) {
      seek(0);
    } else {
      trackIndex = (trackIndex - 1 + vinyl.tracks.length) % vinyl.tracks.length;
      playTrack();
    }
  }

  function stop() {
    localAudio.pause();
    localAudio.src = '';
    pauseYT();
    isPlaying = false;
    mode = 'idle';
    clearProgressPoll();
    // Revoke old blob URLs to free memory
    blobURLs.forEach(u => URL.revokeObjectURL(u));
    blobURLs = [];
  }

  function seek(pct) {
    if (mode === 'local') {
      localAudio.currentTime = localAudio.duration * pct;
    } else if (mode === 'youtube' && ytPlayer) {
      const dur = ytPlayer.getDuration?.() || 0;
      ytPlayer.seekTo(dur * pct, true);
    }
  }

  function setVolume(val) {
    volume = val;
    localAudio.volume = val;
    if (ytPlayer?.setVolume) ytPlayer.setVolume(val * 100);
    localStorage.setItem('vnportal_volume', val);
  }

  function pauseYT() {
    try { ytPlayer?.pauseVideo?.(); } catch {}
  }

  // ── Progress polling for YouTube ───────────
  let progressInterval = null;
  function startProgressPoll() {
    clearProgressPoll();
    if (mode !== 'youtube') return;
    progressInterval = setInterval(updateProgress, 500);
  }
  function clearProgressPoll() {
    clearInterval(progressInterval);
  }

  function updateProgress() {
    let cur = 0, dur = 1;
    if (mode === 'local') {
      cur = localAudio.currentTime;
      dur = localAudio.duration || 1;
    } else if (mode === 'youtube' && ytPlayer?.getCurrentTime) {
      cur = ytPlayer.getCurrentTime();
      dur = ytPlayer.getDuration() || 1;
    }
    const pct = Math.min(cur / dur, 1);
    const bar = document.getElementById('playerProgress');
    if (bar) bar.style.width = (pct * 100) + '%';
    const timeEl = document.getElementById('playerTime');
    if (timeEl) timeEl.textContent = `${fmt(cur)} / ${fmt(dur)}`;
  }

  function fmt(s) {
    s = Math.floor(s || 0);
    return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  }

  // ── UI updates ─────────────────────────────
  function updateNowPlaying(track) {
    document.getElementById('npTitle').textContent  = track.title;
    document.getElementById('npArtist').textContent = track.artist;
    document.getElementById('playerTrackTitle').textContent  = track.title;
    document.getElementById('playerTrackArtist').textContent = track.artist;
    document.getElementById('playerVinylName').textContent   = vinyl.name;
    // Spinning disc
    document.getElementById('npDisc').style.animationPlayState = 'running';
    document.getElementById('playerDisc').style.animationPlayState = 'running';
  }

  function updateUI() {
    const btn = document.getElementById('playerPlayBtn');
    if (btn) btn.textContent = isPlaying ? '⏸' : '▶';
    const disc = document.getElementById('playerDisc');
    if (disc) disc.style.animationPlayState = isPlaying ? 'running' : 'paused';
    document.getElementById('npDisc').style.animationPlayState = isPlaying ? 'running' : 'paused';
  }

  function showSourceBadge(src) {
    const el = document.getElementById('playerSourceBadge');
    if (!el) return;
    const map = {
      local:      { label: '📁 Local',   color: '#27ae60' },
      youtube:    { label: '▶ YouTube',  color: '#e8734a' },
      'yt-search':{ label: '🔍 Find it', color: '#7a7068' },
      'yt-error': { label: '⚠ YT Error', color: '#c0392b' },
    };
    const info = map[src] || { label: src, color: '#555' };
    el.textContent        = info.label;
    el.style.background   = info.color;
  }

  function showYTSearch(title, artist) {
    const query = encodeURIComponent(`${title} ${artist}`);
    const overlay = document.getElementById('ytSearchOverlay');
    const link    = document.getElementById('ytSearchLink');
    if (!overlay || !link) return;
    link.href = `https://www.youtube.com/results?search_query=${query}`;
    link.textContent = `Search "${title}" on YouTube`;
    overlay.classList.remove('hidden');
  }

  function hideYTSearch() {
    document.getElementById('ytSearchOverlay')?.classList.add('hidden');
  }

  // ── YouTube ID extractor ───────────────────
  function extractYTId(url) {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  // ── Wire up player bar UI ──────────────────
  function initUI() {
    loadYouTubeAPI();

    // Restore volume
    const saved = parseFloat(localStorage.getItem('vnportal_volume'));
    if (!isNaN(saved)) { volume = saved; }
    const volSlider = document.getElementById('playerVolume');
    if (volSlider) { volSlider.value = volume; }

    document.getElementById('playerPlayBtn')?.addEventListener('click', togglePlay);
    document.getElementById('playerNextBtn')?.addEventListener('click', next);
    document.getElementById('playerPrevBtn')?.addEventListener('click', prev);

    document.getElementById('playerVolume')?.addEventListener('input', e => {
      setVolume(parseFloat(e.target.value));
    });

    // Progress bar click to seek
    document.getElementById('playerProgressBar')?.addEventListener('click', e => {
      const rect = e.currentTarget.getBoundingClientRect();
      seek((e.clientX - rect.left) / rect.width);
    });

    // YT search overlay close
    document.getElementById('ytSearchClose')?.addEventListener('click', hideYTSearch);

    // Manual YouTube URL paste
    document.getElementById('ytManualPlayBtn')?.addEventListener('click', () => {
      const url = document.getElementById('ytManualUrl')?.value?.trim();
      if (!url) return;
      const id = extractYTId(url);
      if (id) {
        // Save to current track
        if (vinyl?.tracks[trackIndex]) {
          vinyl.tracks[trackIndex].youtubeId = id;
          Store.updateVinyl(vinyl.id, { tracks: vinyl.tracks });
        }
        hideYTSearch();
        playYouTube(id);
      } else {
        alert('Could not extract YouTube video ID from that URL.');
      }
    });
  }

  // Called from exhibit when user clicks Play on a vinyl
  async function playVinyl(vinylId, index = 0) {
    const v = Store.getVinyl(vinylId);
    if (!v) return;
    Store.setCurrentVinyl(vinylId);
    await loadVinyl(v, index);
    // Show player bar
    document.getElementById('playerBar')?.classList.add('visible');
  }

  return { initUI, playVinyl, togglePlay, next, prev, seek, setVolume, extractYTId };
})();
