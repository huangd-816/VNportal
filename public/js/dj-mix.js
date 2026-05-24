// ============================================
// VNportal — DJ Mix
// On file:// → opens YouTube in tab (full track)
// On server → embeds YouTube iframe directly
// ============================================
const DJMix = (() => {
  const IS_SERVER = window.location.protocol !== 'file:';
  const decks={
    A:{playing:false,trackName:''},
    B:{playing:false,trackName:''},
  };
  let crossfade=0.5, tapTimes=[], animFrame=null;

  function init(){ populateDecks(); bindControls(); startVisualizer(); }

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
      document.getElementById(`deck${id}Play`)?.addEventListener('click',()=>playDeck(id));
      document.getElementById(`deck${id}Cue`)?.addEventListener('click',()=>cueDeck(id));
    });
    document.getElementById('crossfader')?.addEventListener('input',e=>{
      crossfade=+e.target.value; applyCrossfade();
    });
    document.getElementById('tapBpmBtn')?.addEventListener('click',tapBpm);
    document.getElementById('djExportBtn')?.addEventListener('click',exportMix);
    document.getElementById('masterVol')?.addEventListener('input',e=>{
      if(!IS_SERVER) return;
      ['A','B'].forEach(id=>{
        const iframe=document.getElementById(`ytEmbed${id}`);
        if(iframe){
          try{ iframe.contentWindow.postMessage(JSON.stringify({event:'command',func:'setVolume',args:[Math.round(+e.target.value*100)]}),'*'); }catch{}
        }
      });
    });
  }

  async function loadDeck(id, value){
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
    if(disc&&coverSrc){ disc.style.backgroundImage=`url(${coverSrc})`; disc.style.backgroundSize='cover'; }

    const wrap=document.getElementById(`deck${id}SpotifyEmbed`);
    if(!wrap) return;
    wrap.style.display='block';

    const q=encodeURIComponent(`${track.title} ${track.artist||''}`);
    const ytSearch=`https://www.youtube.com/results?search_query=${q}`;
    const ytMusic =`https://music.youtube.com/search?q=${q}`;

    if(IS_SERVER){
      // Embed YouTube search iframe — full track playback
      const embedSrc=`https://www.youtube.com/embed?listType=search&list=${q}&controls=1&rel=0&modestbranding=1&enablejsapi=1`;
      wrap.innerHTML=`
        <div class="dj-yt-wrap">
          <div class="dj-yt-label">
            <svg width="12" height="9" viewBox="0 0 24 17" fill="#ff0000"><path d="M23.5 2.6A3 3 0 0 0 21.4.4C19.5 0 12 0 12 0S4.5 0 2.6.5A3 3 0 0 0 .5 2.6C0 4.5 0 8.5 0 8.5s0 4 .5 5.9A3 3 0 0 0 2.6 16.5C4.5 17 12 17 12 17s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 12.5 24 12.5 24 8.5s0-4-.5-5.9zM9.5 12V5l6.5 3.5L9.5 12z"/></svg>
            YouTube · Full track
          </div>
          <iframe id="ytEmbed${id}" src="${embedSrc}" width="100%" height="115"
            allow="autoplay; encrypted-media" allowfullscreen
            style="border:none;border-radius:4px;display:block"></iframe>
          <a href="${ytSearch}" target="_blank" class="dj-yt-hint">Wrong track? Search YouTube ↗</a>
        </div>
      `;
      Notify.success(`Deck ${id}: "${track.title}" — click play in the player`);
    } else {
      // file:// — YouTube iframes blocked. Show direct open buttons instead.
      wrap.innerHTML=`
        <div class="dj-yt-wrap dj-yt-file-mode">
          <div class="dj-file-notice">
            <span style="color:var(--accent)">▶ Open to play full track:</span>
          </div>
          <div class="dj-file-btns">
            <a href="${ytMusic}" target="_blank" class="dj-open-btn dj-yt-btn">
              <svg width="13" height="9" viewBox="0 0 24 17" fill="#ff0000"><path d="M23.5 2.6A3 3 0 0 0 21.4.4C19.5 0 12 0 12 0S4.5 0 2.6.5A3 3 0 0 0 .5 2.6C0 4.5 0 8.5 0 8.5s0 4 .5 5.9A3 3 0 0 0 2.6 16.5C4.5 17 12 17 12 17s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 12.5 24 12.5 24 8.5s0-4-.5-5.9zM9.5 12V5l6.5 3.5L9.5 12z"/></svg>
              YouTube Music
            </a>
            <a href="${ytSearch}" target="_blank" class="dj-open-btn dj-yt-search-btn">
              YouTube Search ↗
            </a>
          </div>
          <div class="dj-server-tip">
            💡 Run <code>npx serve .</code> for embedded playback
          </div>
        </div>
      `;
      Notify.info(`Deck ${id}: "${track.title}" — click the button to open in YouTube`);
    }
  }

  function playDeck(id){
    if(!IS_SERVER){
      Notify.info(`Use the YouTube buttons on Deck ${id} — run npx serve . for embedded play`);
      return;
    }
    Notify.info(`Use the play button inside the YouTube player on Deck ${id}`);
  }

  function cueDeck(id){
    const iframe=document.getElementById(`ytEmbed${id}`);
    if(iframe){ const s=iframe.src; iframe.src=''; setTimeout(()=>iframe.src=s,150); }
  }

  function applyCrossfade(){
    // Visual only — iframe volume limited by browser policy
    const vA=Math.round(Math.cos(crossfade*Math.PI/2)*100);
    const vB=Math.round(Math.cos((1-crossfade)*Math.PI/2)*100);
    ['A','B'].forEach((id,i)=>{
      const iframe=document.getElementById(`ytEmbed${id}`);
      try{ iframe?.contentWindow?.postMessage(JSON.stringify({event:'command',func:'setVolume',args:[i===0?vA:vB]}),'*'); }catch{}
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
    if(navigator.share) navigator.share({title:'VNportal Mix',text,url:'https://github.com/huangd-816/VNportal'}).catch(()=>{});
    Notify.success('Mix exported!');
  }

  function startVisualizer(){
    const cA=document.getElementById('vuCanvasA'), cB=document.getElementById('vuCanvasB');
    if(!cA||!cB) return;
    const ctxA=cA.getContext('2d'), ctxB=cB.getContext('2d');
    let f=0;
    function tick(){
      f++;
      [['A',ctxA,cA],['B',ctxB,cB]].forEach(([id,c,cv])=>{
        const active=!!document.getElementById(`ytEmbed${id}`)||!!document.querySelector(`#deck${id}SpotifyEmbed .dj-file-btns`);
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
