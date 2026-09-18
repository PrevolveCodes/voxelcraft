import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { BLOCK_BY_ID } from './blocks.js';

export const CHUNK=16, HEIGHT=64;
const FACE_NAMES=['side','side','side','side','top','bottom'];
const TEX_NAMES=['grass_top','grass_side','dirt','stone','sand','log_side','log_top','leaves','planks','cobblestone','coal_ore','iron_ore','copper_ore','gold_ore','diamond_ore','snow','sandstone','brick','glass','bedrock'];
const TILE={}; TEX_NAMES.forEach((n,i)=>TILE[n]=i);
let atlasTexture=null;

function hash(x,z,s){let n=(Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^((s|0)));n=Math.imul(n^(n>>>13),1274126177);return(n^(n>>>16))>>>0}
export function seedNumber(v){if(v==='')return Math.floor(Math.random()*2147483647);if(/^-?\d+$/.test(v))return Number(v)|0;let n=2166136261;for(const c of v)n=Math.imul(n^c.charCodeAt(0),16777619);return n|0}
function noise(x,z,s){const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,f=t=>t*t*(3-2*t),r=(a,b)=>hash(a,b,s)/4294967295*2-1,a=r(xi,zi),b=r(xi+1,zi),c=r(xi,zi+1),d=r(xi+1,zi+1);return a+(b-a)*f(xf)+(c-a)*f(zf)+(d-b-c+a)*f(xf)*f(zf)}

function pixelTexture(ctx,x,y,name,i){
  const palettes={
    grass_top:['#4f8f43','#72b454','#3f7b39'],grass_side:['#6b9e4e','#8b613e','#765239'],
    dirt:['#805437','#966540','#70462f'],stone:['#777b7b','#888d8b','#686d6d'],
    sand:['#d5c17b','#e1cd8a','#c5ae69'],log_side:['#6d472b','#815633','#5a3924'],
    log_top:['#9a7047','#76502f','#c29a66'],leaves:['#477d3e','#5c9348','#386b35'],
    planks:['#a87847','#bd8950','#8e623a'],cobblestone:['#666d6e','#7c8382','#555b5d'],
    coal_ore:['#747775','#292c2d','#464a49'],iron_ore:['#817a70','#b18b70','#5e5c59'],
    copper_ore:['#806c60','#b87352','#9b5d45'],gold_ore:['#77736a','#d0aa45','#b48930'],
    diamond_ore:['#777d7c','#55c4c9','#3c9fa9'],snow:['#dce7e7','#f3f7f5','#c8d8d8'],
    sandstone:['#c2a269','#d6b77b','#a98b58'],brick:['#974b43','#b65b4d','#713b37'],
    glass:['#b6dfe0','#83b9bc','#d5eeee'],bedrock:['#303434','#454a49','#242727']
  };
  const p=palettes[name]||palettes.stone;ctx.fillStyle=p[0];ctx.fillRect(x,y,16,16);
  const rng=(q)=>hash(q,i+11,i*97+31)%16;
  for(let q=0;q<22;q++){const px=rng(q),py=rng(q+50);ctx.fillStyle=p[(q%11===0)?2:1];ctx.fillRect(x+px,y+py,1+(q%4===0?1:0),1)}
  ctx.fillStyle='rgba(0,0,0,.18)';
  if(name==='planks'){for(let yy=3;yy<16;yy+=5)ctx.fillRect(x,y+yy,16,1)}
  if(name==='log_side'){for(let xx=2;xx<16;xx+=4)ctx.fillRect(x+xx,y,1,16)}
  if(name==='log_top'){ctx.strokeStyle='rgba(60,35,20,.45)';ctx.strokeRect(x+2,y+2,12,12);ctx.strokeRect(x+5,y+5,6,6)}
  if(name==='grass_side'){ctx.fillStyle='#5b963f';ctx.fillRect(x,y,16,4);ctx.fillStyle='#6f9f4c';for(let q=0;q<8;q++)ctx.fillRect(x+((q*7+i)%16),y+4+((q*3)%6),1,2)}
  if(name.endsWith('_ore')){ctx.fillStyle=p[1];for(let q=0;q<7;q++){const px=(q*5+i*3)%14,py=(q*7+i)%14;ctx.fillRect(x+px,y+py,2,2)}}
}
function makeTextureAtlas(){
  if(atlasTexture)return atlasTexture;
  const canvas=document.createElement('canvas');canvas.width=80;canvas.height=64;const ctx=canvas.getContext('2d');
  TEX_NAMES.forEach((name,i)=>pixelTexture(ctx,(i%5)*16,Math.floor(i/5)*16,name,i));
  atlasTexture=new THREE.CanvasTexture(canvas);atlasTexture.colorSpace=THREE.SRGBColorSpace;
  atlasTexture.magFilter=THREE.NearestFilter;atlasTexture.minFilter=THREE.NearestFilter;
  atlasTexture.wrapS=THREE.ClampToEdgeWrapping;atlasTexture.wrapT=THREE.ClampToEdgeWrapping;
  atlasTexture.generateMipmaps=false;return atlasTexture;
}

export class World{
  constructor(seed,type='Normal'){this.seed=seed;this.type=type;this.chunks=new Map();this.modified=new Map();this.meshes=new Map();this.spawn={x:.5,y:40,z:.5};this.scene=null;this.renderedRadius=0}
  key(cx,cz){return cx+','+cz}
  chunkCoords(x,z){return {cx:Math.floor(x/CHUNK),cz:Math.floor(z/CHUNK)}}
  height(x,z){if(this.type==='Flat')return 30;if(this.type==='Amplified')return Math.max(6,Math.floor(30+noise(x*.018,z*.018,this.seed)*17+noise(x*.045,z*.045,this.seed+9)*8));const n=noise(x*.018,z*.018,this.seed)*10+noise(x*.045,z*.045,this.seed+9)*4;return Math.max(5,Math.floor(30+n+(noise(x*.006,z*.006,this.seed+77)+1)*9))}
  biome(x,z){const n=noise(x*.008,z*.008,this.seed+100);return n<-.32?'desert':n>.38?'forest':noise(x*.015,z*.015,this.seed+101)>.55?'mountain':'plains'}
  baseBlock(x,y,z){if(y<0)return 22;if(y>=HEIGHT)return 0;const h=this.height(x,z),b=this.biome(x,z);if(y>h)return y<=1?21:0;if(y===h){if(b==='desert')return 5;if(b==='mountain'&&h>47)return 14;return 1}if(y>h-4)return b==='desert'?5:2;if(y<7)return 3;const q=hash(x,y,z^this.seed);if(y<24&&q%180===0)return 13;if(y<32&&q%75===0)return 12;if(y<40&&q%40===0)return 11;if(y<45&&q%24===0)return 10;if(q%19===0)return 9;return 3}
  get(x,y,z){if(y<0||y>=HEIGHT)return y<0?22:0;const k=x+','+y+','+z;return this.modified.has(k)?this.modified.get(k):this.baseBlock(x,y,z)}
  set(x,y,z,id){if(y<0||y>=HEIGHT)return false;const k=x+','+y+','+z,base=this.baseBlock(x,y,z);if(id===base)this.modified.delete(k);else this.modified.set(k,id);this.rebuildAround(x,z);return true}
  ensure(cx,cz){const k=this.key(cx,cz);let c=this.chunks.get(k);if(!c){c={cx,cz,state:'GENERATED'};this.chunks.set(k,c)}return c}
  disposeChunk(cx,cz){const k=this.key(cx,cz),m=this.meshes.get(k);if(m){m.parent?.remove(m);m.geometry.dispose();m.material.dispose();this.meshes.delete(k)}this.chunks.delete(k)}
  isRendered(cx,cz){return this.chunks.get(this.key(cx,cz))?.state==='RENDERED'}
  neighborIsSameOrRendered(cx,cz,nx,nz){return nx===cx&&nz===cz||this.isRendered(nx,nz)}
  rebuildAround(x,z){const {cx,cz}=this.chunkCoords(x,z);this.rebuild(cx,cz);const lx=((x%CHUNK)+CHUNK)%CHUNK,lz=((z%CHUNK)+CHUNK)%CHUNK;if(lx===0)this.rebuild(cx-1,cz);if(lx===CHUNK-1)this.rebuild(cx+1,cz);if(lz===0)this.rebuild(cx,cz-1);if(lz===CHUNK-1)this.rebuild(cx,cz+1)}
  rebuild(cx,cz){const k=this.key(cx,cz),m=this.meshes.get(k);if(m){m.parent?.remove(m);m.geometry.dispose();m.material.dispose();this.meshes.delete(k)}if(this.scene&&this.isRendered(cx,cz))this.meshChunk(cx,cz,this.scene)}
  textureTile(block,faceIndex){const t=block?.textures||{};const name=t[FACE_NAMES[faceIndex]]||t.all||'stone';return TILE[name]??TILE.stone}
  meshChunk(cx,cz,scene){
    const key=this.key(cx,cz);if(this.meshes.has(key))return;
    const pos=[],norm=[],uv=[],indices=[],atlas=makeTextureAtlas();
    const faces=[
      {v:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]],n:[0,0,-1],d:[0,0,-1]},
      {v:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]],n:[1,0,0],d:[1,0,0]},
      {v:[[1,0,1],[1,1,1],[0,1,1],[0,0,1]],n:[0,0,1],d:[0,0,1]},
      {v:[[0,0,0],[0,0,1],[0,1,1],[0,1,0]],n:[-1,0,0],d:[-1,0,0]},
      {v:[[0,1,0],[0,1,1],[1,1,1],[1,1,0]],n:[0,1,0],d:[0,1,0]},
      {v:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],n:[0,-1,0],d:[0,-1,0]}
    ];
    const sx=cx*CHUNK,sz=cz*CHUNK,aw=5,ah=4,eps=.001;
    for(let x=sx;x<sx+CHUNK;x++)for(let z=sz;z<sz+CHUNK;z++)for(let y=0;y<HEIGHT;y++){
      const id=this.get(x,y,z),block=BLOCK_BY_ID[id];if(!block||id===0)continue;
      for(let fi=0;fi<faces.length;fi++){const face=faces[fi],nx=x+face.d[0],ny=y+face.d[1],nz=z+face.d[2],nc=this.chunkCoords(nx,nz),same=nc.cx===cx&&nc.cz===cz;
        const nid=this.get(nx,ny,nz),nb=BLOCK_BY_ID[nid];
        if(same){if(nb?.solid&&!nb.transparent)continue}
        else if(this.isRendered(nc.cx,nc.cz)&&nb?.solid&&!nb.transparent)continue;
        const tile=this.textureTile(block,fi),tx=tile%aw,ty=Math.floor(tile/aw),u0=tx/aw+eps,u1=(tx+1)/aw-eps,v0=1-(ty+1)/ah+eps,v1=1-ty/ah-eps,base=pos.length/3;
        for(const q of face.v){pos.push(x+q[0],y+q[1],z+q[2]);norm.push(...face.n)}
        uv.push(u0,v0,u1,v0,u1,v1,u0,v1);indices.push(base,base+1,base+2,base,base+2,base+3);
      }
    }
    if(!pos.length)return;
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeBoundingBox();geo.computeBoundingSphere();
    const mat=new THREE.MeshLambertMaterial({map:atlas,transparent:false,alphaTest:0,depthWrite:true,depthTest:true,side:THREE.FrontSide});
    const mesh=new THREE.Mesh(geo,mat);mesh.frustumCulled=true;mesh.updateMatrixWorld(true);scene.add(mesh);this.meshes.set(key,mesh);
  }
  loadNear(px,pz,dist,scene){
    this.scene=scene;this.renderedRadius=dist;const {cx,cz}=this.chunkCoords(px,pz),required=new Set(),changed=new Set();
    for(let dx=-dist;dx<=dist;dx++)for(let dz=-dist;dz<=dist;dz++){
      if(dx*dx+dz*dz>dist*dist)continue;
      const x=cx+dx,z=cz+dz,k=this.key(x,z);required.add(k);
      const chunk=this.ensure(x,z);
      if(chunk.state!=='RENDERED'){chunk.state='MESHING';this.meshChunk(x,z,scene);chunk.state=this.meshes.has(k)?'RENDERED':'GENERATED';changed.add(k)}
    }
    for(const chunk of [...this.chunks.values()]){
      const k=this.key(chunk.cx,chunk.cz);
      if(chunk.state==='RENDERED'&&!required.has(k)){
        changed.add(k);
        for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])changed.add(this.key(chunk.cx+dx,chunk.cz+dz));
        this.disposeChunk(chunk.cx,chunk.cz);
      }
    }
    for(const k of changed){
      const [x,z]=k.split(',').map(Number),chunk=this.chunks.get(k);
      if(chunk?.state==='RENDERED'){const old=this.meshes.get(k);if(old){old.parent?.remove(old);old.geometry.dispose();old.material.dispose();this.meshes.delete(k)}this.meshChunk(x,z,scene)}
    }
  }
  clearMeshes(){for(const m of this.meshes.values()){m.parent?.remove(m);m.geometry.dispose();m.material.dispose()}this.meshes.clear();this.chunks.clear()}
  findSpawn(){for(let r=0;r<80;r++)for(let x=-r;x<=r;x++)for(const z of[-r,r]){const y=this.height(x,z);if(!this.get(x,y+1,z)&&!this.get(x,y+2,z)){this.spawn={x:x+.5,y:y+1.01,z:z+.5};return}}this.spawn={x:.5,y:this.height(0,0)+1.01,z:.5}}
}
