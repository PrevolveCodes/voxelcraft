import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const game=document.querySelector('#game');
const menu=document.querySelector('#menu'), pause=document.querySelector('#pause');
const coords=document.querySelector('#coords'), fpsEl=document.querySelector('#fps');
const hotbar=document.querySelector('#hotbar'), message=document.querySelector('#message');
const scene=new THREE.Scene(); scene.fog=new THREE.Fog(0x8ec5ed,35,115);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.05,180);
const renderer=new THREE.WebGLRenderer({antialias:false}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight); renderer.outputColorSpace=THREE.SRGBColorSpace; game.appendChild(renderer.domElement);
const controls=new PointerLockControls(camera,document.body); scene.add(camera);
scene.add(new THREE.HemisphereLight(0xbfe5ff,0x554433,1.5));
const sun=new THREE.DirectionalLight(0xffffff,1.7); sun.position.set(30,70,20); scene.add(sun);

const TYPES={air:0,grass:1,dirt:2,stone:3,sand:4,wood:5,leaves:6,water:7,coal:8,iron:9};
const names=['','Grass','Dirt','Stone','Sand','Wood','Leaves','Water','Coal','Iron'];
const solid=new Set([1,2,3,4,5,6,8,9]);
const transparent=new Set([7,6]);
const palette=[TYPES.grass,TYPES.dirt,TYPES.stone,TYPES.wood,TYPES.sand,TYPES.coal,TYPES.iron,TYPES.water];
let selected=0;
const W=64,H=36,D=64;
const blocks=new Map(); const key=(x,y,z)=>`${x},${y},${z}`;
const get=(x,y,z)=>{if(y<0)return TYPES.stone;if(y>=H)return TYPES.air;return blocks.get(key(x,y,z))??TYPES.air};
const set=(x,y,z,t)=>{if(y>=0&&y<H)blocks.set(key(x,y,z),t)};

function hash(x,z,s){let n=(x*374761393+z*668265263+s*1442695041)|0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295}
function noise(x,z,s){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);const a=hash(ix,iz,s),b=hash(ix+1,iz,s),c=hash(ix,iz+1,s),d=hash(ix+1,iz+1,s);return (a+(b-a)*u)+((c+(d-c)*u)-(a+(b-a)*u))*v}
function heightAt(x,z,s){let n=0,a=.55,f=.035;for(let i=0;i<5;i++){n+=noise(x*f,z*f,s+i*17)*a;a*=.5;f*=2}return Math.floor(5+n*14+Math.sin(x*.055)*1.5+Math.cos(z*.047)*1.5)}
let seed=0;
function generateWorld(s){blocks.clear();seed=s;for(let x=0;x<W;x++)for(let z=0;z<D;z++){const h=Math.min(H-5,heightAt(x,z,s));for(let y=0;y<=h;y++){let t=y===h?TYPES.grass:y>h-3?TYPES.dirt:TYPES.stone;if(y<4&&t===TYPES.stone)t=TYPES.sand;set(x,y,z,t)}if(h>7&&hash(x,z,s+91)>.965){for(let y=1;y<=4;y++)set(x,h+y,z,TYPES.wood);for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=3;dy<=5;dy++)if(Math.abs(dx)+Math.abs(dz)+Math.abs(dy-4)<5&&get(x+dx,h+dy,z+dz)===TYPES.air)set(x+dx,h+dy,z+dz,TYPES.leaves)}}
for(let x=3;x<W-3;x++)for(let z=3;z<D-3;z++)for(let y=3;y<Math.min(18,H-1);y++){if(get(x,y,z)===TYPES.stone&&hash(x+y*7,z-y*3,s+500)<.035)set(x,y,z,hash(x,z,s+700)>.5?TYPES.coal:TYPES.iron)}
remesh();spawnPlayer();saveWorld();show('World generated')}

const atlas=document.createElement('canvas');atlas.width=64;atlas.height=32;const ac=atlas.getContext('2d');ac.imageSmoothingEnabled=false;
function tile(i,base,detail){const ox=(i%8)*8,oy=Math.floor(i/8)*8;ac.fillStyle=base;ac.fillRect(ox,oy,8,8);for(let p=0;p<18;p++){const x=ox+((p*13+i*7)%8),y=oy+((p*7+i*3)%8);ac.fillStyle=detail;ac.fillRect(x,y,1,1)}}
tile(0,'#6db84e','#4c9138');tile(1,'#8a5937','#74472c');tile(2,'#85898b','#666a6c');tile(3,'#d8c17a','#bda35d');tile(4,'#7a5130','#4e321e');tile(5,'#3f9149','#2e7137');tile(6,'#3e8bca','#78b7ed');tile(7,'#555a5d','#303438');tile(8,'#b5a48a','#8f806b');
const texture=new THREE.CanvasTexture(atlas);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.colorSpace=THREE.SRGBColorSpace;
const material=new THREE.MeshLambertMaterial({map:texture,transparent:true,alphaTest:.1});
const chunkGroup=new THREE.Group();scene.add(chunkGroup);
const faceDirs=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]];
const faceVerts=[[[0,0,0],[0,1,0],[0,1,1],[0,0,1]],[[1,0,1],[1,1,1],[1,1,0],[1,0,0]],[[0,0,1],[1,0,1],[1,0,0],[0,0,0]],[[0,1,0],[1,1,0],[1,1,1],[0,1,1]],[[1,0,0],[1,1,0],[0,1,0],[0,0,0]],[[0,0,1],[0,1,1],[1,1,1],[1,0,1]]];
function atlasUV(t){const i=Math.max(0,t-1);const ox=(i%8)*.125,oy=Math.floor(i/8)*.25;return [[ox,oy+.25],[ox+.125,oy+.25],[ox+.125,oy],[ox,oy]]}
function remesh(){while(chunkGroup.children.length)chunkGroup.remove(chunkGroup.children[0]);const pos=[],norm=[],uv=[];for(let x=0;x<W;x++)for(let y=0;y<H;y++)for(let z=0;z<D;z++){const t=get(x,y,z);if(!t||t===TYPES.water)continue;for(let f=0;f<6;f++){const d=faceDirs[f],nt=get(x+d[0],y+d[1],z+d[2]);if(nt&&!(transparent.has(nt)&&nt!==TYPES.leaves))continue;const vs=faceVerts[f],u=atlasUV(t);for(let q=0;q<6;q++){const vi=[0,1,2,0,2,3][q];const v=vs[vi];pos.push(x+v[0],y+v[1],z+v[2]);norm.push(d[0],d[1],d[2]);uv.push(u[vi][0],u[vi][1])}}}
const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeBoundingSphere();chunkGroup.add(new THREE.Mesh(g,material));
const waterGeo=new THREE.BoxGeometry(W,.82,D);const wm=new THREE.MeshPhongMaterial({color:0x3b91d1,transparent:true,opacity:.55,depthWrite:false});const water=new THREE.Mesh(waterGeo,wm);water.position.set(W/2,-.41,D/2);let waterTop=4;water.position.y=waterTop-.41;water.scale.y=1;chunkGroup.add(water)}

const player={pos:new THREE.Vector3(W/2+0.5,15,D/2+0.5),vel:new THREE.Vector3(),height:1.8,radius:.28,onGround:false,health:20};
function spawnPlayer(){let x=W/2,z=D/2,y=H-1;while(y>1&&get(Math.floor(x),y,z)===TYPES.air)y--;player.pos.set(x+.5,y+1.01,z+.5);player.vel.set(0,0,0);camera.position.set(player.pos.x,player.pos.y+1.62,player.pos.z)}
function collides(px,py,pz){const minX=Math.floor(px-player.radius),maxX=Math.floor(px+player.radius),minY=Math.floor(py),maxY=Math.floor(py+player.height-.001),minZ=Math.floor(pz-player.radius),maxZ=Math.floor(pz+player.radius);for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++)for(let z=minZ;z<=maxZ;z++)if(solid.has(get(x,y,z)))return true;return false}
function moveAxis(axis,amount){if(!amount)return;player.pos[axis]+=amount;if(collides(player.pos.x,player.pos.y,player.pos.z)){player.pos[axis]-=amount;if(axis==='y'){if(amount<0)player.onGround=true;player.vel.y=0}}}
function updatePlayer(dt){const dir=new THREE.Vector3();const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();if(keys.KeyW)dir.add(forward);if(keys.KeyS)dir.sub(forward);if(keys.KeyD)dir.add(right);if(keys.KeyA)dir.sub(right);if(dir.lengthSq())dir.normalize();const speed=keys.ShiftLeft?7:4.8;player.vel.x=THREE.MathUtils.damp(player.vel.x,dir.x*speed,14,dt);player.vel.z=THREE.MathUtils.damp(player.vel.z,dir.z*speed,14,dt);player.vel.y-=22*dt;if(keys.Space&&player.onGround){player.vel.y=8;player.onGround=false}player.onGround=false;moveAxis('x',player.vel.x*dt);moveAxis('z',player.vel.z*dt);moveAxis('y',player.vel.y*dt);if(player.pos.y<-10){spawnPlayer();player.health=Math.max(1,player.health-2)}camera.position.set(player.pos.x,player.pos.y+1.62,player.pos.z)}

const keys={};addEventListener('keydown',e=>{keys[e.code]=true;if(e.code.startsWith('Digit')){const n=+e.code.slice(5)-1;if(n>=0&&n<palette.length){selected=n;drawHotbar()}}});addEventListener('keyup',e=>keys[e.code]=false);
function drawHotbar(){hotbar.innerHTML='';palette.forEach((t,i)=>{const s=document.createElement('div');s.className='slot'+(i===selected?' selected':'');s.innerHTML=`<span>${i+1}</span><i class="block-${names[t].toLowerCase()}"></i>`;hotbar.appendChild(s)})}drawHotbar();

function raycastBlock(){const origin=camera.getWorldPosition(new THREE.Vector3()),dir=camera.getWorldDirection(new THREE.Vector3()).normalize();let p=origin.clone(),last=p.clone();for(let i=0;i<100;i++){p.addScaledVector(dir,.08);const x=Math.floor(p.x),y=Math.floor(p.y),z=Math.floor(p.z);if(solid.has(get(x,y,z))||get(x,y,z)===TYPES.water)return {x,y,z,last:{x:Math.floor(last.x),y:Math.floor(last.y),z:Math.floor(last.z)}};last.copy(p)}return null}
addEventListener('contextmenu',e=>e.preventDefault());addEventListener('mousedown',e=>{if(!controls.isLocked)return;if(e.button===0)breakBlock();if(e.button===2)placeBlock()});
function breakBlock(){const h=raycastBlock();if(!h)return;const t=get(h.x,h.y,h.z);if(h.y<=0)return;set(h.x,h.y,h.z,TYPES.air);remesh();saveWorld();show(`Broke ${names[t]}`)}
function placeBlock(){const h=raycastBlock();if(!h)return;const p=h.last;if(p.y<0||p.y>=H||get(p.x,p.y,p.z)!==TYPES.air)return;if(collides(p.x+.5,p.y,p.z+.5)&&p.y<=Math.floor(player.pos.y+player.height))return;set(p.x,p.y,p.z,palette[selected]);remesh();saveWorld();show(`Placed ${names[palette[selected]]}`)}
addEventListener('wheel',e=>{if(!controls.isLocked)return;selected=(selected+(e.deltaY>0?1:-1)+palette.length)%palette.length;drawHotbar()},{passive:true});

let worldKey='voxelcraft-world';
function saveWorld(){try{const data={seed,blocks:[...blocks],health:player.health};localStorage.setItem(worldKey,JSON.stringify(data))}catch(e){}}
function loadWorld(){try{const d=JSON.parse(localStorage.getItem(worldKey)||'null');if(!d)return false;seed=d.seed;blocks.clear();for(const [k,v] of d.blocks)blocks.set(k,v);player.health=d.health??20;remesh();spawnPlayer();return true}catch(e){return false}}
function randomSeed(){return Math.floor(Math.random()*2147483647)}
function show(t){message.textContent=t;message.classList.add('show');clearTimeout(show.timer);show.timer=setTimeout(()=>message.classList.remove('show'),1200)}

document.querySelector('#play').onclick=()=>{if(!loadWorld())generateWorld(+document.querySelector('#seed').value||randomSeed());menu.classList.remove('visible');controls.lock()};
document.querySelector('#newWorld').onclick=()=>{generateWorld(+document.querySelector('#seed').value||randomSeed());menu.classList.remove('visible');controls.lock()};
document.querySelector('#resume').onclick=()=>controls.lock();document.querySelector('#save').onclick=()=>{saveWorld();show('World saved')};document.querySelector('#fullscreen').onclick=()=>document.documentElement.requestFullscreen?.();
controls.addEventListener('lock',()=>pause.classList.remove('visible'));controls.addEventListener('unlock',()=>{if(!menu.classList.contains('visible'))pause.classList.add('visible')});

let last=performance.now(),frames=0,fpstime=0,day=0;
function animate(now){requestAnimationFrame(animate);const dt=Math.min(.05,(now-last)/1000);last=now;frames++;fpstime+=dt;if(fpstime>1){fpsEl.textContent=`${frames} FPS`;frames=0;fpstime=0}if(controls.isLocked)updatePlayer(dt);day=(day+dt*.018)%1;const ang=day*Math.PI*2;sun.position.set(Math.cos(ang)*60,Math.sin(ang)*60,25);sun.intensity=Math.max(.15,Math.sin(ang)*1.4+.3);const sky=Math.max(0,Math.sin(ang));scene.background=new THREE.Color().setHSL(.56,.62,.22+sky*.28);scene.fog.color.copy(scene.background);coords.textContent=`XYZ ${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)} · ${names[palette[selected]]}`;renderer.render(scene,camera)}requestAnimationFrame(animate);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
