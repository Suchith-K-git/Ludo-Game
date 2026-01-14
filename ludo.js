/* Ludo 2-Player — Vanilla JS + Canvas
   Players: Red (index 0) & Blue (index 1)
   - Need 6 to leave base
   - 6 grants extra turn
   - Start squares (indices 0, 26) are safe
   - Exact roll to enter Home (6 tiles)
*/

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const rollBtn = document.getElementById('rollBtn');
const resetBtn = document.getElementById('resetBtn');
const diceValueEl = document.getElementById('diceValue');
const turnLabelEl = document.getElementById('turnLabel');

const W = canvas.width, H = canvas.height;
const center = { x: W/2, y: H/2 };

// Colors
const RED = '#ef4444';
const BLUE = '#3b82f6';
const SAFE = '#10b981';
const TRACK = '#1f2937';
const TRACK_DARK = '#141b2a';
const BOARD_EDGE = '#263246';
const TEXT = '#e5e7eb';
const HOME = '#f59e0b';

// Game constants
const TOKENS_PER_PLAYER = 4;
const TRACK_LEN = 52;
const HOME_LEN = 6;
const PLAYER_DATA = [
  { name:'Red', color: RED, startIndex: 0,  basePos:[] },
  { name:'Blue', color: BLUE, startIndex: 26, basePos:[] },
];
const SAFE_INDICES = new Set([0, 26]);

// Geometry — generate a rounded-rectangle track with 52 slots (13 per side)
const outer = { x: 80, y: 80, w: W-160, h: H-160, r: 50 };
const dotRadius = 12;
const tokenRadius = 14;

function roundedRectPath(pad=0){
  const x=outer.x+pad, y=outer.y+pad, w=outer.w-2*pad, h=outer.h-2*pad, r=Math.max(20, outer.r-pad);
  const p = new Path2D();
  p.moveTo(x+r, y);
  p.arcTo(x+w, y, x+w, y+h, r);
  p.arcTo(x+w, y+h, x, y+h, r);
  p.arcTo(x, y+h, x, y, r);
  p.arcTo(x, y, x+w, y, r);
  p.closePath();
  return p;
}

function samplePerimeterPoints(n){
  // Walk the rounded rectangle perimeter and sample n equidistant points
  const path = roundedRectPath(0);
  // Approximate by tracing many points then resampling
  const tmp = [];
  const steps = 4000;
  let len=0;
  let last=null;
  for(let i=0;i<=steps;i++){
    const t=i/steps;
    const pt = pointOnRoundedRect(t);
    if(last){
      len += dist(last, pt);
    }
    tmp.push({t, pt, len});
    last=pt;
  }
  // total length
  const total = len;
  const out=[];
  for(let k=0;k<n;k++){
    const target = (k/ n) * total;
    // find closest
    let j=0;
    while(j<tmp.length && tmp[j].len < target) j++;
    out.push(tmp[j]?.pt || tmp[tmp.length-1].pt);
  }
  return out;
}
function pointOnRoundedRect(t){
  // parametric around rectangle with rounded corners (approx piecewise)
  const perSide = 4; // top, right, bottom, left
  const tt = t*4;
  const seg = Math.floor(tt);
  const k = tt - seg;
  const x=outer.x, y=outer.y, w=outer.w, h=outer.h, r=outer.r;

  switch(seg){
    case 0: { // top side left->right with arcs at ends
      const L = w - 2*r;
      const pos = k * (L + Math.PI*r/2);
      if(pos <= L){
        return { x: x+r + pos, y };
      } else {
        const a = (pos - L)/ (Math.PI*r/2) * (Math.PI/2); // 0..pi/2
        return { x: x+w - r + Math.sin(a)*r, y: y + (1-Math.cos(a))*r };
      }
    }
    case 1: { // right side top->bottom
      const L = h - 2*r;
      const pos = k * (L + Math.PI*r/2);
      if(pos <= L){
        return { x: x+w, y: y+r + pos };
      } else {
        const a = (pos - L)/(Math.PI*r/2) * (Math.PI/2);
        return { x: x+w - (1-Math.cos(a))*r, y: y+h - r + Math.sin(a)*r };
      }
    }
    case 2: { // bottom side right->left
      const L = w - 2*r;
      const pos = k * (L + Math.PI*r/2);
      if(pos <= L){
        return { x: x+w - r - pos, y: y+h };
      } else {
        const a = (pos - L)/(Math.PI*r/2) * (Math.PI/2);
        return { x: x + r - Math.sin(a)*r, y: y+h - (1-Math.cos(a))*r };
      }
    }
    default: { // left side bottom->top
      const L = h - 2*r;
      const pos = k * (L + Math.PI*r/2);
      if(pos <= L){
        return { x: x, y: y+h - r - pos };
      } else {
        const a = (pos - L)/(Math.PI*r/2) * (Math.PI/2);
        return { x: x + (1-Math.cos(a))*r, y: y + r - Math.sin(a)*r };
      }
    }
  }
}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}

const track = samplePerimeterPoints(TRACK_LEN);

// Home paths: straight lines from each player's start towards center
function lerp(a,b,t){return a + (b-a)*t}
function lerpPt(p,q,t){return {x:lerp(p.x,q.x,t), y:lerp(p.y,q.y,t)}}
function buildHomePath(entryIndex){
  const entry = track[entryIndex];
  const pts = [];
  for(let i=1;i<=HOME_LEN;i++){
    const t = i/(HOME_LEN+1);
    pts.push(lerpPt(entry, center, t));
  }
  return pts;
}

const HOME_PATHS = {
  0: buildHomePath(0),    // Red home path
  26: buildHomePath(26),  // Blue home path
};

// Base positions (corners)
function baseSpots(colorIdx){
  const pads = [
    {cx: outer.x + 0.20*outer.w, cy: outer.y + 0.20*outer.h},
    {cx: outer.x + 0.80*outer.w, cy: outer.y + 0.80*outer.h},
  ];
  // Red in top-left, Blue in bottom-right
  const corner = colorIdx===0
    ? {cx: outer.x+outer.w*0.22, cy: outer.y+outer.h*0.22}
    : {cx: outer.x+outer.w*0.78, cy: outer.y+outer.h*0.78};

  // 2x2 grid spots
  const s=40;
  return [
    {x:corner.cx - s, y:corner.cy - s},
    {x:corner.cx + s, y:corner.cy - s},
    {x:corner.cx - s, y:corner.cy + s},
    {x:corner.cx + s, y:corner.cy + s},
  ];
}
PLAYER_DATA[0].basePos = baseSpots(0);
PLAYER_DATA[1].basePos = baseSpots(1);

// Game state
let currentPlayer = 0; // 0=Red, 1=Blue
let dice = null;
let tokens = []; // array of token objects
let highlightTokenIds = new Set();

function resetGame(){
  tokens = [];
  for(let p=0;p<2;p++){
    for(let i=0;i<TOKENS_PER_PLAYER;i++){
      tokens.push({
        id: `${p}-${i}`,
        player: p,
        inBase: true,
        onTrack: false,
        finished: false,
        trackIndex: null, // 0..51
        stepsMoved: 0,    // total steps after leaving base
        homeIndex: null,  // 0..5 when in home path
      });
    }
  }
  currentPlayer = 0;
  dice = null;
  diceValueEl.textContent = '-';
  turnLabelEl.textContent = PLAYER_DATA[currentPlayer].name;
  highlightTokenIds.clear();
  draw();
}

function rollDice(){
  dice = Math.floor(Math.random()*6)+1;
  diceValueEl.textContent = dice;
  computeHighlights();
  draw();
}

function computeHighlights(){
  highlightTokenIds.clear();
  const moves = legalMovesForCurrentPlayer();
  moves.forEach(t => highlightTokenIds.add(t.id));
}

function legalMovesForCurrentPlayer(){
  const p = currentPlayer;
  const d = dice;
  const mine = tokens.filter(t => t.player===p && !t.finished);
  const others = tokens.filter(t => t.player!==p);

  const legal = [];

  mine.forEach(t => {
    if(t.inBase){
      // Need 6 to leave base
      if(d===6){
        // can place at start spot if no same-color collision limit? (allowed to stack)
        legal.push(t);
      }
      return;
    }
    if(t.onTrack){
      // Moving on main track
      const nextSteps = t.stepsMoved + d;
      if(nextSteps < TRACK_LEN){ // stays on track
        legal.push(t);
      } else if(nextSteps === TRACK_LEN){ // exactly at home entry -> move to home index 0
        legal.push(t);
      } else {
        // into home path
        const homeSteps = nextSteps - TRACK_LEN;
        if(homeSteps <= HOME_LEN){
          legal.push(t);
        }
      }
      return;
    }
    if(t.homeIndex!==null){
      // already in home path
      const next = t.homeIndex + d;
      if(next < HOME_LEN){
        legal.push(t);
      } else if(next === HOME_LEN){
        legal.push(t);
      }
    }
  });

  // If nothing is legal, turn will pass on click anywhere or reroll button press (we'll handle after click)
  return legal;
}

function moveToken(token){
  const d = dice;

  // base -> start
  if(token.inBase){
    token.inBase = false;
    token.onTrack = true;
    token.trackIndex = PLAYER_DATA[token.player].startIndex;
    token.stepsMoved = 0;
    handleCaptureAt(token.trackIndex, token.player); // capture if opponent here and not safe (but start is safe)
    endMove(token, /*fromSix*/ true);
    return;
  }

  // on track
  if(token.onTrack){
    const nextSteps = token.stepsMoved + d;
    if(nextSteps < TRACK_LEN){
      token.stepsMoved = nextSteps;
      token.trackIndex = (PLAYER_DATA[token.player].startIndex + token.stepsMoved) % TRACK_LEN;
      handleCaptureAt(token.trackIndex, token.player);
      endMove(token, d===6);
      return;
    }
    if(nextSteps === TRACK_LEN){
      token.onTrack = false;
      token.trackIndex = null;
      token.homeIndex = 0;
      token.stepsMoved = TRACK_LEN;
      endMove(token, d===6);
      return;
    }
    // into home
    const homeSteps = nextSteps - TRACK_LEN;
    if(homeSteps < HOME_LEN){
      token.onTrack = false;
      token.trackIndex = null;
      token.homeIndex = homeSteps;
      token.stepsMoved = nextSteps;
      endMove(token, d===6);
      return;
    }
    if(homeSteps === HOME_LEN){
      token.onTrack = false;
      token.trackIndex = null;
      token.homeIndex = HOME_LEN;
      token.finished = true;
      endMove(token, d===6);
      return;
    }
  }

  // in home path
  if(token.homeIndex!==null){
    const next = token.homeIndex + d;
    if(next < HOME_LEN){
      token.homeIndex = next;
      endMove(token, d===6);
      return;
    }
    if(next === HOME_LEN){
      token.homeIndex = HOME_LEN;
      token.finished = true;
      endMove(token, d===6);
      return;
    }
  }
}

function handleCaptureAt(trackIndex, movingPlayer){
  if(SAFE_INDICES.has(trackIndex)) return; // safe
  // find opponent tokens on same index and on track -> send to base
  tokens.forEach(t=>{
    if(t.player!==movingPlayer && t.onTrack && t.trackIndex===trackIndex){
      // send to base
      t.inBase = true;
      t.onTrack = false;
      t.trackIndex = null;
      t.stepsMoved = 0;
      t.homeIndex = null;
      t.finished = false;
    }
  });
}

function endMove(token, extraTurn){
  // Win check
  const me = tokens.filter(t=>t.player===currentPlayer);
  if(me.every(t=>t.finished)){
    diceValueEl.textContent = '🎉';
    turnLabelEl.textContent = `${PLAYER_DATA[currentPlayer].name} Wins!`;
    rollBtn.disabled = true;
    draw();
    return;
  }

  // Next turn?
  if(dice === 6 && extraTurn){
    // stay on same player
  } else {
    currentPlayer = (currentPlayer+1) % 2;
  }
  dice = null;
  diceValueEl.textContent = '-';
  turnLabelEl.textContent = PLAYER_DATA[currentPlayer].name;
  highlightTokenIds.clear();
  draw();
}

/* ----------------- Rendering ----------------- */

function draw(){
  ctx.clearRect(0,0,W,H);

  // Board base
  drawBoardBackground();

  // Track dots
  drawTrack();

  // Safe marks
  drawSafeMarkers();

  // Home paths
  drawHomePaths();

  // Bases
  drawBases();

  // Tokens
  drawTokens();

  // Highlights
  drawHighlights();
}

function drawBoardBackground(){
  // outer frame
  ctx.save();
  ctx.fillStyle = '#0a1226';
  ctx.fillRect(0,0,W,H);

  ctx.strokeStyle = BOARD_EDGE;
  ctx.lineWidth = 4;
  ctx.stroke(roundedRectPath(0));

  // inner glow
  const grad = ctx.createRadialGradient(center.x, center.y, 40, center.x, center.y, 360);
  grad.addColorStop(0, 'rgba(34,211,238,.06)');
  grad.addColorStop(1, 'rgba(34,211,238,0)');
  ctx.fillStyle = grad;
  ctx.fill(roundedRectPath(6));

  // title watermark
  ctx.fillStyle = 'rgba(255,255,255,.03)';
  ctx.font = 'bold 54px ui-sans-serif, system-ui, Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText('L U D O', center.x, 60);
  ctx.restore();
}

function drawTrack(){
  // shadow ring
  ctx.save();
  ctx.lineWidth = 24;
  ctx.strokeStyle = 'rgba(0,0,0,.18)';
  ctx.stroke(roundedRectPath(36));
  ctx.restore();

  // dots
  for(let i=0;i<track.length;i++){
    const p = track[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, dotRadius, 0, Math.PI*2);
    ctx.fillStyle = (i%2===0)?TRACK:TRACK_DARK;
    ctx.fill();
  }
}

function drawSafeMarkers(){
  SAFE_INDICES.forEach(i=>{
    const p = track[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, dotRadius-2, 0, Math.PI*2);
    ctx.fillStyle = SAFE;
    ctx.fill();
  });
}

function drawHomePaths(){
  for(const key of Object.keys(HOME_PATHS)){
    const idx = Number(key);
    const pts = HOME_PATHS[idx];
    for(let i=0;i<pts.length;i++){
      const p=pts[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI*2);
      ctx.fillStyle = HOME;
      ctx.globalAlpha = 0.22 + 0.11*i;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  // center home
  ctx.beginPath();
  ctx.arc(center.x, center.y, 28, 0, Math.PI*2);
  ctx.fillStyle = HOME;
  ctx.globalAlpha = .25;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = HOME;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawBases(){
  // Red
  drawBaseArea(PLAYER_DATA[0], '#2b0f13');
  // Blue
  drawBaseArea(PLAYER_DATA[1], '#0d1530');
}
function drawBaseArea(player, glow){
  ctx.save();
  const b = baseSpots(player===PLAYER_DATA[0]?0:1);
  // soft glow
  const g = ctx.createRadialGradient(b[0].x+40, b[0].y+40, 10, b[0].x+40, b[0].y+40, 120);
  g.addColorStop(0, glow);
  g.addColorStop(1, 'transparent');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(b[0].x+40, b[0].y+40, 90, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function drawTokens(){
  // Slight offset for stacking tokens on same cell
  const offsetMap = new Map(); // key: 'track-idx' or 'home-key' -> count
  function nextOffset(key){
    const n = (offsetMap.get(key)||0);
    offsetMap.set(key, n+1);
    const k = n%4;
    const dx = (k===1? 6 : k===2? -6 : k===3? 0 : 0);
    const dy = (k===1? -6 : k===2? 6 : k===3? -6 : 6);
    return {dx,dy};
  }

  tokens.forEach(t=>{
    let pos=null, key='';
    if(t.inBase){
      const spots = PLAYER_DATA[t.player].basePos;
      const idx = Number(t.id.split('-')[1]);
      pos = spots[idx];
      key = `base-${t.id}`;
    } else if(t.onTrack){
      const ti = t.trackIndex;
      pos = track[ti];
      key = `track-${ti}`;
    } else if(t.homeIndex!==null){
      const startIdx = PLAYER_DATA[t.player].startIndex;
      const hp = HOME_PATHS[startIdx][Math.min(t.homeIndex, HOME_LEN-1)];
      pos = hp;
      key = `home-${startIdx}-${t.homeIndex}`;
    }
    if(!pos) return;

    const {dx,dy} = nextOffset(key);
    drawToken(pos.x+dx, pos.y+dy, PLAYER_DATA[t.player].color, t);
  });
}

function drawToken(x,y,color, token){
  ctx.save();
  // halo if selectable
  const selectable = highlightTokenIds.has(token.id);
  if(selectable){
    const g = ctx.createRadialGradient(x, y, 5, x, y, 28);
    g.addColorStop(0, 'rgba(34,211,238,.35)');
    g.addColorStop(1, 'rgba(34,211,238,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x,y,28,0,Math.PI*2); ctx.fill();
  }

  // piece
  ctx.beginPath();
  ctx.arc(x,y, tokenRadius, 0, Math.PI*2);
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,.6)';
  ctx.shadowBlur = 12;
  ctx.fill();

  // top highlight
  ctx.beginPath();
  ctx.arc(x-5,y-6, tokenRadius/2.2, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fill();

  // outline
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,.5)';
  ctx.stroke();

  // token index label
  ctx.fillStyle = '#0b1021';
  ctx.font = 'bold 12px ui-sans-serif, system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = String(Number(token.id.split('-')[1]) + 1);
  ctx.fillText(label, x, y+0.5);
  ctx.restore();
}

function drawHighlights(){
  // Also ring current player's start position
  const startIdx = PLAYER_DATA[currentPlayer].startIndex;
  const p = track[startIdx];
  ctx.beginPath();
  ctx.arc(p.x, p.y, dotRadius+8, 0, Math.PI*2);
  ctx.strokeStyle = SAFE;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/* ----------------- Interaction ----------------- */

canvas.addEventListener('click', (e)=>{
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width/rect.width);
  const y = (e.clientY - rect.top)  * (canvas.height/rect.height);

  // If there is a dice value, try to click a highlighted token
  if(dice!==null){
    const hit = pickTokenAt(x,y, Array.from(highlightTokenIds));
    if(hit){
      const token = tokens.find(t=>t.id===hit);
      moveToken(token);
      return;
    } else {
      // if no legal moves exist, pass turn
      if(legalMovesForCurrentPlayer().length===0){
        currentPlayer = (currentPlayer+1)%2;
        dice = null;
        diceValueEl.textContent = '-';
        turnLabelEl.textContent = PLAYER_DATA[currentPlayer].name;
        draw();
      }
    }
  }
});

function pickTokenAt(x,y, allowedIds){
  // Check tokens belonging to allowedIds proximity
  for(let i=tokens.length-1; i>=0; i--){ // from topmost
    const t = tokens[i];
    if(!allowedIds.includes(t.id)) continue;
    const pos = tokenScreenPos(t);
    if(!pos) continue;
    if(Math.hypot(pos.x - x, pos.y - y) <= tokenRadius+6) return t.id;
  }
  return null;
}
function tokenScreenPos(t){
  if(t.inBase){
    const spots = PLAYER_DATA[t.player].basePos;
    const idx = Number(t.id.split('-')[1]);
    return spots[idx];
  } else if(t.onTrack){
    return track[t.trackIndex];
  } else if(t.homeIndex!==null){
    const startIdx = PLAYER_DATA[t.player].startIndex;
    return HOME_PATHS[startIdx][Math.min(t.homeIndex, HOME_LEN-1)];
  }
  return null;
}

rollBtn.addEventListener('click', ()=>{
  if(rollBtn.disabled) return;
  if(dice!==null){
    // already rolled; require move or pass
    return;
  }
  rollDice();
});
resetBtn.addEventListener('click', resetGame);

// Init
resetGame();
