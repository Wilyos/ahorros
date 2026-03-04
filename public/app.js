const state = {
  key: '',
  profileName: '',
  initialAmount: 500,
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

// Genera la secuencia plana de valores: [500, 1000, 1500, ..., 200000]
function getFlatCells() {
  const maxCap = getMaxCapValue();
  const step = sanitizeNumber(state.projectionStepAmount, 500, 1);
  const base = step;
  const cells = [];
  let value = base;
  while (value <= maxCap) {
    cells.push(value);
    value += step;
  }
  return cells;
}

function normalizeMonthlyArrays() {
  if (!Array.isArray(state.scenarioChecks)) state.scenarioChecks = [];
  if (!Array.isArray(state.scenarioLocked)) state.scenarioLocked = [];
  // Normalizar cada fila de la matriz
  state.scenarioChecks = state.scenarioChecks.map((row) => {
    if (!Array.isArray(row)) return Array.from({ length: 12 }, () => false);
    return Array.from({ length: 12 }, (_, idx) => Boolean(row[idx]));
  });
  state.scenarioLocked = state.scenarioLocked.map((row) => {
    if (!Array.isArray(row)) return Array.from({ length: 12 }, () => false);
    return Array.from({ length: 12 }, (_, idx) => Boolean(row[idx]));
  });
}

function recalculateMonthlyActualsFromChecks() {
  // El total ahorrado = suma de valores de todas las celdas marcadas
  // Se guarda en monthlyActuals[0] para simplicidad
  const cells = getFlatCells();
  let total = 0;
  cells.forEach((cellValue, cellIdx) => {
    const rowIdx = Math.floor(cellIdx / 12);
    const colIdx = cellIdx % 12;
    const isChecked = state.scenarioChecks[rowIdx]?.[colIdx] || false;
    const isLocked = state.scenarioLocked[rowIdx]?.[colIdx] || false;
    if (isChecked || isLocked) total += cellValue;
  });
  state.totalSaved = total;
  // Mantener monthlyActuals como array para compatibilidad
  state.monthlyActuals = Array.from({ length: 12 }, () => 0);
}

function getMaxCapValue() {
  return sanitizeNumber(state.maxMonthlySavingCap, 200000, 100);
}

function getProjectionScenarios() {
  const maxCap = getMaxCapValue();
  const stepAmount = sanitizeNumber(state.projectionStepAmount, 500, 100);
  const baseMonthlySaving = stepAmount;
  return { maxCap, stepAmount, baseMonthlySaving };
}

function renderProjectionTable() {
  const cells = getFlatCells();
  const { stepAmount, baseMonthlySaving, maxCap } = getProjectionScenarios();
  const numRows = Math.ceil(cells.length / 12);

  // Asegurar que la matriz de checks tiene el tamaño correcto
  while (state.scenarioChecks.length < numRows) {
    state.scenarioChecks.push(Array.from({ length: 12 }, () => false));
  }
  while (state.scenarioLocked.length < numRows) {
    state.scenarioLocked.push(Array.from({ length: 12 }, () => false));
  }

  // Tabla sin encabezado de fila (solo valores en cuadrícula continua)
  let tableHtml = '<thead><tr><th>#</th>';
  tableHtml += Array.from({ length: 12 }, (_, i) => `<th>Abono ${i + 1}</th>`).join('');
  tableHtml += '</tr></thead><tbody>';

  for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
    const firstCellIdx = rowIdx * 12;
    const firstValue = cells[firstCellIdx];
    const lastValue = cells[Math.min(firstCellIdx + 11, cells.length - 1)];
    const rowLabel = firstValue === lastValue
      ? formatCurrency(firstValue)
      : `${formatCurrency(firstValue)} – ${formatCurrency(lastValue)}`;

    tableHtml += `<tr><td class="scenario-label">${rowLabel}</td>`;

    for (let colIdx = 0; colIdx < 12; colIdx++) {
      const cellIdx = rowIdx * 12 + colIdx;
      if (cellIdx >= cells.length) {
        tableHtml += '<td></td>';
        continue;
      }
      const cellValue = cells[cellIdx];
      const checked = Boolean(state.scenarioChecks[rowIdx]?.[colIdx]);
      const locked = Boolean(state.scenarioLocked[rowIdx]?.[colIdx]);
      const checkboxId = `check_${rowIdx}_${colIdx}`;

      tableHtml += `
        <td class="projection-check-cell">
          <label class="projection-check-label">
            <input
              id="${checkboxId}"
              type="checkbox"
              data-row-idx="${rowIdx}"
              data-col-idx="${colIdx}"
              ${checked ? 'checked' : ''}
              ${locked ? 'disabled' : ''}
            />
            <span class="radio-value">${formatCurrency(cellValue)}</span>
            <span class="lock-indicator">${locked ? '🔒' : ''}</span>
          </label>
        </td>`;
    }
    tableHtml += '</tr>';
  }

  tableHtml += '</tbody>';
  els.projectionTable.innerHTML = tableHtml;

  els.projectionNote.textContent = `Incrementos de ${formatCurrency(stepAmount)} desde ${formatCurrency(baseMonthlySaving)} hasta ${formatCurrency(maxCap)}.`;

  // Event listeners
  els.projectionTable.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const rowIdx = Number(event.target.dataset.rowIdx);
      const colIdx = Number(event.target.dataset.colIdx);
      if (!state.scenarioChecks[rowIdx]) {
        state.scenarioChecks[rowIdx] = Array.from({ length: 12 }, () => false);
      }
      state.scenarioChecks[rowIdx][colIdx] = Boolean(event.target.checked);
      recalculateMonthlyActualsFromChecks();
      renderMonthlyActualInputs();
      renderSummary();
    });
  });
}

function renderMonthlyActualInputs() {
  const cells = getFlatCells();
  let checkedCount = 0;
  let lockedCount = 0;
  let total = 0;

  cells.forEach((cellValue, cellIdx) => {
    const rowIdx = Math.floor(cellIdx / 12);
    const colIdx = cellIdx % 12;
    const isChecked = state.scenarioChecks[rowIdx]?.[colIdx] || false;
    const isLocked = state.scenarioLocked[rowIdx]?.[colIdx] || false;
    if (isChecked) { checkedCount++; total += cellValue; }
    if (isLocked) { lockedCount++; total += cellValue; }
  });

  els.actualInputs.innerHTML = `
    <article class="month-input" style="grid-column: 1/-1">
      <div class="month-header">
        <span>Aboños marcados</span>
        <span class="month-lock">${lockedCount > 0 ? `🔒 ${lockedCount} bloqueados` : ''}</span>
      </div>
      <div class="month-value">${formatCurrency(total)}</div>
      <div class="month-state">${checkedCount + lockedCount} casilla(s) seleccionada(s)</div>
    </article>
  `;
}

function renderSummary() {
  const cells = getFlatCells();
  let totalSaved = 0;
  let totalTarget = 0;

  cells.forEach((cellValue, cellIdx) => {
    const rowIdx = Math.floor(cellIdx / 12);
    const colIdx = cellIdx % 12;
    const isChecked = state.scenarioChecks[rowIdx]?.[colIdx] || false;
    const isLocked = state.scenarioLocked[rowIdx]?.[colIdx] || false;
    if (isChecked || isLocked) totalSaved += cellValue;
    totalTarget += cellValue;
  });

  const completedMonths = 0; // ya no aplica por mes
  const targetFinalAmount = totalTarget;
  const pending = Math.max(0, targetFinalAmount - totalSaved);
  const requiredContribution = targetFinalAmount;
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
  els.projectionStepAmount.disabled = locked;
  els.maxMonthlySavingCap.disabled = locked;
}

function bindGeneralInputs() {
  const map = [
    ['profileName', 'profileName'],
    ['initialAmount', 'initialAmount'],
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
  state.maxMonthlySavingCap = sanitizeNumber(state.maxMonthlySavingCap, 0, 0);
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
