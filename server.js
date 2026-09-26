const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const app=express(); app.use(express.json({limit:'2mb'}));
const server=http.createServer(app);
const io=new Server(server,{path:'/multiplayer-api/socket.io/',cors:{origin:'*'},transports:['websocket','polling']});
app.get('/status',(req,res)=>res.json({ok:true,service:'oldprodigy-220-backend'}));
app.get('/worlds',(req,res)=>res.json({worlds:[{id:1,name:'World 1',serverId:1}]}));
const players=new Map();
io.on('connection',socket=>{
  const q=socket.handshake.query||{}; const id=String(q.userId||socket.id); const worldId=String(q.worldId||1);
  players.set(id,{userID:id,worldID:worldId});
  socket.emit('playerList',Array.from(players.values()).filter(p=>p.userID!==id));
  socket.broadcast.emit('playerJoined',id);
  socket.on('message',msg=>{ socket.broadcast.emit('message',msg); });
  socket.on('disconnect',()=>{players.delete(id); socket.broadcast.emit('playerLeft',id);});
});
const port=process.env.PORT||10000; server.listen(port,'0.0.0.0',()=>console.log(`listening on ${port}`));
