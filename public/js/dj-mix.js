// ============================================
// VNportal — DJ Mix
// In-browser audio via SoundCloud Widget API
// No app switching — plays directly in page
// ============================================
const DJMix = (() => {
  const SC_WIDGET = 'https://w.soundcloud.com/player/';
  const state = {
    A: { trackName:'', widget:null, playing:false, iframe:null },
    B: { trackName:'', widget:null, playing:false, iframe:null },
  };
  let crossfade=0.5, tapTimes=[], animFrame=null;
  let scApiLoaded=false;

  function init(){
    loadSCApi();
    populateDecks();
    bindControls();
    startVisualizer();
  }

  function loadSCApi(){
    if(document.getElementById('scApiScript')) return;
    const s=document.createElement('script');
    s.id='scApiScript';
    s.src='https://w.soundcloud.com/player/api.js';
    s.onload=()=>{ scApiLoaded=true; };
    document.head.appendChild(s);
  }

  function populateDecks(){
    const{vinyls}=Store.get();
    ['A','B'].forEach(id=>{
      const sel=document.getElementById(`deck${id}Select`); if(!sel) return;
      sel.innerHTML='<option value="">— Load track —</option>';
      vinyls.forEach(v=>(v.tracks||[]).forEach((t,ti)=>{
        const o=document.createElement('option');
        o.value=`${v.id}:${ti}`;
        o.textContent=`${t.title} — ${t.artist}`;
        sel.appendChild(o);
      }));
    });
  }

  function bindControls(){
    ['A','B'].forEach(id=>{
      document.getElementById(`deck${id}Select`)?.addEventListener('change',e=>loadDeck(id,e.target.value));
      document.getElementById(`deck${id}Play`)?.addEventListener('click',()=>toggleDeck(id));
      document.getElementById(`deck${id}Cue`)?.addEventListener('click',()=>cueDeck(id));
    });
    document.getElementById('crossfader')?.addEventListener('input',e=>{
      crossfade=+e.target.value;
      applyCrossfade();
    });
    document.getElementById('masterVol')?.addEventListener('input',e=>{
      const vol=Math.round(+e.target.value*100);
      ['A','B'].forEach(id=>{ try{state[id].widget?.setVolume(vol);}catch{} });
    });
    document.getElementById('tapBpmBtn')?.addEventListener('click',tapBpm);
    document.getElementById('djExportBtn')?.addEventListener('click',exportMix);
  }

  async function loadDeck(id, value){
    if(!value) return;
    const[vinylId,tiStr]=value.split(':'); const ti=parseInt(tiStr);
    const vinyl=Store.getVinyl(vinylId); if(!vinyl) return;
    const track=vinyl.tracks?.[ti]; if(!track) return;

    state[id].trackName=`${track.title} — ${track.artist}`;
    document.getElementById(`deck${id}TitleDisp`).textContent=track.title;
    document.getElementById(`deck${id}ArtistDisp`).textContent=track.artist;

    // Cover on disc
    const cover=Store.getCover(vinylId);
    const coverSrc=typeof cover==='string'?cover:(cover?.src||null);
    const disc=document.getElementById(`disc${id}`);
    if(disc&&coverSrc){ disc.style.backgroundImage=`url(${coverSrc})`; disc.style.backgroundSize='cover'; }

    const wrap=document.getElementById(`deck${id}SpotifyEmbed`);
    if(!wrap) return;

    // Build SoundCloud search URL for this track
    const query=encodeURIComponent(`${track.title} ${track.artist}`);
    const scSearchUrl=`https://soundcloud.com/search/sounds?q=${query}`;
    const embedUrl=`${SC_WIDGET}?url=${encodeURIComponent(scSearchUrl)}&auto_play=false&buying=false&liking=false&download=false&sharing=false&show_artwork=true&show_comments=false&show_playcount=false&show_user=false&hide_related=true&visual=false&color=%23f5c518`;

    // Create/replace iframe
    if(state[id].iframe){ state[id].iframe.remove(); state[id].widget=null; }
    const iframe=document.createElement('iframe');
    iframe.style.cssText='width:100%;height:120px;border:none;border-radius:4px;';
    iframe.src=embedUrl;
    iframe.allow='autoplay';
    iframe.id=`scFrame${id}`;
    wrap.innerHTML='';
    wrap.appendChild(iframe);
    wrap.style.display='block';
    state[id].iframe=iframe;

    // Wire up SoundCloud Widget API after iframe loads
    iframe.onload=()=>{
      if(!scApiLoaded||typeof SC==='undefined'){ return; }
      try{
        const widget=SC.Widget(iframe);
        state[id].widget=widget;
        widget.bind(SC.Widget.Events.PLAY,()=>{
          state[id].playing=true;
          updateDeckUI(id,true);
          applyCrossfade();
        });
        widget.bind(SC.Widget.Events.PAUSE,()=>{
          state[id].playing=false;
          updateDeckUI(id,false);
        });
        widget.bind(SC.Widget.Events.FINISH,()=>{
          state[id].playing=false;
          updateDeckUI(id,false);
        });
      } catch(e){}
    };

    Notify.success(`Deck ${id}: Searching for "${track.title}"...`);
  }

  function toggleDeck(id){
    const s=state[id];
    if(!s.widget){
      Notify.warn(`Deck ${id}: Load a track first`);
      return;
    }
    try{
      if(s.playing){ s.widget.pause(); }
      else { s.widget.play(); }
    } catch(e){
      Notify.warn(`Deck ${id}: Use the SoundCloud player controls`);
    }
  }

  function cueDeck(id){
    try{ state[id].widget?.seekTo(0); }catch{}
  }

  function updateDeckUI(id,playing){
    const btn=document.getElementById(`deck${id}Play`);
    if(btn){ btn.textContent=playing?'⏸':'▶'; btn.classList.toggle('active',playing); }
    document.getElementById(`disc${id}`)?.classList.toggle('playing',playing);
    document.getElementById(`arm${id}`)?.classList.toggle('playing',playing);
    updateScreenText();
  }

  function applyCrossfade(){
    // crossfade 0=A full, 0.5=equal, 1=B full
    const volA=Math.round(Math.cos(crossfade*Math.PI/2)*100);
    const volB=Math.round(Math.cos((1-crossfade)*Math.PI/2)*100);
    try{ state.A.widget?.setVolume(volA); }catch{}
    try{ state.B.widget?.setVolume(volB); }catch{}
  }

  function updateScreenText(){
    const screen=document.getElementById('djScreenText'); if(!screen) return;
    const playing=[state.A,state.B].filter(s=>s.playing).map(s=>s.trackName);
    screen.textContent=playing[0]||'VNportal DJ';
  }

  function tapBpm(){
    tapTimes.push(Date.now()); if(tapTimes.length>8) tapTimes.shift();
    if(tapTimes.length>=2){
      const avg=tapTimes.slice(1).map((t,i)=>t-tapTimes[i]).reduce((a,b)=>a+b)/(tapTimes.length-1);
      document.getElementById('bpmDisplay').textContent=Math.round(60000/avg)+' BPM';
    }
  }

  function exportMix(){
    const tracks=[];
    if(state.A.trackName) tracks.push(`Deck A: ${state.A.trackName}`);
    if(state.B.trackName) tracks.push(`Deck B: ${state.B.trackName}`);
    if(!tracks.length){Notify.warn('Load tracks first!');return;}
    const text=`VNportal DJ Mix\n${new Date().toLocaleDateString()}\n\n${tracks.join('\n')}\n\nhttps://github.com/huangd-816/VNportal`;
    const blob=new Blob([text],{type:'text/plain'});
    const a=document.createElement('a'); a.download='vnportal-mix.txt'; a.href=URL.createObjectURL(blob); a.click();
    Notify.success('Mix exported!');
    if(navigator.share) navigator.share({title:'VNportal Mix',text,url:'https://github.com/huangd-816/VNportal'}).catch(()=>{});
  }

  function startVisualizer(){
    const cA=document.getElementById('vuCanvasA'), cB=document.getElementById('vuCanvasB');
    if(!cA||!cB) return;
    const ctxA=cA.getContext('2d'), ctxB=cB.getContext('2d');
    let f=0;
    function tick(){
      f++;
      [['A',ctxA,cA],['B',ctxB,cB]].forEach(([id,c,cv])=>{
        const active=state[id].playing;
        c.clearRect(0,0,cv.width,cv.height);
        for(let i=0;i<12;i++){
          const h=active?(0.15+Math.sin(f*.08+i*.5)*.25+Math.random()*.4)*cv.height:4;
          c.fillStyle=`hsl(${id==='A'?240+i*5:140+i*5},80%,${active?55:20}%)`;
          c.fillRect(i*(cv.width/12)+1,cv.height-h,(cv.width/12)-2,h);
        }
      });
      animFrame=requestAnimationFrame(tick);
    }
    tick();
  }

  function onShow(){ populateDecks(); }
  return{init,onShow};
})();
