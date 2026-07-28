require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;
const DATABASE_URL = process.env.DATABASE_URL;

app.use(express.json({ limit: '50mb' }));

let pool = null;

async function initDb() {
  if (!DATABASE_URL) {
    console.log('[wizard-server] No DATABASE_URL — using filesystem fallback');
    return;
  }
  console.log('[wizard-server] Connecting to Neon Postgres...');
  pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_samples (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      features JSONB NOT NULL,
      labels JSONB NOT NULL,
      timestamp BIGINT NOT NULL,
      game_round INTEGER NOT NULL,
      is_human BOOLEAN NOT NULL,
      player_index INTEGER,
      reward REAL,
      trick_index INTEGER,
      tricks_won_before INTEGER,
      hand_card_ids JSONB,
      trick_card_ids JSONB
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL
    )
  `);
  console.log('[wizard-server] Connected to Postgres');
}

// --- Filesystem fallback (for local dev without DATABASE_URL) ---

const DATA_DIR = path.join(__dirname, 'data');
const TRAINING_FILE = path.join(DATA_DIR, 'training-data.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readTrainingDataFs() {
  try {
    if (!fs.existsSync(TRAINING_FILE)) return { bidSamples: [], playSamples: [], totalGamesPlayed: 0 };
    return JSON.parse(fs.readFileSync(TRAINING_FILE, 'utf-8'));
  } catch { return { bidSamples: [], playSamples: [], totalGamesPlayed: 0 }; }
}

function readModelFs(name) {
  const f = path.join(DATA_DIR, 'models', name + '.json');
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf-8'));
}

function writeModelFs(name, data) {
  ensureDataDir();
  const dir = path.join(DATA_DIR, 'models');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, name + '.json');
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmp, f);
}

// --- KV helpers for Postgres ---

async function kvGet(key) {
  const res = await pool.query('SELECT value FROM kv_store WHERE key = $1', [key]);
  return res.rows.length ? res.rows[0].value : null;
}

async function kvSet(key, value) {
  await pool.query(
    'INSERT INTO kv_store (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
    [key, value]
  );
}

// --- Per-sample training data endpoints ---

function runQuery(sql, params) {
  return pool ? pool.query(sql, params) : Promise.resolve({ rows: [] });
}

app.post('/api/training-samples', async (req, res) => {
  const mode = pool ? 'neon' : 'filesystem';
  try {
    if (mode === 'filesystem') {
      const store = readTrainingDataFs();
      for (const s of req.body.samples || []) {
        if (s.type === 'bid') store.bidSamples.push(s);
        else store.playSamples.push(s);
        // Prune
        if (store.bidSamples.length > 2000) store.bidSamples = store.bidSamples.slice(-2000);
        if (store.playSamples.length > 5000) store.playSamples = store.playSamples.slice(-5000);
      }
      const tmp = TRAINING_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8');
      fs.renameSync(tmp, TRAINING_FILE);
    } else {
      const samples = req.body.samples || [];
      for (const s of samples) {
        await runQuery(
          `INSERT INTO training_samples (id, type, features, labels, timestamp, game_round, is_human, player_index, reward, trick_index, tricks_won_before, hand_card_ids, trick_card_ids)
           VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb)
           ON CONFLICT (id) DO NOTHING`,
          [s.id, s.type, JSON.stringify(s.features), JSON.stringify(s.labels), s.timestamp, s.gameRound, s.isHuman, s.playerIndex ?? null, s.reward ?? null, s.trickIndex ?? null, s.tricksWonBefore ?? null, JSON.stringify(s.handCardIds ?? null), JSON.stringify(s.trickCardIds ?? null)]
        );
      }
      console.log(`[POST /api/training-samples] mode=neon submitted ${samples.length} samples`);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(`[POST /api/training-samples] ERROR: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/training-samples', async (req, res) => {
  const mode = pool ? 'neon' : 'filesystem';
  try {
    if (mode === 'filesystem') {
      const store = readTrainingDataFs();
      res.json({ samples: [...store.bidSamples, ...store.playSamples] });
    } else {
      const result = await runQuery('SELECT * FROM training_samples ORDER BY timestamp ASC');
      const samples = result.rows.map(r => ({
        id: r.id,
        type: r.type,
        features: r.features,
        labels: r.labels,
        timestamp: r.timestamp,
        gameRound: r.game_round,
        isHuman: r.is_human,
        playerIndex: r.player_index,
        reward: r.reward,
        trickIndex: r.trick_index,
        tricksWonBefore: r.tricks_won_before,
        handCardIds: r.hand_card_ids,
        trickCardIds: r.trick_card_ids,
      }));
      console.log(`[GET /api/training-samples] mode=neon returned ${samples.length} samples`);
      res.json({ samples });
    }
  } catch (e) {
    console.error(`[GET /api/training-samples] ERROR: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/training-stats', async (req, res) => {
  const mode = pool ? 'neon' : 'filesystem';
  try {
    if (mode === 'filesystem') {
      const store = readTrainingDataFs();
      res.json({ bid: store.bidSamples.length, play: store.playSamples.length });
    } else {
      const result = await runQuery("SELECT type, COUNT(*)::int as count FROM training_samples GROUP BY type");
      const stats = { bid: 0, play: 0 };
      for (const r of result.rows) stats[r.type] = r.count;
      res.json(stats);
    }
  } catch (e) {
    console.error(`[GET /api/training-stats] ERROR: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/training-samples', async (req, res) => {
  const mode = pool ? 'neon' : 'filesystem';
  try {
    if (mode === 'filesystem') {
      const empty = { bidSamples: [], playSamples: [], totalGamesPlayed: 0 };
      const tmp = TRAINING_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(empty, null, 2), 'utf-8');
      fs.renameSync(tmp, TRAINING_FILE);
      const modelsDir = path.join(DATA_DIR, 'models');
      if (fs.existsSync(modelsDir)) {
        for (const f of fs.readdirSync(modelsDir)) fs.unlinkSync(path.join(modelsDir, f));
        fs.rmdirSync(modelsDir);
      }
    } else {
      await runQuery('DELETE FROM training_samples');
      await runQuery('DELETE FROM kv_store WHERE key LIKE $1', ['model:%']);
    }
    console.log(`[DELETE /api/training-samples] mode=${mode} cleared`);
    res.json({ ok: true });
  } catch (e) {
    console.error(`[DELETE /api/training-samples] ERROR: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// --- Model endpoints ---

app.get('/api/models/:name', async (req, res) => {
  const mode = pool ? 'neon' : 'filesystem';
  try {
    if (pool) {
      const data = await kvGet('model:' + req.params.name);
      console.log(`[GET /api/models/${req.params.name}] mode=neon found=${!!data}`);
      if (!data) return res.status(404).json({ error: 'model not found' });
      res.json(data);
    } else {
      const data = readModelFs(req.params.name);
      console.log(`[GET /api/models/${req.params.name}] mode=filesystem found=${!!data}`);
      if (!data) return res.status(404).json({ error: 'model not found' });
      res.json(data);
    }
  } catch (e) {
    console.error(`[GET /api/models/${req.params.name}] ERROR: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/models/:name', async (req, res) => {
  const mode = pool ? 'neon' : 'filesystem';
  try {
    const size = JSON.stringify(req.body).length;
    if (pool) {
      await kvSet('model:' + req.params.name, req.body);
    } else {
      writeModelFs(req.params.name, req.body);
    }
    console.log(`[POST /api/models/${req.params.name}] mode=${mode} saved ${size} bytes`);
    res.json({ ok: true });
  } catch (e) {
    console.error(`[POST /api/models/${req.params.name}] ERROR: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

// --- Static file serving for production ---

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));

  app.get('{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

// --- Start ---

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`[wizard-server] listening on http://localhost:${PORT} | storage: ${pool ? 'neon' : 'filesystem'}`);
  });
}).catch(e => {
  console.error('[wizard-server] Failed to connect to database:', e.message);
  console.error('[wizard-server] Starting with filesystem fallback');
  app.listen(PORT, () => {
    console.log(`[wizard-server] listening on http://localhost:${PORT} | storage: filesystem (db error)`);
  });
});
