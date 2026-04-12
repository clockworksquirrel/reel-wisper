import 'dotenv/config';
import express from 'express';
import { handleCatalog } from './catalog.js';
import { handleMeta } from './meta.js';
import { encryptConfig, decryptConfig } from './config.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '4000', 10);

// ─── Manifest ────────────────────────────────────────────────────────────────

function buildManifest(config) {
  return {
    id: 'dev.reelwisper.ai',
    version: '1.0.0',
    name: 'ReeL Wisper',
    description: 'AI-powered natural language movie & TV discovery. Describe what you want to watch and let AI find it.',
    logo: 'https://i.imgur.com/placeholder.png', // TODO: real logo
    catalogs: [
      {
        type: 'movie',
        id: 'reelwhisper-movies',
        name: 'ReeL Wisper',
        extra: [{ name: 'search', isRequired: true }],
      },
      {
        type: 'series',
        id: 'reelwhisper-series',
        name: 'ReeL Wisper',
        extra: [{ name: 'search', isRequired: true }],
      },
    ],
    resources: ['catalog', 'meta'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    behaviorHints: { configurable: false, configurationRequired: false },
  };
}

// ─── Express Server (handles config routes + addon) ──────────────────────────

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, '..', 'public')));

// CORS for Stremio
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// ─── Health / Diagnostics ────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    env: {
      TMDB_API_KEY: process.env.TMDB_API_KEY ? 'set' : 'MISSING',
      TVDB_API_KEY: process.env.TVDB_API_KEY ? 'set' : 'MISSING',
      CONFIG_SECRET: process.env.CONFIG_SECRET ? 'set' : 'MISSING (using default)',
      PORT: process.env.PORT || '4000',
    },
  });
});

// ─── Configure Page ──────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '..', 'public', 'configure.html'));
});

app.get('/configure', (req, res) => {
  res.sendFile(join(__dirname, '..', 'public', 'configure.html'));
});

// Generate manifest URL from config
app.post('/configure', (req, res) => {
  const { backend, apiKey, baseUrl, model } = req.body;

  const config = {
    backend: backend || 'openai',
    apiKey: apiKey || '',
    baseUrl: baseUrl || 'https://api.openai.com/v1',
    model: model || 'gpt-4o-mini',
  };

  const token = encryptConfig(config);
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const manifestUrl = `${proto}://${host}/${token}/manifest.json`;

  res.json({ manifestUrl, stremioUrl: `stremio://${host}/${token}/manifest.json` });
});

// ─── Per-Config Addon Routes ─────────────────────────────────────────────────

// Manifest
app.get('/:config/manifest.json', (req, res) => {
  try {
    const config = decryptConfig(req.params.config);
    res.json(buildManifest(config));
  } catch (e) {
    res.status(400).json({ error: 'Invalid configuration' });
  }
});

// Catalog handler — Stremio sends: /:config/catalog/:type/:id/search=query.json
// We use a catch-all and parse the path ourselves since Express 5 path-to-regexp is strict.
app.get('/:config/catalog/:type/*', async (req, res) => {
  try {
    const config = decryptConfig(req.params.config);
    const extra = {};

    // The wildcard captures everything after /catalog/:type/
    // e.g., "reelwhisper-search/search=movie about robots.json" or "reelwhisper-search.json"
    const tail = req.params[0] || '';

    // Split into catalog id and extra params
    const slashIdx = tail.indexOf('/');
    let catalogId, extraStr;
    if (slashIdx === -1) {
      catalogId = tail.replace(/\.json$/, '');
      extraStr = '';
    } else {
      catalogId = tail.slice(0, slashIdx);
      extraStr = tail.slice(slashIdx + 1).replace(/\.json$/, '');
    }

    // Parse extra params (e.g., "search=movie about robots&genre=Action")
    if (extraStr) {
      for (const part of extraStr.split('&')) {
        const eqIdx = part.indexOf('=');
        if (eqIdx === -1) continue;
        const key = part.slice(0, eqIdx);
        const val = decodeURIComponent(part.slice(eqIdx + 1));
        extra[key] = val;
      }
    }

    const args = { type: req.params.type, id: catalogId, extra };

    if (!extra.search) {
      return res.json({ metas: [] });
    }

    console.log(`[ReeL Wisper] Catalog search: "${extra.search}" type=${args.type}`);
    const result = await handleCatalog(args, config);
    console.log(`[ReeL Wisper] Found ${result.metas.length} results`);

    res.json(result);
  } catch (e) {
    console.error('[ReeL Wisper] Catalog error:', e);
    res.json({ metas: [] });
  }
});

// Meta handler
app.get('/:config/meta/:type/:id.json', async (req, res) => {
  try {
    const args = { type: req.params.type, id: req.params.id };
    const result = await handleMeta(args);
    res.json(result);
  } catch (e) {
    console.error('[ReeL Wisper] Meta error:', e);
    res.json({ meta: null });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🎬 ReeL Wisper running on http://localhost:${PORT}`);
  console.log(`   Configure: http://localhost:${PORT}/configure\n`);
});
