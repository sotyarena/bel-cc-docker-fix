const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { transports: ['websocket', 'polling'] });

const PORT = process.env.PORT || 3000;
const teams = new Map();
let roundActive = false;
let buzzSequence = 0;
let buzzerResults = [];

app.get('/health', (_req, res) => res.json({ ok: true, roundActive, teams: teams.size }));
app.use(express.static(path.join(__dirname, 'public')));

function publicState() {
  return {
    teams: [...teams.values()].map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      members: t.members.map(m => ({ id: m.id, name: m.name }))
    })),
    roundActive,
    buzzerResults
  };
}

function broadcast() { io.emit('state', publicState()); }
function sendState(socket) { socket.emit('state', publicState()); }

function registerMember(socket, team, memberName) {
  memberName = String(memberName || '').trim().slice(0, 30);
  if (!memberName) return false;
  const old = team.members.find(m => m.id === socket.id);
  if (old) old.name = memberName;
  else team.members.push({ id: socket.id, name: memberName });
  socket.join(`team:${team.id}`);
  socket.data.teamId = team.id;
  socket.data.memberName = memberName;
  return true;
}

io.on('connection', socket => {
  socket.emit('connected', { socketId: socket.id });
  sendState(socket);

  socket.on('restoreParticipant', ({ teamId, memberName }) => {
    const team = teams.get(teamId);
    if (!team) return socket.emit('restoreFailed');
    if (!registerMember(socket, team, memberName)) return socket.emit('restoreFailed');
    socket.emit('joinedTeam', { teamId, memberName });
    broadcast();
  });

  socket.on('createTeam', ({ name, color, memberName }) => {
    name = String(name || '').trim().slice(0, 30);
    memberName = String(memberName || '').trim().slice(0, 30);
    if (!name) return socket.emit('errorMessage', 'Nama tim wajib diisi.');
    if (!memberName) return socket.emit('errorMessage', 'Nama kapten/peserta wajib diisi.');
    if ([...teams.values()].some(t => t.name.toLowerCase() === name.toLowerCase())) {
      return socket.emit('errorMessage', 'Nama tim sudah digunakan.');
    }

    const id = Math.random().toString(36).slice(2, 9);
    const team = { id, name, color: color || '#2563eb', members: [], owner: socket.id };
    teams.set(id, team);
    registerMember(socket, team, memberName);
    socket.emit('teamCreated', { id, memberName });
    socket.emit('joinedTeam', { teamId: id, memberName });
    broadcast();
  });

  socket.on('joinTeam', ({ teamId, memberName }) => {
    const team = teams.get(teamId);
    if (!team) return socket.emit('errorMessage', 'Tim tidak ditemukan.');
    if (!registerMember(socket, team, memberName)) {
      return socket.emit('errorMessage', 'Nama peserta wajib diisi.');
    }
    socket.emit('joinedTeam', { teamId, memberName: socket.data.memberName });
    broadcast();
  });

  socket.on('buzz', () => {
    if (!roundActive) return socket.emit('buzzRejected', 'Ronde belum dimulai.');
    const teamId = socket.data.teamId;
    const team = teams.get(teamId);
    if (!team) return socket.emit('buzzRejected', 'Anda belum bergabung ke tim.');
    if (buzzerResults.some(r => r.teamId === teamId)) {
      return socket.emit('buzzRejected', 'Tim Anda sudah menekan buzzer pada ronde ini.');
    }

    buzzSequence += 1;
    buzzerResults.push({
      position: buzzSequence,
      teamId,
      teamName: team.name,
      memberName: socket.data.memberName || 'Peserta',
      timestamp: Date.now()
    });
    broadcast();
  });

  socket.on('startRound', () => {
    roundActive = true;
    buzzerResults = [];
    buzzSequence = 0;
    broadcast();
  });

  socket.on('resetRound', () => {
    roundActive = false;
    buzzerResults = [];
    buzzSequence = 0;
    broadcast();
  });

  socket.on('disconnect', () => {
    // Keanggotaan tetap tersimpan. Peserta dapat otomatis mendaftar kembali saat reconnect.
    broadcast();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Bel Cerdas Cermat berjalan di port ${PORT}`);
});
