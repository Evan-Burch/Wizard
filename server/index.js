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
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
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

app.delete('/api/training-data', (req, res) => {
  try {
    const empty = { bidSamples: [], playSamples: [], totalGamesPlayed: 0 };
    writeTrainingData(empty);

    const modelsDir = path.join(DATA_DIR, 'models');
    if (fs.existsSync(modelsDir)) {
      for (const f of fs.readdirSync(modelsDir)) {
        fs.unlinkSync(path.join(modelsDir, f));
      }
      fs.rmdirSync(modelsDir);
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Model storage
app.get('/api/models/:name', (req, res) => {
  const modelFile = path.join(DATA_DIR, 'models', req.params.name + '.json');
  if (!fs.existsSync(modelFile)) {
    return res.status(404).json({ error: 'model not found' });
  }
  res.json(JSON.parse(fs.readFileSync(modelFile, 'utf-8')));
});

app.post('/api/models/:name', (req, res) => {
  try {
    const modelsDir = path.join(DATA_DIR, 'models');
    ensureDataDir();
    fs.mkdirSync(modelsDir, { recursive: true });

    const modelFile = path.join(modelsDir, req.params.name + '.json');
    const tmp = modelFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(req.body), 'utf-8');
    fs.renameSync(tmp, modelFile);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`[wizard-server] listening on http://localhost:${PORT}`);
});
