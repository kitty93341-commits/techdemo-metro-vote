# Old Prodigy 2.20 backend starter

This is a small Socket.IO compatibility/test backend for the 2.20 client. It implements the transport path `/multiplayer-api/socket.io/`, `message`, `playerList`, `playerJoined`, and `playerLeft` events plus basic `/status` and `/worlds` endpoints.

It is **not** a complete replacement for Prodigy's historical API/auth/database/multiplayer protocol. Use it to bring up a public socket endpoint and then implement the exact API calls/messages your client needs.

## Render
Create a **Web Service**, use Node, build command `npm install`, start command `npm start`, and choose the Free instance. Render requires the service to listen on `0.0.0.0`; this server does. Free services can sleep after 15 minutes without inbound HTTP/WebSocket traffic.

After deployment, the Socket.IO base URL is your `https://<service>.onrender.com` URL with path `/multiplayer-api/socket.io/`.

Set the client's localStorage before connecting:
- `oldprodigy_multiplayer_url` = `https://<service>.onrender.com/`
- `oldprodigy_multiplayer_path` = `/multiplayer-api/socket.io/`
- `oldprodigy_api_url` = your compatible API base
