const express=require('express');
const http=require('http');
const {Server}=require('socket.io');

const app=express();
app.use(express.json({limit:'2mb'}));
const server=http.createServer(app);

const io=new Server(server,{
  path:'/multiplayer-api/socket.io/',
  cors:{origin:'*'},
  transports:['websocket','polling']
});

app.get('/',(req,res)=>res.type('html').send('<!doctype html><title>Old Prodigy 2.20 Backend</title><h1>Old Prodigy 2.20 Backend Online</h1><p>Socket.IO: <code>/multiplayer-api/socket.io/</code></p><p><a href="/status">Status</a> · <a href="/worlds">Worlds</a></p>'));
app.get('/status',(req,res)=>res.json({ok:true,service:'oldprodigy-220-backend',socketPath:'/multiplayer-api/socket.io/',players:players.size}));
app.get('/worlds',(req,res)=>res.json({worlds:[{id:1,name:'World 1',serverId:1,online:true,players:players.size}]}));

const players=new Map();
const rooms=new Map();
function roomFor(worldId){const key=String(worldId||1); if(!rooms.has(key)) rooms.set(key,new Set()); return rooms.get(key);}
function snapshot(exceptId,worldId){const room=roomFor(worldId); return [...room].map(id=>players.get(id)).filter(Boolean).filter(p=>p.userID!==exceptId);}

io.on('connection',socket=>{
  const q=socket.handshake.query||{};
  const id=String(q.userId||q.userID||socket.id);
  const worldId=String(q.worldId||q.worldID||1);
  const player={userID:id,worldID:worldId,socketID:socket.id,x:Number(q.x)||0,y:Number(q.y)||0};
  players.set(id,player); roomFor(worldId).add(id);
  socket.data.playerId=id; socket.data.worldId=worldId;

  socket.emit('playerList',snapshot(id,worldId));
  socket.to('world:'+worldId).emit('playerJoined',player);
  socket.join('world:'+worldId);

  socket.on('playerUpdate',data=>{
    if(data&&typeof data==='object'){
      if(Number.isFinite(Number(data.x))) player.x=Number(data.x);
      if(Number.isFinite(Number(data.y))) player.y=Number(data.y);
      if(data.worldID!=null && String(data.worldID)!==worldId) return;
    }
    socket.to('world:'+worldId).emit('playerUpdate',player);
  });
  socket.on('message',msg=>socket.to('world:'+worldId).emit('message',msg));
  socket.on('joinWorld',next=>{
    const nextId=String(next&&next.worldID||next&&next.worldId||1);
    socket.leave('world:'+worldId);
    roomFor(worldId).delete(id);
    const oldWorld=worldId;
    player.worldID=nextId;
    roomFor(nextId).add(id);
    socket.join('world:'+nextId);
    socket.emit('playerList',snapshot(id,nextId));
    socket.to('world:'+oldWorld).emit('playerLeft',id);
    socket.to('world:'+nextId).emit('playerJoined',player);
  });
  socket.on('disconnect',()=>{
    const p=players.get(id);
    players.delete(id);
    roomFor(worldId).delete(id);
    socket.to('world:'+worldId).emit('playerLeft',id);
  });
});

const port=process.env.PORT||10000;
server.listen(port,'0.0.0.0',()=>console.log(`listening on ${port}`));
