import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { BLOCKS, BLOCK_BY_ID } from './blocks.js';

export const CHUNK = 16;
export const HEIGHT = 64;

function hash(x,z,s){let n=Math.imul(x,374761393)^Math.imul(z,668265263)^s;n=Math.imul(n^(n>>>13),1274126177);return(n^(n>>>16))>>>0}
export function seedNumber(v){if(v==='')return Math.floor(Math.random()*2147483647);if(/^-?\d+$/.test(v))return Number(v)|0;let n=2166136261;for(const c of v)n=Math.imul(n^c.charCodeAt(0),16777619);return n|0}
function noise(x,z,s){const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,f=t=>t*t*(3-2*t),r=(a,b)=>hash(a,b,s)/4294967295*2-1,a=r(xi,zi),b=r(xi+1,zi),c=r(xi,zi+1),d=r(xi+1,zi+1);return a+(b-a)*f(xf)+(c-a)*f(zf)+(d-b-c+a)*f(xf)*f(zf)}

let textureAtlas = null;
function makeTextureAtlas(){
  if(textureAtlas) return textureAtlas;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');
  const tiles={grass:0,dirt:1,stone:2,sand:3,wood:4,leaves:5,planks:6,cobblestone:7,coal_ore:8,iron_ore:9,copper_ore:10,gold_ore:11,diamond_ore:12,snow:13,sandstone:14,brick:15};
  const base={grass:'#6fae55',dirt:'#8a5b38',stone:'#7c8588',sand:'#d8c27a',wood:'#76502f',leaves:'#4f873f',planks:'#ad7b48',cobblestone:'#687174',coal_ore:'#646c70',iron_ore:'#85817a',copper_ore:'#9b684d',gold_ore:'#b59a3f',diamond_ore:'#55b8c4',snow:'#e7eeee',sandstone:'#c9a86b',brick:'#a94f43'};
  for(const [name,i] of Object.entries(tiles)){
    const x=(i%4)*64,y=Math.floor(i/4)*64;
    ctx.fillStyle=base[name];ctx.fillRect(x,y,64,64);
    const seed=i*991+17;
    for(let p=0;p<150;p++){const n=hash(p,i,seed)%100;const px=x+(hash(p,3,seed)%64),py=y+(hash(p,7,seed)%64);ctx.fillStyle=n<55?'rgba(0,0,0,.08)':'rgba(255,255,255,.07)';const s=1+(hash(p,9,seed)%3);ctx.fillRect(px,py,s,s)}
    if(name==='grass'){ctx.fillStyle='#8bc36d';ctx.fillRect(x,y,64,7)}
    if(name==='wood'){ctx.strokeStyle='rgba(35,20,10,.45)';ctx.lineWidth=5;for(let k=8;k<64;k+=13){ctx.beginPath();ctx.moveTo(x+k,y);ctx.lineTo(x+k+3,y+64);ctx.stroke()}}
    if(name==='leaves'){ctx.fillStyle='rgba(35,70,28,.25)';for(let k=0;k<10;k++){ctx.fillRect(x+hash(k,i,3)%58,y+hash(k,i,4)%58,5,5)}}
    if(name.includes('ore')){ctx.fillStyle=name==='coal_ore'?'#252a2c':base[name];for(let k=0;k<10;k++)ctx.fillRect(x+hash(k,i,8)%58,y+hash(k,i,9)%58,4,4)}
    if(name==='cobblestone'){ctx.strokeStyle='rgba(30,35,36,.25)';for(let k=8;k<64;k+=16){ctx.beginPath();ctx.moveTo(x,k+y);ctx.lineTo(x+64,k+y);ctx.stroke();ctx.beginPath();ctx.moveTo(x+k,y);ctx.lineTo(x+k,y+64);ctx.stroke()}}
    if(name==='brick'){ctx.strokeStyle='rgba(70,25,20,.35)';for(let k=16;k<64;k+=16){ctx.beginPath();ctx.moveTo(x,y+k);ctx.lineTo(x+64,y+k);ctx.stroke()}ctx.beginPath();ctx.moveTo(x+32,y);ctx.lineTo(x+32,y+16);ctx.stroke()}
  }
  textureAtlas=new THREE.CanvasTexture(canvas);textureAtlas.colorSpace=THREE.SRGBColorSpace;textureAtlas.magFilter=THREE.NearestFilter;textureAtlas.minFilter=THREE.NearestMipmapNearestFilter;textureAtlas.generateMipmaps=true;textureAtlas.wrapS=THREE.ClampToEdgeWrapping;textureAtlas.wrapT=THREE.ClampToEdgeWrapping;
  return textureAtlas;
}

const TILE={grass:0,dirt:1,stone:2,sand:3,wood:4,leaves:5,planks:6,cobblestone:7,coal_ore:8,iron_ore:9,copper_ore:10,gold_ore:11,diamond_ore:12,snow:13,sandstone:14,brick:15};
function tileFor(block){return TILE[block?.idName] ?? TILE[block?.name?.toLowerCase()] ?? TILE.stone}

export class World{
  constructor(seed,type='Normal'){this.seed=seed;this.type=type;this.chunks=new Map();this.modified=new Map();this.meshes=new Map();this.spawn={x:.5,y:40,z:.5};this.time=0}
  key(cx,cz){return `${cx},${cz}`}
  height(x,z){if(this.type==='Flat')return 30;if(this.type==='Amplified')return Math.max(6,Math.floor(30+noise(x*.018,z*.018,this.seed)*17+noise(x*.045,z*.045,this.seed+9)*8));const n=noise(x*.018,z*.018,this.seed)*10+noise(x*.045,z*.045,this.seed+9)*4;return Math.max(5,Math.floor(30+n+(noise(x*.006,z*.006,this.seed+77)+1)*9))}
  biome(x,z){const n=noise(x*.008,z*.008,this.seed+100);return n<-.32?'desert':n>.38?'forest':noise(x*.015,z*.015,this.seed+101)>.55?'mountain':'plains'}
  baseBlock(x,y,z){if(y<0)return 22;const h=this.height(x,z),b=this.biome(x,z);if(y>h)return y<=1?21:0;if(y===h){if(b==='desert')return 5;if(b==='mountain'&&h>47)return 14;return 1}if(y>h-4)return b==='desert'?5:2;if(y<7)return 3;const q=hash(x,y,z^this.seed);if(y<24&&q%180===0)return 13;if(y<32&&q%75===0)return 12;if(y<40&&q%40===0)return 11;if(y<45&&q%24===0)return 10;if(q%19===0)return 9;return 3}
  get(x,y,z){if(y<0||y>=HEIGHT)return y<0?22:0;const k=`${x},${y},${z}`;return this.modified.has(k)?this.modified.get(k):this.baseBlock(x,y,z)}
  set(x,y,z,id){if(y<0||y>=HEIGHT)return false;const k=`${x},${y},${z}`,base=this.baseBlock(x,y,z);if(id===base)this.modified.delete(k);else this.modified.set(k,id);this.rebuildAround(x,z);return true}
  ensure(cx,cz){const k=this.key(cx,cz);if(!this.chunks.has(k))this.chunks.set(k,true)}
  rebuildAround(x,z){const cx=Math.floor(x/CHUNK),cz=Math.floor(z/CHUNK);this.rebuild(cx,cz);if(((x%CHUNK)+CHUNK)%CHUNK===0)this.rebuild(cx-1,cz);if(((x%CHUNK)+CHUNK)%CHUNK===CHUNK-1)this.rebuild(cx+1,cz);if(((z%CHUNK)+CHUNK)%CHUNK===0)this.rebuild(cx,cz-1);if(((z%CHUNK)+CHUNK)%CHUNK===CHUNK-1)this.rebuild(cx,cz+1)}
  rebuild(cx,cz){const k=this.key(cx,cz);const mesh=this.meshes.get(k);if(mesh){mesh.parent?.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();this.meshes.delete(k)}this.ensure(cx,cz)}
  meshChunk(cx,cz,scene){const key=this.key(cx,cz);if(this.meshes.has(key))return;const pos=[],norm=[],uv=[],indices=[];const atlas=makeTextureAtlas();
    const faces=[
      {v:[[0,0,0],[1,0,0],[1,1,0],[0,1,0]],n:[0,0,-1],d:[0,0,-1]},
      {v:[[1,0,0],[1,0,1],[1,1,1],[1,1,0]],n:[1,0,0],d:[1,0,0]},
      {v:[[1,0,1],[0,0,1],[0,1,1],[1,1,1]],n:[0,0,1],d:[0,0,1]},
      {v:[[0,0,1],[0,0,0],[0,1,0],[0,1,1]],n:[-1,0,0],d:[-1,0,0]},
      {v:[[0,1,0],[1,1,0],[1,1,1],[0,1,1]],n:[0,1,0],d:[0,1,0]},
      {v:[[0,0,1],[1,0,1],[1,0,0],[0,0,0]],n:[0,-1,0],d:[0,-1,0]}
    ];
    const sx=cx*CHUNK,sz=cz*CHUNK;
    for(let x=sx;x<sx+CHUNK;x++)for(let z=sz;z<sz+CHUNK;z++)for(let y=0;y<HEIGHT;y++){
      const id=this.get(x,y,z),b=BLOCK_BY_ID[id];if(!b||id===0)continue;
      const tile=tileFor(b),tx=tile%4,ty=Math.floor(tile/4),eps=.001,u0=tx/4+eps,u1=(tx+1)/4-eps,v0=1-(ty+1)/4+eps,v1=1-ty/4-eps;
      for(const face of faces){const nx=x+face.d[0],ny=y+face.d[1],nz=z+face.d[2],nb=BLOCK_BY_ID[this.get(nx,ny,nz)];if(nb?.solid&&!nb.transparent)continue;const base=pos.length/3;for(const q of face.v){pos.push(x+q[0],y+q[1],z+q[2]);norm.push(...face.n)}uv.push(u0,v0,u1,v0,u1,v1,u0,v1);indices.push(base,base+1,base+2,base,base+2,base+3)}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeBoundingBox();geo.computeBoundingSphere();
    if(!pos.length)return;
    const mat=new THREE.MeshLambertMaterial({map:atlas,transparent:true,alphaTest:.05,side:THREE.FrontSide});const mesh=new THREE.Mesh(geo,mat);mesh.position.set(0,0,0);mesh.frustumCulled=true;scene.add(mesh);this.meshes.set(key,mesh)
  }
  loadNear(px,pz,dist,scene){const pcx=Math.floor(px/CHUNK),pcz=Math.floor(pz/CHUNK);for(let dx=-dist;dx<=dist;dx++)for(let dz=-dist;dz<=dist;dz++){if(dx*dx+dz*dz>dist*dist)continue;this.ensure(pcx+dx,pcz+dz);this.meshChunk(pcx+dx,pcz+dz,scene)}}
  clearMeshes(){for(const m of this.meshes.values()){m.parent?.remove(m);m.geometry.dispose();m.material.dispose()}this.meshes.clear()}
  findSpawn(){for(let r=0;r<80;r++)for(let x=-r;x<=r;x++)for(const z of[-r,r]){const y=this.height(x,z);if(!this.get(x,y+1,z)&&!this.get(x,y+2,z)){this.spawn={x:x+.5,y:y+1.01,z:z+.5};return}}this.spawn={x:.5,y:this.height(0,0)+1.01,z:.5}}
}
