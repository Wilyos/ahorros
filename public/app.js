const state = {
  key: '',
  profileName: '',
  initialAmount: 500,
  monthlySaving: 500,
  desiredTargetAmount: 6500,
  projectionStepAmount: 500,
  maxMonthlySavingCap: 200000,
  targetMonths: 12,
  configLocked: false,
  scenarioChecks: [], // Matriz: cada fila es un escenario con 12 checks
  scenarioLocked: [], // Matriz: cada fila es un escenario con 12 locks
  monthlyActuals: Array.from({ length: 12 }, () => 0)
};

const els = {
  profileKey: document.getElementById('profileKey'),
  profileName: document.getElementById('profileName'),
  initialAmount: document.getElementById('initialAmount'),
  monthlySaving: document.getElementById('monthlySaving'),
  desiredTargetAmount: document.getElementById('desiredTargetAmount'),
  projectionStepAmount: document.getElementById('projectionStepAmount'),
  maxMonthlySavingCap: document.getElementById('maxMonthlySavingCap'),
  projectionTable: document.getElementById('projectionTable'),
  projectionNote: document.getElementById('projectionNote'),
  actualInputs: document.getElementById('actualInputs'),
  summary: document.getElementById('summary'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  status: document.getElementById('status'),
  loadBtn: document.getElementById('loadBtn'),
  newBtn: document.getElementById('newBtn'),
  saveBtn: document.getElementById('saveBtn')
};

function getDefaultState() {
  return {
    key: '',
    profileName: '',
    initialAmount: 500,
    monthlySaving: 500,
    desiredTargetAmount: 6500,
    projectionStepAmount: 500,
    maxMonthlySavingCap: 200000,
    targetMonths: 12,
    configLocked: false,
    scenarioChecks: [],
    scenarioLocked: [],
    monthlyActuals: Array.from({ length: 12 }, () => 0)
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(value || 0);
}

function sanitizeNumber(value, fallback = 0, min = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, parsed);
}

function normalizeMonthlyArrays() {
  // Asegurar que scenarioChecks y scenarioLocked sean matrices válidas
  if (!Array.isArray(state.scenarioChecks)) {
    state.scenarioChecks = [];
  }
  if (!Array.isArray(state.scenarioLocked)) {
    state.scenarioLocked = [];
  }
  if (!Array.isArray(state.monthlyActuals)) {
    state.monthlyActuals = Array.from({ length: 12 }, () => 0);
  }

  // Normalizar cada fila de la matriz
  state.scenarioChecks = state.scenarioChecks.map((row) => {
    if (!Array.isArray(row)) return Array.from({ length: 12 }, () => false);
    return Array.from({ length: 12 }, (_, idx) => Boolean(row[idx]));
  });

  state.scenarioLocked = state.scenarioLocked.map((row) => {
    if (!Array.isArray(row)) return Array.from({ length: 12 }, () => false);
    return Array.from({ length: 12 }, (_, idx) => Boolean(row[idx]));
  });

  state.monthlyActuals = Array.from({ length: 12 }, (_, idx) => sanitizeNumber(state.monthlyActuals[idx], 0));
}

function recalculateMonthlyActualsFromChecks() {
  // Obtener scenarios actuales para tener los montos mensuales
  const projectionData = getProjectionScenarios();
  const scenarios = projectionData.scenarios;

  // Asegurar que las matrices de checks tienen el tamaño correcto
  while (state.scenarioChecks.length < scenarios.length) {
    state.scenarioChecks.push(Array.from({ length: 12 }, () => false));
  }
  while (state.scenarioLocked.length < scenarios.length) {
    state.scenarioLocked.push(Array.from({ length: 12 }, () => false));
  }

  // Calcular monthlyActuals: para cada mes, sumar los montos de todos los escenarios que tienen check marcado
  state.monthlyActuals = Array.from({ length: 12 }, (_, monthIdx) => {
    let monthTotal = 0;

    scenarios.forEach((scenario, scenarioIdx) => {
      const isChecked = state.scenarioChecks[scenarioIdx]?.[monthIdx] || false;
      const isLocked = state.scenarioLocked[scenarioIdx]?.[monthIdx] || false;

      if (isChecked || isLocked) {
        // Si está marcado o bloqueado, sumar el monto mensual de este escenario
        monthTotal += scenario.monthlySaving;
      }
    });

    return monthTotal;
  });
}

function getMaxCapValue() {
  return sanitizeNumber(state.maxMonthlySavingCap, 200000, 100);
}

function getEffectiveMonthlySaving() {
  const maxCap = getMaxCapValue();
  const saving = sanitizeNumber(state.monthlySaving, 500, 0);
  return Math.min(saving, maxCap);
}

function getProjectionScenarios() {
  const maxCap = getMaxCapValue();
  const baseMonthlySaving = sanitizeNumber(state.monthlySaving, 500, 0);
  const stepAmount = sanitizeNumber(state.projectionStepAmount, 500, 100);
  const scenarios = [];

  // Generar TODOS los incrementos desde base hasta máximo
  let currentMonthlySaving = baseMonthlySaving;
  while (currentMonthlySaving <= maxCap) {
    const monthlySavingToUse = Math.min(currentMonthlySaving, maxCap);
    const values = projectedByMonth(monthlySavingToUse);
    scenarios.push({
      monthlySaving: monthlySavingToUse,
      values
    });

    currentMonthlySaving += stepAmount;
  }

  return {
    scenarios,
    maxCap,
    stepAmount,
    baseMonthlySaving
  };
}

function projectedByMonth(monthlySaving) {
  const values = [];
  for (let month = 1; month <= 12; month += 1) {
    values.push(state.initialAmount + monthlySaving * month);
  }
  return values;
}

function renderProjectionTable() {
  const projectionData = getProjectionScenarios();
  const scenarios = projectionData.scenarios;

  // Asegurar que las matrices de checks tienen el tamaño correcto
  while (state.scenarioChecks.length < scenarios.length) {
    state.scenarioChecks.push(Array.from({ length: 12 }, () => false));
  }
  while (state.scenarioLocked.length < scenarios.length) {
    state.scenarioLocked.push(Array.from({ length: 12 }, () => false));
  }

  // Construir tabla: FILAS = Incrementos | COLUMNAS = Aboños con valores acumulativos
  let tableHtml = '<thead><tr><th>Incremento/Abono</th>';
  tableHtml += Array.from({ length: 12 }, (_, i) => `<th>Abono ${i + 1}</th>`).join('');
  tableHtml += '</tr></thead><tbody>';

  // Para cada monto (escenario), mostrar valores acumulativos para cada aboño
  scenarios.forEach((scenario, scenarioIdx) => {
    const monthlyLabel = scenarioIdx === 0 
      ? `${formatCurrency(scenario.monthlySaving)} (base)` 
      : formatCurrency(scenario.monthlySaving);
    
    tableHtml += `<tr><td class="scenario-label">${monthlyLabel}</td>`;
    
    for (let monthIdx = 0; monthIdx < 12; monthIdx++) {
      const checked = Boolean(state.scenarioChecks[scenarioIdx]?.[monthIdx]);
      const locked = Boolean(state.scenarioLocked[scenarioIdx]?.[monthIdx]);
      const checkboxId = `check_${scenarioIdx}_${monthIdx}`;
      
      // Valor ACUMULADO: monto mensual × (numero de aboños incluyendo este)
      const accumulatedValue = scenario.monthlySaving * (monthIdx + 1) + state.initialAmount;
      
      tableHtml += `
        <td class="projection-check-cell">
          <label class="projection-check-label">
            <input 
              id="${checkboxId}"
              type="checkbox"
              data-scenario-idx="${scenarioIdx}" 
              data-month-idx="${monthIdx}" 
              ${checked ? 'checked' : ''} 
              ${locked ? 'disabled' : ''} 
            />
            <span class="radio-value">${formatCurrency(accumulatedValue)}</span>
            <span class="lock-indicator">${locked ? '🔒' : ''}</span>
          </label>
        </td>
      `;
    }
    tableHtml += '</tr>';
  });

  tableHtml += '</tbody>';
  els.projectionTable.innerHTML = tableHtml;

  // Mensaje sobre la configuración
  const msgText = `Generando incrementos de ${formatCurrency(projectionData.stepAmount)} desde ${formatCurrency(projectionData.baseMonthlySaving)} hasta ${formatCurrency(projectionData.maxCap)}.`;
  els.projectionNote.textContent = msgText;

  // Event listeners para los checkboxes
  els.projectionTable.querySelectorAll('input[type="checkbox"][data-scenario-idx][data-month-idx]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const scenarioIdx = Number(event.target.dataset.scenarioIdx);
      const monthIdx = Number(event.target.dataset.monthIdx);
      
      if (!state.scenarioChecks[scenarioIdx]) {
        state.scenarioChecks[scenarioIdx] = Array.from({ length: 12 }, () => false);
      }
      state.scenarioChecks[scenarioIdx][monthIdx] = Boolean(event.target.checked);
      
      recalculateMonthlyActualsFromChecks();
      renderMonthlyActualInputs();
      renderSummary();
    });
  });
}

function renderMonthlyActualInputs() {
  els.actualInputs.innerHTML = Array.from({ length: 12 }, (_, monthIdx) => {
    const current = state.monthlyActuals[monthIdx] || 0;
    
    // Contar cuántos escenarios tienen check marcado para este mes
    let checkedCount = 0;
    let hasLocked = false;
    
    state.scenarioChecks.forEach((row, scenarioIdx) => {
      if (row?.[monthIdx]) checkedCount++;
    });
    
    state.scenarioLocked.forEach((row, scenarioIdx) => {
      if (row?.[monthIdx]) {
        hasLocked = true;
        checkedCount++;
      }
    });

    return `
      <article class="month-input">
        <div class="month-header">
          <span>Abono ${monthIdx + 1}</span>
          <span class="month-lock">${hasLocked ? '🔒 Bloqueado' : checkedCount > 0 ? `${checkedCount} check(s)` : 'Sin marcar'}</span>
        </div>
        <div class="month-value">${formatCurrency(current)}</div>
        <div class="month-state">${checkedCount > 0 ? `${checkedCount} escenario(s) seleccionado(s)` : 'Sin selección'}</div>
      </article>
    `;
  }).join('');
}

function renderSummary() {
  const totalSaved = state.monthlyActuals.reduce((acc, value) => acc + value, 0);
  
  // Contar meses que tienen al menos un check marcado
  const completedMonths = state.monthlyActuals.filter(value => value > 0).length;
  
  const targetFinalAmount = sanitizeNumber(
    state.desiredTargetAmount,
    state.initialAmount + state.monthlySaving * state.targetMonths,
    0
  );
  const pending = Math.max(0, targetFinalAmount - (state.initialAmount + totalSaved));
  const requiredContribution = Math.max(0, targetFinalAmount - state.initialAmount);
  const progressPercent = requiredContribution === 0
    ? 100
    : Math.max(0, Math.min(100, (totalSaved / requiredContribution) * 100));

  els.summary.innerHTML = `
    <article class="card">
      <div class="label">Monto inicial</div>
      <div class="value">${formatCurrency(state.initialAmount)}</div>
    </article>
    <article class="card">
      <div class="label">Monto final proyectado</div>
      <div class="value">${formatCurrency(targetFinalAmount)}</div>
    </article>
    <article class="card">
      <div class="label">Monto ahorrado actualmente</div>
      <div class="value">${formatCurrency(totalSaved)}</div>
    </article>
    <article class="card">
      <div class="label">Meses con ahorro</div>
      <div class="value">${completedMonths} / ${state.targetMonths}</div>
    </article>
    <article class="card">
      <div class="label">Monto pendiente por ahorrar</div>
      <div class="value">${formatCurrency(pending)}</div>
    </article>
  `;

  els.progressFill.style.width = `${progressPercent.toFixed(1)}%`;
  els.progressText.textContent = `${progressPercent.toFixed(1)}% completado (${formatCurrency(totalSaved)} de ${formatCurrency(requiredContribution)} por ahorrar)`;
}

function updateConfigLockState() {
  const locked = Boolean(state.configLocked);
  els.monthlySaving.disabled = locked;
  els.desiredTargetAmount.disabled = locked;
  els.projectionStepAmount.disabled = locked;
  els.maxMonthlySavingCap.disabled = locked;
}

function bindGeneralInputs() {
  const map = [
    ['profileName', 'profileName'],
    ['initialAmount', 'initialAmount'],
    ['monthlySaving', 'monthlySaving'],
    ['desiredTargetAmount', 'desiredTargetAmount'],
    ['projectionStepAmount', 'projectionStepAmount'],
    ['maxMonthlySavingCap', 'maxMonthlySavingCap']
  ];

  map.forEach(([elementKey, stateKey]) => {
    const element = els[elementKey];
    element.addEventListener('input', (event) => {
      if (stateKey === 'profileName') {
        state[stateKey] = String(event.target.value || '');
      } else {
        state[stateKey] = sanitizeNumber(event.target.value, state[stateKey]);
      }

      recalculateMonthlyActualsFromChecks();
      renderProjectionTable();
      renderMonthlyActualInputs();
      renderSummary();
    });
  });
}

function syncInputsFromState() {
  els.profileName.value = state.profileName;
  els.initialAmount.value = state.initialAmount;
  els.monthlySaving.value = state.monthlySaving;
  els.desiredTargetAmount.value = state.desiredTargetAmount;
  els.projectionStepAmount.value = state.projectionStepAmount;
  els.maxMonthlySavingCap.value = state.maxMonthlySavingCap;
  updateConfigLockState();
}

function setStatus(message) {
  els.status.textContent = message;
}

async function loadProfile() {
  const key = String(els.profileKey.value || '').trim().toLowerCase();

  if (!key) {
    setStatus('Ingresa un código de perfil para cargar.');
    return;
  }

  setStatus('Cargando perfil...');

  const response = await fetch(`/api/profile/${encodeURIComponent(key)}`);
  const payload = await response.json();

  if (!response.ok) {
    setStatus(payload.error || 'Error cargando perfil.');
    return;
  }

  Object.assign(state, payload.data || {});
  state.maxMonthlySavingCap = sanitizeNumber(state.maxMonthlySavingCap, 200000, 100);
  normalizeMonthlyArrays();
  recalculateMonthlyActualsFromChecks();
  state.key = key;

  syncInputsFromState();
  updateConfigLockState();
  renderProjectionTable();
  renderMonthlyActualInputs();
  renderSummary();

  setStatus(
    payload.updatedAt
      ? `Perfil cargado. Última actualización: ${new Date(payload.updatedAt).toLocaleString()}.`
      : 'Perfil nuevo cargado.'
  );
}

async function saveProfile() {
  const key = String(els.profileKey.value || '').trim().toLowerCase();

  if (!key) {
    setStatus('Ingresa un código de perfil para guardar.');
    return;
  }

  setStatus('Guardando...');

  const payload = {
    profileName: state.profileName,
    initialAmount: sanitizeNumber(state.initialAmount, 500),
    monthlySaving: sanitizeNumber(state.monthlySaving, 500),
    desiredTargetAmount: sanitizeNumber(state.desiredTargetAmount, 6500),
    projectionStepAmount: sanitizeNumber(state.projectionStepAmount, 500, 100),
    maxMonthlySavingCap: getMaxCapValue(),
    targetMonths: 12,
    configLocked: state.configLocked,
    scenarioChecks: state.scenarioChecks.map(row => row.map(v => Boolean(v))),
    scenarioLocked: state.scenarioLocked.map(row => row.map(v => Boolean(v))),
    monthlyActuals: state.monthlyActuals.map((value) => sanitizeNumber(value, 0))
  };

  const response = await fetch(`/api/profile/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();

  if (!response.ok) {
    setStatus(result.error || 'No se pudo guardar.');
    return;
  }

  state.key = key;
  state.configLocked = true;
  
  // Bloquear los checks que están marcados
  state.scenarioChecks.forEach((row, scenarioIdx) => {
    row.forEach((checked, monthIdx) => {
      if (checked) {
        if (!state.scenarioLocked[scenarioIdx]) {
          state.scenarioLocked[scenarioIdx] = Array.from({ length: 12 }, () => false);
        }
        state.scenarioLocked[scenarioIdx][monthIdx] = true;
      }
    });
  });
  
  recalculateMonthlyActualsFromChecks();
  updateConfigLockState();
  renderProjectionTable();
  renderMonthlyActualInputs();
  renderSummary();
  setStatus(`Guardado correctamente: ${new Date(result.updatedAt).toLocaleString()}`);
}

// Dark mode toggle
function initDarkMode() {
  const darkModeToggle = document.getElementById('darkModeToggle');
  const savedTheme = localStorage.getItem('theme') || 'light';
  
  // Aplicar tema guardado
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    darkModeToggle.textContent = '☀️';
  } else {
    document.body.classList.remove('dark-mode');
    darkModeToggle.textContent = '🌙';
  }
  
  // Event listener para el toggle
  darkModeToggle.addEventListener('click', () => {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    const theme = isDarkMode ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    darkModeToggle.textContent = isDarkMode ? '☀️' : '🌙';
  });
}

function bootstrap() {
  initDarkMode();
  bindGeneralInputs();

  els.loadBtn.addEventListener('click', () => {
    loadProfile().catch(() => setStatus('Error al cargar el perfil.'));
  });

  els.newBtn.addEventListener('click', () => {
    const keepKey = String(els.profileKey.value || '').trim().toLowerCase();
    Object.assign(state, getDefaultState());
    state.key = keepKey;
    syncInputsFromState();
    renderProjectionTable();
    renderMonthlyActualInputs();
    renderSummary();
    setStatus('Formulario reiniciado. Configura el perfil y guarda para crearlo.');
  });

  els.saveBtn.addEventListener('click', () => {
    saveProfile().catch(() => setStatus('Error al guardar el perfil.'));
  });

  syncInputsFromState();
  renderProjectionTable();
  renderMonthlyActualInputs();
  renderSummary();
}

bootstrap();
