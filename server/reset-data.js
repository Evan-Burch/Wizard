const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

async function resetPostgres() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pool.query('DELETE FROM kv_store');
  console.log('  Cleared all rows from kv_store');
  await pool.end();
}

function resetFilesystem() {
  const dataDir = path.join(__dirname, 'data');
  const trainingFile = path.join(dataDir, 'training-data.json');
  const modelsDir = path.join(dataDir, 'models');

  if (fs.existsSync(trainingFile)) {
    fs.writeFileSync(trainingFile, JSON.stringify({ bidSamples: [], playSamples: [], totalGamesPlayed: 0 }, null, 2));
    console.log(`  Cleared: ${path.relative(__dirname, trainingFile)}`);
  }

  if (fs.existsSync(modelsDir)) {
    for (const f of fs.readdirSync(modelsDir)) fs.unlinkSync(path.join(modelsDir, f));
    fs.rmdirSync(modelsDir);
    console.log(`  Removed: ${path.relative(__dirname, modelsDir)}/`);
  }
}

async function main() {
  console.log('Resetting training data...\n');

  if (DATABASE_URL) {
    console.log('  Mode: Postgres');
    await resetPostgres();
  } else {
    console.log('  Mode: filesystem');
    resetFilesystem();
  }

  console.log('\nDone. All training data and models erased.');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
