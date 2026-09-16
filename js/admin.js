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

window.mostrarPanelUsuarios = mostrarPanelUsuarios;

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
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">Sin clientes registrados.</td></tr>';
    return;
  }

  clientesData.forEach(c => {
    let badgeClass = 'badge-sin-aviso';
    if (c.estado === 'en proceso') badgeClass = 'badge-en-proceso';
    if (c.estado === 'enviado') badgeClass = 'badge-enviado';
    if (c.estado === 'error') badgeClass = 'badge-error';

    const tr = document.createElement('tr');

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
    meta.textContent = ` (${sanitizeText(t.id, 50)})`;
    item.appendChild(meta);

    const br = document.createElement('br');
    item.appendChild(br);

    const body = document.createElement('small');
    body.textContent = sanitizeText(t.cuerpo, 500) || '-';
    item.appendChild(body);

    list.appendChild(item);
  });
}

async function asignarPlantilla(clienteId, templateId) {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canWrite()) {
    alert('No tenés permisos para asignar plantillas.');
    return;
  }

  const cliente = clientesData.find(c => String(c.id) === String(clienteId));
  if (cliente) cliente.template_id = templateId;

  const { error } = await supabaseClient.from('clientes').update({ template_id: templateId }).eq('id', clienteId);
  if (error) alert("Error al asignar plantilla: " + error.message);
}

async function enviarMail(clienteId) {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canWrite()) {
    alert('No tenés permisos para enviar mails.');
    return;
  }

  const cliente = clientesData.find(c => String(c.id) === String(clienteId));
  if (!cliente || !cliente.template_id) return alert("Por favor, selecciona una plantilla.");

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
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
    await supabaseClient.from('clientes').update({ estado: 'enviado', fecha_envio: new Date() }).eq('id', clienteId);
    
    alert(`📧 Mail enviado con éxito a ${emailDestino}`);
    cargarDatosEnvios();
  } catch (err) {
    alert("❌ Error al enviar mail: " + JSON.stringify(err));
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
    alert('No tenés permisos para crear clientes.');
    return;
  }

  const nombre = sanitizeText(document.getElementById('newNombre').value, 100);
  const pedido = sanitizeText(document.getElementById('newPedido').value, 200);
  const mail = sanitizeEmail(document.getElementById('newMail').value);

  if (!nombre || !mail || !isValidEmail(mail)) return alert('Nombre y correo válido son requeridos.');

  const { error } = await supabaseClient.from('clientes').insert([{ nombre, pedido, mail, estado: 'sin aviso' }]);
  if (error) alert("Error al guardar: " + error.message);
  else {
    bootstrap.Modal.getInstance(document.getElementById('modalCliente')).hide();
    document.getElementById('formCliente').reset();
    cargarDatosEnvios();
  }
}

async function guardarTemplate() {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canWrite()) {
    alert('No tenés permisos para guardar plantillas.');
    return;
  }

  const id = sanitizeTemplateId(document.getElementById('tplId').value);
  const nombre = sanitizeText(document.getElementById('tplNombre').value, 150);
  const cuerpo = sanitizeText(document.getElementById('tplCuerpo').value, 2000);

  if (!id || !nombre || !cuerpo) return alert('Todos los campos son obligatorios.');

  const { error } = await supabaseClient.from('templates').insert([{ id, nombre, cuerpo }]);
  if (error) alert("Error al guardar plantilla: " + error.message);
  else {
    document.getElementById('formTemplate').reset();
    cargarDatosEnvios();
  }
}

async function eliminarCliente(id) {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canDelete()) {
    alert('Solo un admin puede eliminar clientes.');
    return;
  }

  if (confirm("¿Estás seguro de eliminar este registro?")) {
    await supabaseClient.from('clientes').delete().eq('id', id);
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
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">No se pudieron cargar los permisos.</td></tr>`;
    console.error(error);
    return;
  }

  tbody.innerHTML = '';

  if (!perfiles || perfiles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3">Sin usuarios registrados.</td></tr>';
    return;
  }

  perfiles.forEach(usuario => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${usuario.id ? usuario.id.slice(0, 8) : '-'}</strong></td>
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

async function guardarPermisoUsuario(userId) {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canDelete()) {
    alert('Solo el admin principal puede modificar permisos.');
    return;
  }

  const selector = document.querySelector(`[data-user-role-select="${userId}"]`);
  if (!selector) return;

  const nuevoRol = selector.value;
  const { error } = await supabaseClient.from('profiles').update({ role: nuevoRol }).eq('id', userId);

  if (error) {
    alert('Error al actualizar el rol: ' + error.message);
    return;
  }

  if (userId === (await supabaseClient.auth.getUser()).data.user?.id) {
    currentUserRole = nuevoRol;
    applyRolePermissions();
    toggleAdminOnlySections();
  }

  alert('Permiso actualizado correctamente.');
  await cargarDatosAdmin();
}

// GUARDADO DE REGISTROS
async function guardarNuevaPromoBancaria() {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canWrite()) {
    alert('No tenés permisos para crear promos bancarias.');
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

  if (error) alert("Error: " + error.message);
  else {
    bootstrap.Modal.getInstance(document.getElementById('modalNuevaPromoBancaria')).hide();
    cargarPromosBancarias();
  }
}

async function guardarNuevaNovedad() {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canWrite()) {
    alert('No tenés permisos para crear novedades.');
    return;
  }

  const id = sanitizeTemplateId(document.getElementById('nId').value);
  const categoria = sanitizeText(document.getElementById('nCategoria').value, 80);
  const descripcion = sanitizeText(document.getElementById('nDescripcion').value, 400);

  const { error } = await supabaseClient.from('admin_novedades').insert([{ id, categoria, descripcion, activa: 'Si' }]);

  if (error) alert("Error: " + error.message);
  else {
    bootstrap.Modal.getInstance(document.getElementById('modalNuevaNovedad')).hide();
    cargarNovedadesOperativas();
  }
}

// ENVÍO DE EMAIL CON SELECCIÓN
async function enviarMailsSeleccionados(tipo) {
  const sessionOk = await requireAuth();
  if (!sessionOk) return;
  if (!canWrite()) {
    alert('No tenés permisos para enviar notificaciones.');
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

  if (ids.length === 0) return alert("Seleccioná al menos un elemento de la lista.");

  const { data } = await supabaseClient.from(tabla).select('*').in('id', ids);
  
  let mensajeCuerpo = `Resumen de cambios enviados desde Control Hub:\n\n` + JSON.stringify(data, null, 2);

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      email_destino: EMAIL_ADMIN_GRUPO,
      asunto: asunto,
      mensaje: mensajeCuerpo
    });
    alert(`📧 Notificación enviada exitosamente a ${EMAIL_ADMIN_GRUPO}`);
  } catch (err) {
    alert("❌ Error al enviar mail: " + JSON.stringify(err));
  }
}