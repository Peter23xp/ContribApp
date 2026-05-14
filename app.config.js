const path = require('path');
const fs = require('fs');

// Charge .env.development ou .env.production selon APP_ENV, sinon .env
const APP_ENV = process.env.APP_ENV ?? 'development';
const envFile = `.env.${APP_ENV}`;
const envPath = path.resolve(__dirname, envFile);

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    // Ne pas écraser les variables déjà définies dans l'environnement shell
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
  console.log(`[app.config.js] Environnement chargé : ${envFile}`);
} else {
  console.warn(`[app.config.js] Fichier non trouvé : ${envFile}`);
}

// Charge app.json de base
const appJson = require('./app.json');

module.exports = {
  ...appJson.expo,
  extra: {
    ...appJson.expo.extra,
    eas: {
      projectId: '60e46d56-c68e-4a44-a6b8-5a72fac2ec83',
    },
  },
};
