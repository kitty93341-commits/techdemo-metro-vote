const express = require('express');
const http = require('http');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  path: '/multiplayer-api/socket.io',
  origins: '*:*'
});

const players = new Map(); // socket.id -> player
const zones = new Map();   // zone -> Set(socket.id)

function room(zone) {
  zone = String(zone || '');
  if (!zones.has(zone)) zones.set(zone, new Set());
  return zones.get(zone);
}
function playerList(zone, exceptSocket) {
  const ids = [];
  for (const sid of room(zone)) {
    if (sid === exceptSocket) continue;
    const p = players.get(sid);
    if (p) ids.push(p.userID);
  }
  return ids;
}
function broadcastZone(zone, exceptSocket, event, data) {
  for (const sid of room(zone)) {
    if (sid !== exceptSocket) io.sockets.sockets[sid] && io.sockets.sockets[sid].emit(event, data);
  }
}
function leaveRoom(socket) {
  const p = players.get(socket.id);
  if (!p || !p.zone) return;
  const r = room(p.zone);
  r.delete(socket.id);
  broadcastZone(p.zone, socket.id, 'playerLeft', p.userID);
  p.zone = null;
}

app.get('/', (req,res)=>res.send('<!doctype html><title>Old Prodigy 2.20 Multiplayer</title><h1>Old Prodigy 2.20 Multiplayer Online</h1><p>Socket.IO 1.3-compatible server.</p><p><a href="/status">Status</a> · <a href="/worlds">Worlds</a></p>'));
app.get('/status', (req,res)=>res.json({ok:true, players:players.size, zones:[...zones.keys()].filter(Boolean)}));
app.get('/worlds', (req,res)=>res.json({worlds:[{id:1,name:'World 1',serverId:1,online:true,players:players.size,full:players.size>=100}]}));

io.on('connection', function(socket) {
  const q = socket.handshake.query || {};
  const userID = String(q.userId != null ? q.userId : ('socket-' + socket.id));
  const worldID = String(q.worldId != null ? q.worldId : '1');
  const p = {socketID:socket.id, userID:userID, worldID:worldID, zone:null, info:null};
  players.set(socket.id, p);

  socket.on('joinZone', function(zone) {
    zone = String(zone || '');
    if (p.zone === zone) return;
    leaveRoom(socket);
    p.zone = zone;
    room(zone).add(socket.id);

    // Client expects IDs here, not player objects.
    socket.emit('playerList', playerList(zone, socket.id));

    // Tell existing clients about the new ID.
    broadcastZone(zone, socket.id, 'playerJoined', p.userID);

    // Send cached full-info packets to the newly joined client.
    for (const sid of room(zone)) {
      if (sid === socket.id) continue;
      const other = players.get(sid);
      if (other && other.info) socket.emit('message', other.info);
    }
  });

  socket.on('leaveZone', function() { leaveRoom(socket); });

  socket.on('message', function(msg) {
    if (!p.zone || !msg || typeof msg !== 'object') return;
    // The 2.20 client compresses message.data before sending it. Do not
    // unpack/repack it here; forwarding it unchanged lets the original
    // client perform its normal decompression/schema handling.
    if (msg.action === 'info' || msg.action === 'change') p.info = msg;
    broadcastZone(p.zone, socket.id, 'message', msg);
  });

  socket.on('disconnect', function() {
    leaveRoom(socket);
    players.delete(socket.id);
  });
});

const port = process.env.PORT || 10000;
server.listen(port, '0.0.0.0', ()=>console.log('Old Prodigy 2.20 multiplayer listening on ' + port));
