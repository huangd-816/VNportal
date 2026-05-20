const DJMix = (() => {
  let audioCtx=null, masterGain=null;
  const decks={
    A:{audio:null,gainNode:null,hiEQ:null,midEQ:null,loEQ:null,playing:false,blobUrl:null,trackName:''},
    B:{audio:null,gainNode:null,hiEQ:null,midEQ:null,loEQ:null,playing:false,blobUrl:null,trackName:''},
  };
  let crossfade=0.5, tapTimes=[], animFrame=null;

  function init(){ populateDecks(); bindControls(); startVisualizer(); }

  function ensureCtx(){
    if(!audioCtx){
      audioCtx=new(window.AudioContext||window.webkitAudioContext)();
      masterGain=audioCtx.createGain(); masterGain.gain.value=0.8;
      masterGain.connect(audioCtx.destination);
      ['A','B'].forEach(id=>{
        const d=decks[id];
        d.gainNode=audioCtx.createGain();
        d.hiEQ=mkEQ(8000,'highshelf'); d.midEQ=mkEQ(1000,'peaking'); d.loEQ=mkEQ(200,'lowshelf');
        d.gainNode.connect(d.hiEQ); d.hiEQ.connect(d.midEQ); d.midEQ.connect(d.loEQ); d.loEQ.connect(masterGain);
      });
    }
    if(audioCtx.state==='suspended') audioCtx.resume();
  }

  function mkEQ(freq,type){const f=audioCtx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.gain.value=0;return f;}

  function populateDecks(){
    const{vinyls}=Store.get();
    ['A','B'].forEach(id=>{
      const sel=document.getElementById(`deck${id}Select`); if(!sel) return;
      sel.innerHTML='<option value="">— Load track —</option>';
      vinyls.forEach(v=>(v.tracks||[]).forEach((t,ti)=>{
        const o=document.createElement('option');
        o.value=`${v.id}:${ti}`; o.textContent=`${t.title} — ${t.artist}`;
        sel.appendChild(o);
      }));
    });
  }

  function bindControls(){
    ['A','B'].forEach(id=>{
      document.getElementById(`deck${id}Select`)?.addEventListener('change',e=>loadDeck(id,e.target.value));
      document.getElementById(`deck${id}Play`)?.addEventListener('click',()=>toggleDeck(id));
      document.getElementById(`deck${id}Cue`)?.addEventListener('click',()=>{if(decks[id].audio)decks[id].audio.currentTime=0;});
      ['Hi','Mid','Lo'].forEach(band=>{
        document.getElementById(`deck${id}${band}`)?.addEventListener('input',e=>{
          ensureCtx();
          const eq=decks[id][band.toLowerCase()+'EQ'];
          if(eq) eq.gain.setTargetAtTime(+e.target.value,audioCtx.currentTime,.01);
        });
      });
      document.getElementById(`deck${id}Speed`)?.addEventListener('input',e=>{
        if(decks[id].audio) decks[id].audio.playbackRate=+e.target.value;
      });
    });
    document.getElementById('crossfader')?.addEventListener('input',e=>{crossfade=+e.target.value;applyCrossfade();});
    document.getElementById('masterVol')?.addEventListener('input',e=>{ensureCtx();if(masterGain)masterGain.gain.value=+e.target.value;});
    document.getElementById('tapBpmBtn')?.addEventListener('click',tapBpm);
    document.getElementById('djExportBtn')?.addEventListener('click',exportMix);
  }

  async function loadDeck(id,value){
    if(!value) return;
    const[vinylId,tiStr]=value.split(':'); const ti=parseInt(tiStr);
    const vinyl=Store.getVinyl(vinylId); if(!vinyl) return;
    const track=vinyl.tracks?.[ti]; if(!track) return;
    decks[id].trackName=`${track.title} — ${track.artist}`;
    document.getElementById(`deck${id}TitleDisp`).textContent=track.title;
    document.getElementById(`deck${id}ArtistDisp`).textContent=track.artist;
    const cover=Store.getCover(vinylId);
    const coverSrc=typeof cover==='string'?cover:(cover?.src||null);
    const disc=document.getElementById(`disc${id}`);
    if(disc&&coverSrc){disc.style.backgroundImage=`url(${coverSrc})`;disc.style.backgroundSize='cover';}

    // Guard: check if DB is available (may not be if no local files)
    if(typeof DB==='undefined'){
      Notify.warn(`Deck ${id}: No local audio — upload a local file to use the DJ`);
      return;
    }

    const key=DB.trackKey(vinylId,ti);
    const hasLocal=await DB.hasFile(key);
    if(hasLocal){
      const url=await DB.getFileURL(key);
      if(decks[id].blobUrl) URL.revokeObjectURL(decks[id].blobUrl);
      decks[id].blobUrl=url; decks[id].audio=new Audio(url);
      decks[id].audio.addEventListener('ended',()=>stopDeck(id));
      ensureCtx();
      try{
        const src=audioCtx.createMediaElementSource(decks[id].audio);
        src.connect(decks[id].gainNode);
      }catch{}
      Notify.success(`Deck ${id}: "${track.title}" loaded`);
    } else {
      Notify.warn(`Deck ${id}: No local file — upload audio in DIY Vinyl first`);
      document.getElementById(`deck${id}TitleDisp`).textContent=track.title+' (no local file)';
    }
  }

  function toggleDeck(id){
    const d=decks[id];
    if(!d.audio){Notify.error(`Upload a local file to Deck ${id} first!`);return;}
    ensureCtx();
    if(d.playing){
      d.audio.pause(); d.playing=false;
      document.getElementById(`deck${id}Play`).textContent='▶';
      document.getElementById(`deck${id}Play`).classList.remove('active');
      document.getElementById(`disc${id}`)?.classList.remove('playing');
      document.getElementById(`arm${id}`)?.classList.remove('playing');
    } else {
      d.audio.play(); d.playing=true;
      document.getElementById(`deck${id}Play`).textContent='⏸';
      document.getElementById(`deck${id}Play`).classList.add('active');
      document.getElementById(`disc${id}`)?.classList.add('playing');
      document.getElementById(`arm${id}`)?.classList.add('playing');
    }
    applyCrossfade();
    updateScreenText();
  }

  function stopDeck(id){
    decks[id].playing=false;
    document.getElementById(`deck${id}Play`).textContent='▶';
    document.getElementById(`deck${id}Play`).classList.remove('active');
    document.getElementById(`disc${id}`)?.classList.remove('playing');
    document.getElementById(`arm${id}`)?.classList.remove('playing');
  }

  function applyCrossfade(){
    ensureCtx();
    decks.A.gainNode?.gain.setTargetAtTime(Math.cos(crossfade*Math.PI/2),audioCtx.currentTime,.02);
    decks.B.gainNode?.gain.setTargetAtTime(Math.cos((1-crossfade)*Math.PI/2),audioCtx.currentTime,.02);
  }

  function updateScreenText(){
    const screen=document.getElementById('djScreenText');
    if(!screen) return;
    const aName=decks.A.playing?decks.A.trackName:'';
    const bName=decks.B.playing?decks.B.trackName:'';
    screen.textContent=aName||bName||'VNportal DJ';
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
    if(decks.A.trackName) tracks.push(`Deck A: ${decks.A.trackName}`);
    if(decks.B.trackName) tracks.push(`Deck B: ${decks.B.trackName}`);
    if(!tracks.length){Notify.warn('Load tracks on the decks first!');return;}
    const text=`VNportal DJ Mix\n${new Date().toLocaleDateString()}\n\n${tracks.join('\n')}\n\nCrossfader: ${Math.round(crossfade*100)}% B\n\nhttps://github.com/huangd-816/VNportal`;
    const blob=new Blob([text],{type:'text/plain'});
    const a=document.createElement('a'); a.download='vnportal-mix.txt'; a.href=URL.createObjectURL(blob); a.click();
    Notify.success('Mix exported!');
    if(navigator.share) navigator.share({title:'My VNportal Mix',text,url:'https://github.com/huangd-816/VNportal'}).catch(()=>{});
  }

  function startVisualizer(){
    const canvasA=document.getElementById('vuCanvasA'), canvasB=document.getElementById('vuCanvasB');
    if(!canvasA||!canvasB) return;
    const ctxA=canvasA.getContext('2d'), ctxB=canvasB.getContext('2d');
    function tick(){
      [['A',ctxA,canvasA],['B',ctxB,canvasB]].forEach(([id,c,cv])=>{
        const playing=decks[id].playing;
        c.clearRect(0,0,cv.width,cv.height);
        const bars=12;
        for(let i=0;i<bars;i++){
          const h=playing?(0.2+Math.random()*0.8)*cv.height:4;
          const hue=id==='A'?240+i*5:320+i*5;
          c.fillStyle=`hsl(${hue},90%,60%)`;
          c.fillRect(i*(cv.width/bars)+1,cv.height-h,(cv.width/bars)-2,h);
        }
      });
      animFrame=requestAnimationFrame(tick);
    }
    tick();
  }

  function onShow(){ populateDecks(); }
  return{init,onShow};
})();
