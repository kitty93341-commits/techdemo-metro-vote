const express=require('express');
const http=require('http');
const socketio=require('socket.io');

const app=express();
app.use(express.json({limit:'2mb'}));
const server=http.createServer(app);
const io=socketio(server,{
  path:'/multiplayer-api/socket.io/',
  origins:'*:*',
  transports:['websocket','polling']
});

const players=new Map();
const rooms=new Map();
function key(v){return String(v==null||v===''?'1':v);}
function roomFor(zone){zone=key(zone);if(!rooms.has(zone))rooms.set(zone,new Set());return rooms.get(zone);}
function roomName(zone){return 'zone:'+key(zone);}
function ids(except,zone){return Array.from(roomFor(zone)).filter(id=>id!==except);}

app.get('/',(req,res)=>res.type('html').send('<!doctype html><title>Old Prodigy 2.20 Backend</title><h1>Old Prodigy 2.20 Backend Online</h1><p>Socket.IO 1.x multiplayer backend</p><p><a href="/status">Status</a> · <a href="/worlds">Worlds</a></p>'));
app.get('/status',(req,res)=>res.json({ok:true,service:'oldprodigy-220-backend',socketPath:'/multiplayer-api/socket.io/',players:players.size,rooms:rooms.size}));
app.get('/worlds',(req,res)=>res.json({worlds:[{id:1,name:'World 1',serverId:1,online:true,players:players.size}]}));

function sendPlayerList(socket,zone){socket.emit('playerList',ids(socket.data.userId,zone));}
function announceJoin(socket,zone){socket.to(roomName(zone)).emit('playerJoined',socket.data.userId);}
function announceLeave(socket,zone,id){socket.to(roomName(zone)).emit('playerLeft',id);}
function cleanup(socket){
  const id=socket.data&&socket.data.userId;
  const zone=socket.data&&socket.data.zone;
  if(!id)return;
  const p=players.get(id);
  if(p && p.socketId===socket.id)players.delete(id);
  if(zone)roomFor(zone).delete(id);
  if(zone)announceLeave(socket,zone,id);
}

io.on('connection',function(socket){
  const q=socket.handshake.query||{};
  const id=key(q.userId||q.userID||socket.id);
  const zone=key(q.zone||q.zoneName||q.worldId||q.worldID||'1');
  socket.data={userId:id,zone:zone};
  players.set(id,{userID:id,socketId:socket.id,zone:zone,info:null,lastMove:null});
  socket.join(roomName(zone));

  // The 2.20 client expects IDs here, not player objects.
  sendPlayerList(socket,zone);
  // Existing clients receive the ID and respond with their full "info" packet.
  announceJoin(socket,zone);

  socket.on('message',function(msg){
    if(!msg || typeof msg!=='object')return;
    const action=msg.action;
    const data=msg.data||{};
    const p=players.get(id);
    if(!p)return;

    // Never allow one client to impersonate another player in our state.
    if(data.userID!=null && String(data.userID)!==id)return;
    if(data.userID==null)data.userID=id;

    if(action==='info')p.info=msg;
    else if(action==='move')p.lastMove=msg;
    else if(action==='change'){
      if(p.info && p.info.data){
        p.info.data.appearance=data.appearance||p.info.data.appearance;
        p.info.data.equipment=data.equipment||p.info.data.equipment;
        p.info.data.mount=data.mount||p.info.data.mount;
      } else p.info=msg;
    }

    // Forward the exact protocol packet expected by the old client.
    socket.to(roomName(socket.data.zone)).emit('message',msg);
  });

  socket.on('joinZone',function(next){
    let nextZone;
    if(typeof next==='string')nextZone=next;
    else if(next&&typeof next==='object')nextZone=next.zoneName||next.zone||next.id||next.worldId;
    nextZone=key(nextZone||socket.data.zone);
    const oldZone=socket.data.zone;
    if(nextZone===oldZone){sendPlayerList(socket,nextZone);announceJoin(socket,nextZone);return;}

    socket.leave(roomName(oldZone));
    roomFor(oldZone).delete(id);
    announceLeave(socket,oldZone,id);

    socket.data.zone=nextZone;
    const p=players.get(id);
    if(p)p.zone=nextZone;
    roomFor(nextZone).add(id);
    socket.join(roomName(nextZone));
    sendPlayerList(socket,nextZone);
    announceJoin(socket,nextZone);
  });

  socket.on('leaveZone',function(){
    const zone=socket.data.zone;
    roomFor(zone).delete(id);
    socket.leave(roomName(zone));
    announceLeave(socket,zone,id);
  });

  socket.on('disconnect',function(){cleanup(socket);});
});

const port=process.env.PORT||10000;
server.listen(port,'0.0.0.0',()=>console.log('Old Prodigy 2.20 backend listening on '+port));
