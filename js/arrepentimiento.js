// ==========================================
// MÓDULO: SOLICITUDES DE ARREPENTIMIENTO
// ==========================================

let listaArrepentimientos = [];
let vistaArrepentimientos = 'todas';
const EMAIL_TEMPLATE_ARREPENTIMIENTO_CAJA = 'arrepentimiento_caja';
const canalesArrepentimiento = [
  { value: 'web', label: 'Web' },
  { value: 'mercado libre', label: 'Mercado Libre' },
  { value: 'produteca', label: 'Produteca' },
  { value: 'sucursales', label: 'Sucursales' }
];
const sucursalesArrepentimiento = [
  { value: 'mvarela@casadelaudio.com', label: 'Tienda Prueba' },
  { value: 'ruta8@lacasadelaudio.com', label: 'Tienda Ruta 8 (San Martín)' },
  { value: 'sanmartin@lacasadelaudio.com', label: 'Tienda San Martín' },
  { value: 'rmejia@lacasadelaudio.com', label: 'Tienda Ramos Mejía' },
  { value: 'flores@lacasadelaudio.com', label: 'Tienda Flores' },
  { value: 'caballito@casadelaudio.com', label: 'Tienda Caballito' },
  { value: 'parque@lacasadelaudio.com', label: 'Tienda Parque Avellaneda' },
  { value: 'moron@lacasadelaudio.com', label: 'Tienda Morón' },
  { value: 'abasto@casadelaudio.com', label: 'Tienda Almagro / Abasto' },
  { value: 'sanjusto@lacasadelaudio.com', label: 'Tienda San Justo' },
  { value: 'ituzaingo@lacasadelaudio.com', label: 'Tienda Ituzaingó' },
  { value: 'leloir@casadelaudio.com', label: 'Megastore Leloir' },
  { value: 'sanfernando@casadelaudio.com', label: 'Tienda San Fernando' },
  { value: 'sanmiguel@casadelaudio.com', label: 'Tienda San Miguel' },
  { value: 'laferrere@casadelaudio.com', label: 'Tienda Laferrere' },
  { value: 'merlo@casadelaudio.com', label: 'Tienda Merlo' },
  { value: 'jose-paz-sin-email', label: 'Tienda José C. Paz (sin email)' },
  { value: 'lomas@lacasadelaudio.com', label: 'Tienda Lomas de Zamora' },
  { value: 'moreno2@lacasadelaudio.com', label: 'Tienda Moreno II' },
  { value: 'moreno3@lacasadelaudio.com', label: 'Tienda Moreno III' },
  { value: 'monte-grande-sin-email', label: 'Tienda Monte Grande (sin email)' },
  { value: 'canning@lacasadelaudio.com', label: 'Tienda Canning' },
  { value: 'quilmes@lacasadelaudio.com', label: 'Tienda Quilmes' },
  { value: 'solano@lacasadelaudio.com', label: 'Tienda Solano' },
  { value: 'pilar@lacasadelaudio.com', label: 'Megastore Pilar' },
  { value: 'berazategui@lacasadelaudio.com', label: 'Tienda Berazategui' }
];

function esEmailArrepentimiento(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function opcionesSucursalesArrepentimiento(valorActual = '') {
  const existe = sucursalesArrepentimiento.some(sucursal => sucursal.value === valorActual);
  const opciones = existe || !valorActual
    ? sucursalesArrepentimiento
    : [...sucursalesArrepentimiento, { value: valorActual, label: valorActual }];
  return `<option value="">Seleccionar sucursal...</option>${opciones.map(sucursal =>
    `<option value="${escapeHtml(sucursal.value)}" ${sucursal.value === valorActual ? 'selected' : ''}>${escapeHtml(sucursal.label)}</option>`
  ).join('')}`;
}

function nombreSucursalArrepentimiento(valor) {
  const sucursal = sucursalesArrepentimiento.find(item => item.value === valor);
  return sucursal?.label || valor || '';
}

function getDestinatarioFacturacion() {
  return window.AppConfig ? window.AppConfig.get('DESTINATARIO_FACTURACION') : 'mvarela@casadelaudio.com';
}

function getGoogleSheetWebhookUrl() {
  return window.AppConfig ? window.AppConfig.get('GOOGLE_SHEET_ARCHIVE_WEBHOOK_URL') : "https://script.google.com/macros/s/AKfycbyOHK_tiJJgVY9HffudGWQuyfCIIld70VpFg7d4EonvYe2dbOm30p8CAqm9rczkQv9R/exec";
}

// Auxiliares locales de formateo y parsing
function arrepentimientoCsvEscape(value) {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function arrepentimientoNormalizarClave(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function arrepentimientoTextoSeguro(value, maxLength = 300) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function arrepentimientoNumeroSeguro(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function obtenerTemplateArrepentimiento(item) {
  return EMAILJS_TEMPLATE_ID;
}

function obtenerPlantillaEspecificaArrepentimiento(estado) {
  const templates = typeof plantillasEmailData !== 'undefined' ? plantillasEmailData : [];
  return templates.find(template => {
    const modulo = String(template.modulo || 'todos').trim().toLowerCase();
    return template.activo !== false &&
      template.es_contenido_app !== false &&
      ['arrepentimiento', 'todos'].includes(modulo) &&
      template.estado === estado;
  });
}

function obtenerPlantillaConfiguradaArrepentimiento(estado) {
  const templates = typeof plantillasEmailData !== 'undefined' ? plantillasEmailData : [];
  return obtenerPlantillaEspecificaArrepentimiento(estado) || templates.find(template => {
    const modulo = String(template.modulo || 'todos').trim().toLowerCase();
    return template.activo !== false &&
      template.es_contenido_app !== false &&
      ['arrepentimiento', 'todos'].includes(modulo) &&
      !template.estado;
  });
}

function opcionesPlantillasArrepentimiento(templateId = '') {
  const templates = typeof plantillasEmailData !== 'undefined' ? plantillasEmailData : [];
  return `<option value="">Sin plantilla específica</option>${templates
    .filter(template => {
      const modulo = String(template.modulo || 'todos').trim().toLowerCase();
      return template.activo !== false && ['arrepentimiento', 'todos'].includes(modulo);
    })
    .map(template => `<option value="${escapeHtml(template.id)}" ${String(template.id) === String(templateId) ? 'selected' : ''}>${escapeHtml(template.id)}</option>`)
    .join('')}`;
}

function reemplazarVariablesTemplate(texto, item) {
  const pId = item.pedido_id || item.numero_pedido || item.pedido || '';
  const variables = {
    cliente_nombre: item.cliente_nombre || '',
    cliente_dni: item.cliente_dni || '',
    cliente_telefono: item.cliente_telefono || '',
    cliente_email: item.cliente_email || item.cliente_mail || '',
    numero_orden: pId,
    motivo: item.motivo || '',
    otro: item.otro || '',
    comentario: item.comentario || '',
    monto_devolver: item.monto_devolver ?? '',
    canal: item.canal || '',
    estado: item.estado || '',
    sucursal: nombreSucursalArrepentimiento(item.sucursal)
  };

  return String(texto || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, variable) =>
    variables[variable] === undefined ? match : String(variables[variable])
  );
}

function textoPlanoArrepentimientoAHtml(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\r?\n/g, '<br>');
}

function obtenerContenidoTemplateArrepentimiento(item, fallback, estadoTemplate = item.estado) {
  const templates = typeof plantillasEmailData !== 'undefined' ? plantillasEmailData : [];
  const configurado = templates.find(template =>
    template.activo !== false &&
    template.es_contenido_app !== false &&
    ['arrepentimiento', 'todos'].includes(template.modulo || 'todos') &&
    template.estado === estadoTemplate
  ) || templates.find(template =>
    template.activo !== false &&
    template.es_contenido_app !== false &&
    ['arrepentimiento', 'todos'].includes(template.modulo || 'todos') &&
    !template.estado
  );

  return configurado?.cuerpo
    ? reemplazarVariablesTemplate(configurado.cuerpo, item)
    : fallback;
}

async function cargarArrepentimientos() {
  const tbody = document.getElementById('tblArrepentimientos');
  if (!tbody) return;
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;

  if (typeof cargarPlantillasEmail === 'function') {
    await cargarPlantillasEmail();
  }

  const { data, error } = await supabaseClient
    .from('arrepentimientos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="15" class="text-center text-danger">No se pudieron cargar: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  listaArrepentimientos = data || [];
  await cerrarArrepentimientosVencidos();
  renderizarArrepentimientos();
}

async function cerrarArrepentimientosVencidos() {
  const limite = Date.now() - (10 * 24 * 60 * 60 * 1000);
  const vencidos = listaArrepentimientos.filter(item =>
    ['Devuelve Sucursal', 'Retiro en domicilio'].includes(item.estado) &&
    item.fecha_envio && new Date(item.fecha_envio).getTime() <= limite
  );

  for (const item of vencidos) {
    const pId = item.pedido_id || item.numero_pedido || item.pedido || 'S/N';
    const webhook = getGoogleSheetWebhookUrl();
    if (webhook && !webhook.includes('TU_SCRIPT_ID')) {
      await fetch(webhook, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, hoja_destino: 'Cerrado sin gestion', estado_archivo: 'Cerrado sin gestion', motivo_cierre: 'Sin actividad durante 10 días' })
      });
    }
    const { error } = await supabaseClient.from('arrepentimientos').delete().eq('id', item.id);
    if (!error) {
      listaArrepentimientos = listaArrepentimientos.filter(actual => actual.id !== item.id);
      mostrarNotificacion(`La solicitud ${pId} se cerró por falta de actividad durante 10 días.`, 'warning');
    }
  }
}

function renderizarArrepentimientos() {
  const tbody = document.getElementById('tblArrepentimientos');
  if (!tbody) return;

  const q = (document.getElementById('buscarArrepentimiento')?.value || '').toLowerCase();
  const filtroEstado = document.getElementById('filtroEstadoArrepentimiento')?.value || '';
  const filtroEnvio = document.getElementById('filtroEnvioArrepentimiento')?.value || '';
  const contadorCaja = document.getElementById('contadorArrepentimientosCaja');
  if (contadorCaja) {
    contadorCaja.textContent = listaArrepentimientos.filter(item => item.estado === 'Enviado a Caja').length;
  }

  const filtrados = listaArrepentimientos.filter(item => {
    const searchable = [
      item.cliente_nombre, item.cliente_dni, item.cliente_telefono,
      item.cliente_email, item.cliente_mail, item.pedido_id,
      item.numero_pedido, item.motivo, item.otro, item.comentario,
      item.monto_devolver, item.canal
    ].join(' ').toLowerCase();

    const coincideTexto = !q || searchable.includes(q);
    const coincideEstado = !filtroEstado || item.estado === filtroEstado;
    const coincideEnvio = !filtroEnvio || (filtroEnvio === 'enviado' ? item.fecha_envio : !item.fecha_envio);
    const coincideVista = vistaArrepentimientos === 'caja'
      ? item.estado === 'Enviado a Caja'
      : item.estado !== 'Enviado a Caja';
    return coincideTexto && coincideEstado && coincideEnvio && coincideVista;
  });

  const resumenEl = document.getElementById('resumenArrepentimientos');
  if (resumenEl) resumenEl.textContent = `${filtrados.length} registros`;

  if (!filtrados.length) {
    tbody.innerHTML = '<tr><td colspan="15" class="text-center py-4">Sin registros coincidentes.</td></tr>';
    return;
  }

  const opcionesEstado = vistaArrepentimientos === 'caja'
    ? ['Enviado a Caja']
    : ['Devuelve Sucursal', 'Aviso Transferencia', 'Reembolso / anulacion Automatica', 'Retiro en domicilio', 'Enviado a Caja', 'Pre Cerrado', 'Cerrado', 'Cerrado sin gestion', 'Otros'];

  tbody.innerHTML = filtrados.map(item => {
    const pId = item.pedido_id || item.numero_pedido || item.pedido || '-';
    const esCaja = item.estado === 'Enviado a Caja';
    const emailCliente = item.cliente_email || item.cliente_mail || '';
    const emailTo = esCaja
      ? emailCliente
      : item.estado === 'Avisar a Sucursal' || item.estado === 'En espera de respuesta'
        ? item.emails_destino || ''
        : emailCliente;
    const canalActual = item.canal || '';
    const opcionesCanal = canalesArrepentimiento.some(canal => canal.value === canalActual)
      ? canalesArrepentimiento
      : [...canalesArrepentimiento, { value: canalActual, label: canalActual }];
    
    const opcionesPlantillaHtml = opcionesPlantillasArrepentimiento(item.template_id);
    const opcionesEstadoFila = ['Devuelve Sucursal', 'Avisar a Sucursal'].includes(item.estado)
      ? [...opcionesEstado, 'Avisar a Sucursal']
      : item.estado === 'En espera de respuesta'
        ? [...opcionesEstado, 'En espera de respuesta']
      : opcionesEstado;

    return `
      <tr data-id="${item.id}">
        <td class="text-center">
          <input type="checkbox" class="form-check-input chk-arrepentimiento" value="${item.id}">
        </td>
        <td>
          <strong>${escapeHtml(item.cliente_nombre || 'Sin nombre')}</strong><br>
          <small class="text-muted">DNI: ${escapeHtml(item.cliente_dni || '-')} | Tel: ${escapeHtml(item.cliente_telefono || '-')}<br>Email: ${escapeHtml(item.cliente_email || item.cliente_mail || '-')}</small>
        </td>
        <td><strong>${escapeHtml(pId)}</strong></td>
        <td class="col-motivo"><small>${escapeHtml(item.motivo || '-')}</small></td>
        <td class="col-otro">
          <input type="text" class="form-control form-control-sm" value="${escapeHtml(item.otro || '')}" placeholder="Otro..." onchange="actualizarArrepentimientoField('${item.id}', 'otro', this.value)">
        </td>
        <td>
          <input type="text" class="form-control form-control-sm" value="${escapeHtml(item.comentario || '')}" placeholder="Comentario interno..." onchange="actualizarArrepentimientoField('${item.id}', 'comentario', this.value)">
        </td>
        <td class="col-monto">
          <input type="number" min="0" step="0.01" class="form-control form-control-sm" value="${escapeHtml(item.monto_devolver ?? '')}" placeholder="0,00" onchange="actualizarArrepentimientoField('${item.id}', 'monto_devolver', this.value)">
        </td>
        <td class="col-canal">
          <select class="form-select form-select-sm" onchange="actualizarArrepentimientoField('${item.id}', 'canal', this.value)">
            <option value="">-</option>
            ${opcionesCanal.map(canal => `<option value="${escapeHtml(canal.value)}" ${canalActual === canal.value ? 'selected' : ''}>${escapeHtml(canal.label)}</option>`).join('')}
          </select>
        </td>
        <td>
          <select class="form-select form-select-sm" onchange="cambiarEstadoArrepentimiento('${item.id}', this.value)" ${esCaja ? 'disabled' : ''}>
            ${opcionesEstadoFila.map(opt => `<option value="${opt}" ${item.estado === opt ? 'selected' : ''}>${esCaja && opt === 'Enviado a Caja' ? 'Pendiente de Caja' : opt}</option>`).join('')}
            ${!opcionesEstadoFila.includes(item.estado) && item.estado ? `<option value="${escapeHtml(item.estado)}" selected>${escapeHtml(item.estado)}</option>` : ''}
          </select>
        </td>
        <td>
          <select class="form-select form-select-sm" onchange="actualizarArrepentimientoField('${item.id}', 'template_id', this.value)">
            ${opcionesPlantillaHtml}
          </select>
        </td>
        <td>
          <select class="form-select form-select-sm" onchange="actualizarSucursalArrepentimiento('${item.id}', this.value)" ${['Devuelve Sucursal', 'Avisar a Sucursal'].includes(item.estado) ? '' : 'disabled'}>
            ${opcionesSucursalesArrepentimiento(item.sucursal || '')}
          </select>
        </td>
        <td>
          <input type="text" class="form-control form-control-sm${esCaja ? ' recipient-fixed' : ''}" value="${escapeHtml(emailTo)}" placeholder="destino@casadelaudio.com" ${esCaja ? 'readonly' : ''} onchange="actualizarArrepentimientoField('${item.id}', 'emails_destino', this.value)">
        </td>
        <td><span class="badge ${['Notificado cliente', 'Notificada Sucursal'].includes(item.estado_cliente) ? 'bg-success' : 'bg-warning text-dark'}">${escapeHtml(item.estado_cliente || (esCaja ? 'Pendiente de Caja' : 'Pendiente'))}</span></td>
        <td><small>${item.fecha_envio ? new Date(item.fecha_envio).toLocaleString('es-AR') : '-'}</small></td>
        <td class="text-end text-nowrap">
          <button class="btn btn-primary btn-sm me-1" onclick="enviarMailArrepentimiento('${item.id}')" data-role-action="write" title="Enviar Notificación">
            <i class="bi bi-send"></i>
          </button>
          <button class="btn btn-outline-danger btn-sm" onclick="eliminarArrepentimiento('${item.id}')" data-role-action="delete" title="Borrar fila">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (typeof applyRolePermissions === 'function') applyRolePermissions();
}

function cambiarVistaArrepentimientos(vista) {
  vistaArrepentimientos = vista === 'caja' ? 'caja' : 'todas';
  const filtroEstado = document.getElementById('filtroEstadoArrepentimiento');
  if (filtroEstado) {
    filtroEstado.value = '';
    filtroEstado.disabled = vistaArrepentimientos === 'caja';
  }
  document.getElementById('subnavArrepentimientosTodas')?.classList.toggle('active', vistaArrepentimientos === 'todas');
  document.getElementById('subnavArrepentimientosCaja')?.classList.toggle('active', vistaArrepentimientos === 'caja');
  renderizarArrepentimientos();
}

function filtrarArrepentimientos() {
  renderizarArrepentimientos();
}

function seleccionarTodosArrepentimientos(checked) {
  document.querySelectorAll('.chk-arrepentimiento').forEach(input => {
    input.checked = checked;
  });
}

function obtenerArrepentimientosSeleccionados() {
  return Array.from(document.querySelectorAll('.chk-arrepentimiento:checked')).map(input => input.value);
}

async function aplicarCambiosMasivosArrepentimientos() {
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  if (typeof canWrite === 'function' && !canWrite()) return mostrarNotificacion('No tenés permisos para modificar registros.', 'danger');

  const ids = obtenerArrepentimientosSeleccionados();
  const estado = document.getElementById('bulkEstadoArrepentimiento')?.value || '';
  const canal = document.getElementById('bulkCanalArrepentimiento')?.value || '';
  if (!ids.length) return mostrarNotificacion('Seleccioná al menos una fila.', 'warning');
  if (!estado && !canal) return mostrarNotificacion('Elegí un estado o canal para aplicar.', 'warning');

  if (estado === 'Cerrado' || estado === 'Cerrado sin gestion' || estado === 'Devuelve Sucursal' || estado === 'Avisar a Sucursal') {
    if (canal) {
      const { error: canalError } = await supabaseClient.from('arrepentimientos').update({ canal }).in('id', ids);
      if (canalError) return mostrarNotificacion('No se pudo actualizar el canal: ' + canalError.message, 'danger');
    }
    for (const id of ids) {
      await cambiarEstadoArrepentimiento(id, estado);
    }
    return;
  }

  const cambios = {};
  if (estado) cambios.estado = estado;
  if (estado === 'Devuelve Sucursal') cambios.sucursal = '';
  if (canal) cambios.canal = canal;
  if (estado === 'Enviado a Caja') cambios.emails_destino = getDestinatarioFacturacion();
  const { error } = await supabaseClient.from('arrepentimientos').update(cambios).in('id', ids);
  if (error) return mostrarNotificacion('No se pudieron aplicar los cambios: ' + error.message, 'danger');

  if (estado && estado !== 'Enviado a Caja') {
    const actualizacionesDestinatario = listaArrepentimientos
      .filter(item => ids.includes(String(item.id)))
      .map(item => supabaseClient.from('arrepentimientos').update({
        emails_destino: estado === 'Devuelve Sucursal'
          ? item.emails_destino || ''
          : item.cliente_email || item.cliente_mail || ''
      }).eq('id', item.id));
    await Promise.all(actualizacionesDestinatario);
  }

  listaArrepentimientos.forEach(item => {
    if (ids.includes(String(item.id))) {
      Object.assign(item, cambios);
      if (estado && estado !== 'Enviado a Caja') {
        item.emails_destino = estado === 'Devuelve Sucursal' ? item.cliente_email || item.cliente_mail || '' : item.cliente_email || item.cliente_mail || '';
        if (estado === 'Devuelve Sucursal') item.sucursal = '';
      }
    }
  });
  if (estado === 'Enviado a Caja') {
    for (const id of ids) {
      await enviarMailArrepentimiento(id, false, 'automatico-caja');
    }
  }
  document.getElementById('bulkEstadoArrepentimiento').value = '';
  document.getElementById('bulkCanalArrepentimiento').value = '';
  renderizarArrepentimientos();
  mostrarNotificacion(`Se actualizaron ${ids.length} registros.`, 'success');
}

async function eliminarArrepentimientosSeleccionados() {
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  if (typeof canDelete === 'function' && !canDelete()) return mostrarNotificacion('No tenés permisos para eliminar registros.', 'danger');

  const ids = obtenerArrepentimientosSeleccionados();
  if (!ids.length) return mostrarNotificacion('Seleccioná al menos una fila.', 'warning');

  const confirmar = await confirmarAccionModal('Eliminar registros seleccionados', `¿Estás seguro de eliminar las ${ids.length} solicitudes seleccionadas?`);
  if (!confirmar) return;

  const { error } = await supabaseClient.from('arrepentimientos').delete().in('id', ids);
  if (error) return mostrarNotificacion('No se pudieron eliminar los registros: ' + error.message, 'danger');

  listaArrepentimientos = listaArrepentimientos.filter(item => !ids.includes(String(item.id)));
  renderizarArrepentimientos();
  mostrarNotificacion(`Se eliminaron ${ids.length} registros.`, 'success');
}

async function enviarArrepentimientosSeleccionados() {
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  if (typeof canWrite === 'function' && !canWrite()) return mostrarNotificacion('No tenés permisos para enviar mails.', 'danger');

  const ids = obtenerArrepentimientosSeleccionados();
  if (!ids.length) return mostrarNotificacion('Seleccioná al menos una fila.', 'warning');

  const confirmar = await confirmarAccionModal('Enviar notificaciones', `¿Confirmás el envío de mails a las ${ids.length} solicitudes seleccionadas?`);
  if (!confirmar) return;

  let enviados = 0;
  for (const id of ids) {
    if (await enviarMailArrepentimiento(id, false)) enviados += 1;
  }
  renderizarArrepentimientos();
  mostrarNotificacion(`Se enviaron ${enviados} de ${ids.length} mails.`, enviados === ids.length ? 'success' : 'warning');
}

// IMPORTACIÓN DE ARCHIVOS CSV / EXCEL
async function importarArrepentimientosCSV(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  if (typeof canWrite === 'function' && !canWrite()) return mostrarNotificacion('No tenés permisos para importar solicitudes.', 'danger');

  try {
    const jsonRows = typeof leerArchivoPedidos === 'function'
      ? await leerArchivoPedidos(file)
      : await leerArchivoGenerico(file);

    if (!jsonRows || jsonRows.length === 0) return mostrarNotificacion('El archivo está vacío o no posee filas procesables.', 'warning');

    const { data: existentesDB } = await supabaseClient.from('arrepentimientos').select('pedido_id, numero_pedido, pedido');
    const setIDsBase = new Set((existentesDB || []).flatMap(x => [x.pedido_id, x.numero_pedido, x.pedido].filter(Boolean)));

    const registrosNuevos = [];
    const idsDuplicadosAlerta = [];

    for (const row of jsonRows) {
      const getVal = (keys) => {
        const foundKey = Object.keys(row).find(k => keys.some(alias => arrepentimientoNormalizarClave(alias) === arrepentimientoNormalizarClave(k)));
        return foundKey ? arrepentimientoTextoSeguro(row[foundKey]) : '';
      };

      const pedidoVal = getVal(['N° Orden de compra', 'Orden', 'Pedido', 'N° Pedido', 'N° Orden']) || 'S/N';
      if (pedidoVal !== 'S/N' && setIDsBase.has(pedidoVal)) {
        idsDuplicadosAlerta.push(pedidoVal);
      }

      const cliente = getVal(['Nombre y Apellido', 'Nombre', 'Cliente']);
      const dni = getVal(['DNI', 'Documento']);
      const tel = getVal(['Teléfono', 'Telefono', 'Tel']);
      const email = getVal(['Email', 'Mail']);
      const motivo1 = getVal(['Motivo 1', 'Motivo']);
      const otroVal = getVal(['Otro', 'Otro motivo', 'Otros', 'Motivo 2']);
      const canalVal = getVal(['Canal', 'Channel']);
      const comentarioVal = getVal(['Comentarios', 'Comentario']);
      const montoVal = getVal(['Monto a devolver', 'Monto', 'Importe']);
      const estadoOriginal = getVal(['Estado', 'Estado Pedido', 'Estado del pedido']) || 'Otros';
      const estadoVal = estadoOriginal === 'Devuelve en Sucursal' ? 'Devuelve Sucursal' : estadoOriginal;

      registrosNuevos.push({
        cliente_nombre: cliente || 'Sin Nombre',
        cliente_dni: dni || '',
        cliente_telefono: tel || '',
        cliente_email: email || '',
        cliente_mail: email || '',
        pedido_id: pedidoVal,
        numero_pedido: pedidoVal,
        pedido: pedidoVal,
        motivo: motivo1 || 'Arrepentimiento de compra',
        otro: otroVal || '',
        comentario: comentarioVal || '',
        monto_devolver: montoVal ? arrepentimientoNumeroSeguro(montoVal) : null,
        canal: canalVal || '',
        emails_destino: estadoVal === 'Enviado a Caja'
          ? getDestinatarioFacturacion()
          : (email || ''),
        estado: estadoVal
      });
    }

    if (idsDuplicadosAlerta.length > 0) {
      const confirmar = await confirmarAccionModal(
        'Pedidos duplicados detectados',
        `Se detectaron pedidos que ya existen en el sistema (${idsDuplicadosAlerta.slice(0, 3).join(', ')}...). ¿Deseas avanzar e importar de todas formas?`
      );
      if (!confirmar) return;
    }

    const { error } = await supabaseClient.from('arrepentimientos').insert(registrosNuevos);
    if (error) throw error;

    mostrarNotificacion(`Se importaron ${registrosNuevos.length} registros correctamente.`, 'success');
    await cargarArrepentimientos();

  } catch (err) {
    mostrarNotificacion('Error al importar el archivo: ' + err.message, 'danger');
  }
}

function leerArchivoGenerico(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const buffer = event.target.result;
        if (/\.csv$/i.test(file.name)) {
          const text = new TextDecoder('utf-8').decode(buffer);
          resolve(typeof parsearCsvLocal === 'function' ? parsearCsvLocal(text) : []);
          return;
        }
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(firstSheet, { defval: '' }));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}

async function actualizarArrepentimientoField(id, field, value) {
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  if (typeof canWrite === 'function' && !canWrite()) return;

  const item = listaArrepentimientos.find(x => String(x.id) === String(id));
  if (item) item[field] = value;

  const { error } = await supabaseClient.from('arrepentimientos').update({ [field]: value }).eq('id', id);
  if (error) console.error('Error al actualizar en Supabase:', error);
}

async function actualizarSucursalArrepentimiento(id, sucursal) {
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  if (typeof canWrite === 'function' && !canWrite()) return;

  const item = listaArrepentimientos.find(x => String(x.id) === String(id));
  if (!item) return;

  const emails_destino = item.estado === 'Avisar a Sucursal'
    ? (esEmailArrepentimiento(sucursal) ? sucursal : '')
    : item.cliente_email || item.cliente_mail || '';
  const { error } = await supabaseClient.from('arrepentimientos').update({ sucursal, emails_destino }).eq('id', id);
  if (error) {
    const mensaje = error.message?.includes("Could not find the 'sucursal' column")
      ? 'Falta actualizar Supabase: ejecutá ALTER TABLE public.arrepentimientos ADD COLUMN sucursal text;'
      : 'No se pudo guardar la sucursal: ' + error.message;
    mostrarNotificacion(mensaje, 'danger');
    return;
  }

  item.sucursal = sucursal;
  item.emails_destino = emails_destino;
  mostrarNotificacion(
    esEmailArrepentimiento(sucursal) ? 'Sucursal y destinatario actualizados.' : 'Sucursal guardada. Esta sucursal figura sin email.',
    esEmailArrepentimiento(sucursal) ? 'success' : 'warning'
  );
  renderizarArrepentimientos();
}

// CAMBIO DE ESTADO CON MODAL INTEGRADO
async function cambiarEstadoArrepentimiento(id, nuevoEstado) {
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  if (typeof canWrite === 'function' && !canWrite()) return;

  const item = listaArrepentimientos.find(x => String(x.id) === String(id));
  if (!item) return;

  if (nuevoEstado === 'Cerrado' || nuevoEstado === 'Cerrado sin gestion') {
    if (nuevoEstado === 'Cerrado' && vistaArrepentimientos === 'caja') {
      mostrarNotificacion('El cierre final se confirma desde la vista general.', 'warning');
      renderizarArrepentimientos();
      return;
    }
    const pId = item.pedido_id || item.numero_pedido || item.pedido || 'S/N';
    const hojaDestino = nuevoEstado === 'Cerrado sin gestion' ? 'Cerrado sin gestion' : 'Histórico';
    const confirmar = await confirmarAccionModal(
      nuevoEstado === 'Cerrado sin gestion' ? 'Cerrar sin gestión' : 'Cerrar y archivar solicitud',
      `La solicitud del pedido "${pId}" se enviará a la hoja "${hojaDestino}" y se eliminará de la tabla activa. ¿Confirmar?`
    );

    if (!confirmar) {
      renderizarArrepentimientos();
      return;
    }

    try {
      const webhook = getGoogleSheetWebhookUrl();
      if (webhook && !webhook.includes('TU_SCRIPT_ID')) {
        await fetch(webhook, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...item, hoja_destino: hojaDestino, estado_archivo: nuevoEstado })
        });
      }

      const { error } = await supabaseClient.from('arrepentimientos').delete().eq('id', id);
      if (error) throw error;

      mostrarNotificacion(`Pedido ${pId} cerrado y archivado correctamente.`, 'success');
      await cargarArrepentimientos();
      return;

    } catch (err) {
      mostrarNotificacion('Error al archivar el registro: ' + err.message, 'danger');
      return;
    }
  }

  if (nuevoEstado === 'Avisar a Sucursal' && !esEmailArrepentimiento(item.sucursal)) {
    mostrarNotificacion('Seleccioná una sucursal con email antes de avisarla.', 'warning');
    renderizarArrepentimientos();
    return;
  }

  const cambios = { estado: nuevoEstado };
  const estadoPlantilla = nuevoEstado === 'Enviado a Caja' ? 'Pendiente de Caja' : nuevoEstado;
  const plantillaEspecifica = obtenerPlantillaEspecificaArrepentimiento(estadoPlantilla);
  if (!plantillaEspecifica) {
    mostrarNotificacion(`Advertencia: el estado "${estadoPlantilla}" no tiene una plantilla específica asociada.`, 'warning');
  }
  const plantillaEstado = obtenerPlantillaConfiguradaArrepentimiento(estadoPlantilla);
  if (plantillaEstado) cambios.template_id = plantillaEstado.id;
  cambios.estado_cliente = nuevoEstado === 'Enviado a Caja'
    ? 'Pendiente de Caja'
    : item.estado_cliente || 'Pendiente';
  cambios.emails_destino = nuevoEstado === 'Enviado a Caja'
    ? getDestinatarioFacturacion()
    : nuevoEstado === 'Avisar a Sucursal'
      ? item.sucursal
      : nuevoEstado === 'Devuelve Sucursal'
        ? item.cliente_email || item.cliente_mail || ''
      : item.cliente_email || item.cliente_mail || '';
  const { error } = await supabaseClient.from('arrepentimientos').update(cambios).eq('id', id);
  if (error) return mostrarNotificacion('No se pudo cambiar el estado: ' + error.message, 'danger');
  Object.assign(item, cambios);

  if (nuevoEstado === 'Enviado a Caja') {
    const enviado = await enviarMailArrepentimiento(id, false, 'automatico-caja');
    if (!enviado) {
      mostrarNotificacion('El pedido quedó en Enviado a Caja, pero no se pudo enviar el aviso automático.', 'warning');
      renderizarArrepentimientos();
      return;
    }
  }
  renderizarArrepentimientos();
}

// BORRADO CON MODAL INTEGRADO
async function eliminarArrepentimiento(id) {
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  if (typeof canDelete === 'function' && !canDelete()) return mostrarNotificacion('No tenés permisos para eliminar registros.', 'danger');

  const confirmar = await confirmarAccionModal('Eliminar Registro', '¿Estás seguro de eliminar este registro de arrepentimiento?');
  if (!confirmar) return;

  const { error } = await supabaseClient.from('arrepentimientos').delete().eq('id', id);
  if (error) return mostrarNotificacion('Error al borrar: ' + error.message, 'danger');

  listaArrepentimientos = listaArrepentimientos.filter(x => String(x.id) !== String(id));
  mostrarNotificacion('Registro eliminado correctamente.', 'success');
  renderizarArrepentimientos();
}

// EXPORTAR SELECCIONADOS
function exportarSeleccionadosArrepentimientosCSV() {
  const seleccionadosIDs = Array.from(document.querySelectorAll('.chk-arrepentimiento:checked')).map(chk => chk.value);
  if (!seleccionadosIDs.length) return mostrarNotificacion('Seleccioná al menos un registro con la casilla izquierda.', 'warning');

  const filtrados = listaArrepentimientos.filter(item => seleccionadosIDs.includes(String(item.id)));
  generarDescargaCSVArrepentimiento(filtrados, `arrepentimientos_seleccionados_${new Date().toISOString().slice(0,10)}.csv`);
  mostrarNotificacion('Archivo CSV generado con éxito.', 'success');
}

function exportarArrepentimientosCSV() {
  if (!listaArrepentimientos.length) return mostrarNotificacion('No hay datos para exportar.', 'warning');
  generarDescargaCSVArrepentimiento(listaArrepentimientos, `arrepentimientos_todos_${new Date().toISOString().slice(0,10)}.csv`);
}

function generarDescargaCSVArrepentimiento(datos, nombreArchivo) {
  const headers = ['Cliente', 'DNI', 'Telefono', 'Email', 'Pedido', 'Motivo', 'Otro', 'Comentario Interno', 'Monto a devolver', 'Canal', 'Sucursal', 'Estado Pedido', 'Destinatario', 'Estado Cliente', 'Fecha Envío'];
  const csvRows = [
    headers.join(';'),
    ...datos.map(item => [
      arrepentimientoCsvEscape(item.cliente_nombre || ''),
      arrepentimientoCsvEscape(item.cliente_dni || ''),
      arrepentimientoCsvEscape(item.cliente_telefono || ''),
      arrepentimientoCsvEscape(item.cliente_email || item.cliente_mail || ''),
      arrepentimientoCsvEscape(item.pedido_id || item.numero_pedido || item.pedido || ''),
      arrepentimientoCsvEscape(item.motivo || ''),
      arrepentimientoCsvEscape(item.otro || ''),
      arrepentimientoCsvEscape(item.comentario || ''),
      arrepentimientoCsvEscape(item.monto_devolver || ''),
      arrepentimientoCsvEscape(item.canal || ''),
      arrepentimientoCsvEscape(item.sucursal || ''),
      arrepentimientoCsvEscape(item.estado || ''),
      arrepentimientoCsvEscape(item.emails_destino || ''),
      arrepentimientoCsvEscape(item.estado_cliente || 'Pendiente'),
      arrepentimientoCsvEscape(item.fecha_envio ? new Date(item.fecha_envio).toLocaleString('es-AR') : '')
    ].join(';'))
  ];

  const blob = new Blob(['\ufeff' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

async function enviarMailArrepentimiento(id, mostrarResultado = true, modo = 'manual') {
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  if (typeof canWrite === 'function' && !canWrite()) {
    mostrarNotificacion('No tenés permisos para enviar correos.', 'danger');
    return;
  }

  const item = listaArrepentimientos.find(x => String(x.id) === String(id));
  if (!item) return;

  if (modo === 'manual') {
    modo = item.estado === 'Devuelve Sucursal'
      ? 'aviso-cliente-sucursal'
      : item.estado === 'Avisar a Sucursal'
        ? 'aviso-sucursal'
        : modo;
  }

  const esCaja = item.estado === 'Enviado a Caja';
  const esAvisoAutomaticoCaja = modo === 'automatico-caja';
  const esAvisoClienteSucursal = modo === 'aviso-cliente-sucursal';
  const esAvisoSucursal = modo === 'aviso-sucursal';
  const emailCliente = item.cliente_email || item.cliente_mail || '';
  const destino = esAvisoAutomaticoCaja
    ? getDestinatarioFacturacion()
    : esAvisoSucursal
      ? item.sucursal
      : esAvisoClienteSucursal
        ? emailCliente
    : esCaja
      ? emailCliente
      : item.emails_destino || emailCliente;
  if (!destino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino.trim())) {
    const errorMsg = `No hay un email de destino válido: ${destino || 'Vacio'}`;
    if (mostrarResultado) mostrarNotificacion(errorMsg, 'warning');
    await registrarErrorArrepentimiento(errorMsg, `Pedido ${item.pedido_id || 'S/N'}`);
    return false;
  }

  try {
    const pId = item.pedido_id || item.numero_pedido || item.pedido || 'S/N';
    const templateId = esAvisoAutomaticoCaja
      ? EMAIL_TEMPLATE_ARREPENTIMIENTO_CAJA
      : obtenerTemplateArrepentimiento(item);
    const fechaSolicitud = item.fecha || item.created_at;
    const timestamp = fechaSolicitud
      ? new Date(fechaSolicitud).toLocaleString('es-AR')
      : '-';
    const asunto = `Solicitud de arrepentimiento - Orden ${pId}`;
    const mensajeBase = esAvisoAutomaticoCaja
      ? [
          'Se registró una solicitud desde la planilla "boton-arrepentimiento".',
          '',
          `Marca temporal: ${timestamp}`,
          `Nombre y Apellido: ${item.cliente_nombre || '-'}`,
          `DNI: ${item.cliente_dni || '-'}`,
          `Teléfono: ${item.cliente_telefono || '-'}`,
          `Email: ${emailCliente || '-'}`,
          `N° de Orden: ${pId}`,
          `Motivo: ${item.motivo || '-'}`,
          `Otros: ${item.otro || '-'}`,
          `Comentario: ${item.comentario || '-'}`,
          `Monto a devolver: ${item.monto_devolver ?? '-'}`,
          `Canal: ${item.canal || '-'}`,
          `Estado: ${item.estado || '-'}`
        ].join('\n')
      : esAvisoSucursal
        ? `Se informa que se enviará una devolución correspondiente a la orden ${pId}. Por favor, aguardá el ingreso del producto en la sucursal seleccionada.`
        : esAvisoClienteSucursal
          ? `Para continuar con la devolución de tu orden ${pId}, acercá el producto a la sucursal que te será informada y presentá el número de orden. Conservá la constancia de entrega.`
      : `Se realizó la anulación y devolución correspondiente a tu orden ${pId}.`;
    const estadoTemplate = esCaja && !esAvisoAutomaticoCaja ? 'Pendiente de Caja' : item.estado;
    const mensaje = esAvisoAutomaticoCaja
      ? mensajeBase
      : obtenerContenidoTemplateArrepentimiento(item, mensajeBase, estadoTemplate);
    const templateConfigurado = !esAvisoAutomaticoCaja && typeof plantillasEmailData !== 'undefined'
      ? plantillasEmailData.find(template =>
          template.activo !== false &&
          template.es_contenido_app !== false &&
          ['arrepentimiento', 'todos'].includes(template.modulo || 'todos') &&
          (template.estado === estadoTemplate || !template.estado)
        )
      : null;
    const asuntoFinal = templateConfigurado?.nombre
      ? reemplazarVariablesTemplate(templateConfigurado.nombre, item)
      : asunto;
    await emailjs.send(EMAILJS_SERVICE_ID, templateId, {
      email_destino: destino.trim(),
      asunto: asuntoFinal,
      mensaje,
      mensaje_html: textoPlanoArrepentimientoAHtml(mensaje),
      numero_orden: pId,
      timestamp,
      cliente_nombre: item.cliente_nombre || '-',
      cliente_dni: item.cliente_dni || '-',
      cliente_telefono: item.cliente_telefono || '-',
      cliente_email: emailCliente || '-',
      motivo: item.motivo || '-',
      otro: item.otro || '-',
      comentario: item.comentario || '-',
      monto_devolver: esAvisoAutomaticoCaja ? (item.monto_devolver ?? '-') : '',
      canal: item.canal || '-',
      estado: item.estado || '-'
    });

    const now = new Date().toISOString();
    const debeEsperarRespuesta = esAvisoSucursal || ['Aviso Transferencia', 'Reembolso / anulacion Automatica'].includes(item.estado);
    const estadoLuegoDelEnvio = esAvisoAutomaticoCaja
      ? 'Enviado a Caja'
      : debeEsperarRespuesta
        ? 'En espera de respuesta'
      : esAvisoClienteSucursal
        ? 'Avisar a Sucursal'
      : esCaja
        ? 'Pre Cerrado'
        : item.estado;
    const plantillaLuegoDelEnvio = esAvisoClienteSucursal
      ? obtenerPlantillaConfiguradaArrepentimiento('Avisar a Sucursal')?.id || item.template_id || null
      : item.template_id || null;
    const destinatarioLuegoDelEnvio = esAvisoAutomaticoCaja
      ? getDestinatarioFacturacion()
      : esAvisoSucursal
        ? destino.trim()
      : esCaja
        ? ''
        : destino.trim();
    const estadoClienteLuegoDelEnvio = esAvisoAutomaticoCaja
      ? 'Pendiente de Caja'
      : esAvisoSucursal
        ? 'Notificada Sucursal'
        : 'Notificado cliente';
    const { error: updateError } = await supabaseClient.from('arrepentimientos').update({
      fecha_envio: now,
      estado_cliente: estadoClienteLuegoDelEnvio,
      check_envio: true,
      estado: estadoLuegoDelEnvio,
      template_id: plantillaLuegoDelEnvio,
      emails_destino: destinatarioLuegoDelEnvio
    }).eq('id', id);
    if (updateError) throw updateError;

    item.fecha_envio = now;
    item.estado_cliente = estadoClienteLuegoDelEnvio;
    item.check_envio = true;
    item.estado = estadoLuegoDelEnvio;
    item.template_id = plantillaLuegoDelEnvio;
    item.emails_destino = destinatarioLuegoDelEnvio;

    if (mostrarResultado) {
      mostrarNotificacion(esAvisoSucursal ? 'Email enviado a la sucursal. El pedido quedó en espera de respuesta.' : esAvisoClienteSucursal ? 'Email enviado al cliente con los pasos de devolución.' : debeEsperarRespuesta ? 'Email enviado. El pedido quedó en espera de respuesta.' : esCaja ? 'Email enviado al cliente. El pedido pasó a Pre Cerrado.' : 'Email enviado con éxito.', 'success');
      renderizarArrepentimientos();
    }
    return true;

  } catch (err) {
    const errorStr = err.message || JSON.stringify(err);
    if (mostrarResultado) mostrarNotificacion('Error al enviar correo: ' + errorStr, 'danger');
    await registrarErrorArrepentimiento(errorStr, `Pedido ${item.pedido_id || 'S/N'}`);
    return false;
  }
}

async function registrarErrorArrepentimiento(mensaje, referencia) {
  if (typeof registrarLogApp === 'function') {
    await registrarLogApp('Arrepentimientos', 'Error', referencia, mensaje);
  }
}

// ==========================================
// CARGA MANUAL DE SOLICITUDES
// ==========================================
async function abrirModalNuevoArrepentimiento() {
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  if (typeof canWrite === 'function' && !canWrite()) {
    return mostrarNotificacion('No tenés permisos para cargar solicitudes.', 'danger');
  }

  // Cargar plantillas si no estuviesen cargadas y poblar el selector
  if (typeof cargarPlantillasEmail === 'function') {
    await cargarPlantillasEmail();
  }
  const selectPlantilla = document.getElementById('arrTemplateId');
  if (selectPlantilla && typeof opcionesPlantillasEmail === 'function') {
    selectPlantilla.innerHTML = opcionesPlantillasEmail('');
  }

  const aviso = document.getElementById('arrAvisoCajaModal');
  if (aviso) aviso.style.display = 'none';

  const modalEl = document.getElementById('modalNuevoArrepentimiento');
  if (modalEl) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

function onCambioEstadoNuevoArrepentimiento() {
  const estado = document.getElementById('arrEstadoPedido')?.value;
  const aviso = document.getElementById('arrAvisoCajaModal');
  if (aviso) {
    aviso.style.display = estado === 'Enviado a Caja' ? 'block' : 'none';
  }
}

async function guardarNuevoArrepentimiento(event) {
  if (event) event.preventDefault();

  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  if (typeof canWrite === 'function' && !canWrite()) {
    return mostrarNotificacion('No tenés permisos para crear registros.', 'danger');
  }

  const cliente_nombre = arrepentimientoTextoSeguro(document.getElementById('arrClienteNombre')?.value, 150);
  const cliente_email = arrepentimientoTextoSeguro(document.getElementById('arrClienteEmail')?.value, 200).toLowerCase();
  const cliente_dni = arrepentimientoTextoSeguro(document.getElementById('arrClienteDni')?.value, 40);
  const cliente_telefono = arrepentimientoTextoSeguro(document.getElementById('arrClienteTelefono')?.value, 50);
  const pedidoVal = arrepentimientoTextoSeguro(document.getElementById('arrPedidoId')?.value, 80);
  const canal = document.getElementById('arrCanal')?.value || '';
  const montoVal = document.getElementById('arrMontoDevolver')?.value;
  const motivo = document.getElementById('arrMotivo')?.value || 'Arrepentimiento de compra';
  const otro = arrepentimientoTextoSeguro(document.getElementById('arrOtro')?.value, 200);
  const estado = document.getElementById('arrEstadoPedido')?.value || 'Otros';
  const sucursalSelect = document.getElementById('arrSucursal');
  const sucursal = sucursalSelect?.value || '';
  const template_id = obtenerPlantillaConfiguradaArrepentimiento(estado)?.id || '';
  const comentario = arrepentimientoTextoSeguro(document.getElementById('arrComentario')?.value, 500);

  if (!cliente_nombre || !cliente_email || !pedidoVal) {
    return mostrarNotificacion('Nombre, email y número de pedido son obligatorios.', 'warning');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente_email)) {
    return mostrarNotificacion('Por favor ingresá un email válido.', 'warning');
  }

  if (estado === 'Devuelve Sucursal' && !sucursal) {
    return mostrarNotificacion('Seleccioná una sucursal.', 'warning');
  }

  if (!obtenerPlantillaEspecificaArrepentimiento(estado)) {
    mostrarNotificacion(`Advertencia: el estado "${estado}" no tiene una plantilla específica asociada.`, 'warning');
  }

  // Verificar si ya existe en la lista en memoria
  const yaExiste = listaArrepentimientos.some(x => 
    String(x.pedido_id || x.numero_pedido || x.pedido || '').trim().toLowerCase() === pedidoVal.toLowerCase()
  );
  if (yaExiste) {
    const confirmar = await confirmarAccionModal(
      'Pedido duplicado detectado',
      `Ya existe un registro con el número de pedido "${pedidoVal}". ¿Deseas crearlo de todas formas?`
    );
    if (!confirmar) return;
  }

  const submitBtn = document.getElementById('btnGuardarNuevoArrepentimiento');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Guardando...';
  }

  const emails_destino = estado === 'Enviado a Caja'
    ? getDestinatarioFacturacion()
    : estado === 'Devuelve Sucursal'
      ? cliente_email
      : cliente_email;

  const nuevoRegistro = {
    cliente_nombre,
    cliente_dni,
    cliente_telefono,
    cliente_email,
    cliente_mail: cliente_email,
    pedido_id: pedidoVal,
    numero_pedido: pedidoVal,
    pedido: pedidoVal,
    canal,
    monto_devolver: montoVal ? arrepentimientoNumeroSeguro(montoVal) : null,
    motivo,
    otro,
    sucursal,
    template_id: template_id || null,
    comentario,
    estado,
    emails_destino,
    estado_cliente: 'Pendiente',
    check_envio: false
  };

  try {
    const { data, error } = await supabaseClient
      .from('arrepentimientos')
      .insert([nuevoRegistro])
      .select();

    if (error) throw error;

    const registroInsertado = data && data[0] ? data[0] : null;
    if (registroInsertado) {
      listaArrepentimientos.unshift(registroInsertado);
    }

    if (estado === 'Enviado a Caja' && registroInsertado?.id) {
      if (submitBtn) {
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Enviando aviso a Caja...';
      }
      const enviado = await enviarMailArrepentimiento(registroInsertado.id, false, 'automatico-caja');
      if (enviado) {
        mostrarNotificacion(`Solicitud "${pedidoVal}" creada y aviso por correo enviado a Caja exitosamente.`, 'success');
      } else {
        mostrarNotificacion(`Solicitud "${pedidoVal}" creada, pero no se pudo enviar el aviso automático a Caja. Revisá los logs de errores.`, 'warning');
      }
    } else {
      mostrarNotificacion(`Solicitud para el pedido "${pedidoVal}" creada con éxito.`, 'success');
    }

    // Cerrar modal y resetear formulario
    const modalEl = document.getElementById('modalNuevoArrepentimiento');
    if (modalEl) {
      bootstrap.Modal.getInstance(modalEl)?.hide();
    }
    document.getElementById('formNuevoArrepentimiento')?.reset();
    const avisoCaja = document.getElementById('arrAvisoCajaModal');
    if (avisoCaja) avisoCaja.style.display = 'none';

    await cargarArrepentimientos();
  } catch (err) {
    mostrarNotificacion('Error al guardar la solicitud: ' + err.message, 'danger');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-check2"></i> Guardar Solicitud';
    }
  }
}

/**
 * DINÁMICA DE INTERFAZ: Modal Nuevo Arrepentimiento
 * Muestra/Oculta sucursales y alertas según el estado seleccionado
 */
document.addEventListener('DOMContentLoaded', () => {
    // Para que funcione al cargar dinámicamente la vista en la SPA, 
    // delegamos el evento al body o escuchamos cuando se abre el modal.
    
    document.body.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'arrEstadoPedido') {
            const estado = e.target.value;
            const contenedorSucursal = document.getElementById('contenedorSucursal');
            const selectSucursal = document.getElementById('arrSucursal');
            const selectPlantilla = document.getElementById('arrTemplateId');
            const avisoCaja = document.getElementById('arrAvisoCajaModal');

            const plantillaEstado = obtenerPlantillaConfiguradaArrepentimiento(estado);
            if (selectPlantilla && plantillaEstado) selectPlantilla.value = plantillaEstado.id;
            
            // Lógica para Sucursal
            if (estado === 'Devuelve Sucursal') {
                contenedorSucursal.classList.remove('d-none');
                selectSucursal.setAttribute('required', 'true');
            } else {
                contenedorSucursal.classList.add('d-none');
                selectSucursal.removeAttribute('required');
                selectSucursal.value = ''; // Limpiar selección
            }

            // Lógica visual para "Enviado a Caja"
            if (estado === 'Enviado a Caja') {
                avisoCaja.classList.remove('d-none');
            } else {
                avisoCaja.classList.add('d-none');
            }
        }
    });
});

// EXPOSICIÓN GLOBAL COMPLETA
window.cargarArrepentimientos = cargarArrepentimientos;
window.renderizarArrepentimientos = renderizarArrepentimientos;
window.cambiarVistaArrepentimientos = cambiarVistaArrepentimientos;
window.filtrarArrepentimientos = filtrarArrepentimientos;
window.seleccionarTodosArrepentimientos = seleccionarTodosArrepentimientos;
window.obtenerArrepentimientosSeleccionados = obtenerArrepentimientosSeleccionados;
window.aplicarCambiosMasivosArrepentimientos = aplicarCambiosMasivosArrepentimientos;
window.eliminarArrepentimientosSeleccionados = eliminarArrepentimientosSeleccionados;
window.enviarArrepentimientosSeleccionados = enviarArrepentimientosSeleccionados;
window.importarArrepentimientosCSV = importarArrepentimientosCSV;
window.actualizarArrepentimientoField = actualizarArrepentimientoField;
window.actualizarSucursalArrepentimiento = actualizarSucursalArrepentimiento;
window.cambiarEstadoArrepentimiento = cambiarEstadoArrepentimiento;
window.eliminarArrepentimiento = eliminarArrepentimiento;
window.exportarSeleccionadosArrepentimientosCSV = exportarSeleccionadosArrepentimientosCSV;
window.exportarArrepentimientosCSV = exportarArrepentimientosCSV;
window.enviarMailArrepentimiento = enviarMailArrepentimiento;
window.abrirLogsArrepentimiento = abrirLogsArrepentimiento;
window.abrirModalNuevoArrepentimiento = abrirModalNuevoArrepentimiento;
window.onCambioEstadoNuevoArrepentimiento = onCambioEstadoNuevoArrepentimiento;
window.guardarNuevoArrepentimiento = guardarNuevoArrepentimiento;

