// ============================================
// VNportal — DJ Mix (Phase 3)
// Two decks, crossfader, EQ, BPM tap
// Uses Web Audio API — no external libraries
// ============================================

const DJMix = (() => {
  let audioCtx  = null;
  let masterGain = null;

  // Deck state
  const decks = {
    A: { audio: null, source: null, gainNode: null, hiEQ: null, midEQ: null, loEQ: null,
         playing: false, cuePoint: 0, vinylId: null, trackIdx: 0, blobUrl: null },
    B: { audio: null, source: null, gainNode: null, hiEQ: null, midEQ: null, loEQ: null,
         playing: false, cuePoint: 0, vinylId: null, trackIdx: 0, blobUrl: null },
  };

  let crossfadeVal  = 0.5;
  let tapTimes      = [];
  let bpmVal        = null;
  let animFrame     = null;

  // ── Init ──────────────────────────────────
  function init() {
    populateDecks();
    bindControls();
  }

  function ensureAudioCtx() {
    if (!audioCtx) {
      audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.8;
      masterGain.connect(audioCtx.destination);

      // Init deck nodes
      ['A','B'].forEach(id => {
        const d = decks[id];
        d.gainNode = audioCtx.createGain();
        d.hiEQ     = createEQ(audioCtx, 'highshelf', 8000);
        d.midEQ    = createEQ(audioCtx, 'peaking',   1000);
        d.loEQ     = createEQ(audioCtx, 'lowshelf',  200);
        // Chain: gainNode → hi → mid → lo → master
        d.gainNode.connect(d.hiEQ);
        d.hiEQ.connect(d.midEQ);
        d.midEQ.connect(d.loEQ);
        d.loEQ.connect(masterGain);
      });
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function createEQ(ctx, type, freq) {
    const f       = ctx.createBiquadFilter();
    f.type        = type;
    f.frequency.value = freq;
    f.gain.value  = 0;
    return f;
  }

  function populateDecks() {
    const { vinyls } = Store.get();
    ['A','B'].forEach(id => {
      const sel = document.getElementById(`deck${id}Select`);
      sel.innerHTML = '<option value="">— Load track —</option>';
      vinyls.forEach(v => {
        (v.tracks||[]).forEach((t, ti) => {
          const opt = document.createElement('option');
          opt.value = `${v.id}:${ti}`;
          opt.textContent = `${t.title} — ${t.artist}`;
          sel.appendChild(opt);
        });
      });
    });
  }

  function bindControls() {
    // Deck selects
    document.getElementById('deckASelect').addEventListener('change', e => loadDeck('A', e.target.value));
    document.getElementById('deckBSelect').addEventListener('change', e => loadDeck('B', e.target.value));

    // Play buttons
    document.getElementById('deckAPlay').addEventListener('click', () => toggleDeck('A'));
    document.getElementById('deckBPlay').addEventListener('click', () => toggleDeck('B'));

    // Cue buttons
    document.getElementById('deckACue').addEventListener('click', () => cueDeck('A'));
    document.getElementById('deckBCue').addEventListener('click', () => cueDeck('B'));

    // Crossfader
    document.getElementById('crossfader').addEventListener('input', e => {
      crossfadeVal = +e.target.value;
      applyCrossfade();
    });

    // Master volume
    document.getElementById('masterVol').addEventListener('input', e => {
      ensureAudioCtx();
      if (masterGain) masterGain.gain.value = +e.target.value;
    });

    // Speed / pitch
    ['A','B'].forEach(id => {
      document.getElementById(`deck${id}Speed`).addEventListener('input', e => {
        const d = decks[id];
        if (d.audio) d.audio.playbackRate = +e.target.value;
        setDiscSpeed(id, +e.target.value);
      });
      document.getElementById(`deck${id}Hi`).addEventListener('input', e => {
        ensureAudioCtx(); decks[id].hiEQ?.gain.setTargetAtTime(+e.target.value, audioCtx.currentTime, .01);
      });
      document.getElementById(`deck${id}Mid`).addEventListener('input', e => {
        ensureAudioCtx(); decks[id].midEQ?.gain.setTargetAtTime(+e.target.value, audioCtx.currentTime, .01);
      });
      document.getElementById(`deck${id}Lo`).addEventListener('input', e => {
        ensureAudioCtx(); decks[id].loEQ?.gain.setTargetAtTime(+e.target.value, audioCtx.currentTime, .01);
      });
    });

    // BPM tap
    document.getElementById('tapBpmBtn').addEventListener('click', tapBpm);
  }

  async function loadDeck(deckId, value) {
    if (!value) return;
    const [vinylId, trackIdxStr] = value.split(':');
    const trackIdx = parseInt(trackIdxStr);
    const vinyl    = Store.getVinyl(vinylId);
    if (!vinyl) return;

    const track = vinyl.tracks?.[trackIdx];
    if (!track) return;

    const d = decks[deckId];
    d.vinylId  = vinylId;
    d.trackIdx = trackIdx;

    // Update disc label with cover color
    const cover = Store.getCover(vinylId);
    if (cover) {
      document.getElementById(`disc${deckId}`).style.backgroundImage = `url(${cover})`;
      document.getElementById(`disc${deckId}`).style.backgroundSize  = 'cover';
    }

    document.getElementById(`deck${deckId}TitleDisp`).textContent  = track.title;
    document.getElementById(`deck${deckId}ArtistDisp`).textContent = track.artist;
    document.getElementById(`discLabel${deckId}`).textContent       = deckId;

    // Try to load local file
    const key = DB.trackKey(vinylId, trackIdx);
    const hasLocal = await DB.hasFile(key);

    if (hasLocal) {
      const url = await DB.getFileURL(key);
      if (d.blobUrl) URL.revokeObjectURL(d.blobUrl);
      d.blobUrl = url;
      d.audio   = new Audio(url);
      d.audio.addEventListener('ended', () => stopDeck(deckId));
      setupWebAudio(deckId);
    } else {
      // No local file — show note
      document.getElementById(`deck${deckId}TitleDisp`).textContent += ' (upload local file to use DJ)';
    }
  }

  function setupWebAudio(deckId) {
    ensureAudioCtx();
    const d = decks[deckId];
    if (!d.audio || !d.gainNode) return;
    try {
      const src = audioCtx.createMediaElementSource(d.audio);
      src.connect(d.gainNode);
      d.source = src;
    } catch {
      // Already connected
    }
  }

  function toggleDeck(deckId) {
    const d   = decks[deckId];
    const btn = document.getElementById(`deck${deckId}Play`);
    const arm = document.getElementById(`arm${deckId}`);
    const disc = document.getElementById(`disc${deckId}`);

    if (!d.audio) { alert(`Load a track with a local file onto Deck ${deckId} first!`); return; }
    ensureAudioCtx();

    if (d.playing) {
      d.audio.pause();
      d.playing = false;
      btn.textContent = '▶';
      btn.classList.remove('active');
      disc.classList.remove('playing');
      arm.classList.remove('playing');
    } else {
      d.audio.play();
      d.playing = true;
      btn.textContent = '⏸';
      btn.classList.add('active');
      disc.classList.add('playing');
      arm.classList.add('playing');
    }
    applyCrossfade();
    startVUMeter();
  }

  function cueDeck(deckId) {
    const d = decks[deckId];
    if (!d.audio) return;
    d.cuePoint = d.audio.currentTime;
  }

  function stopDeck(deckId) {
    const d = decks[deckId];
    d.playing = false;
    const btn = document.getElementById(`deck${deckId}Play`);
    btn.textContent = '▶';
    btn.classList.remove('active');
    document.getElementById(`disc${deckId}`).classList.remove('playing');
    document.getElementById(`arm${deckId}`).classList.remove('playing');
  }

  function applyCrossfade() {
    ensureAudioCtx();
    // crossfadeVal: 0=full A, 0.5=equal, 1=full B
    const gainA = Math.cos(crossfadeVal * Math.PI/2);
    const gainB = Math.cos((1-crossfadeVal) * Math.PI/2);
    decks.A.gainNode?.gain.setTargetAtTime(gainA, audioCtx.currentTime, .02);
    decks.B.gainNode?.gain.setTargetAtTime(gainB, audioCtx.currentTime, .02);
  }

  function setDiscSpeed(deckId, speed) {
    const disc = document.getElementById(`disc${deckId}`);
    const dur  = 2 / speed;
    disc.style.animationDuration = `${dur}s`;
  }

  // BPM tap
  function tapBpm() {
    tapTimes.push(Date.now());
    if (tapTimes.length > 8) tapTimes.shift();
    if (tapTimes.length >= 2) {
      const diffs  = tapTimes.slice(1).map((t,i)=>t-tapTimes[i]);
      const avg    = diffs.reduce((a,b)=>a+b,0)/diffs.length;
      bpmVal       = Math.round(60000/avg);
      document.getElementById('bpmDisplay').textContent = `${bpmVal} BPM`;
    }
  }

  // Fake VU meter animation
  function startVUMeter() {
    if (animFrame) return;
    function tick() {
      ['A','B'].forEach(id => {
        const d = decks[id];
        const level = d.playing ? 0.3 + Math.random()*0.6 : 0;
        const bar   = document.getElementById(`vuBar${id}`);
        if (bar) bar.style.height = (level*100)+'%';
      });
      animFrame = requestAnimationFrame(tick);
    }
    tick();
  }

  function onShow() {
    populateDecks();
  }

  return { init, onShow };
})();
