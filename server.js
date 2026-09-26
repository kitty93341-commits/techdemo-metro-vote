const express=require('express');
const http=require('http');
const socketio=require('socket.io');
const app=express();
const server=http.createServer(app);
const io=socketio(server,{path:'/multiplayer-api/socket.io/',origins:'*:*',transports:['websocket','polling','jsonp-polling']});
const players=new Map(), rooms=new Map();
const key=v=>String(v==null||v===''?'1':v);
const roomFor=z=>{z=key(z);if(!rooms.has(z))rooms.set(z,new Set());return rooms.get(z)};
const roomName=z=>'zone:'+key(z);
const list=(z,except)=>Array.from(roomFor(z)).filter(id=>id!==except);
app.get('/',(q,s)=>s.type('html').send('<h1>Old Prodigy 2.20 multiplayer backend online</h1><p>Offline-save multiplayer enabled.</p><p><a href="/status">Status</a> · <a href="/worlds">Worlds</a></p>'));
app.get('/status',(q,s)=>s.json({ok:true,players:players.size,rooms:rooms.size,socketPath:'/multiplayer-api/socket.io/'}));
app.get('/worlds',(q,s)=>s.json({worlds:[{id:1,name:'World 1',serverId:1,online:true,players:players.size}]}));
function leave(socket){const p=socket.data||{},id=p.id,z=p.zone;if(!id)return;const pl=players.get(id);if(pl&&pl.socketId===socket.id)players.delete(id);if(z)roomFor(z).delete(id);if(z)socket.to(roomName(z)).emit('playerLeft',id)}
io.on('connection',socket=>{
 const q=socket.handshake.query||{};
 const id=key(q.userId||q.userID||('offline-'+socket.id));
 const zone=key(q.zone||q.zoneName||q.worldId||q.worldID||'1');
 socket.data={id,zone}; players.set(id,{socketId:socket.id,id,zone,info:null}); socket.join(roomName(zone));
 socket.emit('playerList',list(zone,id)); socket.to(roomName(zone)).emit('playerJoined',id);
 socket.on('message',msg=>{
   if(!msg||typeof msg!=='object'||!msg.action)return;
   const p=players.get(id); if(!p)return;
   const data=msg.data&&typeof msg.data==='object'?msg.data:{};
   data.userID=id; msg.data=data;
   if(msg.action==='info'||msg.action==='change') p.info=JSON.parse(JSON.stringify(msg));
   socket.to(roomName(socket.data.zone)).emit('message',msg);
 });
 socket.on('joinZone',next=>{
   let z=typeof next==='string'?next:(next&&(next.zoneName||next.zone||next.id||next.worldId)); z=key(z||socket.data.zone); const old=socket.data.zone;
   if(z===old){socket.emit('playerList',list(z,id));return;}
   roomFor(old).delete(id);socket.leave(roomName(old));socket.to(roomName(old)).emit('playerLeft',id);
   socket.data.zone=z; const p=players.get(id);if(p)p.zone=z;roomFor(z).add(id);socket.join(roomName(z));
   socket.emit('playerList',list(z,id));socket.to(roomName(z)).emit('playerJoined',id);
 });
 socket.on('leaveZone',()=>{const z=socket.data.zone;roomFor(z).delete(id);socket.leave(roomName(z));socket.to(roomName(z)).emit('playerLeft',id)});
 socket.on('disconnect',()=>leave(socket));
});
const port=process.env.PORT||10000;server.listen(port,'0.0.0.0',()=>console.log('listening '+port));
