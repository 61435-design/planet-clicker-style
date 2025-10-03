// Planet Clicker — inspired version
// Put these 3 files in a repo and open index.html (or host on GitHub Pages)

// -------------------- Game state --------------------
let state = {
  clicks: 0,
  totalClicks: 0,
  clickPower: 1,        // base click power (increased by upgrades)
  multiplier: 1,        // from planet & rebirth
  rebirths: 0,
  rebirthMult: 1,
  autoClickers: 0,
  autoEnabled: true,
  autoRebirthEnabled: false,
  upgrades: Array(100).fill(0), // counts per upgrade
  currentPlanet: 0
};

// -------------------- Planets (inspired) --------------------
const planets = [
  { id:0, name:"Merc", color:"#a6f0ff", mult:1 },
  { id:1, name:"Terra", color:"#99f6a9", mult:1.5 },
  { id:2, name:"Pyra", color:"#ffb39a", mult:2 },
  { id:3, name:"Azur", color:"#b6a9ff", mult:3 },
  { id:4, name:"Giga", color:"#ffd86b", mult:5 },
  { id:5, name:"Nova", color:"#ff9bff", mult:10 },
  { id:6, name:"Void", color:"#bfbfbf", mult:25 },
  { id:7, name:"Galaxy", color:"#a17cff", mult:50 }
];

// -------------------- Small helpers --------------------
function fmt(n){
  if (n === Infinity) return "∞";
  if (n < 1000) return Math.floor(n).toString();
  const units = ["K","M","B","T","Qa","Qi","Sx","Sp"];
  let tier = Math.floor(Math.log10(Math.abs(n))/3);
  if (tier <=0) return Math.floor(n).toString();
  const u = units[tier-1] || ("e"+(tier*3));
  return (n/Math.pow(10,tier*3)).toFixed(2)+u;
}

// -------------------- DOM elements --------------------
const el = id => document.getElementById(id);
const clickCountEl = el("clickCount");
const clickPowerEl = el("clickPower");
const multiplierEl = el("multiplierDisplay");
const autoCountEl = el("autoCount");
const rebirthCountEl = el("rebirthCount");
const rebirthMultEl = el("rebirthMult");
const planetListEl = el("planetList");
const planetAreaEl = el("planetArea");
const upgradeListEl = el("upgradeList");

// -------------------- Audio: WebAudio click (no external file) --------------------
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playClickTone(){
  try{
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = 600;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.001);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.09);
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.1);
  }catch(e){
    // some browsers require user gesture to resume audio; ignore if blocked
  }
}

// -------------------- Init UI --------------------
function initPlanets(){
  planets.forEach((p, i)=>{
    const btn = document.createElement("div");
    btn.className = "planet" + (i===state.currentPlanet ? " active":"");
    btn.style.background = `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), ${p.color})`;
    btn.textContent = p.name;
    btn.title = `${p.name} — ${p.mult}×`;
    btn.onclick = ()=> { state.currentPlanet = i; recalcMultiplier(); render(); };
    planetAreaEl.appendChild(btn);

    // also add in right panel compact
    const small = document.createElement("button");
    small.style.background = p.color;
    small.textContent = `${p.name} (${p.mult}×)`;
    small.onclick = ()=> { state.currentPlanet = i; recalcMultiplier(); render(); };
    planetListEl.appendChild(small);
  });
}

function initUpgrades(){
  for(let i=0;i<100;i++){
    const btn = document.createElement("button");
    btn.onclick = ()=> buyUpgrade(i);
    upgradeListEl.appendChild(btn);
  }
}

// -------------------- Game logic --------------------
function recalcMultiplier(){
  const p = planets[state.currentPlanet];
  state.multiplier = p.mult * state.rebirthMult;
}

function buyUpgrade(i){
  const cost = upgradeCost(i);
  if (state.clicks >= cost){
    state.clicks -= cost;
    state.upgrades[i] += 1;
    // simple: each upgrade raises clickPower by +1 (you can change scaling)
    state.clickPower += 1;
    playClickTone();
    render();
  }
}

function upgradeCost(i){
  const base = 10 * (i+1);
  return base * Math.pow(1.12, state.upgrades[i]); // slightly steeper scaling
}

function buyAutoClicker(){
  const cost = 100 * Math.pow(1.12, state.autoClickers);
  if (state.clicks >= cost){
    state.clicks -= cost;
    state.autoClickers += 1;
    playClickTone();
    render();
  }
}

function rebirth(isAuto=false){
  // require 1e3 clicks to rebirth, scalable if you want later
  const requirement = 1000;
  if (state.clicks >= requirement || isAuto){
    state.clicks = 0;
    state.totalClicks = 0;
    state.rebirths += 1;
    // make rebirth multiplier grow fast (100× first, 1000× second... as requested)
    // implement as 10^(rebirths+1) per earlier conversation
    state.rebirthMult = Math.pow(10, state.rebirths + 1);
    // reset upgrades and clickPower but keep automation if desired
    state.upgrades = Array(100).fill(0);
    state.clickPower = 1;
    // note: maintain autoClickers (persist across rebirth) as requested
    playClickTone();
    recalcMultiplier();
    render();
  } else {
    alert(`Need ${fmt(requirement)} clicks to rebirth.`);
  }
}

// -------------------- Fast automation loops --------------------
// Create independent loops:
// - auto clickers: every 1ms (0.001s) when enabled
// - auto rebirth check: every 5ms (0.005s) when enabled
let autoClickIntervalHandle = null;
let autoRebirthIntervalHandle = null;

function startFastLoops(){
  if (!autoClickIntervalHandle){
    autoClickIntervalHandle = setInterval(()=>{
      if (state.autoEnabled && state.autoClickers>0){
        // auto clickers produce clickPower * multiplier * amount each tick
        state.clicks += state.clickPower * state.multiplier * state.autoClickers;
        state.totalClicks += state.clickPower * state.multiplier * state.autoClickers;
      }
    }, 1); // 1ms
  }
  if (!autoRebirthIntervalHandle){
    autoRebirthIntervalHandle = setInterval(()=>{
      if (state.autoRebirthEnabled && state.clicks >= 1000){
        rebirth(true);
      }
    }, 5); // 5ms
  }
}

// -------------------- Click handler --------------------
function playerClick(){
  // resume audio context on first gesture (some browsers block)
  try{ if (audioCtx.state === 'suspended') audioCtx.resume(); } catch(e){}
  state.clicks += state.clickPower * state.multiplier;
  state.totalClicks += state.clickPower * state.multiplier;
  playClickTone();
  render();
}

// -------------------- Render / UI update --------------------
function render(){
  clickCountEl.textContent = fmt(state.clicks);
  clickPowerEl.textContent = fmt(state.clickPower);
  multiplierEl.textContent = (state.multiplier).toFixed(2) + "×";
  autoCountEl.textContent = state.autoClickers;
  rebirthCountEl.textContent = state.rebirths;
  rebirthMultEl.textContent = state.rebirthMult + "×";

  // upgrades buttons update & grey-out
  const buttons = upgradeListEl.querySelectorAll("button");
  buttons.forEach((b,i)=>{
    const cost = upgradeCost(i);
    b.innerHTML = `<strong>Upgrade ${i+1}</strong><div style="font-size:0.85em;color:#ccc">Cost: ${fmt(cost)} • Owned: ${state.upgrades[i]}</div>`;
    if (state.clicks < cost){
      b.classList.add("disabled");
      b.disabled = true;
    } else {
      b.classList.remove("disabled");
      b.disabled = false;
    }
  });

  // planet visuals: highlight current
  const planetEls = planetAreaEl.querySelectorAll(".planet");
  planetEls.forEach((p, idx)=> p.classList.toggle("active", idx===state.currentPlanet));
}

// -------------------- Save / Load --------------------
const STORAGE_KEY = "planet_clicker_state_v1";
function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    console.log("Game saved");
  }catch(e){}
}
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw){
      const s = JSON.parse(raw);
      // basic validation & copy
      state = Object.assign(state, s);
      // ensure arrays correct length
      if (!Array.isArray(state.upgrades) || state.upgrades.length<100) state.upgrades = Array(100).fill(0);
      recalcMultiplier();
      render();
      console.log("Loaded saved state");
    }
  }catch(e){}
}
function resetState(){
  if (!confirm("Reset ALL progress?")) return;
  state = {
    clicks: 0, totalClicks:0, clickPower:1, multiplier:1,
    rebirths:0, rebirthMult:1, autoClickers:0, autoEnabled:true,
    autoRebirthEnabled:false, upgrades:Array(100).fill(0), currentPlanet:0
  };
  recalcMultiplier();
  render();
  saveState();
}

// -------------------- Wire UI --------------------
document.getElementById("clickBtn").onclick = playerClick;
document.getElementById("buyAuto").onclick = buyAutoClicker;
document.getElementById("rebirthBtn").onclick = ()=> rebirth(false);
document.getElementById("automationToggle").onchange = (e)=> { state.autoEnabled = e.target.checked; saveState(); };
document.getElementById("autoRebirthToggle").onchange = (e)=> { state.autoRebirthEnabled = e.target.checked; saveState(); };
document.querySelectorAll(".qmult").forEach(b => b.onclick = ()=> { state.multiplier *= Number(b.dataset.m); render(); saveState(); });

document.getElementById("saveBtn").onclick = saveState;
document.getElementById("loadBtn").onclick = loadState;
document.getElementById("resetBtn").onclick = resetState;

// auto-save occasionally
setInterval(saveState, 2000);

// -------------------- Start --------------------
initPlanets();
initUpgrades();
recalcMultiplier();
loadState();
render();
startFastLoops();
