const Snake = (() => {
  const CELL=24,COLS=20,ROWS=20,W=480,H=480;
  let canvas,ctx,snake,dir,nextDir,food,score,highScore,loop,alive,paused;
  let coverImg=null;
  // Vivid rainbow palette — each segment gets its own color
  const RAINBOW=['#FF3366','#FF6633','#FFCC00','#33FF66','#33CCFF','#6633FF','#FF33CC','#00FFCC','#FF9933','#99FF33'];

  function init() {
    canvas=document.getElementById('snakeCanvas'); if(!canvas) return;
    ctx=canvas.getContext('2d'); canvas.width=W; canvas.height=H;
    highScore=parseInt(localStorage.getItem('vn_snake_best')||'0');
    document.getElementById('snakeContainer')?.classList.add('hidden');
    document.getElementById('playSnakeBtn')?.addEventListener('click', show);
    document.getElementById('closeSnake')?.addEventListener('click', hide);
    document.getElementById('shareSnakeBtn')?.addEventListener('click', shareScore);
    window.addEventListener('keydown', handleKey);
    let tx=0,ty=0;
    canvas.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;e.preventDefault();},{passive:false});
    canvas.addEventListener('touchend',e=>{
      const dx=e.changedTouches[0].clientX-tx,dy=e.changedTouches[0].clientY-ty;
      if(Math.abs(dx)>Math.abs(dy)) setDir(dx>0?{x:1,y:0}:{x:-1,y:0});
      else setDir(dy>0?{x:0,y:1}:{x:0,y:-1});
    });
  }

  function show(){
    document.getElementById('snakeContainer')?.classList.remove('hidden');
    loadCover(); startGame();
  }
  function hide(){
    document.getElementById('snakeContainer')?.classList.add('hidden');
    clearInterval(loop); alive=false;
  }

  function loadCover(){
    const v=Store.getCurrentVinyl(); if(!v) return;
    const c=Store.getCover(v.id); if(!c) return;
    const src=typeof c==='string'?c:(c?.src||null); if(!src) return;
    const img=new Image(); img.onload=()=>coverImg=img; img.src=src;
  }

  function startGame(){
    clearInterval(loop);
    snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10},{x:7,y:10}];
    dir={x:1,y:0}; nextDir={x:1,y:0};
    score=0; alive=true; paused=false;
    placeFood(); updateHUD(); loop=setInterval(tick,130); draw();
  }

  function tick(){
    if(!alive||paused) return;
    dir={...nextDir};
    const nx=snake[0].x+dir.x,ny=snake[0].y+dir.y;
    if(nx<0||nx>=COLS||ny<0||ny>=ROWS){die();return;}
    const head={x:nx,y:ny};
    if(snake.slice(0,-1).some(s=>s.x===head.x&&s.y===head.y)){die();return;}
    snake.unshift(head);
    if(head.x===food.x&&head.y===food.y){
      score++;
      if(score>highScore){highScore=score;localStorage.setItem('vn_snake_best',highScore);}
      updateHUD(); placeFood();
      clearInterval(loop); loop=setInterval(tick,Math.max(60,130-Math.floor(score/5)*8));
    } else { snake.pop(); }
    draw();
  }

  function die(){alive=false;clearInterval(loop);drawDeath();}
  function placeFood(){
    do{food={x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)};}
    while(snake.some(s=>s.x===food.x&&s.y===food.y));
  }

  function draw(){
    // Background
    if(coverImg){
      ctx.drawImage(coverImg,0,0,W,H);
      ctx.fillStyle='rgba(0,0,0,0.48)'; ctx.fillRect(0,0,W,H);
    } else {
      ctx.fillStyle='#1a1520'; ctx.fillRect(0,0,W,H);
    }
    // Grid
    ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=.5;
    for(let x=0;x<=W;x+=CELL){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<=H;y+=CELL){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

    drawFood();

    // Snake body — vivid color per segment
    snake.forEach((seg,i)=>{
      const isHead=i===0;
      // Each segment gets its own vivid color from rainbow
      const col=RAINBOW[i%RAINBOW.length];
      const opacity=Math.max(0.55, 1-(i/snake.length)*0.4);
      const x=seg.x*CELL,y=seg.y*CELL,pad=isHead?0:2;

      ctx.globalAlpha=opacity;

      // Glow effect
      ctx.shadowColor=col; ctx.shadowBlur=isHead?16:8;
      ctx.fillStyle=col;
      rRect(ctx,x+pad,y+pad,CELL-pad*2,CELL-pad*2,isHead?8:5);
      ctx.fill();
      ctx.shadowBlur=0; ctx.globalAlpha=1;

      // Head: bright outline + eyes
      if(isHead){
        ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1.5;
        rRect(ctx,x+1,y+1,CELL-2,CELL-2,8); ctx.stroke();
        ctx.fillStyle='#000';
        const[x1,y1,x2,y2]=eyes(seg.x*CELL,seg.y*CELL);
        ctx.beginPath();ctx.arc(x1,y1,2.5,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(x2,y2,2.5,0,Math.PI*2);ctx.fill();
        // White dot pupils
        ctx.fillStyle='#fff';
        ctx.beginPath();ctx.arc(x1-0.5,y1-0.5,1,0,Math.PI*2);ctx.fill();
        ctx.beginPath();ctx.arc(x2-0.5,y2-0.5,1,0,Math.PI*2);ctx.fill();
      }
    });
  }

  function drawFood(){
    const cx=food.x*CELL+CELL/2,cy=food.y*CELL+CELL/2,r=CELL/2-2;
    // Vivid apple — cycle through colors based on position
    const appleColor=RAINBOW[(food.x+food.y)%RAINBOW.length];
    ctx.shadowColor=appleColor; ctx.shadowBlur=14;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    // Gradient fill
    const grad=ctx.createRadialGradient(cx-3,cy-3,2,cx,cy,r);
    grad.addColorStop(0,'rgba(255,255,255,0.9)');
    grad.addColorStop(0.3,appleColor);
    grad.addColorStop(1,'rgba(0,0,0,0.5)');
    ctx.fillStyle=grad; ctx.fill();
    ctx.shadowBlur=0;
    // Shine dot
    ctx.fillStyle='rgba(255,255,255,0.6)';
    ctx.beginPath(); ctx.arc(cx-3,cy-3,2.5,0,Math.PI*2); ctx.fill();
    // Center hole if cover shown
    if(coverImg){
      ctx.save();
      ctx.beginPath();ctx.arc(cx,cy,r*.4,0,Math.PI*2);ctx.clip();
      const sx=(food.x/COLS)*coverImg.width,sy=(food.y/ROWS)*coverImg.height;
      ctx.drawImage(coverImg,sx,sy,coverImg.width/COLS*2,coverImg.height/ROWS*2,cx-r*.4,cy-r*.4,r*.8,r*.8);
      ctx.restore();
    }
  }

  function eyes(hx,hy){
    const c=CELL/2,o=5;
    if(dir.x===1)  return[hx+c+o,hy+c-o,hx+c+o,hy+c+o];
    if(dir.x===-1) return[hx+c-o,hy+c-o,hx+c-o,hy+c+o];
    if(dir.y===1)  return[hx+c-o,hy+c+o,hx+c+o,hy+c+o];
    return[hx+c-o,hy+c-o,hx+c+o,hy+c-o];
  }
  function rRect(c,x,y,w,h,r){
    c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.arcTo(x+w,y,x+w,y+r,r);
    c.lineTo(x+w,y+h-r);c.arcTo(x+w,y+h,x+w-r,y+h,r);
    c.lineTo(x+r,y+h);c.arcTo(x,y+h,x,y+h-r,r);
    c.lineTo(x,y+r);c.arcTo(x,y,x+r,y,r);c.closePath();
  }
  function drawDeath(){
    draw();
    ctx.fillStyle='rgba(0,0,0,0.75)';ctx.fillRect(0,0,W,H);
    ctx.textAlign='center';
    ctx.fillStyle='#e8e0d5';ctx.font='bold 38px "Bebas Neue",sans-serif';
    ctx.fillText('SIDE B OVER',W/2,H/2-20);
    ctx.fillStyle='#f5c518';ctx.font='15px "DM Mono",monospace';
    ctx.fillText(`Score: ${score}   Best: ${highScore}`,W/2,H/2+10);
    ctx.fillStyle='#9a9290';ctx.font='11px "DM Mono",monospace';
    ctx.fillText('SPACE to replay',W/2,H/2+34);
    ctx.textAlign='left';
  }
  function updateHUD(){
    const s=document.getElementById('snakeScore'),h=document.getElementById('snakeHigh');
    if(s)s.textContent=score;if(h)h.textContent=highScore;
  }
  function setDir(d){if(!(d.x===-dir.x&&d.y===-dir.y))nextDir=d;}
  function handleKey(e){
    if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
    if(document.getElementById('snakeContainer')?.classList.contains('hidden')) return;
    const map={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},
               w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0}};
    if(e.key===' '){if(!alive)startGame();else paused=!paused;e.preventDefault();return;}
    const d=map[e.key];if(d){setDir(d);e.preventDefault();}
  }
  async function shareScore(){
    const text=`I scored ${score} on Groove Snake in VNportal! 🐍🎵\nhttps://github.com/huangd-816/VNportal`;
    if(navigator.share){try{await navigator.share({title:'VNportal',text,url:'https://github.com/huangd-816/VNportal'});return;}catch{}}
    try{await navigator.clipboard.writeText(text);Notify.success('Score + link copied!');}catch{alert(text);}
  }
  return{init};
})();
