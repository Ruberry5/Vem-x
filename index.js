import express from 'express';
import http from 'node:http';
import cors from 'cors';
import { Server } from 'socket.io';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT || 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const app = express();
app.use(cors({ origin: CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN.split(',').map(s=>s.trim()) }));
app.get('/health', (_req,res)=>res.json({ok:true,service:'VEM X realtime server',rooms:rooms.size}));
const httpServer = http.createServer(app);
const io = new Server(httpServer,{cors:{origin:CLIENT_ORIGIN === '*' ? '*' : CLIENT_ORIGIN.split(',').map(s=>s.trim()),methods:['GET','POST']},pingInterval:20000,pingTimeout:30000});

const crews = ['Simba Squad','Duma Dynamo','Chui Strike','Nyoka Venom','Tai Talons','Ngamia Nomads','Radi Raiders','Moto Mavericks'];
const crewColors = {'Simba Squad':'#20e7ff','Duma Dynamo':'#ff4fc8','Chui Strike':'#a875ff','Nyoka Venom':'#b7ff4a','Tai Talons':'#54a8ff','Ngamia Nomads':'#ffc45c','Radi Raiders':'#ff8755','Moto Mavericks':'#ff5e75'};
const rooms = new Map();
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const now=()=>Date.now();
const publicPlayer=(p,hostId)=>({id:p.id,nickname:p.nickname,crew:p.crew,color:crewColors[p.crew]||'#20e7ff',host:p.id===hostId,connected:p.connected,alive:p.alive,tile:p.tile,landed:p.landed});
function roomSnapshot(r){return {code:r.code,hostId:r.hostId,phase:r.phase,players:[...r.players.values()].map(p=>publicPlayer(p,r.hostId)),map:r.map,zone:r.zone,deadline:r.deadline,serverNow:now(),winnerId:r.winnerId,feed:r.feed.slice(-6),message:r.message};}
function broadcast(r){io.to(r.code).emit('state',roomSnapshot(r));}
function makeCode(){let c;do{c=Array.from({length:4},()=>alphabet[Math.floor(Math.random()*alphabet.length)]).join('')}while(rooms.has(c));return c;}
function addFeed(r,msg){r.feed.push({id:randomUUID(),text:msg,at:now()});r.feed=r.feed.slice(-12);}
function setHost(r){const next=[...r.players.values()].find(p=>p.connected)||[...r.players.values()][0];r.hostId=next?.id||null;}
function endMatch(r,winnerId=null){clearInterval(r.timer);r.timer=null;r.phase='winner';r.winnerId=winnerId;r.deadline=null;const w=r.players.get(winnerId);r.message=w?`${w.nickname} is the last one standing!`:'The arena has closed.';broadcast(r);}
function startDrop(r){r.phase='drop';r.deadline=now()+10000;r.message='Choose your landing tile';r.players.forEach(p=>{p.alive=true;p.landed=false;p.tile=null;});addFeed(r,'DROP PHASE — choose a tile');broadcast(r);}
function startMatch(r){if(r.phase!=='lobby'||r.players.size<2)return false;r.phase='rules';r.deadline=now()+5000;r.message='Rules briefing';addFeed(r,'Match starting');broadcast(r);r.timer=setInterval(()=>tick(r),200);return true;}
function tick(r){if(!rooms.has(r.code))return;const t=now();if(!r.deadline||t<r.deadline){return;}
 if(r.phase==='rules'){startDrop(r);return;}
 if(r.phase==='drop'){
   const landed=[...r.players.values()].filter(p=>p.connected&&p.landed);
   for(const p of r.players.values())if(!p.landed){p.alive=false;addFeed(r,`${p.nickname} missed the drop`);}
   if(landed.length===0){endMatch(r,null);return;}
   r.phase='survive';r.zoneStage=0;r.zone={min:1,max:6,closesAt:t+12000};r.deadline=t+12000;r.message='The safe zone is shrinking';addFeed(r,'SAFE ZONE CLOSING — 6 × 6');broadcast(r);return;
 }
 if(r.phase==='survive'){
   const alive=[...r.players.values()].filter(p=>p.alive);
   for(const p of alive){const {x,y}=p.tile||{x:-1,y:-1};if(x<r.zone.min||x>r.zone.max||y<r.zone.min||y>r.zone.max){p.alive=false;addFeed(r,p.nickname+' was caught outside the zone');}}
   const survivors=[...r.players.values()].filter(p=>p.alive);
   if(survivors.length===1){endMatch(r,survivors[0].id);return;}
   if(survivors.length===0){endMatch(r,null);return;}
   if((r.zoneStage||0)<2){
     r.zoneStage=(r.zoneStage||0)+1;
     const bounds=[{min:2,max:5},{min:3,max:4}][r.zoneStage-1];
     r.zone={...bounds,closesAt:t+12000};r.deadline=t+12000;
     addFeed(r,'SAFE ZONE CLOSING — '+(r.zoneStage===1?'4 × 4':'2 × 2'));
     r.message='Move into the next safe zone';broadcast(r);return;
   }
   r.phase='showdown';r.deadline=t+5000;r.showdownTaps=new Map();r.message='FINAL SHOWDOWN — tap to survive';addFeed(r,'5-SECOND FINAL TAP SHOWDOWN');broadcast(r);return;
 }
 if(r.phase==='showdown'){const contenders=[...r.players.values()].filter(p=>p.alive);const taps=r.showdownTaps||new Map();const top=Math.max(0,...contenders.map(p=>taps.get(p.id)||0));const leaders=contenders.filter(p=>(taps.get(p.id)||0)===top);if(leaders.length===1&&top>0){endMatch(r,leaders[0].id);}else{endMatch(r,null);}return;}
 if(r.phase==='winner'){clearInterval(r.timer);r.timer=null;}
}
function leaveRoom(socket){const code=socket.data.roomCode,id=socket.data.playerId;if(!code||!rooms.has(code))return;const r=rooms.get(code),p=r.players.get(id);if(!p)return;p.connected=false;p.socketId=null;addFeed(r,`${p.nickname} disconnected`);if(r.hostId===id){setHost(r);addFeed(r,'A new host has been assigned');}broadcast(r);if([...r.players.values()].every(x=>!x.connected)&&r.phase==='lobby'){setTimeout(()=>{if(rooms.get(code)===r&&[...r.players.values()].every(x=>!x.connected)){rooms.delete(code);}},60000);}}
function attachPlayer(socket,r,p){p.connected=true;p.socketId=socket.id;socket.data.roomCode=r.code;socket.data.playerId=p.id;socket.join(r.code);}

io.on('connection',socket=>{
 socket.on('createRoom',({nickname,crew='Simba Squad',token},cb=()=>{})=>{
  const name=String(nickname||'').trim().slice(0,18);if(!name)return cb({ok:false,error:'Enter a nickname first.'});if(!crews.includes(crew))return cb({ok:false,error:'Choose a valid crew.'});
  const code=makeCode(),id=token||randomUUID();const p={id,nickname:name,crew,connected:true,socketId:socket.id,alive:true,landed:false,tile:null,joinedAt:now()};const r={code,hostId:id,players:new Map([[id,p]]),phase:'lobby',deadline:null,zone:{min:0,max:7},map:{size:8},winnerId:null,feed:[],message:'Waiting for your crew'};rooms.set(code,r);attachPlayer(socket,r,p);broadcast(r);cb({ok:true,token:id,code,state:roomSnapshot(r)});
 });
 socket.on('joinRoom',({code,nickname,crew='Simba Squad',token},cb=()=>{})=>{
  const c=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4),r=rooms.get(c),name=String(nickname||'').trim().slice(0,18);if(!r)return cb({ok:false,error:'Room not found. Check the 4-letter code.'});if(!name)return cb({ok:false,error:'Enter a nickname first.'});if(!crews.includes(crew))return cb({ok:false,error:'Choose a valid crew.'});
  let p=token?r.players.get(token):null;if(p){if(p.nickname.toLowerCase()!==name.toLowerCase())return cb({ok:false,error:'Use the same nickname to reconnect.'});if(p.socketId&&p.socketId!==socket.id)io.to(p.socketId).emit('sessionReplaced');}
  else {if(r.phase!=='lobby'&&r.phase!=='rules'&&r.phase!=='drop'&&r.phase!=='survive')return cb({ok:false,error:'This match has ended. Join the next match.'});if(r.players.size>=10)return cb({ok:false,error:'This room is full (10 players).'});if([...r.players.values()].some(x=>x.nickname.toLowerCase()===name.toLowerCase()))return cb({ok:false,error:'That nickname is already taken in this room.'});p={id:randomUUID(),nickname:name,crew,connected:true,socketId:socket.id,alive:r.phase==='lobby',landed:false,tile:null,joinedAt:now()};r.players.set(p.id,p);if(r.phase!=='lobby')addFeed(r,`${p.nickname} joined as a spectator`);}
  attachPlayer(socket,r,p);if(!p.crew)p.crew=crew;addFeed(r,`${p.nickname} joined the room`);broadcast(r);cb({ok:true,token:p.id,code:c,state:roomSnapshot(r)});
 });
 socket.on('startMatch',(_payload,cb=()=>{})=>{const r=rooms.get(socket.data.roomCode);if(!r)return cb({ok:false,error:'Room expired.'});if(socket.data.playerId!==r.hostId)return cb({ok:false,error:'Only the host can start.'});if(!startMatch(r))return cb({ok:false,error:'At least two players are required.'});cb({ok:true});});
 socket.on('land',({x,y},cb=()=>{})=>{const r=rooms.get(socket.data.roomCode),p=r?.players.get(socket.data.playerId);if(!r||!p)return cb({ok:false,error:'Room connection lost.'});if(r.phase!=='drop')return cb({ok:false,error:'The drop phase has ended.'});if(!p.alive)return cb({ok:false,error:'You joined after the drop began. Spectate until the next match.'});if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>7||y<0||y>7)return cb({ok:false,error:'Choose a valid tile.'});if(p.landed)return cb({ok:false,error:'You have already landed.'});if([...r.players.values()].some(q=>q.alive&&q.landed&&q.tile?.x===x&&q.tile?.y===y))return cb({ok:false,error:'That tile is occupied. Choose another tile.'});p.tile={x,y};p.landed=true;addFeed(r,`${p.nickname} landed`);broadcast(r);cb({ok:true});});
 socket.on('move',({x,y},cb=()=>{})=>{const r=rooms.get(socket.data.roomCode),p=r?.players.get(socket.data.playerId);if(!r||!p)return cb({ok:false,error:'Room connection lost.'});if(r.phase!=='survive'||!p.alive||!p.tile)return cb({ok:false,error:'You cannot move right now.'});if(Math.abs(x-p.tile.x)+Math.abs(y-p.tile.y)!==1)return cb({ok:false,error:'Move one adjacent tile at a time.'});if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x>7||y<0||y>7)return cb({ok:false,error:'That tile is outside the map.'});if([...r.players.values()].some(q=>q.id!==p.id&&q.alive&&q.tile?.x===x&&q.tile?.y===y))return cb({ok:false,error:'That tile is occupied. Choose another tile.'});if(now()-(p.lastMoveAt||0)<400)return cb({ok:false,error:'Wait a moment before moving again.'});p.lastMoveAt=now();p.tile={x,y};broadcast(r);cb({ok:true});});
 socket.on('showdownTap',(_payload,cb=()=>{})=>{const r=rooms.get(socket.data.roomCode),p=r?.players.get(socket.data.playerId);if(!r||!p)return cb({ok:false,error:'Room connection lost.'});if(r.phase!=='showdown'||!p.alive)return cb({ok:false,error:'The final showdown is not active.'});r.showdownTaps.set(p.id,(r.showdownTaps.get(p.id)||0)+1);broadcast(r);cb({ok:true});});
 socket.on('leaveRoom',()=>{const code=socket.data.roomCode,id=socket.data.playerId,r=rooms.get(code);if(r&&id&&r.players.has(id)){const p=r.players.get(id);r.players.delete(id);addFeed(r,`${p.nickname} left the room`);if(r.hostId===id){setHost(r);addFeed(r,'A new host has been assigned');}if(r.players.size===0){clearInterval(r.timer);rooms.delete(code);}else broadcast(r);}socket.leave(code||'');socket.data.roomCode=null;socket.data.playerId=null;});
 socket.on('playAgain',(_payload,cb=()=>{})=>{const r=rooms.get(socket.data.roomCode);if(!r)return cb({ok:false,error:'Room expired.'});if(socket.data.playerId!==r.hostId)return cb({ok:false,error:'Only the host can restart.'});if(r.phase!=='winner')return cb({ok:false,error:'The current match is still running.'});r.phase='lobby';r.winnerId=null;r.deadline=null;r.zone={min:0,max:7};r.players.forEach(p=>{p.alive=true;p.landed=false;p.tile=null;});r.feed=[];r.message='Waiting for your crew';broadcast(r);cb({ok:true});});
 socket.on('disconnect',()=>leaveRoom(socket));
});
httpServer.listen(PORT,'0.0.0.0',()=>console.log(`VEM X realtime server listening on ${PORT}`));
