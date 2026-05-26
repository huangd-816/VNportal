const DJAIUI = (() => {
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let tab = 'suggest';

  function switchTab(t){
    tab = t;
    document.querySelectorAll('.djai-tab').forEach(el=>el.classList.toggle('active',el.dataset.tab===t));
    document.getElementById('djaiSuggest').style.display = t==='suggest'?'':'none';
    document.getElementById('djaiAnalyze').style.display = t==='analyze'?'':'none';
    t==='suggest' ? renderSuggest() : renderAnalyze();
  }

  function renderSuggest(){
    const panel=document.getElementById('djaiSuggest'); if(!panel) return;
    const {vinyls}=Store.get();
    const state=typeof DJMix!=='undefined'?DJMix.getDecksState():null;

    const loadedKeys=new Set(), genreSet=new Set(), artistSet=new Set();
    if(state) ['A','B'].forEach(id=>{
      if(state[id].key)    loadedKeys.add(state[id].key);
      if(state[id].genre)  genreSet.add(state[id].genre);
      if(state[id].artist) artistSet.add(state[id].artist);
    });

    const candidates=[];
    vinyls.forEach(v=>{
      (v.tracks||[]).forEach((t,ti)=>{
        const key=`${v.id}:${ti}`;
        if(loadedKeys.has(key)) return;
        let score=Math.random()*0.4;
        if(genreSet.has(v.genre))  score+=3;
        if(artistSet.has(t.artist)) score+=2;
        candidates.push({v,t,ti,key,score});
      });
    });
    candidates.sort((a,b)=>b.score-a.score);
    const picks=candidates.slice(0,4);

    if(!picks.length){
      panel.innerHTML=`<div class="djai-empty">Add vinyl to your collection for AI suggestions</div>`; return;
    }
    const reason=loadedKeys.size?'Based on your current decks':'From your collection';
    panel.innerHTML=`<div class="djai-reason">${reason}</div>`+picks.map(p=>`
      <div class="djai-card">
        <div class="djai-card-info">
          <div class="djai-card-title">${esc(p.t.title)}</div>
          <div class="djai-card-meta">${esc(p.t.artist)} · <em>${esc(p.v.name)}</em></div>
          ${p.v.genre?`<span class="djai-genre-tag">${esc(p.v.genre)}</span>`:''}
        </div>
        <div class="djai-card-btns">
          <button class="djai-load-btn" data-key="${p.key}" data-deck="A">→ A</button>
          <button class="djai-load-btn" data-key="${p.key}" data-deck="B">→ B</button>
        </div>
      </div>`).join('');

    panel.querySelectorAll('.djai-load-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        if(typeof DJMix!=='undefined') DJMix.loadTrackToDeck(btn.dataset.deck,btn.dataset.key);
        setTimeout(renderSuggest,300);
        Notify.success(`Loaded to Deck ${btn.dataset.deck}`);
      });
    });
  }

  function renderAnalyze(){
    const panel=document.getElementById('djaiAnalyze'); if(!panel) return;
    const state=typeof DJMix!=='undefined'?DJMix.getDecksState():null;

    const bpm=parseInt(document.getElementById('bpmDisplay')?.textContent)||null;
    const cf=parseFloat(document.getElementById('crossfader')?.value||'0.5');
    const vol=parseFloat(document.getElementById('masterVol')?.value||'0.8');
    const hiA=parseInt(document.getElementById('deckAHi')?.value||'0');
    const loA=parseInt(document.getElementById('deckALo')?.value||'0');
    const hiB=parseInt(document.getElementById('deckBHi')?.value||'0');
    const loB=parseInt(document.getElementById('deckBLo')?.value||'0');

    const balance=cf<0.15?'Full A':cf>0.85?'Full B':cf<0.4?'A heavy':cf>0.6?'B heavy':'Even blend';

    const tips=[];
    if(!state?.A.playing&&!state?.B.playing) tips.push('No decks playing — press ▶ to begin');
    else if(state?.A.playing&&state?.B.playing) tips.push('Both decks live — ease crossfader for smooth blend');
    if(cf<0.1||cf>0.9) tips.push('Crossfader at extreme — one deck fully muted');
    if(bpm&&bpm>128)  tips.push('High BPM — a HI boost (+3) adds energy');
    if(bpm&&bpm<80)   tips.push('Slow tempo — reduce LO for cleaner bass');
    if(Math.abs(loA-loB)>8) tips.push('LO EQ mismatch — bass clash risk in blend zone');
    if(vol<0.35) tips.push('Master volume low — raise for full impact');

    const gs=[state?.A?.genre,state?.B?.genre].filter(Boolean);
    const vibe=gs.length===2&&gs[0]===gs[1]?`Pure ${gs[0]}`:gs.length===2?`${gs[0]} × ${gs[1]}`:gs[0]||'—';

    const energy=Math.min(100,Math.round(((bpm||90)/180)*50+vol*30+(Math.max(0,hiA,hiB)/20)*20));
    const eColor=energy>70?'#ff5f5f':energy>40?'#f5a623':'#4ecb91';

    panel.innerHTML=`
      <div class="djai-stats-row">
        <div class="djai-stat"><div class="djai-stat-val">${bpm?bpm+' BPM':'— BPM'}</div><div class="djai-stat-lbl">Tempo</div></div>
        <div class="djai-stat"><div class="djai-stat-val">${balance}</div><div class="djai-stat-lbl">Balance</div></div>
        <div class="djai-stat"><div class="djai-stat-val">${Math.round(vol*100)}%</div><div class="djai-stat-lbl">Master Vol</div></div>
        <div class="djai-stat"><div class="djai-stat-val" style="font-size:.68rem">${esc(vibe)}</div><div class="djai-stat-lbl">Vibe</div></div>
      </div>
      <div class="djai-energy-row">
        <span class="djai-energy-lbl">Energy</span>
        <div class="djai-energy-track"><div class="djai-energy-fill" style="width:${energy}%;background:${eColor}"></div></div>
        <span class="djai-energy-pct">${energy}%</span>
      </div>
      <div class="djai-deck-states">
        ${['A','B'].map(id=>`
          <div class="djai-deck-state${state?.[id]?.playing?' playing':''}">
            <span class="djai-deck-id">DECK ${id}</span>
            <span class="djai-deck-status">${state?.[id]?.playing?'▶ Playing':'⏸ Stopped'}</span>
            <span class="djai-deck-track">${esc(state?.[id]?.trackName||'—')}</span>
          </div>`).join('')}
      </div>
      ${tips.length
        ?`<div class="djai-tips">${tips.map(t=>`<div class="djai-tip">◈ ${esc(t)}</div>`).join('')}</div>`
        :'<div class="djai-empty">Mix sounds good ♫</div>'}
    `;
  }

  function init(){
    document.querySelectorAll('.djai-tab').forEach(t=>{
      t.addEventListener('click',()=>switchTab(t.dataset.tab));
    });
    document.getElementById('djaiRefreshBtn')?.addEventListener('click',()=>{
      tab==='suggest'?renderSuggest():renderAnalyze();
    });
    renderSuggest();
    setInterval(()=>{ if(tab==='analyze') renderAnalyze(); },2000);
  }

  return{init};
})();
