// ==========================================
// MÓDULO 1: PEDIDOS DE MERCADERÍA
// ==========================================

let pedidosMercaderia = [];

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
    <tr>
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
          <option value="pedido_mercaderia" ${pedido.tipo_plantilla === 'pedido_mercaderia' ? 'selected' : ''}>Pedido de mercadería</option>
          <option value="reorganizacion_entrega" ${pedido.tipo_plantilla === 'reorganizacion_entrega' ? 'selected' : ''}>Aviso reorganización entrega</option>
          <option value="sin_stock_cliente" ${pedido.tipo_plantilla === 'sin_stock_cliente' ? 'selected' : ''}>Aviso sin stock a cliente</option>
        </select>
      </td>
      <td><span class="badge ${pedido.estado === 'enviado' ? 'bg-success' : 'bg-warning text-dark'}">${escapeHtml(pedido.estado || 'pendiente')}</span></td>
      <td>${pedido.fecha_envio ? new Date(pedido.fecha_envio).toLocaleString('es-AR') : '-'}</td>
      <td><button class="btn btn-primary btn-sm" type="button" data-role-action="write" onclick="enviarPedido('${pedido.id}')"><i class="bi bi-send"></i> Enviar</button></td>
    </tr>
  `).join('');

  if (typeof applyRolePermissions === 'function') applyRolePermissions();
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
  pedido.tipo_plantilla = tipoPlantilla;
  return { emails_destino: emails, desde_hasta: desdeHasta, tipo_plantilla: tipoPlantilla };
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
    alert('No tenés permisos para enviar pedidos.');
    return false;
  }

  const pedido = obtenerPedido(id);
  if (!pedido) return false;
  obtenerCambiosPedido(pedido);
  const emails = obtenerEmailsPedido(pedido);
  if (!validarEmails(emails)) {
    alert('Cargá al menos un email válido para el pedido seleccionado.');
    return false;
  }

  const boton = document.querySelector(`[onclick="enviarPedido('${id}')"]`);
  if (boton) boton.disabled = true;

  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
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
    alert('Seleccioná al menos un pedido.');
    return;
  }
  if (!confirm(`¿Confirmás el envío de ${ids.length} pedido(s)?`)) return;

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

// ==========================================
// MÓDULO 2: SOLICITUDES DE ARREPENTIMIENTO
// ==========================================

let listaArrepentimientos = [];
const GOOGLE_SHEET_ARCHIVE_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyOHK_tiJJgVY9HffudGWQuyfCIIld70VpFg7d4EonvYe2dbOm30p8CAqm9rczkQv9R/exec";

async function cargarArrepentimientos() {
  const tbody = document.getElementById('tblArrepentimientos');
  if (!tbody) return;
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;

  const { data, error } = await supabaseClient
    .from('arrepentimientos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">No se pudieron cargar: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  listaArrepentimientos = data || [];
  renderizarArrepentimientos();
}

function renderizarArrepentimientos() {
  const tbody = document.getElementById('tblArrepentimientos');
  if (!tbody) return;

  const q = (document.getElementById('buscarArrepentimiento')?.value || '').toLowerCase();
  const filtroEstado = document.getElementById('filtroEstadoArrepentimiento')?.value || '';
  const filtroEnvio = document.getElementById('filtroEnvioArrepentimiento')?.value || '';

  const filtrados = listaArrepentimientos.filter(item => {
    const searchable = [item.cliente_nombre, item.cliente_dni, item.pedido_id, item.numero_pedido, item.motivo, item.comentario].join(' ').toLowerCase();
    const coincideTexto = !q || searchable.includes(q);
    const coincideEstado = !filtroEstado || item.estado === filtroEstado;
    const coincideEnvio = !filtroEnvio || (filtroEnvio === 'enviado' ? item.fecha_envio : !item.fecha_envio);
    return coincideTexto && coincideEstado && coincideEnvio;
  });

  const resumenEl = document.getElementById('resumenArrepentimientos');
  if (resumenEl) resumenEl.textContent = `${filtrados.length} registros`;

  if (!filtrados.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4">Sin registros coincidentes.</td></tr>';
    return;
  }

  const opcionesEstado = ['Devuelve Sucursal', 'Retiro en domicilio', 'Enviado a Caja', 'Otros', 'Cerrado'];

  tbody.innerHTML = filtrados.map(item => {
    const pId = item.pedido_id || item.numero_pedido || item.pedido || '-';
    const emailTo = item.emails_destino || item.cliente_email || item.cliente_mail || '';
    
    return `
      <tr data-id="${item.id}">
        <td class="text-center">
          <input type="checkbox" class="form-check-input chk-arrepentimiento" value="${item.id}" ${item.check_envio ? 'checked' : ''} onchange="actualizarArrepentimientoField('${item.id}', 'check_envio', this.checked)">
        </td>
        <td>
          <strong>${escapeHtml(item.cliente_nombre || 'Sin nombre')}</strong><br>
          <small class="text-muted">DNI: ${escapeHtml(item.cliente_dni || '-')} | Tel: ${escapeHtml(item.cliente_telefono || '-')}</small>
        </td>
        <td><strong>${escapeHtml(pId)}</strong></td>
        <td class="col-motivo"><small>${escapeHtml(item.motivo || '-')}</small></td>
        <td>
          <input type="text" class="form-control form-control-sm" value="${escapeHtml(item.comentario || '')}" placeholder="Comentario interno..." onchange="actualizarArrepentimientoField('${item.id}', 'comentario', this.value)">
        </td>
        <td>
          <select class="form-select form-select-sm" onchange="cambiarEstadoArrepentimiento('${item.id}', this.value)">
            ${opcionesEstado.map(opt => `<option value="${opt}" ${item.estado === opt ? 'selected' : ''}>${opt}</option>`).join('')}
            ${!opcionesEstado.includes(item.estado) && item.estado ? `<option value="${escapeHtml(item.estado)}" selected>${escapeHtml(item.estado)}</option>` : ''}
          </select>
        </td>
        <td>
          <input type="text" class="form-control form-control-sm" value="${escapeHtml(emailTo)}" placeholder="destino@casadelaudio.com" onchange="actualizarArrepentimientoField('${item.id}', 'emails_destino', this.value)">
        </td>
        <td><span class="badge ${item.estado_cliente === 'Notificado' ? 'bg-success' : 'bg-warning text-dark'}">${escapeHtml(item.estado_cliente || 'Pendiente')}</span></td>
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

function filtrarArrepentimientos() {
  renderizarArrepentimientos();
}

// IMPORTACIÓN CON NOTIFICACIÓN Y CONFIRMACIÓN INTEGRADAS
async function importarArrepentimientosCSV(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  if (typeof canWrite === 'function' && !canWrite()) return mostrarNotificacion('No tenés permisos para importar solicitudes.', 'danger');

  try {
    const jsonRows = await leerArchivoPedidos(file);
    if (!jsonRows || jsonRows.length === 0) return mostrarNotificacion('El archivo está vacío o no posee filas procesables.', 'warning');

    const { data: existentesDB } = await supabaseClient.from('arrepentimientos').select('pedido_id, numero_pedido, pedido');
    const setIDsBase = new Set((existentesDB || []).flatMap(x => [x.pedido_id, x.numero_pedido, x.pedido].filter(Boolean)));

    const registrosNuevos = [];
    const idsDuplicadosAlerta = [];

    for (const row of jsonRows) {
      const getVal = (keys) => {
        const foundKey = Object.keys(row).find(k => keys.some(alias => normalizarClaveColumna(alias) === normalizarClaveColumna(k)));
        return foundKey ? textoSeguro(row[foundKey]) : '';
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
      const motivoDetalle = getVal(['Otros', 'Motivo 2']);
      const comentarioVal = getVal(['Comentarios', 'Comentario']);

      registrosNuevos.push({
        cliente_nombre: cliente || 'Sin Nombre',
        cliente_dni: dni || '',
        cliente_telefono: tel || '',
        cliente_email: email || '',
        cliente_mail: email || '',
        pedido_id: pedidoVal,
        numero_pedido: pedidoVal,
        pedido: pedidoVal,
        motivo: [motivo1, motivoDetalle].filter(Boolean).join(' - ') || 'Arrepentimiento de compra',
        comentario: comentarioVal || '',
        estado: 'Enviado a Caja'
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

async function actualizarArrepentimientoField(id, field, value) {
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  if (typeof canWrite === 'function' && !canWrite()) return;

  const item = listaArrepentimientos.find(x => String(x.id) === String(id));
  if (item) item[field] = value;

  const { error } = await supabaseClient.from('arrepentimientos').update({ [field]: value }).eq('id', id);
  if (error) console.error('Error al actualizar en Supabase:', error);
}

// CAMBIO DE ESTADO CON MODAL INTEGRADO
async function cambiarEstadoArrepentimiento(id, nuevoEstado) {
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  if (typeof canWrite === 'function' && !canWrite()) return;

  const item = listaArrepentimientos.find(x => String(x.id) === String(id));
  if (!item) return;

  if (nuevoEstado === 'Cerrado') {
    const pId = item.pedido_id || item.numero_pedido || item.pedido || 'S/N';
    const confirmar = await confirmarAccionModal(
      'Cerrar y Archivar Solicitud',
      `La solicitud del pedido "${pId}" cambiará a 'Cerrado'. Se exportará al Google Sheet de histórico y se borrará de Supabase para liberar espacio. ¿Confirmar?`
    );

    if (!confirmar) {
      renderizarArrepentimientos();
      return;
    }

    try {
      if (GOOGLE_SHEET_ARCHIVE_WEBHOOK_URL && !GOOGLE_SHEET_ARCHIVE_WEBHOOK_URL.includes('TU_SCRIPT_ID')) {
        await fetch(GOOGLE_SHEET_ARCHIVE_WEBHOOK_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
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

  await actualizarArrepentimientoField(id, 'estado', nuevoEstado);
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
  if (!listaArrepentimientos.length) return alert('No hay datos para exportar.');
  generarDescargaCSVArrepentimiento(listaArrepentimientos, `arrepentimientos_todos_${new Date().toISOString().slice(0,10)}.csv`);
}

function generarDescargaCSVArrepentimiento(datos, nombreArchivo) {
  const headers = ['Cliente', 'DNI', 'Telefono', 'Email', 'Pedido', 'Motivo', 'Comentario Interno', 'Estado Pedido', 'Emails Destino', 'Estado Cliente', 'Fecha Envío'];
  const csvRows = [
    headers.join(';'),
    ...datos.map(item => [
      csvEscape(item.cliente_nombre || ''),
      csvEscape(item.cliente_dni || ''),
      csvEscape(item.cliente_telefono || ''),
      csvEscape(item.cliente_email || item.cliente_mail || ''),
      csvEscape(item.pedido_id || item.numero_pedido || item.pedido || ''),
      csvEscape(item.motivo || ''),
      csvEscape(item.comentario || ''),
      csvEscape(item.estado || ''),
      csvEscape(item.emails_destino || ''),
      csvEscape(item.estado_cliente || 'Pendiente'),
      csvEscape(item.fecha_envio ? new Date(item.fecha_envio).toLocaleString('es-AR') : '')
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

async function enviarMailArrepentimiento(id) {
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;
  if (typeof canWrite === 'function' && !canWrite()) return alert('No tenés permisos.');

  const item = listaArrepentimientos.find(x => String(x.id) === String(id));
  if (!item) return;

  const destino = item.emails_destino || item.cliente_email || item.cliente_mail;
  if (!destino || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destino.trim())) {
    const errorMsg = `No hay un email de destino válido: ${destino || 'Vacio'}`;
    alert(errorMsg);
    await registrarErrorArrepentimiento(errorMsg, `Pedido ${item.pedido_id || 'S/N'}`);
    return;
  }

  try {
    const pId = item.pedido_id || item.numero_pedido || item.pedido || 'S/N';
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      email_destino: destino.trim(),
      asunto: `Gestión de Solicitud de Arrepentimiento - Orden ${pId}`,
      mensaje: `Hola ${item.cliente_nombre || ''},\n\nTu solicitud de arrepentimiento para el pedido ${pId} fue gestionada.\nEstado: ${item.estado || '-'}\nComentarios: ${item.comentario || '-'}`
    });

    const now = new Date().toISOString();
    await supabaseClient.from('arrepentimientos').update({
      fecha_envio: now,
      estado_cliente: 'Notificado',
      check_envio: true
    }).eq('id', id);

    item.fecha_envio = now;
    item.estado_cliente = 'Notificado';
    item.check_envio = true;

    alert('Email enviado con éxito.');
    renderizarArrepentimientos();

  } catch (err) {
    const errorStr = err.message || JSON.stringify(err);
    alert('Error al enviar correo: ' + errorStr);
    await registrarErrorArrepentimiento(errorStr, `Pedido ${item.pedido_id || 'S/N'}`);
  }
}

async function registrarErrorArrepentimiento(mensaje, referencia) {
  try {
    const session = (await supabaseClient.auth.getSession()).data.session;
    await supabaseClient.from('arrepentimientos_logs').insert([{
      mensaje_error: mensaje,
      referencia_fila: referencia,
      usuario_email: session?.user?.email || 'sistema'
    }]);
  } catch (e) {
    console.error('Error guardando log de error:', e);
  }
}

async function abrirLogsArrepentimiento() {
  if (currentUserRole !== 'admin') return alert('Acceso exclusivo para administradores.');

  const tbody = document.getElementById('tblLogsArrepentimientoBody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div> Cargando logs...</td></tr>';

  const modalEl = document.getElementById('modalLogsArrepentimiento');
  if (modalEl) new bootstrap.Modal(modalEl).show();

  const { data, error } = await supabaseClient.from('arrepentimientos_logs').select('*').order('created_at', { ascending: false }).limit(50);

  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  tbody.innerHTML = (data || []).map(log => `
    <tr>
      <td>${new Date(log.created_at || log.fecha).toLocaleString('es-AR')}</td>
      <td class="text-danger fw-bold">${escapeHtml(log.mensaje_error)}</td>
      <td><code>${escapeHtml(log.referencia_fila || '-')}</code></td>
      <td>${escapeHtml(log.usuario_email || '-')}</td>
    </tr>
  `).join('') || '<tr><td colspan="4" class="text-center py-3">Sin errores registrados.</td></tr>';
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

window.cargarArrepentimientos = cargarArrepentimientos;
window.filtrarArrepentimientos = filtrarArrepentimientos;
window.importarArrepentimientosCSV = importarArrepentimientosCSV;
window.actualizarArrepentimientoField = actualizarArrepentimientoField;
window.cambiarEstadoArrepentimiento = cambiarEstadoArrepentimiento;
window.eliminarArrepentimiento = eliminarArrepentimiento;
window.exportarSeleccionadosArrepentimientosCSV = exportarSeleccionadosArrepentimientosCSV;
window.exportarArrepentimientosCSV = exportarArrepentimientosCSV;
window.enviarMailArrepentimiento = enviarMailArrepentimiento;
window.abrirLogsArrepentimiento = abrirLogsArrepentimiento;