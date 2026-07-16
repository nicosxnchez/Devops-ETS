const API_BASE = '/api';

let currentView = 'dashboard';
let currentEditId = null;
let currentEditType = null;
let pedidos = [];
let despachos = [];
let conductores = [];
let rutas = [];

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initModals();
  initForms();
  loadDashboard();
  loadAllData();
});

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      switchView(view);
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
      }
    });
  });
  
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
  
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-view]')) {
        const view = e.target.closest('[data-view]').dataset.view;
        switchView(view);
        navItems.forEach(i => i.classList.remove('active'));
        document.querySelector(`.nav-item[data-view="${view}"]`)?.classList.add('active');
      }
    });
  });
  
  document.getElementById('btnNuevoDespacho').addEventListener('click', () => openModal('despacho'));
  document.getElementById('btnNuevaOrdenCompra').addEventListener('click', () => openModal('pedido'));
  document.getElementById('btnNuevoDespachoOrden').addEventListener('click', () => openModal('despacho'));
  document.getElementById('btnNuevoConductor').addEventListener('click', () => openModal('conductor'));
  document.getElementById('btnNuevaRuta').addEventListener('click', () => openModal('ruta'));
}

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`)?.classList.add('active');
  
  const titles = {
    dashboard: 'Dashboard',
    despachos: 'Órdenes de Compra',
    'ordenes-despacho': 'Órdenes de Despacho',
    conductores: 'Conductores',
    rutas: 'Rutas',
    configuracion: 'Configuración'
  };
  document.getElementById('pageTitle').textContent = titles[view] || 'Dashboard';
  
  const btnNuevoDespacho = document.getElementById('btnNuevoDespacho');
  if (btnNuevoDespacho) {
    btnNuevoDespacho.style.display = ['dashboard', 'despachos', 'ordenes-despacho'].includes(view) ? 'inline-flex' : 'none';
  }
}

async function loadDashboard() {
  try {
    const [statsRes, pedidosRes, despachosRes] = await Promise.all([
      fetch(`${API_BASE}/stats`),
      fetch(`${API_BASE}/pedidos?limit=5&sort=fecha_creacion&order=desc`),
      fetch(`${API_BASE}/despachos?limit=5&sort=fecha_salida&order=desc`)
    ]);
    
    if (statsRes.ok) {
      const stats = await statsRes.json();
      updateStatCards(stats);
    }
    
    if (pedidosRes.ok) {
      const data = await pedidosRes.json();
      renderPedidosRecientes(data.data || data);
    }
    
    if (despachosRes.ok) {
      const data = await despachosRes.json();
      renderDespachosRecientes(data.data || data);
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
    showToast('Error al cargar el dashboard', 'error');
  }
}

function updateStatCards(stats) {
  document.getElementById('statPedidosPendientes').textContent = stats.pedidos_pendientes || 0;
  document.getElementById('statDespachosHoy').textContent = stats.despachos_hoy || 0;
  document.getElementById('statConductoresActivos').textContent = stats.conductores_activos || 0;
  document.getElementById('statRutasActivas').textContent = stats.rutas_activas || 0;
}

function renderPedidosRecientes(pedidos) {
  const tbody = document.getElementById('tbodyPedidosRecientes');
  if (!pedidos || pedidos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="padding: 32px; text-align: center; color: var(--text-muted);">No hay órdenes recientes</td></tr>`;
    return;
  }
  tbody.innerHTML = pedidos.map(p => `
    <tr>
      <td>#${p.id}</td>
      <td>${escapeHtml(p.cliente_nombre || p.cliente_nombre || p.cliente)}</td>
      <td>${formatDate(p.fecha_creacion)}</td>
      <td><span class="badge badge-${p.estado}">${getEstadoLabel(p.estado)}</span></td>
      <td>${formatCurrency(p.total)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-icon" onclick="verPedido(${p.id})" title="Ver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderDespachosRecientes(despachos) {
  const tbody = document.getElementById('tbodyDespachosRecientes');
  if (!despachos || despachos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="padding: 32px; text-align: center; color: var(--text-muted);">No hay despachos recientes</td></tr>`;
    return;
  }
  tbody.innerHTML = despachos.map(d => `
    <tr>
      <td>#${d.id}</td>
      <td>OC-${d.pedido_id}</td>
      <td>${escapeHtml(d.conductor_nombre || 'Sin asignar')}</td>
      <td><span class="badge badge-${d.estado}">${getEstadoDespachoLabel(d.estado)}</span></td>
      <td>${d.fecha_salida ? formatDate(d.fecha_salida) : '-'}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-icon" onclick="verDespacho(${d.id})" title="Ver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadAllData() {
  await Promise.all([
    loadPedidos(),
    loadDespachos(),
    loadConductores(),
    loadRutas()
  ]);
}

async function loadPedidos() {
  try {
    const res = await fetch(`${API_BASE}/pedidos`);
    if (res.ok) {
      const data = await res.json();
      pedidos = data.data || data;
      renderPedidosTable(pedidos);
    }
  } catch (error) {
    console.error('Error loading pedidos:', error);
  }
}

function renderPedidosTable(data) {
  const tbody = document.getElementById('tbodyPedidos');
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="padding: 32px; text-align: center; color: var(--text-muted);">No hay órdenes de compra registradas</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(p => `
    <tr>
      <td>#${p.id}</td>
      <td>${escapeHtml(p.cliente_nombre)}</td>
      <td>${escapeHtml(p.cliente_contacto || '-')}</td>
      <td>${formatDate(p.fecha_creacion)}</td>
      <td><span class="badge badge-${p.estado}">${getEstadoLabel(p.estado)}</span></td>
      <td>${formatCurrency(p.total)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-icon" onclick="verPedido(${p.id})" title="Ver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn btn-icon" onclick="editarPedido(${p.id})" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-icon danger" onclick="eliminarPedido(${p.id})" title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadDespachos() {
  try {
    const res = await fetch(`${API_BASE}/despachos`);
    if (res.ok) {
      const data = await res.json();
      despachos = data.data || data;
      renderDespachosTable(despachos);
    }
  } catch (error) {
    console.error('Error loading despachos:', error);
  }
}

function renderDespachosTable(data) {
  const tbody = document.getElementById('tbodyDespachos');
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="padding: 32px; text-align: center; color: var(--text-muted);">No hay órdenes de despacho registradas</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(d => `
    <tr>
      <td>#${d.id}</td>
      <td>OC-${d.pedido_id}</td>
      <td>${escapeHtml(d.conductor_nombre || 'Sin asignar')}</td>
      <td>${escapeHtml(d.vehiculo_placa || '-')}</td>
      <td><span class="badge badge-${d.estado}">${getEstadoDespachoLabel(d.estado)}</span></td>
      <td>${d.fecha_salida ? formatDate(d.fecha_salida) : '-'}</td>
      <td>${d.fecha_entrega_real ? formatDate(d.fecha_entrega_real) : '-'}</td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-icon" onclick="verDespacho(${d.id})" title="Ver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn btn-icon" onclick="editarDespacho(${d.id})" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-icon danger" onclick="eliminarDespacho(${d.id})" title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadConductores() {
  try {
    const res = await fetch(`${API_BASE}/conductores`);
    if (res.ok) {
      const data = await res.json();
      conductores = data.data || data;
      renderConductoresTable(conductores);
    }
  } catch (error) {
    console.error('Error loading conductores:', error);
  }
}

function renderConductoresTable(data) {
  const tbody = document.getElementById('tbodyConductores');
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="padding: 32px; text-align: center; color: var(--text-muted);">No hay conductores registrados</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(c => `
    <tr>
      <td>#${c.id}</td>
      <td>${escapeHtml(c.nombre)}</td>
      <td>${escapeHtml(c.licencia)}</td>
      <td>${escapeHtml(c.telefono || '-')}</td>
      <td>${escapeHtml(c.vehiculo_placa || 'Sin asignar')}</td>
      <td><span class="badge badge-${c.estado}">${c.estado === 'activo' ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-icon" onclick="verConductor(${c.id})" title="Ver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn btn-icon" onclick="editarConductor(${c.id})" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-icon danger" onclick="eliminarConductor(${c.id})" title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadRutas() {
  try {
    const res = await fetch(`${API_BASE}/rutas`);
    if (res.ok) {
      const data = await res.json();
      rutas = data.data || data;
      renderRutasTable(rutas);
    }
  } catch (error) {
    console.error('Error loading rutas:', error);
  }
}

function renderRutasTable(data) {
  const tbody = document.getElementById('tbodyRutas');
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="padding: 32px; text-align: center; color: var(--text-muted);">No hay rutas registradas</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(r => `
    <tr>
      <td>#${r.id}</td>
      <td>${escapeHtml(r.nombre)}</td>
      <td>${escapeHtml(r.origen)}</td>
      <td>${escapeHtml(r.destino)}</td>
      <td>${r.distancia_km}</td>
      <td>${r.tiempo_estimado_horas}h</td>
      <td><span class="badge badge-${r.estado}">${r.estado === 'activa' ? 'Activa' : 'Inactiva'}</span></td>
      <td>
        <div class="action-buttons">
          <button class="btn btn-icon" onclick="verRuta(${r.id})" title="Ver">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn btn-icon" onclick="editarRuta(${r.id})" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-icon danger" onclick="eliminarRuta(${r.id})" title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function initModals() {
  const modalOverlay = document.getElementById('modalOverlay');
  const modalDetalleOverlay = document.getElementById('modalDetalleOverlay');
  const modalClose = document.getElementById('modalClose');
  const modalDetalleClose = document.getElementById('modalDetalleClose');
  const btnCancelarModal = document.getElementById('btnCancelarModal');
  const btnCerrarDetalle = document.getElementById('btnCerrarDetalle');
  
  [modalClose, btnCancelarModal].forEach(btn => {
    btn?.addEventListener('click', closeModal);
  });
  
  [modalDetalleClose, btnCerrarDetalle].forEach(btn => {
    btn?.addEventListener('click', closeModalDetalle);
  });
  
  modalOverlay?.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  
  modalDetalleOverlay?.addEventListener('click', (e) => {
    if (e.target === modalDetalleOverlay) closeModalDetalle();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeModalDetalle();
    }
  });
}

function initForms() {
  const modalForm = document.getElementById('modalForm');
  const btnGuardarModal = document.getElementById('btnGuardarModal');
  const btnGuardarConfig = document.getElementById('btnGuardarConfig');
  
  modalForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveModalForm();
  });
  
  btnGuardarModal?.addEventListener('click', saveModalForm);
  btnGuardarConfig?.addEventListener('click', saveConfig);
  
  document.getElementById('searchPedidos')?.addEventListener('input', debounce(filterPedidos, 300));
  document.getElementById('filterEstadoPedido')?.addEventListener('change', filterPedidos);
  document.getElementById('searchDespachos')?.addEventListener('input', debounce(filterDespachos, 300));
  document.getElementById('filterEstadoDespacho')?.addEventListener('change', filterDespachos);
  document.getElementById('searchConductores')?.addEventListener('input', debounce(filterConductores, 300));
  document.getElementById('searchRutas')?.addEventListener('input', debounce(filterRutas, 300));
}

function openModal(type, id = null) {
  currentEditType = type;
  currentEditId = id;
  
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const formFields = document.getElementById('modalFormFields');
  const modalForm = document.getElementById('modalForm');
  
  modalForm.reset();
  
  const fields = getFormFields(type, id);
  modalTitle.textContent = id ? `Editar ${getTypeLabel(type)}` : `Nuevo ${getTypeLabel(type)}`;
  formFields.innerHTML = fields.map(f => renderField(f)).join('');
  
  if (id) {
    loadModalData(type, id);
  }
  
  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
  
  setTimeout(() => {
    const firstInput = formFields.querySelector('input, select, textarea');
    firstInput?.focus();
  }, 100);
}

function getFormFields(type, id) {
  const baseFields = [];
  
  switch (type) {
    case 'pedido':
      return [
        { name: 'cliente_nombre', label: 'Cliente', type: 'text', required: true },
        { name: 'cliente_contacto', label: 'Contacto', type: 'text' },
        { name: 'cliente_telefono', label: 'Teléfono', type: 'tel' },
        { name: 'cliente_direccion', label: 'Dirección', type: 'text', required: true },
        { name: 'fecha_entrega_estimada', label: 'Fecha Entrega Estimada', type: 'date', required: true },
        { name: 'observaciones', label: 'Observaciones', type: 'textarea' }
      ];
    case 'despacho':
      return [
        { name: 'pedido_id', label: 'Orden de Compra', type: 'select', required: true, options: pedidos.filter(p => p.estado === 'pendiente' || p.estado === 'procesando').map(p => ({ value: p.id, label: `OC-${p.id} - ${p.cliente_nombre}` })) },
        { name: 'conductor_id', label: 'Conductor', type: 'select', required: true, options: conductores.filter(c => c.estado === 'activo').map(c => ({ value: c.id, label: `${c.nombre} (${c.licencia})` })) },
        { name: 'vehiculo_id', label: 'Vehículo', type: 'select', required: true, options: [] },
        { name: 'fecha_salida', label: 'Fecha Salida', type: 'datetime-local', required: true },
        { name: 'fecha_entrega_estimada', label: 'Fecha Entrega Estimada', type: 'datetime-local', required: true },
        { name: 'observaciones', label: 'Observaciones', type: 'textarea' }
      ];
    case 'conductor':
      return [
        { name: 'nombre', label: 'Nombre Completo', type: 'text', required: true },
        { name: 'licencia', label: 'N° Licencia', type: 'text', required: true },
        { name: 'licencia_vencimiento', label: 'Vencimiento Licencia', type: 'date', required: true },
        { name: 'telefono', label: 'Teléfono', type: 'tel' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'vehiculo_placa', label: 'Placa Vehículo', type: 'text' },
        { name: 'vehiculo_marca', label: 'Marca Vehículo', type: 'text' },
        { name: 'vehiculo_modelo', label: 'Modelo Vehículo', type: 'text' },
        { name: 'vehiculo_capacidad_kg', label: 'Capacidad (kg)', type: 'number', min: 0 },
        { name: 'estado', label: 'Estado', type: 'select', required: true, options: [{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }] }
      ];
    case 'ruta':
      return [
        { name: 'nombre', label: 'Nombre Ruta', type: 'text', required: true },
        { name: 'origen', label: 'Origen', type: 'text', required: true },
        { name: 'destino', label: 'Destino', type: 'text', required: true },
        { name: 'distancia_km', label: 'Distancia (km)', type: 'number', min: 0, step: 0.1, required: true },
        { name: 'tiempo_estimado_horas', label: 'Tiempo Estimado (horas)', type: 'number', min: 0, step: 0.5, required: true },
        { name: 'estado', label: 'Estado', type: 'select', required: true, options: [{ value: 'activa', label: 'Activa' }, { value: 'inactiva', label: 'Inactiva' }] }
      ];
  }
  return baseFields;
}

function renderField(field) {
  const required = field.required ? 'required' : '';
  const id = `field-${field.name}`;
  
  let inputHtml = '';
  switch (field.type) {
    case 'select':
      const options = field.options?.map(o => `<option value="${o.value}">${o.label}</option>`).join('') || '';
      inputHtml = `<select id="${id}" name="${field.name}" ${required}>${options}</select>`;
      break;
    case 'textarea':
      inputHtml = `<textarea id="${id}" name="${field.name}" rows="3" ${required}></textarea>`;
      break;
    default:
      inputHtml = `<input type="${field.type}" id="${id}" name="${field.name}" ${required} ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.step !== undefined ? `step="${field.step}"` : ''}>`;
  }
  
  return `
    <div class="form-field">
      <label for="${id}">${field.label}${field.required ? ' *' : ''}</label>
      ${inputHtml}
    </div>
  `;
}

function getTypeLabel(type) {
  const labels = {
    pedido: 'Orden de Compra',
    despacho: 'Orden de Despacho',
    conductor: 'Conductor',
    ruta: 'Ruta'
  };
  return labels[type] || 'Registro';
}

async function loadModalData(type, id) {
  try {
    const res = await fetch(`${API_BASE}/${type}s/${id}`);
    if (res.ok) {
      const data = await res.json();
      const form = document.getElementById('modalForm');
      Object.keys(data).forEach(key => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) {
          if (input.type === 'checkbox') {
            input.checked = data[key];
          } else if (input.tagName === 'SELECT' && data[key] !== undefined) {
            input.value = data[key];
          } else if (input.type === 'datetime-local' && data[key]) {
            input.value = data[key].replace(' ', 'T').substring(0, 16);
          } else {
            input.value = data[key] || '';
          }
        }
      });
    }
  } catch (error) {
    console.error('Error loading modal data:', error);
  }
}

async function saveModalForm() {
  const form = document.getElementById('modalForm');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  
  data.conductor_id = parseInt(data.conductor_id) || null;
  data.vehiculo_id = parseInt(data.vehiculo_id) || null;
  data.pedido_id = parseInt(data.pedido_id) || null;
  data.distancia_km = parseFloat(data.distancia_km) || 0;
  data.tiempo_estimado_horas = parseFloat(data.tiempo_estimado_horas) || 0;
  data.vehiculo_capacidad_kg = parseInt(data.vehiculo_capacidad_kg) || 0;
  
  const endpoint = `${API_BASE}/${currentEditType}s`;
  const method = currentEditId ? 'PUT' : 'POST';
  const url = currentEditId ? `${endpoint}/${currentEditId}` : endpoint;
  
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (res.ok) {
      showToast(`${getTypeLabel(currentEditType)} ${currentEditId ? 'actualizado' : 'creado'} correctamente`, 'success');
      closeModal();
      await refreshCurrentView();
    } else {
      const err = await res.json().catch(() => ({ message: 'Error al guardar' }));
      showToast(err.message || 'Error al guardar', 'error');
    }
  } catch (error) {
    console.error('Error saving:', error);
    showToast('Error de conexión', 'error');
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
  currentEditId = null;
  currentEditType = null;
}

function openModalDetalle(title, content) {
  document.getElementById('modalDetalleTitle').textContent = title;
  document.getElementById('modalDetalleBody').innerHTML = content;
  document.getElementById('modalDetalleOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModalDetalle() {
  document.getElementById('modalDetalleOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

async function verPedido(id) {
  try {
    const res = await fetch(`${API_BASE}/pedidos/${id}`);
    if (res.ok) {
      const p = await res.json();
      openModalDetalle(`Orden de Compra #${p.id}`, renderPedidoDetalle(p));
    }
  } catch (error) {
    console.error(error);
  }
}

function renderPedidoDetalle(p) {
  return `
    <div class="detail-grid">
      <div class="detail-item">
        <span class="detail-label">ID</span>
        <span class="detail-value">#${p.id}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Cliente</span>
        <span class="detail-value">${escapeHtml(p.cliente_nombre)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Contacto</span>
        <span class="detail-value">${escapeHtml(p.cliente_contacto || '-')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Teléfono</span>
        <span class="detail-value">${escapeHtml(p.cliente_telefono || '-')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Dirección</span>
        <span class="detail-value">${escapeHtml(p.cliente_direccion)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Fecha Creación</span>
        <span class="detail-value">${formatDateTime(p.fecha_creacion)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Fecha Entrega Estimada</span>
        <span class="detail-value">${formatDate(p.fecha_entrega_estimada)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Estado</span>
        <span class="detail-value"><span class="badge badge-${p.estado}">${getEstadoLabel(p.estado)}</span></span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Total</span>
        <span class="detail-value">${formatCurrency(p.total)}</span>
      </div>
      <div class="detail-item" style="grid-column: 1/-1;">
        <span class="detail-label">Observaciones</span>
        <span class="detail-value">${escapeHtml(p.observaciones || 'Sin observaciones')}</span>
      </div>
    </div>
    ${p.items && p.items.length > 0 ? `
      <div class="detail-section">
        <h4>Productos</h4>
        <div class="table-container">
          <table>
            <thead><tr><th>Producto</th><th>Cant.</th><th>Precio Unit.</th><th>Subtotal</th></tr></thead>
            <tbody>
              ${p.items.map(i => `
                <tr>
                  <td>${escapeHtml(i.producto_nombre)}</td>
                  <td>${i.cantidad}</td>
                  <td>${formatCurrency(i.precio_unitario)}</td>
                  <td>${formatCurrency(i.subtotal)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}

async function verDespacho(id) {
  try {
    const res = await fetch(`${API_BASE}/despachos/${id}`);
    if (res.ok) {
      const d = await res.json();
      openModalDetalle(`Orden de Despacho #${d.id}`, renderDespachoDetalle(d));
    }
  } catch (error) {
    console.error(error);
  }
}

function renderDespachoDetalle(d) {
  return `
    <div class="detail-grid">
      <div class="detail-item">
        <span class="detail-label">ID</span>
        <span class="detail-value">#${d.id}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Orden de Compra</span>
        <span class="detail-value">OC-${d.pedido_id} - ${escapeHtml(d.cliente_nombre || '')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Conductor</span>
        <span class="detail-value">${escapeHtml(d.conductor_nombre || 'Sin asignar')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Vehículo</span>
        <span class="detail-value">${escapeHtml(d.vehiculo_placa || '-')} ${d.vehiculo_marca ? `- ${d.vehiculo_marca} ${d.vehiculo_modelo}` : ''}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Estado</span>
        <span class="detail-value"><span class="badge badge-${d.estado}">${getEstadoDespachoLabel(d.estado)}</span></span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Fecha Salida</span>
        <span class="detail-value">${d.fecha_salida ? formatDateTime(d.fecha_salida) : 'No iniciado'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Fecha Entrega Estimada</span>
        <span class="detail-value">${formatDateTime(d.fecha_entrega_estimada)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Fecha Entrega Real</span>
        <span class="detail-value">${d.fecha_entrega_real ? formatDateTime(d.fecha_entrega_real) : 'Pendiente'}</span>
      </div>
      <div class="detail-item" style="grid-column: 1/-1;">
        <span class="detail-label">Observaciones</span>
        <span class="detail-value">${escapeHtml(d.observaciones || 'Sin observaciones')}</span>
      </div>
    </div>
  `;
}

async function verConductor(id) {
  try {
    const res = await fetch(`${API_BASE}/conductores/${id}`);
    if (res.ok) {
      const c = await res.json();
      openModalDetalle(`Conductor: ${c.nombre}`, renderConductorDetalle(c));
    }
  } catch (error) {
    console.error(error);
  }
}

function renderConductorDetalle(c) {
  return `
    <div class="detail-grid">
      <div class="detail-item">
        <span class="detail-label">ID</span>
        <span class="detail-value">#${c.id}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Nombre</span>
        <span class="detail-value">${escapeHtml(c.nombre)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Licencia</span>
        <span class="detail-value">${escapeHtml(c.licencia)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Venc. Licencia</span>
        <span class="detail-value">${formatDate(c.licencia_vencimiento)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Teléfono</span>
        <span class="detail-value">${escapeHtml(c.telefono || '-')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Email</span>
        <span class="detail-value">${escapeHtml(c.email || '-')}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Vehículo</span>
        <span class="detail-value">${escapeHtml(c.vehiculo_placa || 'Sin asignar')} ${c.vehiculo_marca ? `- ${c.vehiculo_marca} ${c.vehiculo_modelo}` : ''}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Capacidad</span>
        <span class="detail-value">${c.vehiculo_capacidad_kg ? `${c.vehiculo_capacidad_kg} kg` : '-'}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Estado</span>
        <span class="detail-value"><span class="badge badge-${c.estado}">${c.estado === 'activo' ? 'Activo' : 'Inactivo'}</span></span>
      </div>
    </div>
  `;
}

async function verRuta(id) {
  try {
    const res = await fetch(`${API_BASE}/rutas/${id}`);
    if (res.ok) {
      const r = await res.json();
      openModalDetalle(`Ruta: ${r.nombre}`, renderRutaDetalle(r));
    }
  } catch (error) {
    console.error(error);
  }
}

function renderRutaDetalle(r) {
  return `
    <div class="detail-grid">
      <div class="detail-item">
        <span class="detail-label">ID</span>
        <span class="detail-value">#${r.id}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Nombre</span>
        <span class="detail-value">${escapeHtml(r.nombre)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Origen</span>
        <span class="detail-value">${escapeHtml(r.origen)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Destino</span>
        <span class="detail-value">${escapeHtml(r.destino)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Distancia</span>
        <span class="detail-value">${r.distancia_km} km</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Tiempo Estimado</span>
        <span class="detail-value">${r.tiempo_estimado_horas} horas</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Estado</span>
        <span class="detail-value"><span class="badge badge-${r.estado}">${r.estado === 'activa' ? 'Activa' : 'Inactiva'}</span></span>
      </div>
    </div>
  `;
}

function editarPedido(id) { openModal('pedido', id); }
function editarDespacho(id) { openModal('despacho', id); }
function editarConductor(id) { openModal('conductor', id); }
function editarRuta(id) { openModal('ruta', id); }

async function eliminarPedido(id) {
  if (!confirm('¿Eliminar esta orden de compra?')) return;
  try {
    const res = await fetch(`${API_BASE}/pedidos/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Orden eliminada', 'success');
      await loadPedidos();
      await loadDashboard();
    }
  } catch (error) {
    showToast('Error al eliminar', 'error');
  }
}

async function eliminarDespacho(id) {
  if (!confirm('¿Eliminar esta orden de despacho?')) return;
  try {
    const res = await fetch(`${API_BASE}/despachos/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Despacho eliminado', 'success');
      await loadDespachos();
      await loadDashboard();
    }
  } catch (error) {
    showToast('Error al eliminar', 'error');
  }
}

async function eliminarConductor(id) {
  if (!confirm('¿Eliminar este conductor?')) return;
  try {
    const res = await fetch(`${API_BASE}/conductores/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Conductor eliminado', 'success');
      await loadConductores();
    }
  } catch (error) {
    showToast('Error al eliminar', 'error');
  }
}

async function eliminarRuta(id) {
  if (!confirm('¿Eliminar esta ruta?')) return;
  try {
    const res = await fetch(`${API_BASE}/rutas/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Ruta eliminada', 'success');
      await loadRutas();
    }
  } catch (error) {
    showToast('Error al eliminar', 'error');
  }
}

function filterPedidos() {
  const search = document.getElementById('searchPedidos').value.toLowerCase();
  const estado = document.getElementById('filterEstadoPedido').value;
  let filtered = pedidos;
  if (search) {
    filtered = filtered.filter(p => 
      p.cliente_nombre?.toLowerCase().includes(search) ||
      p.cliente_contacto?.toLowerCase().includes(search) ||
      String(p.id).includes(search)
    );
  }
  if (estado) {
    filtered = filtered.filter(p => p.estado === estado);
  }
  renderPedidosTable(filtered);
}

function filterDespachos() {
  const search = document.getElementById('searchDespachos').value.toLowerCase();
  const estado = document.getElementById('filterEstadoDespacho').value;
  let filtered = despachos;
  if (search) {
    filtered = filtered.filter(d => 
      String(d.id).includes(search) ||
      String(d.pedido_id).includes(search) ||
      d.conductor_nombre?.toLowerCase().includes(search)
    );
  }
  if (estado) {
    filtered = filtered.filter(d => d.estado === estado);
  }
  renderDespachosTable(filtered);
}

function filterConductores() {
  const search = document.getElementById('searchConductores').value.toLowerCase();
  let filtered = conductores;
  if (search) {
    filtered = filtered.filter(c => 
      c.nombre.toLowerCase().includes(search) ||
      c.licencia.toLowerCase().includes(search) ||
      c.vehiculo_placa?.toLowerCase().includes(search)
    );
  }
  renderConductoresTable(filtered);
}

function filterRutas() {
  const search = document.getElementById('searchRutas').value.toLowerCase();
  let filtered = rutas;
  if (search) {
    filtered = filtered.filter(r => 
      r.nombre.toLowerCase().includes(search) ||
      r.origen.toLowerCase().includes(search) ||
      r.destino.toLowerCase().includes(search)
    );
  }
  renderRutasTable(filtered);
}

async function refreshCurrentView() {
  switch (currentView) {
    case 'dashboard': await loadDashboard(); break;
    case 'despachos': await loadPedidos(); break;
    case 'ordenes-despacho': await loadDespachos(); break;
    case 'conductores': await loadConductores(); break;
    case 'rutas': await loadRutas(); break;
  }
}

async function saveConfig() {
  const config = {
    empresa_nombre: document.getElementById('configEmpresaNombre').value,
    empresa_ruc: document.getElementById('configEmpresaRuc').value,
    empresa_direccion: document.getElementById('configEmpresaDireccion').value,
    empresa_telefono: document.getElementById('configEmpresaTelefono').value,
    tiempo_maximo_entrega: parseInt(document.getElementById('configTiempoMaximo').value),
    notificaciones_automaticas: document.getElementById('configNotificaciones').value
  };
  
  try {
    const res = await fetch(`${API_BASE}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (res.ok) {
      showToast('Configuración guardada', 'success');
    }
  } catch (error) {
    showToast('Error al guardar', 'error');
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toast-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toast-icon"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toast-icon"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="toast-icon"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  
  toast.innerHTML = `
    ${icons[type] || icons.info}
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(amount);
}

function getEstadoLabel(estado) {
  const labels = {
    pendiente: 'Pendiente',
    procesando: 'Procesando',
    despachado: 'Despachado',
    entregado: 'Entregado',
    cancelado: 'Cancelado'
  };
  return labels[estado] || estado;
}

function getEstadoDespachoLabel(estado) {
  const labels = {
    programado: 'Programado',
    en_ruta: 'En Ruta',
    entregado: 'Entregado',
    fallido: 'Fallido'
  };
  return labels[estado] || estado;
}