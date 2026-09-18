import Peer from 'https://esm.sh/peerjs@1.5.4';

export class Multiplayer{
  constructor({onState,onRemote,onBlock,onError,onStatus}){
    this.onState=onState;this.onRemote=onRemote;this.onBlock=onBlock;this.onError=onError;this.onStatus=onStatus;
    this.peer=null;this.hostId=null;this.isHost=false;this.connections=new Map();this.players=new Map();this.local=null;this.room='';
  }
  status(s,msg=''){this.onStatus?.(s,msg)}
  makeId(){return crypto.randomUUID?.().replaceAll('-','').slice(0,12)||Math.random().toString(36).slice(2,14)}
  async create(displayName){
    this.leave();this.isHost=true;this.status('CONNECTING');
    return new Promise((resolve,reject)=>{
      const id='vc-'+this.makeId();this.peer=new Peer(id);this.hostId=id;
      this.peer.on('open',peerId=>{this.room=peerId;this.local={networkId:peerId,displayName:displayName||'Player',position:{x:0,y:0,z:0},rotation:{x:0,y:0},skin:'default',health:20,hunger:20,selectedSlot:0};this.status('CONNECTED',peerId);this.onState?.({type:'room-created',roomId:peerId});resolve(peerId)});
      this.peer.on('connection',conn=>this.attach(conn));
      this.peer.on('error',e=>{this.status('CONNECTION ERROR',e.message||'Connection failed');this.onError?.(e);reject(e)});
      this.peer.on('disconnected',()=>this.status('DISCONNECTED'));
    });
  }
  async join(roomId,displayName){
    this.leave();this.isHost=false;this.hostId=roomId.trim();this.room=this.hostId;this.status('CONNECTING');
    return new Promise((resolve,reject)=>{
      this.peer=new Peer();this.peer.on('open',id=>{
        this.local={networkId:id,displayName:displayName||'Player',position:{x:0,y:0,z:0},rotation:{x:0,y:0},skin:'default',health:20,hunger:20,selectedSlot:0};
        const conn=this.peer.connect(this.hostId,{reliable:true});this.attach(conn);
        conn.on('open',()=>{conn.send({type:'hello',player:this.local});this.status('CONNECTED',this.hostId);resolve(this.hostId)});
      });
      this.peer.on('error',e=>{this.status('CONNECTION ERROR',e.message||'Connection failed');this.onError?.(e);reject(e)});
    });
  }
  attach(conn){
    conn.on('open',()=>{this.connections.set(conn.peer,conn);if(this.isHost){for(const p of this.players.values())conn.send({type:'player-join',player:p});if(this.local)conn.send({type:'player-join',player:this.local})}});
    conn.on('data',m=>this.message(conn,m));
    conn.on('close',()=>{this.connections.delete(conn.peer);if(this.isHost){this.players.delete(conn.peer);this.broadcast({type:'player-leave',networkId:conn.peer},conn.peer)}this.onRemote?.({type:'leave',networkId:conn.peer})});
    conn.on('error',e=>this.onError?.(e));
  }
  message(conn,m){
    if(!m||typeof m.type!=='string')return;
    if(this.isHost&&m.type==='hello'){const p=this.cleanPlayer(m.player,conn.peer);this.players.set(p.networkId,p);this.broadcast({type:'player-join',player:p});return}
    if(this.isHost&&m.type==='state'){const p=this.cleanPlayer(m.player,conn.peer);this.players.set(p.networkId,p);this.broadcast({type:'state',player:p},conn.peer);this.onRemote?.({type:'state',player:p});return}
    if(this.isHost&&m.type==='block-request'){const b=this.cleanBlock(m.block);if(!b)return;this.onBlock?.(b,true);this.broadcast({type:'block',block:b})}
    if(!this.isHost&&['player-join','state','player-leave','block'].includes(m.type))this.onRemote?.(m);
  }
  cleanPlayer(p,id){
    const q=p&&typeof p==='object'?p:{};const v=q.position||{};const r=q.rotation||{};
    return {networkId:id,displayName:String(q.displayName||'Player').slice(0,24),position:{x:clampNum(v.x),y:clampNum(v.y),z:clampNum(v.z)},rotation:{x:clampNum(r.x),y:clampNum(r.y)},skin:String(q.skin||'default').slice(0,64),health:clampNum(q.health,0,20),hunger:clampNum(q.hunger,0,20),selectedSlot:Math.max(0,Math.min(8,Math.floor(clampNum(q.selectedSlot))))};
  }
  cleanBlock(b){if(!b||!Number.isInteger(b.x)||!Number.isInteger(b.y)||!Number.isInteger(b.z)||!Number.isInteger(b.id))return null;if(Math.abs(b.x)>100000||Math.abs(b.z)>100000||b.y<0||b.y>=64||b.id<0||b.id>255)return null;return{x:b.x,y:b.y,z:b.z,id:b.id,version:Date.now()}}
  sendState(p){if(!this.peer||!this.local)return;this.local={...this.local,...p};if(this.isHost){this.players.set(this.local.networkId,this.cleanPlayer(this.local,this.local.networkId));this.broadcast({type:'state',player:this.local})}else{const c=this.connections.get(this.hostId);if(c?.open)c.send({type:'state',player:this.local})}}
  requestBlock(block){const b=this.cleanBlock(block);if(!b)return;if(this.isHost)this.onBlock?.(b,true);else{const c=this.connections.get(this.hostId);if(c?.open)c.send({type:'block-request',block:b})}}
  broadcast(m,except){for(const [id,c] of this.connections)if(id!==except&&c.open)c.send(m)}
  leave(){for(const c of this.connections.values())c.close();this.connections.clear();this.players.clear();if(this.peer){this.peer.destroy();this.peer=null}this.hostId=null;this.isHost=false;this.room='';this.status('DISCONNECTED')}
}
function clampNum(v,min=-100000,max=100000){const n=Number(v);if(!Number.isFinite(n))return 0;return Math.max(min,Math.min(max,n))}
