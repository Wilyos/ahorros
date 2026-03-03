const express = require('express');
const path = require('path');
const { getProfile, saveProfile } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

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
  res.json({ ok: true });
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

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Ahorros app corriendo en http://localhost:${PORT}`);
});
