const express = require('express');
const path = require('path');
const { getProfile, saveProfile } = require('./db');

console.log('[SERVER] Inicializando servidor...');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const INDEX_PATH = path.join(PUBLIC_DIR, 'index.html');

console.log(`[SERVER] Puerto: ${PORT}`);
console.log(`[SERVER] Entorno: ${process.env.NODE_ENV || 'development'}`);
console.log(`[SERVER] Sirviendo archivos estáticos desde: ${PUBLIC_DIR}`);

app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.originalUrl}`);
  next();
});

app.use((req, res, next) => {
  const noCachePaths = req.path === '/' || req.path === '/index.html' || req.path.endsWith('.js') || req.path.endsWith('.css');
  if (noCachePaths) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
  }
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC_DIR, {
  maxAge: 0,
  etag: false
}));

function buildDefaultData() {
  const monthlyActuals = Array.from({ length: 12 }, () => 0);
  const scenarioChecks = [];
  const scenarioLocked = [];

  return {
    profileName: '',
    initialAmount: 500,
    monthlySaving: 500,
    desiredTargetAmount: 6500,
    projectionStepAmount: 500,
    maxMonthlySavingCap: 200000,
    targetMonths: 12,
    configLocked: false,
    scenarioChecks,
    scenarioLocked,
    monthlyActuals
  };
}

function normalizePayload(payload) {
  const monthlyActuals = Array.isArray(payload.monthlyActuals) ? payload.monthlyActuals : [];
  const scenarioChecks = Array.isArray(payload.scenarioChecks) ? payload.scenarioChecks : [];
  const scenarioLocked = Array.isArray(payload.scenarioLocked) ? payload.scenarioLocked : [];
  
  const normalizedMonthlyActuals = Array.from({ length: 12 }, (_, idx) => {
    const value = Number(monthlyActuals[idx] || 0);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  });
  
  // Normalizar matrices de escenarios
  const normalizedScenarioChecks = scenarioChecks.map((row) => {
    if (!Array.isArray(row)) return Array.from({ length: 12 }, () => false);
    return Array.from({ length: 12 }, (_, idx) => Boolean(row[idx]));
  });
  
  const normalizedScenarioLocked = scenarioLocked.map((row) => {
    if (!Array.isArray(row)) return Array.from({ length: 12 }, () => false);
    return Array.from({ length: 12 }, (_, idx) => Boolean(row[idx]));
  });

  const numeric = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const monthlySaving = Math.max(
    0,
    numeric(payload.monthlySaving, numeric(payload.minMonthlySaving, 500))
  );
  const maxMonthlySavingCap = Math.max(100, numeric(payload.maxMonthlySavingCap, 200000));
  const normalizedMonthlySaving = Math.min(monthlySaving, maxMonthlySavingCap);
  const initialAmount = Math.max(0, numeric(payload.initialAmount, 500));
  const defaultDesiredTargetAmount = initialAmount + normalizedMonthlySaving * 12;
  const desiredTargetAmount = Math.max(
    0,
    numeric(payload.desiredTargetAmount, defaultDesiredTargetAmount)
  );
  const projectionStepAmount = Math.max(100, numeric(payload.projectionStepAmount, 500));
  const targetMonths = Math.min(12, Math.max(1, Math.floor(numeric(payload.targetMonths, 12))));
  const configLocked = Boolean(payload.configLocked);

  return {
    profileName: String(payload.profileName || '').trim(),
    initialAmount,
    monthlySaving: normalizedMonthlySaving,
    desiredTargetAmount,
    projectionStepAmount,
    maxMonthlySavingCap,
    targetMonths,
    configLocked,
    scenarioChecks: normalizedScenarioChecks,
    scenarioLocked: normalizedScenarioLocked,
    monthlyActuals: normalizedMonthlyActuals
  };
}

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
});

// Health check adicional en raíz (algunos orquestadores lo buscan aquí)
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

app.get('/', (_req, res, next) => {
  res.sendFile(INDEX_PATH, { maxAge: 0 }, (err) => {
    if (err) {
      console.error('[SERVER] Error sirviendo /:', err.message);
      next(err);
    }
  });
});

app.get('/api/profile/:key', (req, res) => {
  const key = String(req.params.key || '').trim();

  if (!key) {
    return res.status(400).json({ error: 'Perfil inválido.' });
  }

  const saved = getProfile(key);

  if (!saved) {
    const defaultData = buildDefaultData();
    return res.json({ data: defaultData, updatedAt: null });
  }

  return res.json(saved);
});

app.put('/api/profile/:key', (req, res) => {
  const key = String(req.params.key || '').trim();

  if (!key) {
    return res.status(400).json({ error: 'Perfil inválido.' });
  }

  const existing = getProfile(key);
  const normalized = normalizePayload(req.body || {});

  if (existing && existing.data && existing.data.configLocked) {
    const lockedMonthlySaving = Number(existing.data.monthlySaving) || 0;
    const existingCap = Number(existing.data.maxMonthlySavingCap) || 200000;
    normalized.monthlySaving = Math.min(lockedMonthlySaving, existingCap);
    normalized.maxMonthlySavingCap = Math.max(100, existingCap);
    normalized.configLocked = true;
  } else {
    normalized.configLocked = true;
  }

  // Preservar locks de escenarios existentes
  const existingScenarioLocked = Array.isArray(existing?.data?.scenarioLocked)
    ? existing.data.scenarioLocked
    : [];

  // Asegurar que la matriz scenarioLocked tenga el tamaño correcto
  while (normalized.scenarioLocked.length < normalized.scenarioChecks.length) {
    normalized.scenarioLocked.push(Array.from({ length: 12 }, () => false));
  }

  // Preservar locks existentes y bloquear checks marcados
  normalized.scenarioChecks.forEach((row, scenarioIdx) => {
    row.forEach((checked, monthIdx) => {
      // Si ya estaba bloqueado, mantener el lock
      if (existingScenarioLocked[scenarioIdx]?.[monthIdx]) {
        normalized.scenarioLocked[scenarioIdx][monthIdx] = true;
      }
      // Si está marcado en este save, bloquearlo
      else if (checked) {
        normalized.scenarioLocked[scenarioIdx][monthIdx] = true;
      }
    });
  });

  const result = saveProfile(key, normalized);

  return res.json({ ok: true, updatedAt: result.updatedAt });
});

// Manejador catch-all para SPA - sirve index.html
app.use((_req, res, next) => {
  res.sendFile(INDEX_PATH, { maxAge: 0 }, (err) => {
    if (err) {
      console.error('[SERVER] Error sirviendo index.html:', err.message);
      next(err);
    }
  });
});

app.use((err, _req, res, _next) => {
  console.error('[SERVER] Error no manejado en request:', err?.message || err);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: 'Error interno del servidor' });
});

const HOST = '0.0.0.0'; // Escuchar en todas las interfaces (necesario para Railway)
const server = app.listen(PORT, HOST, () => {
  console.log(`Ahorros app corriendo en http://${HOST}:${PORT}`);
  // Dar tiempo a que el servidor esté completamente listo
  setTimeout(() => {
    console.log('[SERVER] ✓ Servidor listo para recibir requests');
  }, 100);
});

// Configurar timeouts del servidor
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido, cerrando servidor...');
  server.close(() => {
    console.log('Servidor cerrado.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT recibido, cerrando servidor...');
  server.close(() => {
    console.log('Servidor cerrado.');
    process.exit(0);
  });
});

// Capturar errores no manejados
process.on('uncaughtException', (err) => {
  console.error('Excepción no capturada:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Promise rechazada sin manejar:', reason);
});
