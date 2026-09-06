const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e6 });
const rooms = new Map();
const MAX_ROOM_SIZE = 8;

app.use(express.static('public'));
app.get('/health', (_req, res) => res.json({ ok: true }));

function roomCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(code) ? code : null;
}
function name(value) {
  const result = String(value || '').trim().replace(/\s+/g, ' ');
  return result.length >= 1 && result.length <= 24 ? result : null;
}
function members(code) { return Array.from(rooms.get(code)?.values() || []); }
function leave(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  socket.leave(code);
  const room = rooms.get(code);
  if (room) {
    room.delete(socket.id);
    if (room.size) io.to(code).emit('users-list', members(code));
    else rooms.delete(code);
  }
  socket.to(code).emit('user-left', { userId: socket.id });
  socket.data.roomCode = null;
}
function canSignal(socket, target) {
  return Boolean(socket.data.roomCode && rooms.get(socket.data.roomCode)?.has(target));
}

io.on('connection', socket => {
  socket.on('join-room', (payload, respond) => {
    const code = roomCode(payload?.roomCode);
    const displayName = name(payload?.userName);
    if (!code || !displayName) return respond?.({ ok: false, error: 'Enter a name and a 4–16 character invite code.' });
    leave(socket);
    const room = rooms.get(code) || new Map();
    if (room.size >= MAX_ROOM_SIZE) return respond?.({ ok: false, error: 'This room is full (maximum 8 people).' });
    const existingUsers = Array.from(room.values());
    room.set(socket.id, { userId: socket.id, name: displayName });
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    respond?.({ ok: true, roomCode: code, users: existingUsers });
    io.to(code).emit('users-list', members(code));
    socket.to(code).emit('user-joined', { userId: socket.id, name: displayName });
  });
  ['offer', 'answer', 'ice-candidate'].forEach(eventName => socket.on(eventName, payload => {
    if (!payload?.target || !canSignal(socket, payload.target)) return;
    io.to(payload.target).emit(eventName, { sender: socket.id, ...(eventName === 'ice-candidate' ? { candidate: payload.candidate } : { sdp: payload.sdp }) });
  }));
  socket.on('speaking-state', ({ isSpeaking }) => {
    if (socket.data.roomCode) socket.to(socket.data.roomCode).emit('user-speaking-state', { userId: socket.id, isSpeaking: Boolean(isSpeaking) });
  });
  socket.on('leave-room', () => leave(socket));
  socket.on('disconnect', () => leave(socket));
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, '0.0.0.0', () => console.log(`WalkieTalkie listening on http://localhost:${port}`));
