const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const trainingFile = path.join(dataDir, 'training-data.json');
const modelFiles = [
  path.join(dataDir, 'models', 'bidding.json'),
  path.join(dataDir, 'models', 'cardplay.json'),
  path.join(dataDir, 'models', 'meta.json'),
];

const emptyData = {
  bidSamples: [],
  playSamples: [],
  totalGamesPlayed: 0,
};

console.log('Resetting training data...\n');

// Reset training data file
if (fs.existsSync(trainingFile)) {
  fs.writeFileSync(trainingFile, JSON.stringify(emptyData, null, 2));
  console.log(`  Cleared: ${path.relative(__dirname, trainingFile)}`);
} else {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(trainingFile, JSON.stringify(emptyData, null, 2));
  console.log(`  Created: ${path.relative(__dirname, trainingFile)}`);
}

// Remove model files
for (const file of modelFiles) {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`  Deleted: ${path.relative(__dirname, file)}`);
  }
}

// Remove models directory if empty
const modelsDir = path.join(dataDir, 'models');
if (fs.existsSync(modelsDir) && fs.readdirSync(modelsDir).length === 0) {
  fs.rmdirSync(modelsDir);
  console.log(`  Removed: ${path.relative(__dirname, modelsDir)}/`);
}

console.log('\nDone. All training data and models erased.');
console.log('No browser storage is used — all data is server-side only.');
