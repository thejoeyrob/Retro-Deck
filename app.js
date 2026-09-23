(()=>{
'use strict';
const $=s=>document.querySelector(s);
const canvas=$('#gameCanvas'), ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const rand=(a,b)=>Math.random()*(b-a)+a;
const choice=a=>a[(Math.random()*a.length)|0];
const rectHit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;

const store={
  load(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}},
  save(k,v){localStorage.setItem(k,JSON.stringify(v))}
};
let prefs=store.load('jwrd.prefs',{skin:'classic',haptics:true,sound:true,buttons:{dpad:'#202226',a:'#e84b4b',b:'#f2cc40',x:'#4c83f1',y:'#4bc27b'}});
let stats=store.load('jwrd.stats',{played:[],achievements:{},high:{},requests:[]});
function saveAll(){store.save('jwrd.prefs',prefs);store.save('jwrd.stats',stats)}
function buzz(ms=12){if(prefs.haptics&&navigator.vibrate)navigator.vibrate(ms)}

const input={down:{},pressed:{},released:{}, set(k,v){if(v&&!this.down[k])this.pressed[k]=true;if(!v&&this.down[k])this.released[k]=true;this.down[k]=v}, consume(k){const v=!!this.pressed[k];delete this.pressed[k];return v}, frame(){this.pressed={};this.released={}}};
const keyMap={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',KeyZ:'a',KeyX:'b',KeyQ:'x',KeyE:'y'};
addEventListener('keydown',e=>{if(e.code==='KeyP'){togglePause();e.preventDefault();return}if(e.code==='Escape'&&currentGame){openMenu();e.preventDefault();return}const k=keyMap[e.code];if(k){input.set(k,true);e.preventDefault()}});
addEventListener('keyup',e=>{const k=keyMap[e.code];if(k){input.set(k,false);e.preventDefault()}});
document.querySelectorAll('[data-key]').forEach(btn=>{
  const k=btn.dataset.key;
  const on=e=>{e.preventDefault();btn.setPointerCapture?.(e.pointerId);input.set(k,true);btn.classList.add('pressed');buzz(8)};
  const off=e=>{e.preventDefault();input.set(k,false);btn.classList.remove('pressed')};
  btn.addEventListener('pointerdown',on);['pointerup','pointercancel','lostpointercapture'].forEach(ev=>btn.addEventListener(ev,off));
});
document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});

const achievements={
  snake10:{title:'Snake Charmer',desc:'Reach 10 points in Snake.',reward:'Unlocks Neon Circuit skin'},
  blocks10:{title:'Stack Master',desc:'Clear 10 lines in Block Stack.',reward:'Unlocks Sunset skin'},
  mountainCrown:{title:'Crown Bearer',desc:'Claim the crown in Mountain King Tribute.',reward:'Unlocks Carbon skin'},
  mountainTop:{title:'Mountain King',desc:'Escape to the summit with the crown.',reward:'Permanent gold crown badge'},
  play3:{title:'Arcade Regular',desc:'Play three different games.',reward:'Unlocks Arcade Carpet skin'},
  brawl3:{title:'Street Clean-up',desc:'Clear three waves in Street Brawl.',reward:'Bragging rights'}
};
function unlock(id){if(!stats.achievements[id]){stats.achievements[id]=Date.now();saveAll();toast(`Achievement: ${achievements[id].title}`);renderAchievements();renderSkins()}}
function markPlayed(id){if(!stats.played.includes(id)){stats.played.push(id);if(stats.played.length>=3)unlock('play3');saveAll()}}
function highScore(id,val){stats.high[id]=Math.max(stats.high[id]||0,Math.floor(val||0));saveAll()}

const skins=[
  {id:'classic',name:'Classic Grey',swatch:'linear-gradient(135deg,#c2c0b2,#89887e)',unlock:null},
  {id:'charcoal',name:'Charcoal',swatch:'linear-gradient(135deg,#4b4d53,#1e2023)',unlock:null},
  {id:'red',name:'Rally Red',swatch:'linear-gradient(135deg,#d64b50,#74242a)',unlock:null},
  {id:'ice',name:'Ice Blue',swatch:'linear-gradient(135deg,#d5e8ef,#7693a3)',unlock:null},
  {id:'neon',name:'Neon Circuit',swatch:'repeating-linear-gradient(135deg,#34214d 0 10px,#111226 10px 20px)',unlock:'snake10'},
  {id:'sunset',name:'Sunset',swatch:'linear-gradient(135deg,#ffb06a,#d35672,#623a76)',unlock:'blocks10'},
  {id:'carbon',name:'Carbon',swatch:'repeating-linear-gradient(45deg,#333 0 4px,#171717 4px 8px)',unlock:'mountainCrown'},
  {id:'arcade',name:'Arcade Carpet',swatch:'radial-gradient(#f4d35e 1px,transparent 1px),radial-gradient(#ed6a5a 1px,#24182d 1px)',unlock:'play3'}
];
function skinUnlocked(s){return !s.unlock||!!stats.achievements[s.unlock]}
function applyPrefs(){
  $('#app').className=`app skin-${prefs.skin}`;
  const r=document.documentElement.style;r.setProperty('--dpad',prefs.buttons.dpad);r.setProperty('--a',prefs.buttons.a);r.setProperty('--b',prefs.buttons.b);r.setProperty('--x',prefs.buttons.x);r.setProperty('--y',prefs.buttons.y);
  $('#dpadColour').value=prefs.buttons.dpad;$('#aColour').value=prefs.buttons.a;$('#bColour').value=prefs.buttons.b;$('#xColour').value=prefs.buttons.x;$('#yColour').value=prefs.buttons.y;$('#hapticsToggle').checked=prefs.haptics;$('#soundToggle').checked=prefs.sound;
}
function renderSkins(){const el=$('#skinGrid');el.innerHTML='';skins.forEach(s=>{const b=document.createElement('button');b.type='button';b.className=`skinChoice ${prefs.skin===s.id?'selected':''} ${skinUnlocked(s)?'':'locked'}`;b.innerHTML=`<i class="skinSwatch" style="background:${s.swatch}"></i><span>${s.name}</span><small>${skinUnlocked(s)?(s.unlock?'Unlocked':'Included'):`🔒 ${achievements[s.unlock].desc}`}</small>`;b.onclick=()=>{if(!skinUnlocked(s)){toast(achievements[s.unlock].desc);return}prefs.skin=s.id;saveAll();applyPrefs();renderSkins()};el.appendChild(b)})}
function renderAchievements(){const el=$('#achievementList');el.innerHTML='';Object.entries(achievements).forEach(([id,a])=>{const ok=!!stats.achievements[id];const d=document.createElement('div');d.className=`achievement ${ok?'':'locked'}`;d.innerHTML=`<div class="medal">${ok?'★':'○'}</div><div><strong>${a.title}</strong><small>${a.desc}<br>${a.reward}</small></div>`;el.appendChild(d)})}
['dpad','a','b','x','y'].forEach(k=>{$(`#${k}Colour`).addEventListener('input',e=>{prefs.buttons[k]=e.target.value;saveAll();applyPrefs()})});
$('#hapticsToggle').onchange=e=>{prefs.haptics=e.target.checked;saveAll()};$('#soundToggle').onchange=e=>{prefs.sound=e.target.checked;saveAll();if(!prefs.sound)audio.stop()};
$('#resetAppearanceBtn').onclick=()=>{prefs={skin:'classic',haptics:true,sound:true,buttons:{dpad:'#202226',a:'#e84b4b',b:'#f2cc40',x:'#4c83f1',y:'#4bc27b'}};saveAll();applyPrefs();renderSkins()};

const audio={ctx:null,nodes:[],timer:null,ensure(){if(!prefs.sound)return null;this.ctx??=new (window.AudioContext||window.webkitAudioContext)();this.ctx.resume?.();return this.ctx},beep(freq=440,d=.06,type='square',gain=.03){const a=this.ensure();if(!a)return;const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=freq;g.gain.value=gain;o.connect(g).connect(a.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+d);o.stop(a.currentTime+d+.02)},stop(){clearTimeout(this.timer);this.timer=null;this.nodes.forEach(n=>{try{n.stop()}catch{}});this.nodes=[]},mountain(proximity=1,speed=1){if(!prefs.sound)return;this.mountainLevel=clamp(proximity,0,1);this.mountainSpeed=Math.max(.7,speed);if(this.timer)return;const a=this.ensure();if(!a)return;const notes=[440,493.88,523.25,587.33,659.25,523.25,659.25,622.25,493.88,622.25,659.25,523.25,659.25,698.46,587.33,698.46,739.99,622.25,739.99,783.99,659.25,783.99,830.61,698.46];let i=0;const play=()=>{if(!currentGame||currentGame.id!=='mountain'||currentGame.paused){this.timer=null;return}const o=a.createOscillator(),g=a.createGain();o.type='square';o.frequency.value=notes[i++%notes.length];const vol=.008+.06*(this.mountainLevel??1);g.gain.setValueAtTime(vol,a.currentTime);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+.1);o.connect(g).connect(a.destination);o.start();o.stop(a.currentTime+.11);this.timer=setTimeout(play,Math.max(58,175/(this.mountainSpeed||1)))};play()}}

function toast(msg,ms=1700){const el=$('#toast');el.textContent=msg;el.classList.remove('hidden');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.add('hidden'),ms)}

class Game{
  constructor(id){this.id=id;this.paused=false;this.over=false;this.score=0}
  reset(){} update(){} draw(){} stop(){audio.stop()} hud(){return `SCORE ${Math.floor(this.score)}`}
  gameOver(msg='GAME OVER'){this.over=true;toast(`${msg} • MENU to restart`,2400)}
}

class SnakeGame extends Game{
  constructor(){super('snake');this.reset()}
  reset(){this.grid=22;this.snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];this.dir={x:1,y:0};this.next={x:1,y:0};this.food=this.newFood();this.acc=0;this.score=0;this.over=false}
  newFood(){let p;do{p={x:(Math.random()*this.grid)|0,y:(Math.random()*this.grid)|0}}while(this.snake?.some(s=>s.x===p.x&&s.y===p.y));return p}
  update(dt){if(this.over)return;const p=input.pressed;if((p.up)&&this.dir.y!==1)this.next={x:0,y:-1};if((p.down)&&this.dir.y!==-1)this.next={x:0,y:1};if((p.left)&&this.dir.x!==1)this.next={x:-1,y:0};if((p.right)&&this.dir.x!==-1)this.next={x:1,y:0};this.acc+=dt;const tick=Math.max(70,145-this.score*4);if(this.acc<tick)return;this.acc=0;this.dir=this.next;let h={x:(this.snake[0].x+this.dir.x+this.grid)%this.grid,y:(this.snake[0].y+this.dir.y+this.grid)%this.grid};if(this.snake.some(s=>s.x===h.x&&s.y===h.y)){highScore(this.id,this.score);return this.gameOver()};this.snake.unshift(h);if(h.x===this.food.x&&h.y===this.food.y){this.score++;audio.beep(620,.05);this.food=this.newFood();if(this.score>=10)unlock('snake10');highScore(this.id,this.score)}else this.snake.pop()}
  draw(){ctx.fillStyle='#061009';ctx.fillRect(0,0,W,H);const s=Math.min(H*.88,W*.55)/this.grid,ox=(W-s*this.grid)/2,oy=(H-s*this.grid)/2;ctx.strokeStyle='#8fff9a18';for(let i=0;i<=this.grid;i++){ctx.beginPath();ctx.moveTo(ox+i*s,oy);ctx.lineTo(ox+i*s,oy+s*this.grid);ctx.stroke();ctx.beginPath();ctx.moveTo(ox,oy+i*s);ctx.lineTo(ox+s*this.grid,oy+i*s);ctx.stroke()}ctx.fillStyle='#f1d45a';ctx.beginPath();ctx.arc(ox+(this.food.x+.5)*s,oy+(this.food.y+.5)*s,s*.32,0,Math.PI*2);ctx.fill();this.snake.forEach((p,i)=>{ctx.fillStyle=i?'#7ef58a':'#d9ffe0';ctx.fillRect(ox+p.x*s+2,oy+p.y*s+2,s-4,s-4)});ctx.fillStyle='#8fff9a';ctx.font='20px monospace';ctx.fillText(`SCORE ${this.score}   BEST ${stats.high.snake||0}`,24,34)}
}

class PongGame extends Game{
  constructor(){super('pong');this.reset()}
  reset(){this.pY=H/2-55;this.cpuY=H/2-55;this.ball={x:W/2,y:H/2,vx:380*(Math.random()<.5?-1:1),vy:rand(-220,220),r:10};this.me=0;this.cpu=0;this.score=0;this.over=false}
  update(dt){const d=dt/1000;let mv=(input.down.up||input.down.x?-1:0)+(input.down.down||input.down.a?1:0);this.pY=clamp(this.pY+mv*390*d,20,H-130);this.cpuY=clamp(this.cpuY+(this.ball.y-(this.cpuY+55))*2.1*d,20,H-130);const b=this.ball;b.x+=b.vx*d;b.y+=b.vy*d;if(b.y<b.r||b.y>H-b.r){b.vy*=-1;b.y=clamp(b.y,b.r,H-b.r);audio.beep(260,.03)}const lp={x:34,y:this.cpuY,w:16,h:110},rp={x:W-50,y:this.pY,w:16,h:110};if((b.vx<0&&b.x-b.r<lp.x+lp.w&&b.x>lp.x&&b.y>lp.y&&b.y<lp.y+lp.h)||(b.vx>0&&b.x+b.r>rp.x&&b.x<rp.x+rp.w&&b.y>rp.y&&b.y<rp.y+rp.h)){b.vx*=-1.05;b.vy+=(b.y-((b.vx>0?lp:rp).y+55))*2;audio.beep(420,.025)}if(b.x<-30){this.me++;this.serve(-1)}if(b.x>W+30){this.cpu++;this.serve(1)}this.score=this.me;if(this.me>=7||this.cpu>=7)this.gameOver(this.me>this.cpu?'YOU WIN':'CPU WINS')}
  serve(dir){this.ball={x:W/2,y:H/2,vx:360*dir,vy:rand(-200,200),r:10};audio.beep(150,.1)}
  draw(){ctx.fillStyle='#080c11';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#ffffff35';ctx.setLineDash([12,12]);ctx.beginPath();ctx.moveTo(W/2,0);ctx.lineTo(W/2,H);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#eee';ctx.fillRect(34,this.cpuY,16,110);ctx.fillRect(W-50,this.pY,16,110);ctx.beginPath();ctx.arc(this.ball.x,this.ball.y,this.ball.r,0,Math.PI*2);ctx.fill();ctx.font='70px monospace';ctx.fillStyle='#ffffff45';ctx.fillText(this.cpu,350,90);ctx.fillText(this.me,560,90)}
  hud(){return `${this.cpu} — ${this.me}`}
}

const SHAPES=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0],[1,0],[1,1]],[[0,1],[0,1],[1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]]];
class BlockGame extends Game{
  constructor(){super('blocks');this.reset()}
  reset(){this.cols=10;this.rows=20;this.board=Array.from({length:this.rows},()=>Array(this.cols).fill(0));this.lines=0;this.score=0;this.drop=0;this.over=false;this.spawn()}
  spawn(){this.p={m:choice(SHAPES).map(r=>r.slice()),x:3,y:0,c:1+((Math.random()*6)|0)};if(this.collide(this.p.x,this.p.y,this.p.m))this.gameOver()}
  collide(px,py,m){return m.some((row,y)=>row.some((v,x)=>v&&(px+x<0||px+x>=this.cols||py+y>=this.rows||(py+y>=0&&this.board[py+y][px+x]))))}
  move(dx,dy){if(!this.collide(this.p.x+dx,this.p.y+dy,this.p.m)){this.p.x+=dx;this.p.y+=dy;return true}return false}
  rotate(){const m=this.p.m[0].map((_,i)=>this.p.m.map(r=>r[i]).reverse());if(!this.collide(this.p.x,this.p.y,m))this.p.m=m}
  lock(){this.p.m.forEach((r,y)=>r.forEach((v,x)=>{if(v&&this.p.y+y>=0)this.board[this.p.y+y][this.p.x+x]=this.p.c}));let n=0;for(let y=this.rows-1;y>=0;y--){if(this.board[y].every(Boolean)){this.board.splice(y,1);this.board.unshift(Array(this.cols).fill(0));n++;y++}}if(n){this.lines+=n;this.score+=n*n*100;audio.beep(700,.08);if(this.lines>=10)unlock('blocks10')}this.spawn()}
  update(dt){if(this.over)return;if(input.consume('left'))this.move(-1,0);if(input.consume('right'))this.move(1,0);if(input.consume('down'))this.move(0,1);if(input.consume('a')||input.consume('x'))this.rotate();if(input.consume('b')){while(this.move(0,1))this.score+=2;this.lock()}this.drop+=dt;if(this.drop>Math.max(150,650-this.lines*16)){this.drop=0;if(!this.move(0,1))this.lock()}highScore(this.id,this.score)}
  draw(){ctx.fillStyle='#080b12';ctx.fillRect(0,0,W,H);const s=24,ox=W/2-this.cols*s/2,oy=H/2-this.rows*s/2;ctx.fillStyle='#111827';ctx.fillRect(ox-5,oy-5,this.cols*s+10,this.rows*s+10);const colors=['','#e75d5d','#f2c94c','#4f86f7','#59c985','#b26ee5','#f08cc4'];const drawCell=(x,y,c)=>{ctx.fillStyle=colors[c];ctx.fillRect(ox+x*s+1,oy+y*s+1,s-2,s-2);ctx.fillStyle='#ffffff22';ctx.fillRect(ox+x*s+3,oy+y*s+3,s-6,4)};this.board.forEach((r,y)=>r.forEach((v,x)=>v&&drawCell(x,y,v)));this.p.m.forEach((r,y)=>r.forEach((v,x)=>v&&drawCell(this.p.x+x,this.p.y+y,this.p.c)));ctx.font='22px monospace';ctx.fillStyle='#ddd';ctx.fillText(`LINES ${this.lines}`,ox+this.cols*s+32,oy+35);ctx.fillText(`SCORE ${this.score}`,ox+this.cols*s+32,oy+70)}
  hud(){return `LINES ${this.lines} • ${this.score}`}
}

const MAZE=[
'#####################',
'#.........#.........#',
'#.###.###.#.###.###.#',
'#.#...............#.#',
'#.#.##.#######.##.#.#',
'#.....#...#...#.....#',
'......#.#...#.#......',
'#.##..#.#####.#..##.#',
'#.....#.......#.....#',
'#.###.###.#.###.###.#',
'#.........#.........#',
'#.#######...#######.#',
'#####################'];
class MazeGame extends Game{
  constructor(){super('maze');this.reset()}
  reset(){this.map=MAZE.map(r=>r.split(''));this.p={x:1,y:1};this.dir={x:1,y:0};this.next={x:1,y:0};this.ghosts=[{x:19,y:11,dx:-1,dy:0},{x:10,y:6,dx:1,dy:0},{x:1,y:11,dx:1,dy:0}];this.score=0;this.lives=3;this.acc=0;this.over=false}
  wall(x,y){if(y<0||y>=this.map.length)return true;x=(x+21)%21;return this.map[y][x]==='#'}
  update(dt){if(this.over)return;if(input.consume('up'))this.next={x:0,y:-1};if(input.consume('down'))this.next={x:0,y:1};if(input.consume('left'))this.next={x:-1,y:0};if(input.consume('right'))this.next={x:1,y:0};this.acc+=dt;if(this.acc<110)return;this.acc=0;let nx=this.p.x+this.next.x,ny=this.p.y+this.next.y;if(!this.wall(nx,ny))this.dir=this.next;nx=(this.p.x+this.dir.x+21)%21;ny=this.p.y+this.dir.y;if(!this.wall(nx,ny)){this.p.x=nx;this.p.y=ny}if(this.map[this.p.y][this.p.x]==='.'){this.map[this.p.y][this.p.x]=' ';this.score+=10;audio.beep(520,.018,'square',.012)}this.ghosts.forEach(g=>{let opts=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>!this.wall(g.x+dx,g.y+dy)&&!(dx===-g.dx&&dy===-g.dy));if(Math.random()<.38){opts.sort((a,b)=>Math.abs(g.x+a[0]-this.p.x)+Math.abs(g.y+a[1]-this.p.y)-Math.abs(g.x+b[0]-this.p.x)-Math.abs(g.y+b[1]-this.p.y))}const [dx,dy]=choice(opts.length?opts:[[g.dx,g.dy]]);g.dx=dx;g.dy=dy;g.x=(g.x+dx+21)%21;g.y+=dy;if(g.x===this.p.x&&g.y===this.p.y)this.hit()});if(!this.map.some(r=>r.includes('.')))this.gameOver('MAZE CLEARED');highScore(this.id,this.score)}
  hit(){this.lives--;audio.beep(90,.25,'sawtooth',.05);if(this.lives<=0)return this.gameOver();this.p={x:1,y:1};this.ghosts[0].x=19;this.ghosts[0].y=11}
  draw(){ctx.fillStyle='#05060c';ctx.fillRect(0,0,W,H);const s=36,ox=(W-21*s)/2,oy=(H-13*s)/2;this.map.forEach((r,y)=>r.forEach((v,x)=>{if(v==='#'){ctx.fillStyle='#234fd6';ctx.fillRect(ox+x*s+2,oy+y*s+2,s-4,s-4);ctx.fillStyle='#0b1f77';ctx.fillRect(ox+x*s+7,oy+y*s+7,s-14,s-14)}else if(v==='.'){ctx.fillStyle='#f3dec0';ctx.beginPath();ctx.arc(ox+(x+.5)*s,oy+(y+.5)*s,3.5,0,Math.PI*2);ctx.fill()}}));ctx.fillStyle='#ffe24e';ctx.beginPath();ctx.arc(ox+(this.p.x+.5)*s,oy+(this.p.y+.5)*s,13,0,Math.PI*2);ctx.fill();['#f05162','#5ed6ff','#f59adb'].forEach((c,i)=>{const g=this.ghosts[i];ctx.fillStyle=c;ctx.beginPath();ctx.arc(ox+(g.x+.5)*s,oy+(g.y+.5)*s,12,Math.PI,0);ctx.lineTo(ox+(g.x+.5)*s+12,oy+(g.y+.5)*s+12);ctx.lineTo(ox+(g.x+.5)*s-12,oy+(g.y+.5)*s+12);ctx.fill()});ctx.fillStyle='#fff';ctx.font='18px monospace';ctx.fillText(`SCORE ${this.score}   LIVES ${this.lives}`,18,28)}
  hud(){return `SCORE ${this.score} • ♥ ${this.lives}`}
}

class BreakerGame extends Game{
  constructor(){super('breaker');this.reset()}
  reset(){this.px=W/2-70;this.ball={x:W/2,y:H-90,vx:0,vy:0,r:9};this.launched=false;this.lives=3;this.score=0;this.over=false;this.bricks=[];for(let y=0;y<6;y++)for(let x=0;x<12;x++)this.bricks.push({x:70+x*69,y:55+y*30,w:62,h:22,hp:1,c:y%4})}
  update(dt){if(this.over)return;const d=dt/1000,mv=(input.down.left?-1:0)+(input.down.right?1:0);this.px=clamp(this.px+mv*520*d,20,W-160);if(!this.launched){this.ball.x=this.px+70;if(input.consume('a')||input.consume('x')){this.launched=true;this.ball.vx=rand(-220,220);this.ball.vy=-360}}else{const b=this.ball;b.x+=b.vx*d;b.y+=b.vy*d;if(b.x<b.r||b.x>W-b.r){b.vx*=-1;b.x=clamp(b.x,b.r,W-b.r)}if(b.y<b.r){b.vy=Math.abs(b.vy)}if(b.y>H+20){this.lives--;this.launched=false;b.y=H-90;if(this.lives<=0)this.gameOver()}const pad={x:this.px,y:H-45,w:140,h:16};if(b.vy>0&&b.y+b.r>pad.y&&b.y<pad.y+pad.h&&b.x>pad.x&&b.x<pad.x+pad.w){b.vy=-Math.abs(b.vy);b.vx+=(b.x-(pad.x+70))*3;audio.beep(300,.03)}for(let i=this.bricks.length-1;i>=0;i--){const r=this.bricks[i];if(b.x+b.r>r.x&&b.x-b.r<r.x+r.w&&b.y+b.r>r.y&&b.y-b.r<r.y+r.h){this.bricks.splice(i,1);b.vy*=-1;this.score+=10;audio.beep(500+r.c*80,.03);break}}if(!this.bricks.length)this.gameOver('BOARD CLEARED')}highScore(this.id,this.score)}
  draw(){ctx.fillStyle='#090a10';ctx.fillRect(0,0,W,H);const cols=['#f55b5b','#f3c74d','#57c888','#5590ed'];this.bricks.forEach(r=>{ctx.fillStyle=cols[r.c];ctx.fillRect(r.x,r.y,r.w,r.h)});ctx.fillStyle='#e7e7e7';ctx.fillRect(this.px,H-45,140,16);ctx.beginPath();ctx.arc(this.ball.x,this.ball.y,this.ball.r,0,Math.PI*2);ctx.fill();ctx.font='18px monospace';ctx.fillText(`SCORE ${this.score}   LIVES ${this.lives}`,18,28)}
}

class RocksGame extends Game{
  constructor(){super('rocks');this.reset()}
  reset(){this.ship={x:W/2,y:H/2,a:-Math.PI/2,vx:0,vy:0};this.bullets=[];this.rocks=[];this.score=0;this.lives=3;this.cool=0;this.over=false;for(let i=0;i<7;i++)this.addRock(3)}
  addRock(size=3,x=null,y=null){this.rocks.push({x:x??(Math.random()<.5?rand(0,W):choice([0,W])),y:y??rand(0,H),vx:rand(-70,70),vy:rand(-70,70),r:size*12+8,size})}
  update(dt){if(this.over)return;const d=dt/1000,s=this.ship;if(input.down.left)s.a-=3.4*d;if(input.down.right)s.a+=3.4*d;if(input.down.up){s.vx+=Math.cos(s.a)*180*d;s.vy+=Math.sin(s.a)*180*d}if(input.down.down){s.vx*=.985;s.vy*=.985}s.x=(s.x+s.vx*d+W)%W;s.y=(s.y+s.vy*d+H)%H;this.cool-=dt;if((input.down.a||input.down.x)&&this.cool<=0){this.cool=170;this.bullets.push({x:s.x,y:s.y,vx:Math.cos(s.a)*480+s.vx,vy:Math.sin(s.a)*480+s.vy,t:1200});audio.beep(720,.03)}this.bullets.forEach(b=>{b.x=(b.x+b.vx*d+W)%W;b.y=(b.y+b.vy*d+H)%H;b.t-=dt});this.bullets=this.bullets.filter(b=>b.t>0);this.rocks.forEach(r=>{r.x=(r.x+r.vx*d+W)%W;r.y=(r.y+r.vy*d+H)%H});for(let bi=this.bullets.length-1;bi>=0;bi--)for(let ri=this.rocks.length-1;ri>=0;ri--){const b=this.bullets[bi],r=this.rocks[ri];if((b.x-r.x)**2+(b.y-r.y)**2<r.r*r.r){this.bullets.splice(bi,1);this.rocks.splice(ri,1);this.score+=10*r.size;if(r.size>1){this.addRock(r.size-1,r.x,r.y);this.addRock(r.size-1,r.x,r.y)}audio.beep(130,.06,'sawtooth');break}}for(const r of this.rocks){if((s.x-r.x)**2+(s.y-r.y)**2<(r.r+12)**2){this.lives--;s.x=W/2;s.y=H/2;s.vx=s.vy=0;audio.beep(70,.2,'sawtooth',.06);if(this.lives<=0)this.gameOver();break}}if(this.rocks.length<5&&!this.over)this.addRock(3);highScore(this.id,this.score)}
  draw(){ctx.fillStyle='#02050a';ctx.fillRect(0,0,W,H);ctx.fillStyle='#ffffff44';for(let i=0;i<80;i++)ctx.fillRect((i*137)%W,(i*83)%H,1,1);ctx.strokeStyle='#e7ecef';ctx.lineWidth=2;this.rocks.forEach(r=>{ctx.beginPath();for(let i=0;i<8;i++){const a=i/8*Math.PI*2,rr=r.r*(.8+.2*Math.sin(i*7.3));const x=r.x+Math.cos(a)*rr,y=r.y+Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.stroke()});ctx.save();ctx.translate(this.ship.x,this.ship.y);ctx.rotate(this.ship.a);ctx.beginPath();ctx.moveTo(16,0);ctx.lineTo(-12,-10);ctx.lineTo(-7,0);ctx.lineTo(-12,10);ctx.closePath();ctx.stroke();ctx.restore();ctx.fillStyle='#fff';this.bullets.forEach(b=>{ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill()});ctx.font='18px monospace';ctx.fillText(`SCORE ${this.score}   SHIPS ${this.lives}`,18,28)}
}

class BrawlGame extends Game{
  constructor(){super('brawl');this.reset()}
  reset(){this.player={x:180,y:380,w:42,h:74,hp:100,vy:0,on:true,face:1,attack:0};this.wave=1;this.score=0;this.over=false;this.spawnWave()}
  spawnWave(){this.enemies=Array.from({length:Math.min(2+this.wave,6)},(_,i)=>({x:600+i*70,y:390,w:40,h:68,hp:30+this.wave*8,v:55+this.wave*8,hit:0}));toast(`WAVE ${this.wave}`)}
  update(dt){if(this.over)return;const d=dt/1000,p=this.player;let mv=(input.down.left?-1:0)+(input.down.right?1:0);if(mv)p.face=Math.sign(mv);p.x=clamp(p.x+mv*190*d,35,W-75);if((input.consume('x')||input.consume('up'))&&p.on){p.vy=-360;p.on=false}p.vy+=900*d;p.y+=p.vy*d;if(p.y>=380){p.y=380;p.vy=0;p.on=true}p.attack=Math.max(0,p.attack-dt);if(input.consume('a')||input.consume('b')){p.attack=180;const reach={x:p.face>0?p.x+p.w:p.x-56,y:p.y+8,w:56,h:56};this.enemies.forEach(e=>{if(rectHit(reach,e)){e.hp-=input.down.b?20:14;e.x+=p.face*28;this.score+=5;audio.beep(180,.04,'square',.04)}})}this.enemies.forEach(e=>{e.hit=Math.max(0,e.hit-dt);const dir=Math.sign(p.x-e.x);if(Math.abs(p.x-e.x)>55)e.x+=dir*e.v*d;else if(e.hit<=0){e.hit=700;p.hp-=8+this.wave;audio.beep(80,.08,'sawtooth',.04);if(p.hp<=0)this.gameOver()}});this.enemies=this.enemies.filter(e=>e.hp>0);if(!this.enemies.length){if(this.wave>=3)unlock('brawl3');this.wave++;p.hp=Math.min(100,p.hp+20);this.spawnWave()}highScore(this.id,this.score)}
  draw(){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#17112c');g.addColorStop(1,'#35191e');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.fillStyle='#242632';ctx.fillRect(0,454,W,86);for(let x=0;x<W;x+=80){ctx.fillStyle=x%160?'#2e303b':'#282a34';ctx.fillRect(x,454,78,86)}const p=this.player;ctx.fillStyle=p.attack?'#f6d54b':'#5aa3ff';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#ff7b6b';this.enemies.forEach(e=>ctx.fillRect(e.x,e.y,e.w,e.h));ctx.fillStyle='#fff';ctx.font='18px monospace';ctx.fillText(`HP ${Math.max(0,p.hp)}   WAVE ${this.wave}   SCORE ${this.score}`,20,30);ctx.fillStyle='#3b3b42';ctx.fillRect(20,45,220,12);ctx.fillStyle='#72e27d';ctx.fillRect(20,45,220*p.hp/100,12)}
  hud(){return `WAVE ${this.wave} • HP ${Math.max(0,this.player.hp)}`}
}

class MountainGame extends Game{
  constructor(){super('mountain');this.reset()}
  reset(){audio.stop();this.level=1;this.worldW=1800;this.worldH=1600;this.player={x:150,y:1470,w:28,h:44,vx:0,vy:0,on:false,climb:false};this.score=0;this.time=240;this.spiritReady=false;this.spirit=false;this.crown=false;this.won=false;this.over=false;this.musicState='';this.platforms=[
    {x:0,y:1520,w:1800,h:80},{x:80,y:1430,w:300,h:22},{x:430,y:1370,w:230,h:22},{x:720,y:1300,w:360,h:22},{x:1160,y:1420,w:300,h:22},{x:1450,y:1325,w:260,h:22},
    {x:120,y:1220,w:300,h:22},{x:510,y:1160,w:340,h:22},{x:940,y:1090,w:290,h:22},{x:1320,y:1200,w:300,h:22},
    {x:70,y:980,w:250,h:22},{x:390,y:900,w:300,h:22},{x:760,y:980,w:250,h:22},{x:1080,y:850,w:300,h:22},{x:1450,y:930,w:260,h:22},
    {x:180,y:720,w:360,h:22},{x:630,y:650,w:250,h:22},{x:980,y:700,w:300,h:22},{x:1360,y:620,w:300,h:22},
    {x:80,y:500,w:280,h:22},{x:440,y:430,w:310,h:22},{x:860,y:500,w:300,h:22},{x:1260,y:390,w:330,h:22},
    {x:230,y:260,w:280,h:22},{x:610,y:210,w:270,h:22},{x:1010,y:250,w:280,h:22},{x:1370,y:180,w:330,h:22},{x:780,y:80,w:260,h:22}
  ];this.diamonds=[];for(let i=0;i<44;i++){const p=this.platforms[1+(i% (this.platforms.length-1))];this.diamonds.push({x:p.x+30+(i*47)%Math.max(40,p.w-60),y:p.y-18,taken:false})}this.spiritObj={x:700,y:620};this.shrine={x:1450,y:325,w:90,h:65};this.summit={x:865,y:45,w:90,h:35};this.spider={x:1650,y:1470,v:68};this.bat={x:120,y:280,vx:120};this.cameraY=1060}
  solidRect(){return {x:this.player.x,y:this.player.y,w:this.player.w,h:this.player.h}}
  update(dt){if(this.over||this.won)return;const d=dt/1000,p=this.player;this.time-=d;if(this.time<=0)return this.gameOver('TIME UP');let mv=(input.down.left?-1:0)+(input.down.right?1:0);p.vx=mv*240;p.x=clamp(p.x+p.vx*d,0,this.worldW-p.w);if((input.consume('up')||input.consume('x'))&&p.on){p.vy=-530;p.on=false;audio.beep(180,.04)}p.vy+=1250*d;let oldY=p.y;p.y+=p.vy*d;p.on=false;if(p.vy>=0){for(const r of this.platforms){if(p.x+p.w>r.x&&p.x<r.x+r.w&&oldY+p.h<=r.y+5&&p.y+p.h>=r.y){p.y=r.y-p.h;p.vy=0;p.on=true;break}}}if(p.y>this.worldH+80){p.x=150;p.y=1470;p.vy=0;this.score=Math.max(0,this.score-100);audio.beep(70,.2,'sawtooth',.05)}for(const dmd of this.diamonds){if(!dmd.taken&&Math.abs((p.x+p.w/2)-dmd.x)<24&&Math.abs((p.y+p.h/2)-dmd.y)<30){dmd.taken=true;this.score+=25;audio.beep(880,.04);if(this.score>=1000&&!this.spiritReady){this.spiritReady=true;toast('The Flame Spirit is near… follow the music',2500)}}}if(this.spiritReady&&!this.spirit){const dist=Math.hypot(p.x-this.spiritObj.x,p.y-this.spiritObj.y);const prox=clamp(1-dist/700,0,1);this.musicState='spirit';audio.mountain(prox,1.0+(1-this.time/240)*.18);if(input.consume('a')&&dist<65){this.spirit=true;audio.stop();this.musicState='';toast('Flame Spirit captured — reach the shrine',2200);this.score+=1500}}if(this.spirit&&!this.crown){const s=this.shrine;if(input.consume('a')&&Math.abs(p.x-s.x)<100&&Math.abs(p.y-s.y)<110){this.crown=true;unlock('mountainCrown');this.score+=5000;toast('CROWN CLAIMED — ESCAPE TO THE SUMMIT!',2600);this.musicState='crown';audio.mountain(1,1.45)}}if(this.crown){audio.mountain(1,1.35+(1-this.time/240)*.35);this.bat.x+=this.bat.vx*d;if(this.bat.x<0||this.bat.x>this.worldW)this.bat.vx*=-1;if(Math.hypot(p.x-this.bat.x,p.y-this.bat.y)<50){this.crown=false;audio.stop();this.musicState='';toast('A cave bat stole the crown! Return to the shrine.',2200)}if(rectHit(this.solidRect(),this.summit)){this.won=true;audio.stop();this.score+=9000;unlock('mountainTop');highScore(this.id,this.score);toast('YOU ARE THE MOUNTAIN KING!',3500)}}this.spider.x+=Math.sign(p.x-this.spider.x)*this.spider.v*d;if(Math.abs(p.y-1470)<90&&Math.abs(p.x-this.spider.x)<42){this.score=Math.max(0,this.score-250);p.x=150;p.y=1470;toast('The giant spider caught you',1500)}this.cameraY=clamp(p.y-H*.58,0,this.worldH-H);highScore(this.id,this.score)}
  draw(){const cy=this.cameraY;ctx.fillStyle='#06070a';ctx.fillRect(0,0,W,H);const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#11182b');g.addColorStop(1,'#050608');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(-this.player.x+W*.48,-cy);ctx.fillStyle='#26272a';this.platforms.forEach(r=>{ctx.fillRect(r.x,r.y,r.w,r.h);ctx.fillStyle='#44464b';ctx.fillRect(r.x,r.y,r.w,4);ctx.fillStyle='#26272a'});this.diamonds.forEach(d=>{if(d.taken)return;ctx.save();ctx.translate(d.x,d.y);ctx.rotate(Math.PI/4);ctx.fillStyle='#67f3ff';ctx.fillRect(-7,-7,14,14);ctx.restore()});if(this.spiritReady&&!this.spirit){const pulse=12+Math.sin(performance.now()/120)*4;ctx.fillStyle='#ffb93f';ctx.shadowColor='#ff9e2c';ctx.shadowBlur=22;ctx.beginPath();ctx.arc(this.spiritObj.x,this.spiritObj.y,pulse,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}ctx.fillStyle=this.spirit?'#7f6e44':'#4f4b44';ctx.fillRect(this.shrine.x,this.shrine.y,this.shrine.w,this.shrine.h);ctx.fillStyle='#1b1b1d';ctx.fillRect(this.shrine.x+22,this.shrine.y+22,46,43);ctx.fillStyle='#fff';ctx.font='13px monospace';ctx.fillText(this.spirit?'CROWN':'SEALED',this.shrine.x+14,this.shrine.y-8);if(this.crown){ctx.fillStyle='#ffd84a';ctx.fillRect(this.player.x+4,this.player.y-12,20,9)}ctx.fillStyle='#ffb83d';ctx.beginPath();ctx.arc(this.summit.x+45,this.summit.y,12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b6b6be';ctx.fillRect(this.player.x,this.player.y,this.player.w,this.player.h);ctx.fillStyle='#222';ctx.fillRect(this.player.x+18,this.player.y+10,4,4);ctx.fillStyle='#7c211f';ctx.fillRect(this.spider.x,1478,42,22);for(let i=0;i<4;i++){ctx.strokeStyle='#a83a36';ctx.beginPath();ctx.moveTo(this.spider.x+10+i*7,1494);ctx.lineTo(this.spider.x-5+i*15,1510);ctx.stroke()}if(this.crown){ctx.fillStyle='#8d7cc9';ctx.beginPath();ctx.moveTo(this.bat.x,this.bat.y);ctx.lineTo(this.bat.x-22,this.bat.y-12);ctx.lineTo(this.bat.x-14,this.bat.y+10);ctx.lineTo(this.bat.x+14,this.bat.y+10);ctx.lineTo(this.bat.x+22,this.bat.y-12);ctx.closePath();ctx.fill()}ctx.restore();ctx.fillStyle='#fff';ctx.font='18px monospace';ctx.fillText(`SCORE ${this.score}`,18,28);ctx.fillText(`TIME ${Math.ceil(this.time)}`,18,52);ctx.fillStyle=this.score>=1000?'#f6ce54':'#7ff08c';ctx.fillText(this.crown?'CROWN: ESCAPE TO SUMMIT':this.spirit?'SPIRIT: REACH SHRINE':this.spiritReady?'FOLLOW THE MUSIC':`DIAMONDS ${Math.min(1000,this.score)}/1000`,W-330,28)}
  hud(){return `${Math.floor(this.score)} • ${Math.ceil(this.time)}s`}
  stop(){super.stop()}
}

const gameDefs=[
  {id:'mountain',title:'Mountain King Tribute',desc:'Collect diamonds, find the Flame Spirit, claim the crown and escape to the summit.',accent:'#ffb83d',orientation:'landscape',controls:'action',how:`A personal tribute built from scratch around the documented 1983 play loop: collect 1,000 diamond points, use music to locate the Flame Spirit, take it to the shrine, claim the crown, then escape to the summit. The soundtrack is a newly synthesised rendition of Grieg’s public-domain “In the Hall of the Mountain King”; no original ROM, code, graphics or recording is included.<br><br><b>Controls:</b> D-pad = run/jump. <kbd>A</kbd> = collect/interact. <kbd>X</kbd> also jumps.`,make:()=>new MountainGame()},
  {id:'maze',title:'Maze Chase',desc:'Pellets, pursuing ghosts and wrap-around tunnels. Fast, clean and movement-only.',accent:'#ffe24e',orientation:'any',controls:'mirror',how:`Clear every pellet while avoiding the three pursuers. The left D-pad and right-side movement pad both control direction. The open tunnel wraps from one side to the other.`,make:()=>new MazeGame()},
  {id:'blocks',title:'Block Stack',desc:'A tight falling-block puzzle with line clears, rotation and hard drop.',accent:'#b26ee5',orientation:'any',controls:'action',how:`Build complete horizontal lines. D-pad moves the piece. <kbd>A</kbd>/<kbd>X</kbd> rotates. <kbd>B</kbd> hard-drops. Clear 10 lines to unlock the Sunset console skin.`,make:()=>new BlockGame()},
  {id:'pong',title:'Table Tennis',desc:'The classic side-to-side paddle duel. First to seven wins.',accent:'#e7e7e7',orientation:'any',controls:'mirror',how:`Move your right paddle up and down. Use either D-pad, or the right-side upper/lower controls. First to 7 wins.`,make:()=>new PongGame()},
  {id:'snake',title:'Snake',desc:'Wrap the walls, grow the chain, avoid yourself. Either side controls movement.',accent:'#7ef58a',orientation:'any',controls:'mirror',how:`Eat the gold targets and keep growing. The walls wrap you to the opposite side; hitting your own body ends the run. Both control sides work for movement. Reach 10 points to unlock Neon Circuit.`,make:()=>new SnakeGame()},
  {id:'breaker',title:'Brick Breaker',desc:'Clear the wall, keep the ball alive and chase a clean high score.',accent:'#57c888',orientation:'any',controls:'action',how:`D-pad left/right moves the paddle. <kbd>A</kbd> launches the ball. Clear every brick before losing all three lives.`,make:()=>new BreakerGame()},
  {id:'rocks',title:'Space Rocks',desc:'Rotate, thrust and shoot through an endless field of splitting rocks.',accent:'#9dc7ff',orientation:'landscape',controls:'action',how:`Landscape game. Left/right rotates, up thrusts, down brakes. <kbd>A</kbd> fires. Large rocks split into smaller ones.`,make:()=>new RocksGame()},
  {id:'brawl',title:'Street Brawl',desc:'A compact side-scrolling beat-’em-up with punches, kicks and escalating waves.',accent:'#ff716b',orientation:'landscape',controls:'action',how:`Landscape game. D-pad moves. <kbd>A</kbd> punches, <kbd>B</kbd> attacks, <kbd>X</kbd> jumps. Survive escalating waves; clear three to earn the Street Clean-up achievement.`,make:()=>new BrawlGame()}
];
const defs=Object.fromEntries(gameDefs.map(g=>[g.id,g]));
function renderLibrary(){const g=$('#gameGrid');g.innerHTML='';gameDefs.forEach(d=>{const b=document.createElement('button');b.className='gameCard';b.style.setProperty('--accent',d.accent);b.innerHTML=`<div class="gameVisual"></div><h3>${d.title}</h3><p>${d.desc}</p><div class="metaRow"><span class="tag">${d.orientation==='landscape'?'Landscape':'Portrait + Landscape'}</span><span class="tag">${d.controls==='mirror'?'Movement':'Action'}</span>${stats.high[d.id]!=null?`<span class="tag">Best ${stats.high[d.id]}</span>`:''}</div>`;b.onclick=()=>startGame(d.id);g.appendChild(b)})}

let currentGame=null,currentDef=null,last=performance.now(),raf=0;
function startGame(id){currentDef=defs[id];currentGame=currentDef.make();markPlayed(id);audio.ensure();$('#gameTitle').textContent=currentDef.title.toUpperCase();$('#libraryView').classList.remove('active');$('#consoleView').classList.add('active');configureControls();checkOrientation();cancelAnimationFrame(raf);last=performance.now();raf=requestAnimationFrame(loop)}
function configureControls(){const mirror=currentDef.controls==='mirror';$('#mirrorPad').classList.toggle('hidden',!mirror);$('#actionPad').classList.toggle('hidden',mirror)}
function loop(t){if(!currentGame)return;let dt=Math.min(34,t-last);last=t;if(!currentGame.paused&&!orientationBlocked()){currentGame.update(dt)}currentGame.draw();$('#hudText').textContent=currentGame.hud();input.frame();raf=requestAnimationFrame(loop)}
function exitGame(){if(!currentGame)return;currentGame.stop();currentGame=null;currentDef=null;cancelAnimationFrame(raf);$('#consoleView').classList.remove('active');$('#libraryView').classList.add('active');$('#menuDialog').close?.();renderLibrary()}
function restartGame(){if(!currentDef)return;currentGame?.stop();currentGame=currentDef.make();$('#menuDialog').close?.();last=performance.now()}
function togglePause(){if(!currentGame)return;currentGame.paused=!currentGame.paused;if(currentGame.paused)audio.stop();else if(currentGame.id==='mountain'&&(currentGame.spiritReady||currentGame.crown))audio.mountain(currentGame.crown?1:.7,currentGame.crown?1.45:1);toast(currentGame.paused?'PAUSED':'RESUMED')}
function openMenu(){if(!currentGame)return;currentGame.paused=true;audio.stop();$('#menuGameName').textContent=currentDef.title;$('#menuDialog').showModal()}
function orientationBlocked(){return currentDef?.orientation==='landscape'&&matchMedia('(orientation: portrait)').matches}
function checkOrientation(){if(!currentGame)return;$('#rotatePrompt').classList.toggle('hidden',!orientationBlocked())}
addEventListener('orientationchange',()=>setTimeout(checkOrientation,150));addEventListener('resize',checkOrientation);

$('#homeBtn').onclick=()=>currentGame?openMenu():null;$('#menuBtn').onclick=openMenu;$('#pauseBtn').onclick=togglePause;
$('#resumeBtn').onclick=()=>{currentGame.paused=false;$('#menuDialog').close();last=performance.now()};$('#restartBtn').onclick=restartGame;$('#exitGameBtn').onclick=exitGame;
$('#howToBtn').onclick=()=>{$('#menuDialog').close();$('#infoTitle').textContent=currentDef.title;$('#infoBody').innerHTML=currentDef.how;$('#infoDialog').showModal()};
$('#settingsBtn').onclick=()=>{renderSkins();$('#settingsDialog').showModal()};$('#achievementsBtn').onclick=()=>{renderAchievements();$('#achievementsDialog').showModal()};

function renderRequests(){const el=$('#requestList');el.innerHTML=stats.requests.length?'<p class="eyebrow">SAVED ON THIS DEVICE</p>':'';stats.requests.slice().reverse().forEach(r=>{const d=document.createElement('div');d.className='requestItem';d.innerHTML=`<strong>${escapeHtml(r.title)}</strong><small>${escapeHtml(r.platform||'Platform not set')} • ${new Date(r.at).toLocaleDateString()}</small>`;el.appendChild(d)})}
function escapeHtml(s=''){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
$('#requestGameBtn').onclick=()=>{renderRequests();$('#requestDialog').showModal()};
$('#requestForm').addEventListener('submit',e=>{e.preventDefault();const title=$('#requestTitle').value.trim();if(!title)return;stats.requests.push({title,platform:$('#requestPlatform').value.trim(),notes:$('#requestNotes').value.trim(),at:Date.now()});saveAll();renderRequests();$('#requestTitle').value='';$('#requestPlatform').value='';$('#requestNotes').value='';toast('Game request saved')});
$('#copyResearchBtn').onclick=async()=>{const t=$('#requestTitle').value.trim()||'[GAME TITLE]',p=$('#requestPlatform').value.trim()||'[ORIGINAL PLATFORM]',n=$('#requestNotes').value.trim()||'Preserve the feel, controls and defining gameplay without using copyrighted ROMs or extracted assets.';const text=`Research ${t} (${p}) for a lawful personal web-game tribute. Identify the defining gameplay loop, controls, level structure, scoring, audio cues, orientation needs, rights/licensing risks, and whether any legitimate browser-playable/open-source implementation exists. Prioritise primary manuals and reputable preservation sources. Requirements: ${n}`;try{await navigator.clipboard.writeText(text);toast('Research prompt copied')}catch{toast('Copy unavailable — select text manually')}};

applyPrefs();renderSkins();renderAchievements();renderLibrary();renderRequests();
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
