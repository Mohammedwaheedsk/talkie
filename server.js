const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { getIceConfiguration } = require('./ice-servers');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e6 });
const rooms = new Map();
const MAX_ROOM_SIZE = 8;

app.use(express.static('public'));
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/ice-config', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    res.json(getIceConfiguration());
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

function roomCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}
function name(value) {
  const result = String(value || '').trim().replace(/\s+/g, ' ');
  return result.length >= 1 && result.length <= 24 ? result : null;
}
function roomMode(value) { return value === 'video' ? 'video' : value === 'audio' ? 'audio' : null; }
function roomKey(mode, code) { return `${mode}:${code}`; }
function members(code) { return Array.from(rooms.get(code)?.values() || []); }
function leave(socket) {
  const key = socket.data.roomKey;
  if (!key) return;
  socket.leave(key);
  const room = rooms.get(key);
  if (room) {
    room.delete(socket.id);
    if (room.size) io.to(key).emit('users-list', Array.from(room.values()));
    else rooms.delete(key);
  }
  socket.to(key).emit('user-left', { userId: socket.id });
  socket.data.roomCode = null;
  socket.data.roomKey = null;
}
function canSignal(socket, target) {
  return Boolean(socket.data.roomKey && rooms.get(socket.data.roomKey)?.has(target));
}

io.on('connection', socket => {
  socket.on('join-room', (payload, respond) => {
    const code = roomCode(payload?.roomCode);
    const displayName = name(payload?.userName);
    const mode = roomMode(payload?.mode);
    if (!code || !displayName || !mode) return respond?.({ ok: false, error: 'Enter a name and a 6-character invite code.' });
    leave(socket);
    const key = roomKey(mode, code);
    const room = rooms.get(key) || new Map();
    if (room.size >= MAX_ROOM_SIZE) return respond?.({ ok: false, error: 'This room is full (maximum 8 people).' });
    const existingUsers = Array.from(room.values());
    room.set(socket.id, { userId: socket.id, name: displayName, mode });
    rooms.set(key, room);
    socket.join(key);
    socket.data.roomCode = code;
    socket.data.roomKey = key;
    socket.data.mode = mode;
    respond?.({ ok: true, roomCode: code, mode, users: existingUsers });
    io.to(key).emit('users-list', Array.from(room.values()));
    socket.to(key).emit('user-joined', { userId: socket.id, name: displayName, mode });
  });
  ['offer', 'answer', 'ice-candidate'].forEach(eventName => socket.on(eventName, payload => {
    if (!payload?.target || !canSignal(socket, payload.target)) return;
    io.to(payload.target).emit(eventName, { sender: socket.id, ...(eventName === 'ice-candidate' ? { candidate: payload.candidate } : { sdp: payload.sdp }) });
  }));
  socket.on('speaking-state', ({ isSpeaking }) => {
    if (socket.data.roomKey && socket.data.mode === 'audio') socket.to(socket.data.roomKey).emit('user-speaking-state', { userId: socket.id, isSpeaking: Boolean(isSpeaking) });
  });
  socket.on('leave-room', () => leave(socket));
  socket.on('disconnect', () => leave(socket));
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, '0.0.0.0', () => console.log(`WalkieTalkie listening on http://localhost:${port}`));
