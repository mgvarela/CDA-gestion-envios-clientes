let clientesData = [];
let templatesData = [];

function isAdminOnlyAction(element) {
  return element && element.dataset && element.dataset.adminOnly === 'true';
}

function toggleAdminOnlySections() {
  const isAdminUser = currentUserRole === 'admin';
  document.querySelectorAll('[data-admin-only="true"]').forEach(el => {
    el.hidden = !isAdminUser;
  });
}

async function cargarDatosAdmin() {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;

  await Promise.all([
    cargarPromosWeb(),
    cargarPromosBancarias(),
    cargarNovedadesOperativas(),
    cargarUsuariosRoles()
  ]);
}

function mostrarPanelUsuarios() {
  document.querySelectorAll('#adminTabs .nav-link').forEach(link => link.classList.remove('active'));
  document.querySelectorAll('.tab-content .tab-pane').forEach(panel => panel.classList.remove('show', 'active'));

  const tab = document.getElementById('tab-usuarios');
  const panel = document.getElementById('content-usuarios');
  if (!tab || !panel) return;

  tab.classList.add('active');
  panel.classList.add('show', 'active');
  cargarUsuariosRoles();
}

function mostrarPanelConfiguracion() {
  document.querySelectorAll('#adminTabs .nav-link').forEach(link => link.classList.remove('active'));
  document.querySelectorAll('.tab-content .tab-pane').forEach(panel => panel.classList.remove('show', 'active'));

  const tab = document.getElementById('tab-configuracion');
  const panel = document.getElementById('content-configuracion');
  if (!tab || !panel) return;

  tab.classList.add('active');
  panel.classList.add('show', 'active');
  cargarConfiguracionesSistema();
}

window.mostrarPanelUsuarios = mostrarPanelUsuarios;
window.mostrarPanelConfiguracion = mostrarPanelConfiguracion;
window.abrirModalPlantillas = abrirModalPlantillas;
window.actualizarEstadoTemplate = actualizarEstadoTemplate;
window.actualizarVistaPreviaTemplate = actualizarVistaPreviaTemplate;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeText(value, maxLength = 200) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function sanitizeTemplateBody(value, maxLength = 2000) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

function sanitizeEmail(value) {
  return sanitizeText(value, 254).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());
}

function sanitizeTemplateId(value) {
  return sanitizeText(value, 80).replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function cargarDatosEnvios() {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;

  const { data: templates } = await supabaseClient.from('templates').select('*');
  const { data: clientes } = await supabaseClient.from('clientes').select('*').order('created_at', { ascending: false });
  
  templatesData = templates || [];
  clientesData = clientes || [];
  
  renderTablaEnvios();
  renderTemplates();
}

function renderTablaEnvios() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (clientesData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4">Sin clientes registrados.</td></tr>';
    return;
  }

  clientesData.forEach(c => {
    let badgeClass = 'badge-sin-aviso';
    if (c.estado === 'en proceso') badgeClass = 'badge-en-proceso';
    if (c.estado === 'enviado') badgeClass = 'badge-enviado';
    if (c.estado === 'error') badgeClass = 'badge-error';

    const tr = document.createElement('tr');

    const selectionCell = document.createElement('td');
    const selection = document.createElement('input');
    selection.type = 'checkbox';
    selection.className = 'cliente-checkbox';
    selection.value = c.id;
    selectionCell.appendChild(selection);
    tr.appendChild(selectionCell);

    const nombreCell = document.createElement('td');
    const nombreStrong = document.createElement('strong');
    nombreStrong.textContent = sanitizeText(c.nombre, 80) || '-';
    nombreCell.appendChild(nombreStrong);
    tr.appendChild(nombreCell);

    const pedidoCell = document.createElement('td');
    pedidoCell.textContent = sanitizeText(c.pedido, 200) || '-';
    tr.appendChild(pedidoCell);

    const mailCell = document.createElement('td');
    mailCell.textContent = sanitizeEmail(c.mail) || '-';
    tr.appendChild(mailCell);

    const selectCell = document.createElement('td');
    const select = document.createElement('select');
    select.className = 'form-select form-select-sm';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Seleccionar plantilla...';
    select.appendChild(placeholder);

    templatesData.forEach(t => {
      const option = document.createElement('option');
      option.value = String(t.id);
      option.textContent = sanitizeText(t.nombre, 80) || 'Plantilla';
      if (String(t.id).trim() === String(c.template_id).trim()) option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener('change', (event) => {
      asignarPlantilla(c.id, event.target.value);
    });
    selectCell.appendChild(select);
    tr.appendChild(selectCell);

    const sendCell = document.createElement('td');
    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'btn btn-sm btn-primary';
    sendBtn.id = `btn-send-${c.id}`;
    sendBtn.innerHTML = '<i class="bi bi-send"></i> Enviar';
    sendBtn.disabled = !canWrite();
    sendBtn.addEventListener('click', () => enviarMail(c.id));
    sendCell.appendChild(sendBtn);
    tr.appendChild(sendCell);

    const estadoCell = document.createElement('td');
    const estadoBadge = document.createElement('span');
    estadoBadge.className = `badge ${badgeClass}`;
    estadoBadge.id = `badge-${c.id}`;
    estadoBadge.textContent = sanitizeText(c.estado, 30) || 'sin aviso';
    estadoCell.appendChild(estadoBadge);
    tr.appendChild(estadoCell);

    const fechaEnvioCell = document.createElement('td');
    fechaEnvioCell.textContent = c.fecha_envio ? new Date(c.fecha_envio).toLocaleString('es-AR') : '-';
    tr.appendChild(fechaEnvioCell);

    const accionesCell = document.createElement('td');
    accionesCell.className = 'text-center';

    if (canDelete()) {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-sm btn-outline-danger';
      deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
      deleteBtn.addEventListener('click', () => eliminarCliente(c.id));
      accionesCell.appendChild(deleteBtn);
    } else {
      accionesCell.textContent = '-';
    }

    tr.appendChild(accionesCell);

    tbody.appendChild(tr);
  });
}

function renderTemplates() {
  const list = document.getElementById('listTemplates');
  if (!list) return;
  list.innerHTML = '';
  templatesData.forEach(t => {
    const item = document.createElement('li');
    item.className = 'list-group-item';

    const title = document.createElement('strong');
    title.textContent = sanitizeText(t.nombre, 80) || 'Plantilla';
    item.appendChild(title);

    const meta = document.createElement('small');
    meta.className = 'text-muted';
    meta.textContent = ` (${sanitizeText(t.id, 50)}) - ${sanitizeText(t.modulo || 'todos', 40)} - ${sanitizeText(t.estado || 'general', 50)}`;
    item.appendChild(meta);

    const br = document.createElement('br');
    item.appendChild(br);

    const body = document.createElement('small');
    body.textContent = sanitizeText(t.cuerpo, 500) || '-';
    item.appendChild(body);

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'btn btn-sm btn-outline-primary mt-2 me-2';
    editButton.innerHTML = '<i class="bi bi-pencil"></i> Editar';
    editButton.addEventListener('click', () => editarTemplate(t.id));
    item.appendChild(editButton);

    const active = document.createElement('div');
    active.className = 'form-check form-switch mt-2';
    const activeInput = document.createElement('input');
    activeInput.type = 'checkbox';
    activeInput.className = 'form-check-input';
    activeInput.checked = t.activo !== false;
    activeInput.id = `template-active-${sanitizeTemplateId(t.id)}`;
    activeInput.addEventListener('change', () => actualizarEstadoTemplate(t.id, activeInput.checked));
    const activeLabel = document.createElement('label');
    activeLabel.className = 'form-check-label';
    activeLabel.htmlFor = activeInput.id;
    activeLabel.textContent = 'Disponible para seleccionar';
    active.appendChild(activeInput);
    active.appendChild(activeLabel);
    item.appendChild(active);

    if (canDelete()) {
      const actions = document.createElement('div');
      actions.className = 'mt-2';
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'btn btn-sm btn-outline-danger';
      deleteButton.innerHTML = '<i class="bi bi-trash3"></i> Eliminar referencia';
      deleteButton.addEventListener('click', () => eliminarTemplate(t.id));
      actions.appendChild(deleteButton);
      item.appendChild(actions);
    }

    list.appendChild(item);
  });
}

async function abrirModalPlantillas() {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  const modalEl = document.getElementById('modalTemplates');
  if (!modalEl) return mostrarNotificacion('No se pudo cargar el panel de plantillas.', 'danger');

  const { data, error } = await supabaseClient.from('templates').select('*').order('nombre');
  if (error) return mostrarNotificacion('No se pudieron cargar las plantillas: ' + error.message, 'danger');
  templatesData = data || [];
  renderTemplates();
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

async function actualizarEstadoTemplate(id, activo) {
  if (!(await requireAuth()) || !canWrite()) return;
  const { error } = await supabaseClient.from('templates').update({ activo }).eq('id', id);
  if (error) return mostrarNotificacion('No se pudo actualizar la plantilla: ' + error.message, 'danger');
  const template = templatesData.find(item => String(item.id) === String(id));
  if (template) template.activo = activo;
  if (typeof cargarPlantillasEmail === 'function') await cargarPlantillasEmail();
  mostrarNotificacion(activo ? 'Plantilla activada.' : 'Plantilla desactivada.', 'success');
}

function editarTemplate(id) {
  const template = templatesData.find(item => String(item.id) === String(id));
  if (!template) return;
  document.getElementById('tplId').value = template.id || '';
  document.getElementById('tplId').readOnly = true;
  document.getElementById('tplNombre').value = template.nombre || '';
  document.getElementById('tplCuerpo').value = template.cuerpo || '';
  document.getElementById('tplModulo').value = template.modulo || 'todos';
  document.getElementById('tplEstado').value = template.estado || '';
  document.getElementById('tplActivo').checked = template.activo !== false;
  document.getElementById('btnGuardarTemplate').textContent = 'Guardar cambios';
  document.getElementById('btnCancelarEdicionTemplate').classList.remove('d-none');
  actualizarVistaPreviaTemplate();
}

function cancelarEdicionTemplate() {
  const form = document.getElementById('formTemplate');
  form?.reset();
  document.getElementById('tplId').readOnly = false;
  document.getElementById('tplActivo').checked = true;
  document.getElementById('btnGuardarTemplate').textContent = 'Guardar plantilla';
  document.getElementById('btnCancelarEdicionTemplate').classList.add('d-none');
  actualizarVistaPreviaTemplate();
}

function actualizarVistaPreviaTemplate() {
  const preview = document.getElementById('tplVistaPrevia');
  const cuerpo = document.getElementById('tplCuerpo')?.value || '';
  if (preview) preview.textContent = cuerpo || 'Escribí un texto para ver la vista previa.';
}

async function asignarPlantilla(clienteId, templateId) {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canWrite()) {
    mostrarNotificacion('No tenés permisos para asignar plantillas.', 'danger');
    return;
  }

  const cliente = clientesData.find(c => String(c.id) === String(clienteId));
  if (cliente) cliente.template_id = templateId;

  const { error } = await supabaseClient.from('clientes').update({ template_id: templateId }).eq('id', clienteId);
  if (error) mostrarNotificacion("Error al asignar plantilla: " + error.message, 'danger');
}

async function enviarMail(clienteId) {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canWrite()) {
    mostrarNotificacion('No tenés permisos para enviar mails.', 'danger');
    return;
  }

  const cliente = clientesData.find(c => String(c.id) === String(clienteId));
  if (!cliente || !cliente.template_id) return mostrarNotificacion("Por favor, seleccioná una plantilla.", 'warning');

  const template = templatesData.find(t => String(t.id) === String(cliente.template_id));
  if (!template) return;

  const nombreCliente = sanitizeText(cliente.nombre, 80);
  const pedidoCliente = sanitizeText(cliente.pedido || '', 200);
  const emailDestino = sanitizeEmail(cliente.mail);

  const asuntoFinal = sanitizeText(template.nombre, 150).replace(/\{\{nombre\}\}/g, nombreCliente).replace(/\{\{pedido\}\}/g, pedidoCliente);
  const cuerpoFinal = sanitizeText(template.cuerpo, 2000).replace(/\{\{nombre\}\}/g, nombreCliente).replace(/\{\{pedido\}\}/g, pedidoCliente);

  const btn = document.getElementById(`btn-send-${clienteId}`);
  if (btn) btn.disabled = true;

  try {
    const params = { email_destino: emailDestino, asunto: asuntoFinal, mensaje: cuerpoFinal };
    await emailjs.send(EMAILJS_SERVICE_ID, template.id, params);
    await supabaseClient.from('clientes').update({ estado: 'enviado', fecha_envio: new Date() }).eq('id', clienteId);
    
    mostrarNotificacion(`📧 Mail enviado con éxito a ${emailDestino}`, 'success');
    cargarDatosEnvios();
  } catch (err) {
    mostrarNotificacion("❌ Error al enviar mail: " + (err.text || err.message || JSON.stringify(err)), 'danger');
    await supabaseClient.from('clientes').update({ estado: 'error' }).eq('id', clienteId);
    cargarDatosEnvios();
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function guardarCliente() {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canWrite()) {
    mostrarNotificacion('No tenés permisos para crear clientes.', 'danger');
    return;
  }

  const nombre = sanitizeText(document.getElementById('newNombre').value, 100);
  const pedido = sanitizeText(document.getElementById('newPedido').value, 200);
  const mail = sanitizeEmail(document.getElementById('newMail').value);

  if (!nombre || !mail || !isValidEmail(mail)) return mostrarNotificacion('Nombre y correo válido son requeridos.', 'warning');

  const { error } = await supabaseClient.from('clientes').insert([{ nombre, pedido, mail, estado: 'sin aviso' }]);
  if (error) mostrarNotificacion("Error al guardar: " + error.message, 'danger');
  else {
    bootstrap.Modal.getInstance(document.getElementById('modalCliente')).hide();
    document.getElementById('formCliente').reset();
    mostrarNotificacion('Cliente creado correctamente.', 'success');
    cargarDatosEnvios();
  }
}

async function guardarTemplate() {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canWrite()) {
    mostrarNotificacion('No tenés permisos para guardar plantillas.', 'danger');
    return;
  }

  const id = sanitizeTemplateId(document.getElementById('tplId').value);
  const nombre = sanitizeText(document.getElementById('tplNombre').value, 150);
  const cuerpo = sanitizeTemplateBody(document.getElementById('tplCuerpo').value, 2000);

  if (!id || !nombre || !cuerpo) return mostrarNotificacion('Todos los campos son obligatorios.', 'warning');

  const modulo = document.getElementById('tplModulo')?.value || 'todos';
  const estado = document.getElementById('tplEstado')?.value || null;
  const activo = document.getElementById('tplActivo')?.checked !== false;
  const editando = document.getElementById('tplId').readOnly;
  const payload = { nombre, cuerpo, modulo, estado, activo, es_contenido_app: true };
  const query = editando
    ? supabaseClient.from('templates').update(payload).eq('id', id)
    : supabaseClient.from('templates').insert([{ id, ...payload }]);
  const { error } = await query;
  if (error) mostrarNotificacion("Error al guardar plantilla: " + error.message, 'danger');
  else {
    cancelarEdicionTemplate();
    mostrarNotificacion('Plantilla guardada correctamente.', 'success');
    const { data } = await supabaseClient.from('templates').select('*').order('nombre');
    templatesData = data || [];
    renderTemplates();
    if (typeof cargarPlantillasEmail === 'function') await cargarPlantillasEmail();
  }
}

async function eliminarCliente(id) {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canDelete()) {
    mostrarNotificacion('Solo un admin puede eliminar clientes.', 'danger');
    return;
  }

  const confirmar = await confirmarAccionModal('Eliminar cliente', '¿Estás seguro de eliminar este registro?');
  if (confirmar) {
    await supabaseClient.from('clientes').delete().eq('id', id);
    mostrarNotificacion('Cliente eliminado correctamente.', 'success');
    cargarDatosEnvios();
  }
}

function filtrarTabla() {
  const text = document.getElementById('searchInput').value.toLowerCase();
  document.querySelectorAll('#tableBody tr').forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(text) ? '' : 'none';
  });
}

const EMAIL_ADMIN_GRUPO = "info---ecommerce@googlegroups.com";

// SELECCIÓN MÚLTIPLE DE CHECKBOXES
function toggleSelectAll(masterId, className) {
  const master = document.getElementById(masterId);
  document.querySelectorAll('.' + className).forEach(chk => chk.checked = master.checked);
}

function configuracionSeleccionAdmin(tipo) {
  const configuraciones = {
    promos: { selector: '.chk-promo', tabla: 'admin_promos', campo: 'estado', control: 'bulkEstadoPromos', cargar: cargarPromosWeb },
    bancarias: { selector: '.chk-bancaria', tabla: 'admin_promos_bancarias', campo: 'estado_vigencia', control: 'bulkEstadoBancarias', cargar: cargarPromosBancarias },
    novedades: { selector: '.chk-novedad', tabla: 'admin_novedades', campo: 'activa', control: 'bulkEstadoNovedades', cargar: cargarNovedadesOperativas }
  };
  return configuraciones[tipo];
}

async function actualizarSeleccionAdmin(tipo) {
  const sessionOk = await requireAuth();
  if (!sessionOk || !canWrite()) return;

  const configuracion = configuracionSeleccionAdmin(tipo);
  const ids = Array.from(document.querySelectorAll(`${configuracion.selector}:checked`)).map(input => input.value);
  const valor = document.getElementById(configuracion.control)?.value || '';
  if (!ids.length) return mostrarNotificacion('Seleccioná al menos un registro.', 'warning');
  if (!valor) return mostrarNotificacion('Elegí un estado para aplicar.', 'warning');

  const { error } = await supabaseClient.from(configuracion.tabla).update({ [configuracion.campo]: valor }).in('id', ids);
  if (error) return mostrarNotificacion('No se pudieron aplicar los cambios: ' + error.message, 'danger');
  document.getElementById(configuracion.control).value = '';
  mostrarNotificacion('Cambios aplicados correctamente.', 'success');
  await configuracion.cargar();
}

async function eliminarSeleccionAdmin(tipo) {
  const sessionOk = await requireAuth();
  if (!sessionOk || !canDelete()) return;

  const configuracion = configuracionSeleccionAdmin(tipo);
  const ids = Array.from(document.querySelectorAll(`${configuracion.selector}:checked`)).map(input => input.value);
  if (!ids.length) return mostrarNotificacion('Seleccioná al menos un registro.', 'warning');

  const confirmar = await confirmarAccionModal('Eliminar registros', `¿Eliminar los ${ids.length} registros seleccionados?`);
  if (!confirmar) return;

  const { error } = await supabaseClient.from(configuracion.tabla).delete().in('id', ids);
  if (error) return mostrarNotificacion('No se pudieron eliminar los registros: ' + error.message, 'danger');
  mostrarNotificacion('Registros eliminados.', 'success');
  await configuracion.cargar();
}

// RENDER DE TABLAS CON CHECKBOXES
async function cargarPromosWeb() {
  const { data: promos } = await supabaseClient.from('admin_promos').select('*').order('created_at', { ascending: false });
  const tbody = document.getElementById('tblAdminPromos');
  if (!tbody || !promos) return;

  tbody.innerHTML = '';
  let activas = 0, inactivas = 0;

  promos.forEach(p => {
    if (p.estado?.toLowerCase() === 'activa') activas++; else inactivas++;
    tbody.innerHTML += `
      <tr>
        <td><input type="checkbox" class="chk-promo" value="${p.id}"></td>
        <td><small class="fw-bold">${p.id}</small></td>
        <td><strong>${p.promo}</strong></td>
        <td><small>${p.inicio ? new Date(p.inicio).toLocaleDateString() : '-'}</small></td>
        <td><small>${p.fin ? new Date(p.fin).toLocaleDateString() : '-'}</small></td>
        <td><a href="${p.landing || '#'}" target="_blank">Link</a></td>
        <td><span class="badge bg-secondary">${p.canal || 'web'}</span></td>
        <td><span class="badge ${p.estado === 'Activa' ? 'bg-success' : 'bg-danger'}">${p.estado}</span></td>
      </tr>`;
  });
  if (document.getElementById('kpiPromosActivas')) document.getElementById('kpiPromosActivas').innerText = activas;
  if (document.getElementById('kpiPromosInactivas')) document.getElementById('kpiPromosInactivas').innerText = inactivas;
}

async function cargarPromosBancarias() {
  const { data: promos } = await supabaseClient.from('admin_promos_bancarias').select('*').order('created_at', { ascending: false });
  const tbody = document.getElementById('tblAdminBancarias');
  if (!tbody || !promos) return;

  tbody.innerHTML = '';
  let activas = 0;

  promos.forEach(p => {
    if ((p.estado_vigencia || '').toUpperCase() === 'ACTIVA' || p.activa === 'SI' || p.activa === true) activas++;
    tbody.innerHTML += `
      <tr>
        <td><input type="checkbox" class="chk-bancaria" value="${p.id}"></td>
        <td><small class="fw-bold">${p.id}</small></td>
        <td><strong>${p.banco || '-'}</strong></td>
        <td>${p.descuento || '-'}</td>
        <td>${p.cuotas || '-'}</td>
        <td><small>${p.vigencia_inicio || '-'}${p.vigencia_fin ? ` al ${p.vigencia_fin}` : ''}</small></td>
        <td>${p.alcance || '-'}</td>
        <td><span class="badge ${((p.estado_vigencia || '').toUpperCase() === 'ACTIVA' || p.activa === 'SI' || p.activa === true) ? 'bg-success' : 'bg-secondary'}">${p.estado_vigencia || (p.activa === 'SI' ? 'Activa' : 'Inactiva')}</span></td>
      </tr>`;
  });

  if (document.getElementById('kpiPromosBancarias')) document.getElementById('kpiPromosBancarias').innerText = activas;
}

async function cargarNovedadesOperativas() {
  const { data: novedades } = await supabaseClient.from('admin_novedades').select('*').order('created_at', { ascending: false });
  const tbody = document.getElementById('tblAdminNovedades');
  if (!tbody || !novedades) return;

  tbody.innerHTML = '';

  novedades.forEach(n => {
    tbody.innerHTML += `
      <tr>
        <td><input type="checkbox" class="chk-novedad" value="${n.id}"></td>
        <td><small class="fw-bold">${n.id}</small></td>
        <td>${n.categoria || '-'}</td>
        <td>${n.descripcion || '-'}</td>
        <td><span class="badge ${n.activa === 'Si' || n.activa === true ? 'bg-success' : 'bg-secondary'}">${n.activa || 'No'}</span></td>
      </tr>`;
  });

  if (document.getElementById('kpiNovedades')) document.getElementById('kpiNovedades').innerText = novedades.length;
}

async function cargarUsuariosRoles() {
  const sessionOk = await requireAuth();
  if (!sessionOk || !canWrite()) return;

  const tbody = document.getElementById('tblUsuariosPermisos');
  if (!tbody) return;

  const { data: perfiles, error } = await supabaseClient.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">No se pudieron cargar los permisos: ${escapeHtml(error.message)}</td></tr>`;
    console.error(error);
    return;
  }

  tbody.innerHTML = '';

  if (!perfiles || perfiles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3">Sin usuarios registrados.</td></tr>';
    return;
  }

  perfiles.forEach(usuario => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="checkbox" class="usuario-checkbox" value="${usuario.id}"></td>
      <td><strong>${usuario.id ? usuario.id.slice(0, 8) : '-'}</strong></td>
      <td>${escapeHtml(usuario.email || '-')}</td>
      <td>${usuario.role || 'viewer'}</td>
      <td>
        <select class="form-select form-select-sm" data-user-role-select="${usuario.id}">
          <option value="viewer" ${usuario.role === 'viewer' ? 'selected' : ''}>viewer</option>
          <option value="editor" ${usuario.role === 'editor' ? 'selected' : ''}>editor</option>
          <option value="admin" ${usuario.role === 'admin' ? 'selected' : ''}>admin</option>
        </select>
      </td>
      <td class="text-end">
        <button class="btn btn-sm btn-primary" data-user-role-save="${usuario.id}" data-role-action="write">Guardar</button>
      </td>
    `;

    const saveButton = row.querySelector('[data-user-role-save]');
    saveButton.addEventListener('click', () => guardarPermisoUsuario(usuario.id));

    tbody.appendChild(row);
  });

  toggleAdminOnlySections();
}

function seleccionarTodosUsuarios(checked) {
  document.querySelectorAll('.usuario-checkbox').forEach(input => {
    input.checked = checked;
  });
}

async function actualizarRolesSeleccionados() {
  const sessionOk = await requireAuth();
  if (!sessionOk || !canDelete()) return;

  const ids = Array.from(document.querySelectorAll('.usuario-checkbox:checked')).map(input => input.value);
  const rol = document.getElementById('bulkRolUsuarios')?.value || '';
  if (!ids.length) return mostrarNotificacion('Seleccioná al menos un usuario.', 'warning');
  if (!rol) return mostrarNotificacion('Elegí un rol para aplicar.', 'warning');

  const confirmar = await confirmarAccionModal('Actualizar roles', `¿Asignar el rol "${rol}" a ${ids.length} usuario(s)?`);
  if (!confirmar) return;

  const { error } = await supabaseClient.from('profiles').update({ role: rol }).in('id', ids);
  if (error) return mostrarNotificacion('No se pudieron actualizar los roles: ' + error.message, 'danger');
  document.getElementById('bulkRolUsuarios').value = '';
  mostrarNotificacion('Roles actualizados correctamente.', 'success');
  await cargarUsuariosRoles();
}

async function guardarPermisoUsuario(userId) {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canDelete()) {
    mostrarNotificacion('Solo el admin principal puede modificar permisos.', 'danger');
    return;
  }

  const selector = document.querySelector(`[data-user-role-select="${userId}"]`);
  if (!selector) return;

  const nuevoRol = selector.value;
  const { error } = await supabaseClient.from('profiles').update({ role: nuevoRol }).eq('id', userId);

  if (error) {
    mostrarNotificacion('Error al actualizar el rol: ' + error.message, 'danger');
    return;
  }

  if (userId === (await supabaseClient.auth.getUser()).data.user?.id) {
    currentUserRole = nuevoRol;
    applyRolePermissions();
    toggleAdminOnlySections();
  }

  mostrarNotificacion('Permiso actualizado correctamente.', 'success');
  await cargarDatosAdmin();
}

// GUARDADO DE REGISTROS
async function guardarNuevaPromoBancaria() {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canWrite()) {
    mostrarNotificacion('No tenés permisos para crear promos bancarias.', 'danger');
    return;
  }

  const id = sanitizeTemplateId(document.getElementById('pbId').value);
  const banco = sanitizeText(document.getElementById('pbBanco').value, 80);
  const descuento = sanitizeText(document.getElementById('pbDescuento').value, 80);
  const cuotas = sanitizeText(document.getElementById('pbCuotas').value, 30);
  const vigencia_inicio = document.getElementById('pbInicio').value;
  const vigencia_fin = document.getElementById('pbFin').value;
  const alcance = sanitizeText(document.getElementById('pbAlcance').value, 150);

  const { error } = await supabaseClient.from('admin_promos_bancarias').insert([{
    id, banco, descuento, cuotas, vigencia_inicio, vigencia_fin, alcance, activa: 'SI', estado_vigencia: 'ACTIVA'
  }]);

  if (error) mostrarNotificacion("Error: " + error.message, 'danger');
  else {
    bootstrap.Modal.getInstance(document.getElementById('modalNuevaPromoBancaria')).hide();
    mostrarNotificacion('Promo bancaria guardada correctamente.', 'success');
    cargarPromosBancarias();
  }
}

async function guardarNuevaNovedad() {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canWrite()) {
    mostrarNotificacion('No tenés permisos para crear novedades.', 'danger');
    return;
  }

  const id = sanitizeTemplateId(document.getElementById('nId').value);
  const categoria = sanitizeText(document.getElementById('nCategoria').value, 80);
  const descripcion = sanitizeText(document.getElementById('nDescripcion').value, 400);

  const { error } = await supabaseClient.from('admin_novedades').insert([{ id, categoria, descripcion, activa: 'Si' }]);

  if (error) mostrarNotificacion("Error: " + error.message, 'danger');
  else {
    bootstrap.Modal.getInstance(document.getElementById('modalNuevaNovedad')).hide();
    mostrarNotificacion('Novedad guardada correctamente.', 'success');
    cargarNovedadesOperativas();
  }
}

// ENVÍO DE EMAIL CON SELECCIÓN
async function enviarMailsSeleccionados(tipo) {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canWrite()) {
    mostrarNotificacion('No tenés permisos para enviar notificaciones.', 'danger');
    return;
  }

  let ids = [], tabla = '', asunto = '';

  if (tipo === 'promos') {
    ids = Array.from(document.querySelectorAll('.chk-promo:checked')).map(cb => cb.value);
    tabla = 'admin_promos'; asunto = '📢 [Alertas Promos Web] Actualización de Campañas';
  } else if (tipo === 'bancarias') {
    ids = Array.from(document.querySelectorAll('.chk-bancaria:checked')).map(cb => cb.value);
    tabla = 'admin_promos_bancarias'; asunto = '🏦 [Alertas Bancarias] Nuevos Convenios';
  } else if (tipo === 'novedades') {
    ids = Array.from(document.querySelectorAll('.chk-novedad:checked')).map(cb => cb.value);
    tabla = 'admin_novedades'; asunto = '🚚 [Novedades Operativas] Cambios en Plataforma';
  }

  if (ids.length === 0) return mostrarNotificacion("Seleccioná al menos un elemento de la lista.", 'warning');

  const { data } = await supabaseClient.from(tabla).select('*').in('id', ids);
  
  let mensajeCuerpo = `Resumen de cambios enviados desde Control Hub:\n\n` + JSON.stringify(data, null, 2);

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      email_destino: EMAIL_ADMIN_GRUPO,
      asunto: asunto,
      mensaje: mensajeCuerpo
    });
    mostrarNotificacion(`📧 Notificación enviada exitosamente a ${EMAIL_ADMIN_GRUPO}`, 'success');
  } catch (err) {
    mostrarNotificacion("❌ Error al enviar mail: " + (err.text || err.message || JSON.stringify(err)), 'danger');
  }
}

function seleccionarTodosClientes(checked) {
  document.querySelectorAll('.cliente-checkbox').forEach(input => {
    input.checked = checked;
  });
  const headerCheckbox = document.getElementById('chkTodosClientesTabla');
  const toolbarCheckbox = document.getElementById('chkTodosClientes');
  if (headerCheckbox) headerCheckbox.checked = checked;
  if (toolbarCheckbox) toolbarCheckbox.checked = checked;
}

async function aplicarCambiosMasivosClientes() {
  const sessionOk = await requireAuth();
  if (!sessionOk || !canWrite()) return;

  const ids = Array.from(document.querySelectorAll('.cliente-checkbox:checked')).map(input => input.value);
  const estado = document.getElementById('bulkEstadoCliente')?.value || '';
  if (!ids.length) return mostrarNotificacion('Seleccioná al menos un cliente.', 'warning');
  if (!estado) return mostrarNotificacion('Elegí un estado para aplicar.', 'warning');

  const { error } = await supabaseClient.from('clientes').update({ estado }).in('id', ids);
  if (error) return mostrarNotificacion('No se pudieron aplicar los cambios: ' + error.message, 'danger');
  clientesData.forEach(cliente => {
    if (ids.includes(String(cliente.id))) cliente.estado = estado;
  });
  document.getElementById('bulkEstadoCliente').value = '';
  mostrarNotificacion('Estados de clientes actualizados.', 'success');
  renderTablaEnvios();
}

async function eliminarClientesSeleccionados() {
  const sessionOk = await requireAuth();
  if (!sessionOk || !canDelete()) return;

  const ids = Array.from(document.querySelectorAll('.cliente-checkbox:checked')).map(input => input.value);
  if (!ids.length) return mostrarNotificacion('Seleccioná al menos un cliente.', 'warning');

  const confirmar = await confirmarAccionModal('Eliminar clientes', `¿Eliminar los ${ids.length} clientes seleccionados?`);
  if (!confirmar) return;

  const { error } = await supabaseClient.from('clientes').delete().in('id', ids);
  if (error) return mostrarNotificacion('No se pudieron eliminar los clientes: ' + error.message, 'danger');
  clientesData = clientesData.filter(cliente => !ids.includes(String(cliente.id)));
  mostrarNotificacion('Clientes eliminados.', 'success');
  renderTablaEnvios();
}

async function eliminarTemplate(id) {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canDelete()) return mostrarNotificacion('Solo un admin puede eliminar referencias de plantillas.', 'danger');

  const confirmar = await confirmarAccionModal('Eliminar plantilla', `¿Eliminar la referencia de plantilla "${id}" de Supabase?`);
  if (!confirmar) return;

  const { error } = await supabaseClient.from('templates').delete().eq('id', id);
  if (error) return mostrarNotificacion('Error al eliminar la referencia: ' + error.message, 'danger');

  mostrarNotificacion('Plantilla eliminada.', 'success');
  await cargarDatosEnvios();
}

// =======================================================
// GESTIÓN DE CONFIGURACIÓN Y APIS (Exclusivo Admin)
// =======================================================
async function cargarConfiguracionesSistema() {
  const sessionOk = await requireAuth();
  if (!sessionOk || !canDelete()) return;

  const tbody = document.getElementById('tblConfiguracionesSistema');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando configuraciones...</td></tr>';

  const { data, error } = await supabaseClient
    .from('configuraciones_sistema')
    .select('*')
    .order('clave', { ascending: true });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error al cargar configuraciones: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-muted">No hay configuraciones registradas en Supabase.</td></tr>';
    return;
  }

  // Actualizar caché de AppConfig en memoria
  data.forEach(item => {
    if (window.AppConfig) window.AppConfig.set(item.clave, item.valor);
  });

  tbody.innerHTML = data.map(item => {
    const inputType = item.es_secreta ? 'password' : 'text';
    const toggleButton = item.es_secreta ? `
      <button class="btn btn-outline-secondary btn-sm" type="button" onclick="togglePasswordVisibility('config-${item.clave}', this)" title="Mostrar / Ocultar">
        <i class="bi bi-eye"></i>
      </button>` : '';

    return `
      <tr data-config-key="${item.clave}">
        <td>
          <strong class="font-monospace small text-primary">${escapeHtml(item.clave)}</strong>
          ${item.es_secreta ? '<span class="badge bg-secondary ms-1 small">Secreta</span>' : ''}
        </td>
        <td>
          <small class="text-muted">${escapeHtml(item.descripcion || '-')}</small>
        </td>
        <td>
          <div class="input-group input-group-sm">
            <input type="${inputType}" class="form-control config-input" id="config-${item.clave}" value="${escapeHtml(item.valor || '')}" placeholder="Ingresá ${escapeHtml(item.clave)}...">
            ${toggleButton}
          </div>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" type="button" onclick="guardarConfiguracionSistema('${item.clave}')">
            <i class="bi bi-floppy"></i> Guardar
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  if (btn) {
    btn.innerHTML = `<i class="bi ${isPass ? 'bi-eye-slash' : 'bi-eye'}"></i>`;
  }
}

async function guardarConfiguracionSistema(clave) {
  const sessionOk = await requireAuth();
  if (!sessionOk || !canDelete()) return;

  const input = document.getElementById(`config-${clave}`);
  if (!input) return;
  const nuevoValor = input.value.trim();

  const { error } = await supabaseClient
    .from('configuraciones_sistema')
    .update({ valor: nuevoValor, updated_at: new Date().toISOString() })
    .eq('clave', clave);

  if (error) {
    mostrarNotificacion(`Error al guardar "${clave}": ${error.message}`, 'danger');
    return;
  }

  if (window.AppConfig) {
    window.AppConfig.set(clave, nuevoValor);
  }

  mostrarNotificacion(`Configuración "${clave}" actualizada correctamente.`, 'success');
}

async function guardarTodasConfiguracionesSistema() {
  const sessionOk = await requireAuth();
  if (!sessionOk || !canDelete()) return;

  const rows = document.querySelectorAll('#tblConfiguracionesSistema tr[data-config-key]');
  if (!rows.length) return mostrarNotificacion('No hay configuraciones para guardar.', 'warning');

  const updates = [];
  rows.forEach(row => {
    const key = row.getAttribute('data-config-key');
    const input = row.querySelector('.config-input');
    if (key && input) {
      const val = input.value.trim();
      updates.push({ clave: key, valor: val });
    }
  });

  try {
    const promesas = updates.map(u => 
      supabaseClient
        .from('configuraciones_sistema')
        .update({ valor: u.valor, updated_at: new Date().toISOString() })
        .eq('clave', u.clave)
    );
    await Promise.all(promesas);

    updates.forEach(u => {
      if (window.AppConfig) window.AppConfig.set(u.clave, u.valor);
    });

    mostrarNotificacion(`Se guardaron las ${updates.length} variables correctamente.`, 'success');
  } catch (err) {
    mostrarNotificacion('Error al guardar configuraciones: ' + err.message, 'danger');
  }
}

// Exposición global
window.cargarConfiguracionesSistema = cargarConfiguracionesSistema;
window.guardarConfiguracionSistema = guardarConfiguracionSistema;
window.guardarTodasConfiguracionesSistema = guardarTodasConfiguracionesSistema;
window.togglePasswordVisibility = togglePasswordVisibility;