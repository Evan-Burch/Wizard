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
  pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
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

function writeTrainingDataFs(data) {
  ensureDataDir();
  const tmp = TRAINING_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, TRAINING_FILE);
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

function deleteAllFs() {
  writeTrainingDataFs({ bidSamples: [], playSamples: [], totalGamesPlayed: 0 });
  const dir = path.join(DATA_DIR, 'models');
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
    fs.rmdirSync(dir);
  }
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

async function kvDeleteAll() {
  await pool.query('DELETE FROM kv_store');
}

// --- Training data endpoints ---

app.get('/api/training-data', async (req, res) => {
  try {
    if (pool) {
      const data = await kvGet('training-data');
      res.json(data || { bidSamples: [], playSamples: [], totalGamesPlayed: 0 });
    } else {
      res.json(readTrainingDataFs());
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/training-data', async (req, res) => {
  try {
    if (pool) {
      await kvSet('training-data', req.body);
    } else {
      writeTrainingDataFs(req.body);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/training-data', async (req, res) => {
  try {
    if (pool) {
      await kvDeleteAll();
    } else {
      deleteAllFs();
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Model endpoints ---

app.get('/api/models/:name', async (req, res) => {
  try {
    if (pool) {
      const data = await kvGet('model:' + req.params.name);
      if (!data) return res.status(404).json({ error: 'model not found' });
      res.json(data);
    } else {
      const data = readModelFs(req.params.name);
      if (!data) return res.status(404).json({ error: 'model not found' });
      res.json(data);
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/models/:name', async (req, res) => {
  try {
    if (pool) {
      await kvSet('model:' + req.params.name, req.body);
    } else {
      writeModelFs(req.params.name, req.body);
    }
    res.json({ ok: true });
  } catch (e) {
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
    console.log(`[wizard-server] listening on http://localhost:${PORT}`);
  });
}).catch(e => {
  console.error('[wizard-server] Failed to connect to database:', e.message);
  console.error('[wizard-server] Starting with filesystem fallback');
  app.listen(PORT, () => {
    console.log(`[wizard-server] listening on http://localhost:${PORT} (filesystem mode)`);
  });
});
