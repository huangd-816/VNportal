// ============================================
// VNportal — DJ Mix
// YouTube IFrame embed — full tracks, in-browser
// Works with: npx serve . (local server)
// ============================================
const DJMix = (() => {
  let audioCtx=null, masterGain=null;
  const decks={
    A:{gainNode:null,playing:false,trackName:'',ytPlayer:null,ytReady:false},
    B:{gainNode:null,playing:false,trackName:'',ytPlayer:null,ytReady:false},
  };
  let ytApiLoaded=false, crossfade=0.5, tapTimes=[], animFrame=null;

  // Load YouTube IFrame API once
  function loadYTApi(){
    if(document.getElementById('ytApiScript')||window.YT) return;
    const s=document.createElement('script');
    s.id='ytApiScript';
    s.src='https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }

  window.onYouTubeIframeAPIReady=function(){
    ytApiLoaded=true;
  };

  function init(){ loadYTApi(); populateDecks(); bindControls(); startVisualizer(); }

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
      document.getElementById(`deck${id}Speed`)?.addEventListener('input',e=>{
        try{ decks[id].ytPlayer?.setPlaybackRate?.(+e.target.value); }catch{}
      });
    });
    document.getElementById('crossfader')?.addEventListener('input',e=>{
      crossfade=+e.target.value; applyCrossfade();
    });
    document.getElementById('masterVol')?.addEventListener('input',e=>{
      const vol=Math.round(+e.target.value*100);
      ['A','B'].forEach(id=>{ try{ decks[id].ytPlayer?.setVolume?.(vol); }catch{} });
    });
    document.getElementById('tapBpmBtn')?.addEventListener('click',tapBpm);
    document.getElementById('djExportBtn')?.addEventListener('click',exportMix);
  }

  async function loadDeck(id, value){
    if(!value) return;
    const[vinylId,tiStr]=value.split(':'); const ti=parseInt(tiStr);
    const vinyl=Store.getVinyl(vinylId); if(!vinyl) return;
    const track=vinyl.tracks?.[ti]; if(!track) return;

    decks[id].trackName=`${track.title} — ${track.artist}`;
    document.getElementById(`deck${id}TitleDisp`).textContent=track.title;
    document.getElementById(`deck${id}ArtistDisp`).textContent=track.artist;

    // Cover on disc
    const cover=Store.getCover(vinylId);
    const coverSrc=typeof cover==='string'?cover:(cover?.src||null);
    const disc=document.getElementById(`disc${id}`);
    if(disc&&coverSrc){ disc.style.backgroundImage=`url(${coverSrc})`; disc.style.backgroundSize='cover'; }

    const wrap=document.getElementById(`deck${id}SpotifyEmbed`);
    if(wrap){ wrap.innerHTML=''; wrap.style.display='block'; }

    // Build YouTube search query — exact title + artist
    const q=encodeURIComponent(`${track.title} ${track.artist||''} official`);
    const searchUrl=`https://www.youtube.com/results?search_query=${q}`;

    // Embed YouTube search results iframe — full tracks
    const embedUrl=`https://www.youtube.com/embed?listType=search&list=${q}&autoplay=0&controls=1&rel=0&modestbranding=1`;

    if(wrap){
      wrap.innerHTML=`
        <div class="dj-yt-wrap">
          <div class="dj-yt-label">
            <svg width="14" height="10" viewBox="0 0 24 17" fill="#ff0000"><path d="M23.5 2.6A3 3 0 0 0 21.4.4C19.5 0 12 0 12 0S4.5 0 2.6.5A3 3 0 0 0 .5 2.6C0 4.5 0 8.5 0 8.5s0 4 .5 5.9A3 3 0 0 0 2.6 16.5C4.5 17 12 17 12 17s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 12.5 24 8.5 24 8.5s0-4-.5-5.9zM9.5 12V5l6.5 3.5L9.5 12z"/></svg>
            Full track · YouTube
          </div>
          <iframe
            id="ytEmbed${id}"
            src="${embedUrl}"
            width="100%" height="120"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
            allowfullscreen
            style="border:none;border-radius:4px"
          ></iframe>
          <div class="dj-yt-hint">
            Wrong track? 
            <a href="${searchUrl}" target="_blank" class="dj-yt-search-link">Search YouTube ↗</a>
          </div>
        </div>
      `;
    }
    Notify.success(`Deck ${id}: "${track.title}" — click play in the video`);
  }

  function toggleDeck(id){
    Notify.info(`Use the YouTube player controls on Deck ${id}`);
  }
  function cueDeck(id){
    const iframe=document.getElementById(`ytEmbed${id}`);
    if(iframe){ const src=iframe.src; iframe.src=''; setTimeout(()=>iframe.src=src,100); }
  }

  function applyCrossfade(){
    const vA=Math.round(Math.cos(crossfade*Math.PI/2)*100);
    const vB=Math.round(Math.cos((1-crossfade)*Math.PI/2)*100);
    // YouTube iframes control their own volume — set via postMessage
    ['A','B'].forEach((id,i)=>{
      const iframe=document.getElementById(`ytEmbed${id}`);
      const vol=i===0?vA:vB;
      try{
        iframe?.contentWindow?.postMessage(JSON.stringify({
          event:'command',func:'setVolume',args:[vol]
        }),'https://www.youtube.com');
      }catch{}
    });
  }

  function tapBpm(){
    tapTimes.push(Date.now()); if(tapTimes.length>8) tapTimes.shift();
    if(tapTimes.length>=2){
      const avg=tapTimes.slice(1).map((t,i)=>t-tapTimes[i]).reduce((a,b)=>a+b)/(tapTimes.length-1);
      document.getElementById('bpmDisplay').textContent=Math.round(60000/avg)+' BPM';
    }
  }

  function exportMix(){
    const tracks=[decks.A,decks.B].filter(d=>d.trackName).map((d,i)=>`Deck ${i?'B':'A'}: ${d.trackName}`);
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
        const active=!!document.getElementById(`ytEmbed${id}`);
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

  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function onShow(){ populateDecks(); }
  return{init,onShow};
})();
