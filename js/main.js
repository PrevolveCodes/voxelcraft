import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { World, seedNumber } from './world.js';
import { BLOCKS, BLOCK_BY_ID, HOTBAR_BLOCKS } from './blocks.js';

const $ = id => document.getElementById(id);
const EYE = 1.62;
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.3;
const MAX_HEALTH = 20;
const MAX_HUNGER = 20;
const SAVE_INTERVAL = 10;
const APPLE = { id: 'apple', name: 'Apple', count: 8, color: 0xd65b55, food: 5 };

let scene, camera, renderer, clock;
let world = null;
let player = null;
let gameState = 'MENU';
let pointerLocked = false;
let keys = Object.create(null);
let yaw = 0;
let pitch = 0;
let velocity = new THREE.Vector3();
let onGround = false;
let verticalSpeedBeforeLanding = 0;
let health = MAX_HEALTH;
let hunger = MAX_HUNGER;
let hotIndex = 0;
let hot = [];
let inventory = {};
let target = null;
let breaking = null;
let outline = null;
let currentWorldKey = null;
let lastSaveTime = 0;
let survivalTime = 0;
let hungerClock = 0;
let regenClock = 0;
let hintClock = 8;
let settings = loadSettings();

function loadSettings() {
  try { return { fov: 75, sens: 8, volume: .8, rd: 3, coords: true, bob: true, ...JSON.parse(localStorage.getItem('voxelSettings') || '{}') }; }
  catch { return { fov: 75, sens: 8, volume: .8, rd: 3, coords: true, bob: true }; }
}

function setScreen(id) {
  for (const el of document.querySelectorAll('.screen')) el.classList.add('hidden');
  if (id) $(id)?.classList.remove('hidden');
}

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87c8ed);
  scene.fog = new THREE.Fog(0x87c8ed, 55, 150);

  camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, .05, 220);
  camera.up.set(0, 1, 0);
  camera.rotation.order = 'YXZ';

  renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  $('game').appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xdff4ff, 0x514638, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 1.15);
  sun.position.set(60, 100, 35);
  scene.add(sun);

  clock = new THREE.Clock();
  bindEvents();
  syncSettingsUI();
  buildHotbar();
  updateHud();
  requestAnimationFrame(loop);
}

function bindEvents() {
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  document.addEventListener('keydown', e => {
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
    keys[e.code] = true;
    if (gameState === 'PLAYING') {
      if (e.code === 'KeyE') openInventory();
      if (e.code === 'Escape') pause();
      if (e.code === 'KeyF') eatApple();
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 9) { hotIndex = n - 1; buildHotbar(); }
      }
    } else if (gameState === 'PAUSED' && e.code === 'Escape') resume();
    else if (gameState === 'INVENTORY' && e.code === 'Escape') closeInventory();
  });

  document.addEventListener('keyup', e => { keys[e.code] = false; });

  renderer.domElement.addEventListener('click', () => {
    if (gameState === 'PLAYING' && !pointerLocked) renderer.domElement.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === renderer.domElement;
    if (!pointerLocked && gameState === 'PLAYING') pause();
  });

  document.addEventListener('mousemove', e => {
    if (!pointerLocked || gameState !== 'PLAYING') return;
    const sensitivity = Number(settings.sens) * 0.0015;
    yaw -= e.movementX * sensitivity;
    pitch -= e.movementY * sensitivity;
    pitch = THREE.MathUtils.clamp(pitch, -Math.PI / 2 + .02, Math.PI / 2 - .02);
  });

  renderer.domElement.addEventListener('mousedown', e => {
    if (!pointerLocked || gameState !== 'PLAYING') return;
    e.preventDefault();
    if (e.button === 0) startBreak();
    if (e.button === 2) placeBlock();
  });

  renderer.domElement.addEventListener('mouseup', e => { if (e.button === 0) breaking = null; });
  renderer.domElement.addEventListener('wheel', e => {
    if (!pointerLocked || gameState !== 'PLAYING') return;
    e.preventDefault();
    hotIndex = (hotIndex + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
    buildHotbar();
  }, { passive: false });
  renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

  $('playBtn').onclick = () => { refreshWorlds(); setScreen('worlds'); gameState = 'WORLDS'; };
  $('worldsBtn').onclick = () => { refreshWorlds(); setScreen('worlds'); gameState = 'WORLDS'; };
  $('createBtn').onclick = () => { setScreen('create'); gameState = 'CREATE'; };
  $('startWorld').onclick = startNewWorld;
  $('resumeBtn').onclick = resume;
  $('quitBtn').onclick = () => { saveWorld(); leaveToMenu(); };
  $('settingsBtn').onclick = () => openSettings('menu');
  $('pauseSettings').onclick = () => openSettings('pause');
  $('aboutBtn').onclick = () => { setScreen('about'); gameState = 'ABOUT'; };
  $('closeInv').onclick = closeInventory;
  $('closeInvBottom').onclick = closeInventory;
  $('respawnBtn').onclick = respawn;
  $('deadMenu').onclick = () => { leaveToMenu(); };
  document.querySelectorAll('[data-back]').forEach(btn => btn.onclick = () => {
    const destination = btn.dataset.back;
    setScreen(destination);
    gameState = destination === 'menu' ? 'MENU' : destination.toUpperCase();
    if (destination === 'worlds') refreshWorlds();
  });

  $('fov').oninput = () => { camera.fov = Number($('fov').value); camera.updateProjectionMatrix(); saveSettings(); syncSettingsUI(); };
  $('sens').oninput = () => { saveSettings(); syncSettingsUI(); };
  $('volume').oninput = () => { saveSettings(); syncSettingsUI(); };
  $('rd').oninput = () => { saveSettings(); syncSettingsUI(); };
  $('coordsToggle').onchange = saveSettings;
  $('bobToggle').onchange = saveSettings;
}

function syncSettingsUI() {
  if (!$('fov')) return;
  $('fov').value = settings.fov; $('sens').value = settings.sens; $('volume').value = settings.volume; $('rd').value = settings.rd;
  $('coordsToggle').checked = settings.coords !== false; $('bobToggle').checked = settings.bob !== false;
  $('fovValue').textContent = settings.fov; $('sensValue').textContent = settings.sens; $('volumeValue').textContent = `${Math.round(settings.volume * 100)}%`; $('rdValue').textContent = settings.rd;
}

function saveSettings() {
  settings = { fov: Number($('fov').value), sens: Number($('sens').value), volume: Number($('volume').value), rd: Number($('rd').value), coords: $('coordsToggle').checked, bob: $('bobToggle').checked };
  localStorage.setItem('voxelSettings', JSON.stringify(settings));
}

function resetInventory() {
  inventory = {};
  for (const id of Object.keys(BLOCKS)) inventory[id] = 0;
  inventory.apple = APPLE.count;
  hot = HOTBAR_BLOCKS.map((id, i) => ({ id, count: i === 1 ? 16 : 0 }));
}

function startNewWorld() {
  const name = $('worldName').value.trim() || 'New World';
  const seed = seedNumber($('worldSeed').value.trim());
  const type = $('worldType').value;
  world = new World(seed, type);
  world.findSpawn();
  player = { pos: new THREE.Vector3(world.spawn.x, world.spawn.y, world.spawn.z), height: PLAYER_HEIGHT, radius: PLAYER_RADIUS };
  health = MAX_HEALTH; hunger = MAX_HUNGER; survivalTime = 0; hungerClock = 0; regenClock = 0;
  resetInventory();
  currentWorldKey = `voxelWorld:${name}`;
  saveWorld();
  enterWorld();
}

function enterWorld() {
  setScreen(null);
  $('loading').classList.remove('hidden');
  $('hud').classList.add('hidden');
  gameState = 'LOADING';
  document.exitPointerLock();
  world.clearMeshes();
  const distance = Math.max(1, Number($('renderDistance').value) || settings.rd || 3);
  let step = 0;
  const total = 8;
  const generate = () => {
    step++;
    const radius = Math.max(1, Math.ceil(distance * Math.sqrt(step / total)));
    world.loadNear(player.pos.x, player.pos.z, radius, scene);
    $('loadBar').style.width = `${Math.round(step / total * 100)}%`;
    $('loadText').textContent = `Generating world... ${step}/${total}`;
    if (step < total) setTimeout(generate, 25);
    else {
      placePlayerOnSafeGround();
      $('loading').classList.add('hidden');
      $('hud').classList.remove('hidden');
      gameState = 'PLAYING';
      hintClock = 8;
      updateHud();
      requestPointerLockSafely();
    }
  };
  generate();
}

function requestPointerLockSafely() {
  if (gameState === 'PLAYING') renderer.domElement.requestPointerLock().catch?.(() => {});
}

function placePlayerOnSafeGround() {
  const x = Math.floor(player.pos.x);
  const z = Math.floor(player.pos.z);
  let y = Math.max(1, Math.floor(player.pos.y));
  for (let i = 0; i < 8 && y < 120; i++, y++) if (isOpenForPlayer(x, y, z)) { player.pos.y = y + .01; break; }
  while (y > 1 && !isSolid(x, y - 1, z)) y--;
  if (isSolid(x, y - 1, z)) player.pos.y = y + .01;
}

function refreshWorlds() {
  const box = $('worldList'); box.innerHTML = '';
  const worlds = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('voxelWorld:')) continue;
    try { worlds.push([key, JSON.parse(localStorage.getItem(key))]); } catch { localStorage.removeItem(key); }
  }
  worlds.sort((a,b) => String(a[1].name).localeCompare(String(b[1].name)));
  for (const [key, data] of worlds) {
    const row = document.createElement('div'); row.className = 'worldRow';
    const info = document.createElement('div');
    info.innerHTML = `<strong>${escapeHtml(data.name)}</strong><small>Seed: ${escapeHtml(String(data.seed))}</small>`;
    const play = document.createElement('button'); play.textContent = 'PLAY'; play.onclick = () => loadWorld(key);
    const del = document.createElement('button'); del.textContent = 'DELETE'; del.className = 'delete'; del.onclick = () => { if (confirm(`Delete "${data.name}"?`)) { localStorage.removeItem(key); refreshWorlds(); } };
    row.append(info, play, del); box.appendChild(row);
  }
}

function loadWorld(key) {
  let data;
  try { data = JSON.parse(localStorage.getItem(key)); } catch { return; }
  if (!data) return;
  currentWorldKey = key;
  world = new World(data.seed, data.type);
  world.modified = new Map(Object.entries(data.modified || {}).map(([k,v]) => [k, Number(v)]));
  world.time = Number(data.time || 0);
  player = { pos: new THREE.Vector3(data.player?.x ?? .5, data.player?.y ?? 35, data.player?.z ?? .5), height: PLAYER_HEIGHT, radius: PLAYER_RADIUS };
  health = THREE.MathUtils.clamp(Number(data.health ?? MAX_HEALTH), 0, MAX_HEALTH);
  hunger = THREE.MathUtils.clamp(Number(data.hunger ?? MAX_HUNGER), 0, MAX_HUNGER);
  inventory = { ...inventory, ...(data.inventory || {}) };
  inventory.apple = Number(data.apple ?? inventory.apple ?? 0);
  hot = Array.isArray(data.hot) ? data.hot : HOTBAR_BLOCKS.map(id => ({id,count:0}));
  while (hot.length < 9) hot.push({ id: HOTBAR_BLOCKS[hot.length] || 'dirt', count: 0 });
  hot = hot.slice(0,9);
  enterWorld();
}

function saveWorld() {
  if (!world || !player || !currentWorldKey) return;
  const name = currentWorldKey.slice('voxelWorld:'.length);
  const data = { saveVersion: 2, name, seed: world.seed, type: world.type, player: { x: player.pos.x, y: player.pos.y, z: player.pos.z }, health, hunger, inventory, hot, modified: Object.fromEntries(world.modified), time: survivalTime };
  localStorage.setItem(currentWorldKey, JSON.stringify(data));
}

function leaveToMenu() {
  saveWorld();
  document.exitPointerLock();
  gameState = 'MENU';
  target = null; breaking = null;
  if (outline) outline.visible = false;
  $('hud').classList.add('hidden');
  setScreen('menu');
}

function isSolid(x,y,z) {
  const id = world.get(x,y,z); const block = BLOCK_BY_ID[id];
  return !!(block?.solid && !block.transparent);
}

function isOpenForPlayer(x,y,z) {
  return !isSolid(x,y,z) && !isSolid(x,y+1,z);
}

function collidesAt(pos) {
  const minX = Math.floor(pos.x - PLAYER_RADIUS), maxX = Math.floor(pos.x + PLAYER_RADIUS);
  const minY = Math.floor(pos.y), maxY = Math.floor(pos.y + PLAYER_HEIGHT - .001);
  const minZ = Math.floor(pos.z - PLAYER_RADIUS), maxZ = Math.floor(pos.z + PLAYER_RADIUS);
  for (let x=minX;x<=maxX;x++) for (let y=minY;y<=maxY;y++) for (let z=minZ;z<=maxZ;z++) if (isSolid(x,y,z)) return true;
  return false;
}

function moveAxis(axis, amount) {
  if (!amount) return false;
  const next = player.pos.clone(); next[axis] += amount;
  if (!collidesAt(next)) { player.pos[axis] = next[axis]; return false; }
  return true;
}

function updatePlayer(dt) {
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const move = new THREE.Vector3();
  if (keys.KeyW) move.add(forward);
  if (keys.KeyS) move.sub(forward);
  if (keys.KeyD) move.add(right);
  if (keys.KeyA) move.sub(right);
  if (move.lengthSq()) move.normalize();
  const sprinting = !!(keys.ShiftLeft || keys.ShiftRight) && move.lengthSq() > 0;
  const speed = sprinting ? 7 : 4.5;
  velocity.x = THREE.MathUtils.damp(velocity.x, move.x * speed, 20, dt);
  velocity.z = THREE.MathUtils.damp(velocity.z, move.z * speed, 20, dt);

  if (keys.Space && onGround) { velocity.y = 8; onGround = false; }
  const oldY = player.pos.y;
  velocity.y -= 22 * dt;
  verticalSpeedBeforeLanding = velocity.y;

  moveAxis('x', velocity.x * dt);
  moveAxis('z', velocity.z * dt);
  const hitVertical = moveAxis('y', velocity.y * dt);
  if (hitVertical) {
    if (velocity.y < 0) {
      onGround = true;
      if (verticalSpeedBeforeLanding < -11) damage(Math.min(10, Math.floor((Math.abs(verticalSpeedBeforeLanding)-10)*.7)), 'fall');
    }
    velocity.y = 0;
  } else onGround = false;

  if (player.pos.y < -12) { health = 0; die(); return; }
  if (oldY < player.pos.y && !onGround) onGround = false;

  let bob = 0;
  if (settings.bob !== false && onGround && move.lengthSq() > 0) bob = Math.sin(performance.now() * .012 * (sprinting ? 1.4 : 1)) * .025;
  camera.position.set(player.pos.x, player.pos.y + EYE + bob, player.pos.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

function updateSurvival(dt) {
  survivalTime += dt;
  hungerClock += dt;
  regenClock += dt;
  if (hungerClock >= 30) { hungerClock = 0; hunger = Math.max(0, hunger - 1); }
  if (hunger <= 0 && survivalTime % 1 < dt) damage(1, 'starvation');
  if (hunger >= 18 && health < MAX_HEALTH && regenClock >= 4) { regenClock = 0; health = Math.min(MAX_HEALTH, health + 1); }
}

function damage(amount, reason='damage') {
  if (gameState !== 'PLAYING' || amount <= 0) return;
  health = Math.max(0, health - amount);
  updateHud();
  if (health <= 0) die();
}

function eatApple() {
  if (gameState !== 'PLAYING' || hunger >= MAX_HUNGER || inventory.apple <= 0) return;
  inventory.apple--;
  hunger = Math.min(MAX_HUNGER, hunger + APPLE.food);
  buildHotbar(); updateHud();
}

function findTarget() {
  if (!world || gameState !== 'PLAYING') return null;
  const origin = camera.position.clone();
  const direction = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize();
  return voxelRaycast(origin, direction, 7);
}

function voxelRaycast(origin, direction, maxDistance) {
  const step = .035;
  let previous = null;
  const p = origin.clone();
  for (let d=0; d<=maxDistance; d+=step) {
    const cell = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) };
    if (!previous || cell.x!==previous.x || cell.y!==previous.y || cell.z!==previous.z) {
      const id = world.get(cell.x,cell.y,cell.z);
      if (id && BLOCK_BY_ID[id]?.solid) {
        let normal = new THREE.Vector3();
        if (previous) {
          normal.set(previous.x-cell.x, previous.y-cell.y, previous.z-cell.z);
        } else normal.set(-Math.sign(direction.x),-Math.sign(direction.y),-Math.sign(direction.z));
        return { ...cell, id, normal, distance:d };
      }
      previous = cell;
    }
    p.addScaledVector(direction, step);
  }
  return null;
}

function updateTargetOutline() {
  if (!outline) {
    outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006,1.006,1.006)), new THREE.LineBasicMaterial({ color:0xf3f7dc, transparent:true, opacity:.7 }));
    scene.add(outline);
  }
  if (!target) { outline.visible = false; return; }
  outline.visible = true;
  outline.position.set(target.x+.5,target.y+.5,target.z+.5);
}

function startBreak() {
  if (!target) return;
  const block = BLOCK_BY_ID[target.id];
  if (!block || target.y < 0) return;
  breaking = { x:target.x,y:target.y,z:target.z,id:target.id,time:0,need:Math.max(.12, Number(block.hardness || 1) / 2) };
}

function updateBreaking(dt) {
  if (!breaking) return;
  if (!pointerLocked || !target || target.x!==breaking.x || target.y!==breaking.y || target.z!==breaking.z || target.id!==breaking.id) { breaking = null; setBreakProgress(0); return; }
  breaking.time += dt;
  const ratio = Math.min(1, breaking.time / breaking.need);
  setBreakProgress(ratio);
  if (ratio >= 1) {
    const block = BLOCK_BY_ID[breaking.id];
    world.set(breaking.x, breaking.y, breaking.z, 0);
    if (block?.drop) giveItem(block.drop, 1); else if (breaking.id !== 22) giveItem(breaking.id, 1);
    breaking = null; setBreakProgress(0);
  }
}

function setBreakProgress(ratio) {
  const bar = $('breakBar');
  if (!ratio) { bar.classList.add('hidden'); bar.querySelector('i').style.width='0%'; return; }
  bar.classList.remove('hidden'); bar.querySelector('i').style.width=`${ratio*100}%`;
}

function placeBlock() {
  const slot = hot[hotIndex];
  if (!slot || slot.count <= 0 || !BLOCK_BY_ID[slot.id] || !target) return;
  const n = target.normal;
  const x = target.x + n.x, y = target.y + n.y, z = target.z + n.z;
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) || world.get(x,y,z)!==0) return;
  const test = player.pos.clone(); test.x = x + .5; test.y = y; test.z = z + .5;
  if (collidesAt(test)) return;
  world.set(x,y,z,BLOCK_BY_ID[slot.id].id);
  slot.count--; buildHotbar();
}

function giveItem(id, count) {
  if (!id) return;
  const slot = hot.find(s => s.id === id && s.count < 64);
  if (slot) slot.count = Math.min(64, slot.count + count);
  else {
    const empty = hot.find(s => !s.id || s.count <= 0);
    if (empty && BLOCK_BY_ID[id]) { empty.id=id; empty.count=count; }
    else inventory[id] = (inventory[id] || 0) + count;
  }
  buildHotbar();
}

function itemSymbol(id) {
  const b = BLOCK_BY_ID[id];
  if (id === 'apple') return '●';
  return b ? '■' : '·';
}

function itemColor(id) {
  if (id === 'apple') return APPLE.color;
  return BLOCK_BY_ID[id]?.color || 0xffffff;
}

function buildHotbar() {
  const box = $('hotbar'); box.innerHTML='';
  hot.forEach((slot,i) => {
    const el=document.createElement('div'); el.className=`hot ${i===hotIndex?'sel':''}`;
    const num=document.createElement('span'); num.className='num'; num.textContent=i+1;
    const icon=document.createElement('span'); icon.className='item-icon'; icon.textContent=itemSymbol(slot.id); icon.style.color=`#${itemColor(slot.id).toString(16).padStart(6,'0')}`;
    const count=document.createElement('small'); count.textContent=slot.count>0?slot.count:'';
    el.append(num,icon,count); el.onclick=()=>{hotIndex=i;buildHotbar()}; box.appendChild(el);
  });
}

function renderInventory() {
  const grid=$('invGrid'); grid.innerHTML='';
  const entries=Object.entries(inventory).filter(([,count])=>Number(count)>0);
  if (!entries.length) { const empty=document.createElement('p'); empty.textContent='Inventory empty'; empty.className='muted'; grid.appendChild(empty); }
  for (const [id,count] of entries) {
    const el=document.createElement('div'); el.className='slot';
    const icon=document.createElement('b'); icon.textContent=itemSymbol(id); icon.style.color=`#${itemColor(id).toString(16).padStart(6,'0')}`;
    const text=document.createElement('span'); text.textContent=id.replaceAll('_',' ');
    const qty=document.createElement('em'); qty.textContent=count;
    el.append(icon,text,qty); el.title=id; grid.appendChild(el);
  }
  const h=$('invHotbar'); h.innerHTML='';
  hot.forEach((slot,i)=>{ const el=document.createElement('div'); el.className=`slot ${i===hotIndex?'selected':''}`; el.innerHTML=`<b style="color:#${itemColor(slot.id).toString(16).padStart(6,'0')}">${itemSymbol(slot.id)}</b><em>${slot.count||''}</em>`; h.appendChild(el); });
}

function openInventory() { gameState='INVENTORY'; document.exitPointerLock(); renderInventory(); $('inventory').classList.remove('hidden'); }
function closeInventory() { $('inventory').classList.add('hidden'); gameState='PLAYING'; requestPointerLockSafely(); }
function pause() { if (gameState!=='PLAYING') return; gameState='PAUSED'; document.exitPointerLock(); setScreen('pause'); }
function resume() { if (gameState!=='PAUSED') return; setScreen(null); gameState='PLAYING'; $('hud').classList.remove('hidden'); requestPointerLockSafely(); }
function die() { if (gameState==='DEAD') return; health=0; document.exitPointerLock(); gameState='DEAD'; setScreen('dead'); $('hud').classList.add('hidden'); saveWorld(); }
function respawn() { if (!world) return; health=MAX_HEALTH; hunger=MAX_HUNGER; player.pos.set(world.spawn.x,world.spawn.y,world.spawn.z); velocity.set(0,0,0); onGround=false; setScreen(null); $('hud').classList.remove('hidden'); gameState='PLAYING'; requestPointerLockSafely(); updateHud(); }

function updateHud() {
  const healthIcons=$('healthIcons'), hungerIcons=$('hungerIcons');
  healthIcons.innerHTML=''; hungerIcons.innerHTML='';
  for(let i=0;i<10;i++) { const h=document.createElement('span'); h.className=`icon ${health>=i*2+2?'full':health>i*2?'half':'empty'} health`; healthIcons.appendChild(h); const f=document.createElement('span'); f.className=`icon ${hunger>=i*2+2?'full':hunger>i*2?'half':'empty'} food`; hungerIcons.appendChild(f); }
  $('healthText').textContent=`${Math.ceil(health)} / ${MAX_HEALTH}`; $('hungerText').textContent=`${Math.ceil(hunger)} / ${MAX_HUNGER}`;
  $('coords').textContent=settings.coords===false||!player?'':`XYZ ${player.pos.x.toFixed(1)}  ${player.pos.y.toFixed(1)}  ${player.pos.z.toFixed(1)}`;
}

function loop() {
  requestAnimationFrame(loop);
  const dt=Math.min(clock.getDelta(),.05);
  if (gameState==='PLAYING' && world && player) {
    updatePlayer(dt); updateSurvival(dt);
    target=findTarget(); updateTargetOutline(); updateBreaking(dt); updateHud();
    if (hintClock>0) { hintClock-=dt; $('hint').style.opacity=Math.max(0,hintClock/2); }
    else $('hint').style.opacity='0';
    if (survivalTime-lastSaveTime>=SAVE_INTERVAL) { saveWorld(); lastSaveTime=survivalTime; }
  }
  renderer.render(scene,camera);
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

init();
