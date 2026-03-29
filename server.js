const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { MongoClient } = require('mongodb');
const { createClient } = require('redis');
const path = require('path');
const fs = require('fs');

console.log('MONGO_URL:', process.env.MONGO_URL ? 'definida' : 'INDEFINIDA');

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.connect().then(() => console.log('Redis conectado')).catch((err) => console.error('Redis connect error:', err));

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mih-gg-secret-2026';
const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) { console.error('ERRO: MONGO_URL não configurada!'); process.exit(1); }

let db;

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.connect().then(() => console.log('Redis conectado')).catch((err) => console.error('Redis falhou ao conectar:', err));

async function connectDB() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db('mihgg');
  console.log('MongoDB conectado em:', MONGO_URL.substring(0, 30));
  await seedDB();
}

async function seedDB() {
  const users = db.collection('users');
  const config = db.collection('config');
  const posts = db.collection('posts');
  const schedule = db.collection('schedule');

  const admin = await users.findOne({ username: 'Mih' });
  if (!admin) {
    await users.insertOne({ id: 'admin-001', username: 'Mih', password: '1234', role: 'admin', createdAt: new Date().toISOString(), profile: { displayName: 'Mih', color: '#a8f0b0', nameEffect: 'glow', avatar: null, bio: 'Dona do site 👾', badges: ['👑','🎮','⚡'] } });
  }

  const cfg = await config.findOne({ _id: 'main' });
  if (!cfg) {
    await config.insertOne({ _id: 'main', status: 'online', currentGame: 'Valorant', statusMessage: 'Subindo de rank!', streamUrl: '', isLive: false, games: { valorant: { rank: 'Diamond II', rr: 63, winRate: 68, kd: 2.4, matches: 247, mainAgents: ['Jett','Sage','Clove','Raze'], agentIcons: ['🌪️','🌿','💊','💥'] }, overwatch: { rank: 'Platinum III', sr: 2480, winRate: 61, matches: 183, mainHeroes: ['Ana','Kiriko','Tracer','Sojourn'], heroIcons: ['💉','🌸','⚡','🎯'], healPerGame: 18000 }, minecraft: { activeWorld: 'Mundo Survival', hours: 340, version: '1.21.4', worlds: ['Survival Principal','SMP Friends','Creative Build'] } }, lastUpdated: new Date().toISOString() });
  }

  if (await posts.countDocuments() === 0) {
    await posts.insertMany([
      { id: 'post-001', title: 'Como Subir de Elo no Valorant em 2026', content: 'Dicas práticas de gameplay, posicionamento e mentalidade que me levaram do Gold ao Diamond em 3 meses!', game: 'Valorant', emoji: '🔪', exclusive: false, likes: 284, likedBy: [], comments: [], createdAt: new Date().toISOString() },
      { id: 'post-002', title: 'Ana: Guia Completo para Iniciantes', content: 'A Ana é a minha main no OW2. Vou te ensinar posicionamento, timing dos nades e quando usar o sleep dart!', game: 'Overwatch', emoji: '🛡️', exclusive: false, likes: 197, likedBy: [], comments: [], createdAt: new Date().toISOString() },
      { id: 'post-003', title: '5 Farms Automáticas Essenciais no 1.21', content: 'Ferro, xp, madeira e mais — aprenda a fazer as farms que vão turbinar seu mundo survival de vez!', game: 'Minecraft', emoji: '🏰', exclusive: false, likes: 431, likedBy: [], comments: [], createdAt: new Date().toISOString() },
      { id: 'post-004', title: 'Minha Setup Gamer Completa 2026', content: 'Finalmente revelando tudo: monitor, headset, teclado, mouse e o que faz diferença de verdade. Conteúdo exclusivo!', game: 'Geral', emoji: '💻', exclusive: true, likes: 89, likedBy: [], comments: [], createdAt: new Date().toISOString() }
    ]);
  }

  if (await schedule.countDocuments() === 0) {
    await schedule.insertMany([
      { day: 3, time: '21h', icon: '⚔️', name: 'Ranked Valorant', desc: 'Push pro Immortal!', game: 'Valorant' },
      { day: 7, time: '20h', icon: '🛡️', name: 'Overwatch Comp.', desc: 'Flex support', game: 'Overwatch' },
      { day: 10, time: '19h', icon: '⛏️', name: 'Minecraft SMP', desc: 'Build da cidade', game: 'Minecraft' },
      { day: 14, time: '21h', icon: '⚔️', name: 'Val. Duo Ranked', desc: 'Com os amigos!', game: 'Valorant' },
      { day: 18, time: '20h', icon: '🎮', name: 'Game Night', desc: 'Jogo surpresa!', game: 'Geral' },
      { day: 22, time: '21h', icon: '🛡️', name: 'OW2 Competitivo', desc: 'Subindo de rank', game: 'Overwatch' },
      { day: 25, time: '19h', icon: '⛏️', name: 'Minecraft Farm', desc: 'Fazendinha nova', game: 'Minecraft' }
    ]);
  }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({ destination: (req, file, cb) => { const dir = path.join(__dirname, 'public', 'avatars'); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); cb(null, dir); }, filename: (req, file, cb) => { cb(null, 'avatar-' + uuidv4() + path.extname(file.originalname)); } });
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 }, fileFilter: (req, file, cb) => { if (file.mimetype.startsWith('image/')) cb(null, true); else cb(new Error('Só imagens!')); } });

function authMiddleware(req, res, next) { const token = req.headers.authorization?.split(' ')[1]; if (!token) return res.status(401).json({ error: 'Token não fornecido' }); try { req.user = jwt.verify(token, JWT_SECRET); next(); } catch { res.status(401).json({ error: 'Token inválido' }); } }
function adminMiddleware(req, res, next) { authMiddleware(req, res, () => { if (req.user.role !== 'admin') return res.status(403).json({ error: 'Só a Mih pode fazer isso!' }); next(); }); }

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Preencha tudo!' });
  const user = await db.collection('users').findOne({ username: { $regex: new RegExp('^' + username + '$', 'i') } });
  if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
  if (user.password !== password) return res.status(401).json({ error: 'Senha incorreta' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  const { password: _, _id, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

app.get('/api/auth/me', authMiddleware, async (req, res) => { const user = await db.collection('users').findOne({ id: req.user.id }); if (!user) return res.status(404).json({ error: 'Não encontrado' }); const { password, _id, ...safe } = user; res.json(safe); });

app.post('/api/admin/users/create', adminMiddleware, async (req, res) => { const { username, password, displayName, color, nameEffect } = req.body; if (!username || !password) return res.status(400).json({ error: 'Usuário e senha obrigatórios' }); const exists = await db.collection('users').findOne({ username: { $regex: new RegExp('^' + username + '$', 'i') } }); if (exists) return res.status(409).json({ error: 'Usuário já existe' }); const newUser = { id: uuidv4(), username, password, role: 'viewer', createdAt: new Date().toISOString(), profile: { displayName: displayName || username, color: color || '#a8f0b0', nameEffect: nameEffect || 'none', avatar: null, bio: '', badges: ['🎮'] } }; await db.collection('users').insertOne(newUser); const { password: _, _id, ...safe } = newUser; res.status(201).json({ message: 'Usuário criado!', user: safe }); });

app.get('/api/admin/users', adminMiddleware, async (req, res) => { const users = await db.collection('users').find({}).toArray(); res.json(users.map(({ password, _id, ...u }) => u)); });

app.delete('/api/admin/users/:id', adminMiddleware, async (req, res) => { const user = await db.collection('users').findOne({ id: req.params.id }); if (!user) return res.status(404).json({ error: 'Não encontrado' }); if (user.role === 'admin') return res.status(403).json({ error: 'Não pode deletar a admin!' }); await db.collection('users').deleteOne({ id: req.params.id }); res.json({ message: 'Removido' }); });

app.patch('/api/admin/users/:id', adminMiddleware, async (req, res) => { const { displayName, color, nameEffect, bio, badges, newPassword, role } = req.body; const update = {}; if (displayName) update['profile.displayName'] = displayName; if (color) update['profile.color'] = color; if (nameEffect) update['profile.nameEffect'] = nameEffect; if (bio !== undefined) update['profile.bio'] = bio; if (badges) update['profile.badges'] = badges; if (newPassword) update.password = newPassword; if (role) update.role = role; await db.collection('users').updateOne({ id: req.params.id }, { $set: update }); const user = await db.collection('users').findOne({ id: req.params.id }); const { password, _id, ...safe } = user; res.json(safe); });

app.patch('/api/profile', authMiddleware, async (req, res) => { const { bio, color, nameEffect } = req.body; const update = {}; if (bio !== undefined) update['profile.bio'] = bio; if (color) update['profile.color'] = color; if (nameEffect) update['profile.nameEffect'] = nameEffect; await db.collection('users').updateOne({ id: req.user.id }, { $set: update }); const user = await db.collection('users').findOne({ id: req.user.id }); const { password, _id, ...safe } = user; res.json(safe); });

app.post('/api/profile/avatar', authMiddleware, upload.single('avatar'), async (req, res) => { if (!req.file) return res.status(400).json({ error: 'Sem imagem' }); const avatarPath = '/avatars/' + req.file.filename; await db.collection('users').updateOne({ id: req.user.id }, { $set: { 'profile.avatar': avatarPath } }); res.json({ avatar: avatarPath }); });

app.get('/api/config', async (req, res) => { const config = await db.collection('config').findOne({ _id: 'main' }); const { _id, ...safe } = config; res.json(safe); });

app.patch('/api/admin/config', adminMiddleware, async (req, res) => { const allowed = ['status','currentGame','statusMessage','streamUrl','isLive']; const update = { lastUpdated: new Date().toISOString() }; allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; }); await db.collection('config').updateOne({ _id: 'main' }, { $set: update }); const config = await db.collection('config').findOne({ _id: 'main' }); const { _id, ...safe } = config; res.json({ message: 'Atualizado!', config: safe }); });

app.patch('/api/admin/config/games/:game', adminMiddleware, async (req, res) => { const { game } = req.params; const update = { lastUpdated: new Date().toISOString() }; Object.keys(req.body).forEach(k => { update[`games.${game}.${k}`] = req.body[k]; }); await db.collection('config').updateOne({ _id: 'main' }, { $set: update }); const config = await db.collection('config').findOne({ _id: 'main' }); res.json({ message: game + ' atualizado!', data: config.games[game] }); });

app.get('/api/posts', async (req, res) => { const token = req.headers.authorization?.split(' ')[1]; let isLoggedIn = false; try { jwt.verify(token, JWT_SECRET); isLoggedIn = true; } catch {} const query = isLoggedIn ? {} : { exclusive: false }; const posts = await db.collection('posts').find(query).sort({ createdAt: -1 }).toArray(); res.json(posts.map(({ _id, likedBy, ...p }) => p)); });

app.post('/api/admin/posts', adminMiddleware, async (req, res) => { const { title, content, game, emoji, exclusive } = req.body; if (!title || !content) return res.status(400).json({ error: 'Título e conteúdo obrigatórios' }); const post = { id: uuidv4(), title, content, game: game || 'Geral', emoji: emoji || '📝', exclusive: !!exclusive, likes: 0, likedBy: [], comments: [], createdAt: new Date().toISOString() }; await db.collection('posts').insertOne(post); res.status(201).json(post); });

app.delete('/api/admin/posts/:id', adminMiddleware, async (req, res) => { await db.collection('posts').deleteOne({ id: req.params.id }); res.json({ message: 'Deletado' }); });

app.post('/api/posts/:id/like', authMiddleware, async (req, res) => { const post = await db.collection('posts').findOne({ id: req.params.id }); if (!post) return res.status(404).json({ error: 'Não encontrado' }); const liked = (post.likedBy || []).includes(req.user.id); if (liked) { await db.collection('posts').updateOne({ id: req.params.id }, { $pull: { likedBy: req.user.id }, $inc: { likes: -1 } }); } else { await db.collection('posts').updateOne({ id: req.params.id }, { $push: { likedBy: req.user.id }, $inc: { likes: 1 } }); } const updated = await db.collection('posts').findOne({ id: req.params.id }); res.json({ likes: updated.likes, liked: !liked }); });

app.post('/api/posts/:id/comment', authMiddleware, async (req, res) => { const { text } = req.body; if (!text?.trim()) return res.status(400).json({ error: 'Comentário vazio' }); const user = await db.collection('users').findOne({ id: req.user.id }); const comment = { id: uuidv4(), userId: req.user.id, username: user.profile?.displayName || user.username, color: user.profile?.color, nameEffect: user.profile?.nameEffect, avatar: user.profile?.avatar, badges: user.profile?.badges, text: text.trim().substring(0, 500), createdAt: new Date().toISOString() }; await db.collection('posts').updateOne({ id: req.params.id }, { $push: { comments: comment } }); res.status(201).json(comment); });

app.delete('/api/posts/:postId/comment/:commentId', authMiddleware, async (req, res) => { const post = await db.collection('posts').findOne({ id: req.params.postId }); if (!post) return res.status(404).json({ error: 'Não encontrado' }); const comment = (post.comments || []).find(c => c.id === req.params.commentId); if (!comment) return res.status(404).json({ error: 'Comentário não encontrado' }); if (comment.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Não autorizado' }); await db.collection('posts').updateOne({ id: req.params.postId }, { $pull: { comments: { id: req.params.commentId } } }); res.json({ message: 'Removido' }); });

app.delete('/api/admin/redis/:key', adminMiddleware, async (req, res) => {
  const { key } = req.params;
  try {
    const deleted = await redisClient.del(key);
    if (deleted === 0) return res.status(404).json({ error: `Chave "${key}" não encontrada no Redis` });
    res.json({ message: `Chave "${key}" deletada com sucesso` });
  } catch (err) {
    console.error('Erro ao deletar chave Redis:', err);
    res.status(500).json({ error: 'Erro ao conectar ao Redis' });
  }
});

app.get('/api/schedule', async (req, res) => { const s = await db.collection('schedule').find({}).sort({ day: 1 }).toArray(); res.json(s.map(({ _id, ...x }) => x)); });

app.post('/api/admin/schedule', adminMiddleware, async (req, res) => { const { day, time, icon, name, desc, game } = req.body; await db.collection('schedule').insertOne({ day, time, icon: icon||'🎮', name, desc, game: game||'Geral' }); const s = await db.collection('schedule').find({}).sort({ day: 1 }).toArray(); res.status(201).json(s.map(({ _id, ...x }) => x)); });

app.delete('/api/admin/schedule/:day', adminMiddleware, async (req, res) => { await db.collection('schedule').deleteOne({ day: parseInt(req.params.day) }); res.json({ message: 'Removido' }); });

app.get('/delete-redis-key-a', async (req, res) => {
  try {
    const deleted = await redisClient.del('a');
    res.json({ success: true, deleted, message: `Chave "a" ${deleted ? 'deletada' : 'não encontrada'}` });
  } catch (err) {
    console.error('Erro:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.use((err, req, res, next) => { console.error(err.message); res.status(500).json({ error: err.message }); });

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`MIH.GG rodando em http://localhost:${PORT}`);
    console.log(`Login: Mih / 1234`);
  });
}).catch(err => {
  console.error('Erro MongoDB:', err.message);
  process.exit(1);
});
