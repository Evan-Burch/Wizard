const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const DATA_DIR = path.join(__dirname, 'data');
const TRAINING_FILE = path.join(DATA_DIR, 'training-data.json');

app.use(express.json({ limit: '50mb' }));

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readTrainingData() {
  try {
    if (!fs.existsSync(TRAINING_FILE)) {
      return { bidSamples: [], playSamples: [], totalGamesPlayed: 0 };
    }
    return JSON.parse(fs.readFileSync(TRAINING_FILE, 'utf-8'));
  } catch {
    return { bidSamples: [], playSamples: [], totalGamesPlayed: 0 };
  }
}

function writeTrainingData(data) {
  ensureDataDir();
  const tmp = TRAINING_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmp, TRAINING_FILE);
}

// Training data
app.get('/api/training-data', (req, res) => {
  res.json(readTrainingData());
});

app.post('/api/training-data', (req, res) => {
  try {
    writeTrainingData(req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Model storage (IndexedDB replacement — not currently used, reserved for future)
app.get('/api/models/:name', (req, res) => {
  const modelDir = path.join(DATA_DIR, 'models', req.params.name);
  const metaPath = path.join(modelDir, 'model.json');
  if (!fs.existsSync(metaPath)) {
    return res.status(404).json({ error: 'model not found' });
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  const weightsPath = path.join(modelDir, 'model.weights.bin');
  if (fs.existsSync(weightsPath)) {
    meta.weightsManifest[0].paths = [`${req.params.name}/model.weights.bin`];
  }
  res.json(meta);
});

app.post('/api/models/:name', (req, res) => {
  try {
    const modelDir = path.join(DATA_DIR, 'models', req.params.name);
    ensureDataDir();
    fs.mkdirSync(modelDir, { recursive: true });

    const { topology, weights } = req.body;
    fs.writeFileSync(path.join(modelDir, 'model.json'), JSON.stringify(topology), 'utf-8');
    if (weights) {
      const buf = Buffer.from(weights, 'base64');
      fs.writeFileSync(path.join(modelDir, 'model.weights.bin'), buf);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`[wizard-server] listening on http://localhost:${PORT}`);
});
