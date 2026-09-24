// ==========================================
// MÓDULO 1: PEDIDOS DE MERCADERÍA
// ==========================================

let pedidosMercaderia = [];
let plantillasEmailData = [];

function plantillasPorModulo(modulo) {
  const moduloNormalizado = String(modulo || '').trim().toLowerCase();
  return plantillasEmailData.filter(template => {
    const moduloTemplate = String(template.modulo || 'todos').trim().toLowerCase();
    return ['todos', moduloNormalizado].includes(moduloTemplate);
  });
}

function etiquetaPlantilla(template) {
  return template.id || 'sin-id';
}

async function cargarPlantillasEmail() {
  const { data, error } = await supabaseClient.from('templates').select('*').order('nombre');
  if (error) {
    console.error('No se pudieron cargar las plantillas:', error.message);
    return [];
  }
  plantillasEmailData = (data || []).filter(template => template.activo !== false);
  const bulkTemplate = document.getElementById('bulkPlantillaPedido');
  if (bulkTemplate) {
    bulkTemplate.innerHTML = '<option value="">Cambiar plantilla...</option>' + plantillasPorModulo('pedidos')
      .map(template => `<option value="${escapeHtml(template.id)}">${escapeHtml(etiquetaPlantilla(template))}</option>`)
      .join('');
  }
  return plantillasEmailData;
}

function opcionesPlantillasEmail(templateId) {
  const options = ['<option value="">Seleccionar plantilla...</option>'];
  plantillasPorModulo('pedidos').forEach(template => {
    const selected = String(template.id) === String(templateId || '') ? ' selected' : '';
    options.push(`<option value="${escapeHtml(template.id)}"${selected}>${escapeHtml(etiquetaPlantilla(template))}</option>`);
  });
  return options.join('');
}

const PEDIDOS_COLUMNAS = {
  cod_suc_vta: ['Cod_Suc_Vta', 'Cod Suc Vta'],
  sucursal_vta: ['Sucursal_Vta', 'Sucursal Vta'],
  documento: ['Documento', 'Pedido', 'Nro Pedido'],
  fecha_venta: ['Fecha_Venta', 'Fecha Venta'],
  fecha_programada: ['Fecha_Programada', 'Fecha Programada'],
  clave: ['Clave'],
  familia: ['Familia'],
  articulo: ['Articulo', 'Artículo'],
  cantidad: ['Cantidad'],
  st_disponible: ['St_Disponible', 'St Disponible'],
  st_reservado: ['St_Reservado', 'St Reservado'],
  cod_suc_ent: ['Cod_Suc_Ent', 'Cod Suc Ent'],
  sucursal_ent: ['Sucursal_Ent', 'Sucursal Ent'],
  cod_cliente: ['Cod_Cliente', 'Cod Cliente', 'DNI'],
  cliente: ['Cliente', 'Nombre'],
  confirmo: ['Confirmo', 'Confirmado'],
  actualizado: ['Actualizado'],
  st_depo: ['st_depo', 'St_Depo', 'Stock Deposito', 'Stock Depósito'],
  estado: ['Estado'],
  emails_destino: ['Emails Destino', 'Emails', 'Mail', 'Correo'],
  desde_hasta: ['Desde / Hasta', 'Desde Hasta', 'Tramo'],
  tipo_plantilla: ['Plantilla', 'Tipo Plantilla']
};

function normalizarClaveColumna(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function valorColumna(row, aliases) {
  const key = Object.keys(row).find(item => aliases.some(alias => normalizarClaveColumna(alias) === normalizarClaveColumna(item)));
  return key ? row[key] : '';
}

function numeroSeguro(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function textoSeguro(value, maxLength = 300) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function convertirFilaPedido(row, index) {
  const pedido = {};
  Object.entries(PEDIDOS_COLUMNAS).forEach(([field, aliases]) => {
    pedido[field] = textoSeguro(valorColumna(row, aliases));
  });
  pedido.fila_origen = index + 2;
  pedido.cantidad = numeroSeguro(pedido.cantidad);
  pedido.st_disponible = numeroSeguro(pedido.st_disponible);
  pedido.st_reservado = numeroSeguro(pedido.st_reservado);
  pedido.st_depo = numeroSeguro(pedido.st_depo);
  pedido.estado = pedido.estado || (pedido.st_depo > 1 ? 'con stock' : 'pendiente');
  pedido.emails_destino = pedido.emails_destino || 'deposito.central@lacasadelaudio.com, grupoclientes@casadelaudio.com';
  pedido.desde_hasta = pedido.desde_hasta || `Depósito -> ${pedido.sucursal_ent || 'Sucursal'}`;
  pedido.tipo_plantilla = pedido.tipo_plantilla || 'pedido_mercaderia';
  return pedido;
}

async function cargarPedidos() {
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  const tbody = document.getElementById('cuerpoPedidos');
  if (!tbody) return;

  await cargarPlantillasEmail();
  const { data, error } = await supabaseClient.from('pedidos_mercaderia').select('*').order('created_at', { ascending: false });
  if (error) {
    mostrarEstadoPedidos(`No se pudieron cargar los pedidos: ${error.message}`, 'danger');
    return;
  }

  pedidosMercaderia = data || [];
  renderizarPedidos();
}

async function importarPedidos(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  if (typeof canWrite === 'function' && !canWrite()) {
    mostrarEstadoPedidos('No tenés permisos para importar pedidos.', 'danger');
    return;
  }

  try {
    const rows = await leerArchivoPedidos(file);
    const pedidos = rows.map(convertirFilaPedido).filter(pedido => pedido.documento || pedido.clave || pedido.articulo);
    if (!pedidos.length) throw new Error('No se encontraron filas con Documento, Clave o Artículo.');

    const { error } = await supabaseClient.from('pedidos_mercaderia').insert(pedidos);
    if (error) throw error;

    mostrarEstadoPedidos(`Se importaron ${pedidos.length} registros correctamente.`, 'success');
    await cargarPedidos();
  } catch (error) {
    mostrarEstadoPedidos(`No se pudo importar el archivo: ${error.message}`, 'danger');
  }
}

function leerArchivoPedidos(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const buffer = event.target.result;
        if (/\.csv$/i.test(file.name)) {
          resolve(parsearCsvLocal(new TextDecoder('utf-8').decode(buffer)));
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

function parsearCsvLocal(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && (character === ';' || character === ',')) {
      row.push(value.trim());
      value = '';
    } else if (!quoted && (character === '\n' || character === '\r')) {
      if (character === '\r' && nextCharacter === '\n') index += 1;
      row.push(value.trim());
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  row.push(value.trim());
  if (row.some(cell => cell !== '')) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1).map(cells => headers.reduce((result, header, index) => {
    result[header] = cells[index] ?? '';
    return result;
  }, {}));
}

function renderizarPedidos() {
  const tbody = document.getElementById('cuerpoPedidos');
  if (!tbody) return;
  const query = textoSeguro(document.getElementById('busquedaPedidos')?.value).toLowerCase();
  const visibles = pedidosMercaderia.filter(pedido => Number(pedido.st_depo) <= 0).filter(pedido => {
    const searchable = [pedido.cliente, pedido.cod_cliente, pedido.documento, pedido.clave, pedido.articulo].join(' ').toLowerCase();
    return !query || searchable.includes(query);
  });

  const resumen = document.getElementById('resumenPedidos');
  if (resumen) resumen.textContent = `${visibles.length} registros`;

  if (!visibles.length) {
    tbody.innerHTML = '<tr><td colspan="12" class="text-center py-4">No hay registros para mostrar.</td></tr>';
    return;
  }

  tbody.innerHTML = visibles.map(pedido => `
    <tr class="${esRegistroObsoleto(pedido.created_at) ? 'table-warning' : ''}">
      <td><input type="checkbox" class="pedido-checkbox" value="${pedido.id}"></td>
      <td><strong>${escapeHtml(pedido.cliente || 'Sin nombre')}</strong></td>
      <td>${escapeHtml(pedido.cod_cliente || '-')}</td>
      <td>${escapeHtml(pedido.documento || '-')}</td>
      <td>${escapeHtml(pedido.fecha_venta || '-')}</td>
      <td>
        <input class="form-control form-control-sm mb-1" id="emails-${pedido.id}" value="${escapeHtml(pedido.emails_destino || '')}" onchange="guardarCambiosPedido('${pedido.id}')" placeholder="email1, email2, email3">
      </td>
      <td><strong>${escapeHtml(pedido.clave || '-')}</strong><br><small>${escapeHtml(pedido.articulo || '-')}</small></td>
      <td><input class="form-control form-control-sm" id="desde-${pedido.id}" value="${escapeHtml(pedido.desde_hasta || '')}" onchange="guardarCambiosPedido('${pedido.id}')"></td>
      <td>
        <select class="form-select form-select-sm" id="plantilla-${pedido.id}" onchange="guardarCambiosPedido('${pedido.id}')">
          ${opcionesPlantillasEmail(pedido.template_id || pedido.tipo_plantilla)}
        </select>
      </td>
      <td><span class="badge ${pedido.estado === 'enviado' ? 'bg-success' : 'bg-warning text-dark'}">${escapeHtml(pedido.estado || 'pendiente')}</span></td>
      <td>${pedido.fecha_envio ? new Date(pedido.fecha_envio).toLocaleString('es-AR') : '-'}</td>
      <td><button class="btn btn-primary btn-sm" type="button" data-role-action="write" onclick="enviarPedido('${pedido.id}')"><i class="bi bi-send"></i> Enviar</button></td>
    </tr>
  `).join('');

  if (typeof applyRolePermissions === 'function') applyRolePermissions();
}

async function aplicarCambiosMasivosPedidos() {
  const sessionOk = await requireAuth();
  if (!sessionOk || !canWrite()) return;

  const ids = Array.from(document.querySelectorAll('.pedido-checkbox:checked')).map(input => input.value);
  const estado = document.getElementById('bulkEstadoPedido')?.value || '';
  const templateId = document.getElementById('bulkPlantillaPedido')?.value || '';
  if (!ids.length) return mostrarEstadoPedidos('Seleccioná al menos un pedido.', 'warning');
  if (!estado && !templateId) return mostrarEstadoPedidos('Elegí un estado o plantilla para aplicar.', 'warning');

  const cambios = {};
  if (estado) cambios.estado = estado;
  if (templateId) cambios.template_id = templateId;
  const { error } = await supabaseClient.from('pedidos_mercaderia').update(cambios).in('id', ids);
  if (error) return mostrarEstadoPedidos(`No se pudieron aplicar los cambios: ${error.message}`, 'danger');

  pedidosMercaderia.forEach(pedido => {
    if (ids.includes(String(pedido.id))) Object.assign(pedido, cambios);
  });
  document.getElementById('bulkEstadoPedido').value = '';
  document.getElementById('bulkPlantillaPedido').value = '';
  renderizarPedidos();
  mostrarEstadoPedidos(`Se actualizaron ${ids.length} pedidos.`, 'success');
}

async function eliminarPedidosSeleccionados() {
  const sessionOk = await requireAuth();
  if (!sessionOk || !canDelete()) return;

  const ids = Array.from(document.querySelectorAll('.pedido-checkbox:checked')).map(input => input.value);
  if (!ids.length) return mostrarEstadoPedidos('Seleccioná al menos un pedido.', 'warning');
  
  const confirmar = await confirmarAccionModal(
    'Eliminar pedidos seleccionados',
    `¿Estás seguro de eliminar los ${ids.length} pedidos seleccionados?`
  );
  if (!confirmar) return;

  const { error } = await supabaseClient.from('pedidos_mercaderia').delete().in('id', ids);
  if (error) return mostrarEstadoPedidos(`No se pudieron eliminar los pedidos: ${error.message}`, 'danger');

  pedidosMercaderia = pedidosMercaderia.filter(pedido => !ids.includes(String(pedido.id)));
  renderizarPedidos();
  mostrarEstadoPedidos(`Se eliminaron ${ids.length} pedidos.`, 'success');
}

function filtrarPedidos() {
  renderizarPedidos();
}

function seleccionarTodosPedidos(checked) {
  document.querySelectorAll('.pedido-checkbox').forEach(input => { input.checked = checked; });
}

function obtenerPedido(id) {
  return pedidosMercaderia.find(pedido => String(pedido.id) === String(id));
}

function obtenerCambiosPedido(pedido) {
  const emails = document.getElementById(`emails-${pedido.id}`)?.value.trim() || '';
  const desdeHasta = document.getElementById(`desde-${pedido.id}`)?.value.trim() || '';
  const tipoPlantilla = document.getElementById(`plantilla-${pedido.id}`)?.value || 'pedido_mercaderia';
  pedido.emails_destino = emails;
  pedido.desde_hasta = desdeHasta;
  pedido.template_id = tipoPlantilla;
  return { emails_destino: emails, desde_hasta: desdeHasta, template_id: tipoPlantilla };
}

async function guardarCambiosPedido(id) {
  const sessionOk = await requireAuth();
  if (!sessionOk || !canWrite()) return;
  const pedido = obtenerPedido(id);
  if (!pedido) return;

  const cambios = obtenerCambiosPedido(pedido);
  const { error } = await supabaseClient.from('pedidos_mercaderia').update(cambios).eq('id', id);
  if (error) mostrarEstadoPedidos(`No se pudieron guardar los cambios: ${error.message}`, 'danger');
}

function obtenerEmailsPedido(pedido) {
  return String(pedido.emails_destino || '')
    .split(/[;,]/)
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

function validarEmails(emails) {
  return emails.length > 0 && emails.every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function construirMensajePedido(pedido) {
  const plantilla = pedido.tipo_plantilla || 'pedido_mercaderia';
  if (plantilla === 'sin_stock_cliente') {
    return `Hola ${pedido.cliente || ''},\n\nTe informamos que el producto ${pedido.articulo || ''} (${pedido.clave || '-'}) no cuenta con stock disponible para el pedido ${pedido.documento || '-'}.\n\nFecha de venta: ${pedido.fecha_venta || '-'}\n\nPor favor comunicate con Atención al Cliente.`;
  }

  if (plantilla === 'reorganizacion_entrega') {
    return `Pedido de reorganización de entrega\n\nPedido: ${pedido.documento || '-'}\nCliente: ${pedido.cliente || '-'}\nArtículo: ${pedido.articulo || '-'}\nClave: ${pedido.clave || '-'}\nDesde / Hasta: ${pedido.desde_hasta || '-'}\nCantidad: ${pedido.cantidad || 0}`;
  }

  return `Pedido de mercadería\n\nPedido: ${pedido.documento || '-'}\nCliente: ${pedido.cliente || '-'}\nDNI / Código: ${pedido.cod_cliente || '-'}\nArtículo: ${pedido.articulo || '-'}\nClave: ${pedido.clave || '-'}\nCantidad: ${pedido.cantidad || 0}\nStock disponible: ${pedido.st_disponible || 0}\nDesde / Hasta: ${pedido.desde_hasta || '-'}`;
}

async function enviarPedido(id) {
  const sessionOk = await requireAuth();
  if (!sessionOk || !canWrite()) {
    mostrarNotificacion('No tenés permisos para enviar pedidos.', 'danger');
    return false;
  }

  const pedido = obtenerPedido(id);
  if (!pedido) return false;
  obtenerCambiosPedido(pedido);
  const emails = obtenerEmailsPedido(pedido);
  if (!validarEmails(emails)) {
    mostrarNotificacion('Cargá al menos un email válido para el pedido seleccionado.', 'warning');
    return false;
  }

  const boton = document.querySelector(`[onclick="enviarPedido('${id}')"]`);
  if (boton) boton.disabled = true;

  try {
    const templateId = pedido.template_id || EMAILJS_TEMPLATE_ID;
    await emailjs.send(EMAILJS_SERVICE_ID, templateId, {
      email_destino: emails[0],
      email_cc: emails.slice(1).join(','),
      asunto: `Solicitud de mercadería - Pedido ${pedido.documento || '-'}`,
      mensaje: construirMensajePedido(pedido)
    });

    const fechaEnvio = new Date().toISOString();
    const { error } = await supabaseClient.from('pedidos_mercaderia').update({
      emails_destino: emails.join(', '),
      desde_hasta: pedido.desde_hasta,
      tipo_plantilla: pedido.tipo_plantilla,
      template_id: pedido.template_id || '',
      estado: 'enviado',
      fecha_envio: fechaEnvio
    }).eq('id', id);
    if (error) throw error;

    pedido.estado = 'enviado';
    pedido.fecha_envio = fechaEnvio;
    renderizarPedidos();
    return true;
  } catch (error) {
    mostrarEstadoPedidos(`No se pudo enviar el pedido: ${error.message || error.text || error}`, 'danger');
    return false;
  } finally {
    if (boton) boton.disabled = false;
  }
}

async function enviarPedidosSeleccionados() {
  const ids = Array.from(document.querySelectorAll('.pedido-checkbox:checked')).map(input => input.value);
  if (!ids.length) {
    mostrarNotificacion('Seleccioná al menos un pedido.', 'warning');
    return;
  }
  const confirmar = await confirmarAccionModal(
    'Confirmar envíos',
    `¿Confirmás el envío de ${ids.length} pedido(s)?`
  );
  if (!confirmar) return;

  let enviados = 0;
  for (const id of ids) {
    if (await enviarPedido(id)) enviados += 1;
  }
  mostrarEstadoPedidos(`Se enviaron ${enviados} de ${ids.length} pedido(s).`, enviados === ids.length ? 'success' : 'warning');
}

function exportarStockPositivo() {
  const exportRows = pedidosMercaderia.filter(pedido => Number(pedido.st_depo) > 1);
  if (!exportRows.length) {
    mostrarEstadoPedidos('No hay productos con stock de depósito superior a 1.', 'warning');
    return;
  }

  const columns = ['documento', 'fecha_venta', 'clave', 'familia', 'articulo', 'cantidad', 'sucursal_ent', 'st_disponible', 'cod_cliente', 'cliente', 'st_depo'];
  const headers = ['Documento', 'Fecha_Venta', 'Clave', 'Familia', 'Articulo', 'Cantidad', 'Sucursal_Ent', 'St_Disponible', 'DNI Cliente', 'Cliente', 'st_depo'];
  const csv = [headers, ...exportRows.map(row => columns.map(column => row[column] ?? ''))]
    .map(row => row.map(csvEscape).join(';')).join('\r\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pedidos-stock-mayor-1-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  mostrarEstadoPedidos(`Se exportaron ${exportRows.length} productos con stock superior a 1.`, 'success');
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function mostrarEstadoPedidos(message, type) {
  const alert = document.getElementById('estadoImportacion');
  if (!alert) return;
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  alert.classList.remove('d-none');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// EXPOSICIÓN GLOBAL
window.cargarPedidos = cargarPedidos;
window.importarPedidos = importarPedidos;
window.exportarStockPositivo = exportarStockPositivo;
window.filtrarPedidos = filtrarPedidos;
window.seleccionarTodosPedidos = seleccionarTodosPedidos;
window.guardarCambiosPedido = guardarCambiosPedido;
window.enviarPedido = enviarPedido;
window.enviarPedidosSeleccionados = enviarPedidosSeleccionados;
window.cargarPlantillasEmail = cargarPlantillasEmail;
window.opcionesPlantillasEmail = opcionesPlantillasEmail;
window.leerArchivoPedidos = leerArchivoPedidos;
window.parsearCsvLocal = parsearCsvLocal;