/**
 * AWS ECS Fargate + RDS Dashboard Controller
 * Handles REST communication with the backend (/api/items), DOM rendering and UX state.
 */

// Si la aplicación es servida por Nginx, las peticiones relativas a '/api' son automáticamente
// reenviadas mediante proxy inverso al contenedor del Backend en la subred privada.
const API_BASE_URL = '';

let allItems = [];

// Elementos del DOM
const form = document.getElementById('item-form');
const btnSubmit = document.getElementById('btn-submit');
const btnRefresh = document.getElementById('btn-refresh');
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('table-search');
const statusPill = document.getElementById('status-pill');
const statusText = document.getElementById('status-text');
const statTotal = document.getElementById('stat-total');
const statValue = document.getElementById('stat-value');
const statLatency = document.getElementById('stat-latency');
const toastContainer = document.getElementById('toast-container');

// ---------------------------------------------------------------------------
// Notificaciones Toast
// ---------------------------------------------------------------------------
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✅' : '⚠️';
  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ---------------------------------------------------------------------------
// Actualización del Estado de Conexión
// ---------------------------------------------------------------------------
function updateStatus(isOnline, message = '') {
  statusPill.className = `status-pill ${isOnline ? 'status-online' : 'status-offline'}`;
  statusText.textContent = isOnline ? (message || 'Backend & RDS Conectados') : (message || 'Desconectado de RDS');
}

// ---------------------------------------------------------------------------
// Consulta de Ítems (GET /api/items)
// ---------------------------------------------------------------------------
async function fetchItems() {
  btnRefresh.classList.add('spinning');
  const startTime = performance.now();

  try {
    const response = await fetch(`${API_BASE_URL}/api/items`, {
      headers: { 'Accept': 'application/json' }
    });

    const elapsed = Math.round(performance.now() - startTime);
    statLatency.textContent = `${elapsed} ms`;

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    allItems = result.data || [];

    updateStatus(true, `Conectado a RDS (${allItems.length} registros)`);
    renderTable(allItems);
    updateMetrics(allItems);
  } catch (error) {
    console.error('Error al consultar ítems:', error);
    updateStatus(false, 'Error de conexión con Backend/RDS');
    statLatency.textContent = 'Err';
    renderTableError(error.message);
  } finally {
    btnRefresh.classList.remove('spinning');
  }
}

// ---------------------------------------------------------------------------
// Renderizado de la Tabla
// ---------------------------------------------------------------------------
function renderTable(items) {
  if (items.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty-cell">
          <p style="color: var(--text-muted); font-size: 0.95rem;">No hay registros en la base de datos.</p>
          <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.25rem;">Usa el formulario para realizar el primer INSERT en Amazon RDS.</p>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = items.map(item => {
    const formattedPrice = Number(item.precio).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    });

    const formattedDate = item.fecha_creacion 
      ? new Date(item.fecha_creacion).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
      : 'N/A';

    return `
      <tr>
        <td class="col-id">#${item.id}</td>
        <td class="col-name">${escapeHtml(item.nombre)}</td>
        <td class="col-desc">${item.descripcion ? escapeHtml(item.descripcion) : '<em style="color:var(--text-muted)">Sin descripción</em>'}</td>
        <td class="col-price">${formattedPrice}</td>
        <td class="col-date">${formattedDate}</td>
      </tr>
    `;
  }).join('');
}

function renderTableError(errorMessage) {
  tableBody.innerHTML = `
    <tr>
      <td colspan="5" class="table-empty-cell" style="color: var(--color-danger);">
        <p><strong>Error al consultar Amazon RDS</strong></p>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">${escapeHtml(errorMessage)}</p>
      </td>
    </tr>
  `;
}

// ---------------------------------------------------------------------------
// Cálculo de Métricas
// ---------------------------------------------------------------------------
function updateMetrics(items) {
  statTotal.textContent = items.length;
  const totalValue = items.reduce((sum, item) => sum + (parseFloat(item.precio) || 0), 0);
  statValue.textContent = totalValue.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  });
}

// ---------------------------------------------------------------------------
// Envío de Formulario (POST /api/items)
// ---------------------------------------------------------------------------
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombreInput = document.getElementById('nombre');
  const precioInput = document.getElementById('precio');
  const descripcionInput = document.getElementById('descripcion');

  const nombre = nombreInput.value.trim();
  const precio = parseFloat(precioInput.value);
  const descripcion = descripcionInput.value.trim();

  if (!nombre) {
    showToast('El nombre del ítem es requerido', 'error');
    nombreInput.focus();
    return;
  }

  if (isNaN(precio) || precio < 0) {
    showToast('Ingresa un precio válido mayor o igual a 0', 'error');
    precioInput.focus();
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.classList.add('loading');

  try {
    const response = await fetch(`${API_BASE_URL}/api/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ nombre, descripcion, precio })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Error en el servidor al insertar registro');
    }

    showToast(`Ítem "${result.data.nombre}" registrado exitosamente en RDS`, 'success');
    form.reset();
    await fetchItems();
  } catch (error) {
    console.error('Error al insertar:', error);
    showToast(`Fallo al guardar: ${error.message}`, 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.classList.remove('loading');
  }
});

// ---------------------------------------------------------------------------
// Búsqueda en tiempo real
// ---------------------------------------------------------------------------
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  if (!query) {
    renderTable(allItems);
    return;
  }
  const filtered = allItems.filter(item => 
    (item.nombre && item.nombre.toLowerCase().includes(query)) ||
    (item.descripcion && item.descripcion.toLowerCase().includes(query)) ||
    String(item.id).includes(query)
  );
  renderTable(filtered);
});

btnRefresh.addEventListener('click', fetchItems);

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Carga inicial
document.addEventListener('DOMContentLoaded', fetchItems);
