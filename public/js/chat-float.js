// ============================================
// VNportal — Floating Chat + Bullet Screen
// 弹幕 (danmaku) style message display
// ============================================
const ChatFloat = (() => {
  const CHAT_KEY = 'vn_chat';
  const NAME_KEY = 'vn_chat_name';
  let minimized = false;
  let bulletLanes = [false,false,false,false]; // 4 lanes for bullets
  let widget = null;

  function getMessages(){ try{return JSON.parse(localStorage.getItem(CHAT_KEY)||'[]');}catch{return[];} }
  function saveMessages(m){ localStorage.setItem(CHAT_KEY,JSON.stringify(m)); }

  function getMyName(){
    const user = typeof Auth!=='undefined'&&Auth.isLoggedIn() ? Auth.getUser() : null;
    if(user) return user.name;
    let n = localStorage.getItem(NAME_KEY);
    if(!n||!n.startsWith('Guest')){
      n = 'Guest'+String(Math.floor(Math.random()*900)+100);
      localStorage.setItem(NAME_KEY,n);
    }
    return n;
  }

  function init(){
    createWidget();
    // Sync with workshop if it renders too
    window._chatFloatRender = renderMessages;
  }

  function createWidget(){
    widget = document.createElement('div');
    widget.id = 'chatFloat';
    widget.className = 'chat-float';
    widget.innerHTML = `
      <div class="chat-float-bar" id="chatFloatBar">
        <span class="chat-float-title">💬 Discussion</span>
        <div class="chat-float-traffic">
          <button class="tl-btn tl-red"    title="Clear" onclick="ChatFloat._clearAll()"></button>
          <button class="tl-btn tl-yellow" title="Minimize" onclick="ChatFloat._toggle()"></button>
          <button class="tl-btn tl-green"  title="Expand" onclick="ChatFloat._expand()"></button>
        </div>
      </div>
      <div class="chat-float-body" id="chatFloatBody">
        <div class="chat-float-msgs" id="chatFloatMsgs"></div>
        <div class="chat-float-input-row">
          <input id="chatFloatInput" class="chat-float-input" placeholder="Type a message..." maxlength="200"/>
          <button class="chat-float-send" id="chatFloatSend">→</button>
        </div>
      </div>
    `;
    document.body.appendChild(widget);

    // Make draggable
    makeDraggable(widget, document.getElementById('chatFloatBar'));

    // Send
    document.getElementById('chatFloatSend').addEventListener('click', sendMessage);
    document.getElementById('chatFloatInput').addEventListener('keydown', e=>{
      if(e.key==='Enter'){ e.preventDefault(); sendMessage(); }
    });

    renderMessages();
  }

  function sendMessage(){
    const input = document.getElementById('chatFloatInput');
    const text = input?.value?.trim(); if(!text) return;
    const name = getMyName();
    const msgs = getMessages();
    const msg = {
      id: Date.now().toString(),
      name, text,
      time: new Date().toISOString(),
      userId: (typeof Auth!=='undefined'&&Auth.isLoggedIn()) ? Auth.getUser()?.id : 'anon',
      vinyl: Store.getCurrentVinyl()?.name || null,
    };
    msgs.push(msg);
    if(msgs.length>200) msgs.splice(0,msgs.length-200);
    saveMessages(msgs);
    input.value = '';
    renderMessages();
    fireBullet(msg);
    // Sync workshop chat if open
    if(typeof Workshop!=='undefined') Workshop.onShow?.();
  }

  function renderMessages(){
    const el = document.getElementById('chatFloatMsgs'); if(!el) return;
    const msgs = getMessages();
    const myName = getMyName();
    const myId = (typeof Auth!=='undefined'&&Auth.isLoggedIn()) ? Auth.getUser()?.id : null;

    if(!msgs.length){
      el.innerHTML='<p class="chat-empty-hint">No messages yet</p>';
      return;
    }

    el.innerHTML = msgs.slice(-30).map(m=>{
      const isOwn = m.userId===myId || (!myId&&m.name===myName);
      const time = new Date(m.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
      return `
        <div class="cfm-row${isOwn?' cfm-own':''}">
          ${!isOwn?`<span class="cfm-name">${esc(m.name)}</span>`:''}
          <span class="cfm-bubble">${esc(m.text)}</span>
          <span class="cfm-time">${time}</span>
          ${isOwn?`<button class="cfm-del" data-id="${m.id}">✕</button>`:''}
        </div>
      `;
    }).join('');

    // Delete buttons
    el.querySelectorAll('.cfm-del').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const msgs=getMessages().filter(m=>m.id!==btn.dataset.id);
        saveMessages(msgs); renderMessages();
      });
    });
    el.scrollTop = el.scrollHeight;
  }

  // ── Bullet screen (弹幕) ─────────────────
  function fireBullet(msg){
    const bullet = document.createElement('div');
    bullet.className = 'danmaku-bullet';

    // Pick a random color
    const colors = ['#f5c518','#e8734a','#4a9edd','#27ae60','#cc44ff','#ff4488','#00ccaa'];
    const color  = colors[Math.floor(Math.random()*colors.length)];
    bullet.style.color = color;
    bullet.style.textShadow = `0 0 8px ${color}44`;

    // Pick a free lane (top position)
    let lane = bulletLanes.findIndex(l=>!l);
    if(lane===-1) lane = Math.floor(Math.random()*4);
    bulletLanes[lane] = true;
    const topOffsets = [12, 44, 76, 108];
    bullet.style.top = topOffsets[lane] + 'px';

    bullet.textContent = `${msg.name}: ${msg.text}`;
    document.getElementById('danmakuLayer').appendChild(bullet);

    // Animate across screen
    const W = window.innerWidth;
    bullet.style.left = W + 'px';
    const duration = 5000 + Math.random()*3000;
    const start = performance.now();
    function animate(now){
      const elapsed = now - start;
      const pct = elapsed/duration;
      if(pct>=1){
        bullet.remove();
        bulletLanes[lane] = false;
        return;
      }
      bullet.style.left = (W - pct*(W+bullet.offsetWidth+200)) + 'px';
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
    // Free lane after animation
    setTimeout(()=>{ bulletLanes[lane]=false; }, duration);
  }

  // ── Controls ─────────────────────────────
  function toggle(){
    minimized = !minimized;
    const body = document.getElementById('chatFloatBody');
    if(body) body.style.display = minimized ? 'none' : '';
  }

  function expand(){
    minimized = false;
    const body = document.getElementById('chatFloatBody');
    if(body) body.style.display = '';
  }

  function clearAll(){
    if(!confirm('Clear all messages?')) return;
    saveMessages([]); renderMessages();
    if(typeof Workshop!=='undefined') Workshop.onShow?.();
  }

  // ── Draggable ────────────────────────────
  function makeDraggable(el, handle){
    let ox=0, oy=0, sx=0, sy=0;
    handle.style.cursor = 'grab';
    handle.addEventListener('mousedown', e=>{
      e.preventDefault();
      sx=e.clientX; sy=e.clientY;
      const r=el.getBoundingClientRect();
      ox=sx-r.left; oy=sy-r.top;
      handle.style.cursor='grabbing';
      function onMove(e){
        el.style.left = (e.clientX-ox)+'px';
        el.style.top  = (e.clientY-oy)+'px';
        el.style.right='auto'; el.style.bottom='auto';
      }
      function onUp(){
        handle.style.cursor='grab';
        document.removeEventListener('mousemove',onMove);
        document.removeEventListener('mouseup',onUp);
      }
      document.addEventListener('mousemove',onMove);
      document.addEventListener('mouseup',onUp);
    });
  }

  function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  // Public
  window.ChatFloat = {init, _toggle:toggle, _expand:expand, _clearAll:clearAll};
  return window.ChatFloat;
})();
