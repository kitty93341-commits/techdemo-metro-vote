# Old Prodigy 2.20 multiplayer backend

Deploy as a Render Web Service with start command `npm start`.

This server intentionally uses Socket.IO 1.3.5 to match the old 2.20 client and implements the client's `message`, `playerList`, `playerJoined`, `playerLeft`, `joinZone`, and `leaveZone` events.
