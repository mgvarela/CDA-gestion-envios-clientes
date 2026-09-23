let listaFacturacion = [];
let vistaFacturacion = 'principal';
let tiendasFacturacion = [];
let operadoresFacturacion = [];

const TIENDAS_FACTURACION_INICIALES = ['Provincia Wins', 'Personal', 'Shell', 'Infobae', 'Nación', 'Credicoop', 'Comafi', 'Macro'];

function textoFacturacion(value, maxLength = 1000) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function puedeEditarFacturacion() {
  return typeof canWrite === 'function' && canWrite('facturacion');
}

async function cargarCatalogosFacturacion() {
  const [tiendasResult, operadoresResult] = await Promise.all([
    supabaseClient.from('facturacion_tiendas').select('nombre').order('nombre'),
    supabaseClient.from('facturacion_operadores').select('nombre').order('nombre')
  ]);

  tiendasFacturacion = tiendasResult.error ? TIENDAS_FACTURACION_INICIALES : (tiendasResult.data || []).map(item => item.nombre);
  operadoresFacturacion = operadoresResult.error ? [] : (operadoresResult.data || []).map(item => item.nombre);
}

function cargarSelectCatalogoFacturacion(elementId, values, placeholder, selectedValue = '') {
  const select = document.getElementById(elementId);
  if (!select) return;
  const options = Array.from(new Set(values.filter(Boolean).map(value => textoFacturacion(value, 100))));
  if (selectedValue && !options.includes(selectedValue)) options.push(selectedValue);
  select.innerHTML = `<option value="">${placeholder}</option>${options.map(value =>
    `<option value="${escapeHtml(value)}" ${value === selectedValue ? 'selected' : ''}>${escapeHtml(value)}</option>`
  ).join('')}`;
}

async function cargarFacturacion() {
  const tbody = document.getElementById('tblFacturacion');
  if (!tbody || !(await requireAuth())) return;

  const { data, error } = await supabaseClient
    .from('facturacion_pedidos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">No se pudieron cargar los pedidos: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  listaFacturacion = data || [];
  renderizarFacturacion();
}

function estadoClaseFacturacion(estado) {
  if (estado === 'Facturado') return 'bg-success';
  if (estado === 'Corregir') return 'bg-warning text-dark';
  return 'bg-primary';
}

function renderizarFacturacion() {
  const tbody = document.getElementById('tblFacturacion');
  if (!tbody) return;

  const query = (document.getElementById('buscarFacturacion')?.value || '').toLowerCase();
  const estadoFiltro = document.getElementById('filtroEstadoFacturacion')?.value || '';
  const pendientesCaja = listaFacturacion.filter(item => item.en_caja && item.estado !== 'Facturado');
  const facturados = listaFacturacion.filter(item => item.estado === 'Facturado');
  const registrosBase = vistaFacturacion === 'caja'
    ? pendientesCaja
    : vistaFacturacion === 'facturados'
      ? facturados
      : listaFacturacion.filter(item => !item.en_caja && item.estado !== 'Facturado');
  const registros = registrosBase.filter(item => {
    const texto = [item.fecha_compra, item.tienda, item.id_compra, item.pedido, item.operador, item.estado, item.notas, item.numero_comprobante].join(' ').toLowerCase();
    return (!query || texto.includes(query)) && (!estadoFiltro || item.estado === estadoFiltro);
  });

  document.getElementById('contadorFacturacionCaja').textContent = pendientesCaja.length;
  document.getElementById('contadorFacturacionFacturados').textContent = facturados.length;
  document.getElementById('resumenFacturacion').textContent = `${registros.length} registros`;

  if (!registros.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4">No hay pedidos en esta bandeja.</td></tr>';
    return;
  }

  tbody.innerHTML = registros.map(item => {
    const puedeEditar = puedeEditarFacturacion();
    let acciones = '';
    if (vistaFacturacion === 'principal') {
      acciones = `
        <button class="btn btn-sm btn-outline-secondary me-1" type="button" onclick="abrirModalFacturacion('${item.id}')" ${puedeEditar ? '' : 'hidden'} title="Editar pedido"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-primary" type="button" onclick="enviarPedidoACaja('${item.id}')" ${puedeEditar ? '' : 'hidden'}><i class="bi bi-cash-stack"></i> Enviar a Caja</button>`;
    } else if (vistaFacturacion === 'caja') {
      acciones = `
        <button class="btn btn-sm btn-outline-warning me-1" type="button" onclick="devolverPedidoACorreccion('${item.id}')" ${puedeEditar ? '' : 'hidden'} title="Devolver para corregir"><i class="bi bi-arrow-return-left"></i></button>
        <button class="btn btn-sm btn-success" type="button" onclick="abrirModalComprobanteFacturacion('${item.id}')" ${puedeEditar ? '' : 'hidden'}><i class="bi bi-check2-circle"></i> Facturar</button>`;
    } else if (!item.exportado_sheet) {
      acciones = `<button class="btn btn-sm btn-outline-secondary" type="button" onclick="enviarFacturadoAGoogleSheet('${item.id}')" ${puedeEditar ? '' : 'hidden'}><i class="bi bi-cloud-arrow-up"></i> Reintentar envío</button>`;
    }

    return `<tr>
      <td>${item.fecha_compra ? new Date(`${item.fecha_compra}T00:00:00`).toLocaleDateString('es-AR') : '-'}</td>
      <td>${escapeHtml(item.tienda || '-')}</td>
      <td>${escapeHtml(item.id_compra || '-')}</td>
      <td><strong>${escapeHtml(item.pedido || '-')}</strong></td>
      <td>${escapeHtml(item.operador || '-')}</td>
      <td><span class="badge ${estadoClaseFacturacion(item.estado)}">${escapeHtml(item.estado || 'Pedido Nuevo')}</span></td>
      <td><small>${escapeHtml(item.notas || '-')}</small></td>
      <td>${escapeHtml(item.numero_comprobante || '-')}</td>
      <td class="text-end text-nowrap">${acciones || '-'}</td>
    </tr>`;
  }).join('');
}

function cambiarVistaFacturacion(vista) {
  vistaFacturacion = ['caja', 'facturados'].includes(vista) ? vista : 'principal';
  document.getElementById('subnavFacturacionPrincipal')?.classList.toggle('active', vistaFacturacion === 'principal');
  document.getElementById('subnavFacturacionCaja')?.classList.toggle('active', vistaFacturacion === 'caja');
  document.getElementById('subnavFacturacionFacturados')?.classList.toggle('active', vistaFacturacion === 'facturados');
  renderizarFacturacion();
}

async function abrirModalFacturacion(id = '') {
  if (!(await requireAuth()) || !puedeEditarFacturacion()) return mostrarNotificacion('No tenés permisos para cargar pedidos.', 'danger');
  await cargarCatalogosFacturacion();
  const pedidoExistente = listaFacturacion.find(item => String(item.id) === String(id));
  document.getElementById('formFacturacion').reset();
  document.getElementById('factPedidoId').value = pedidoExistente?.id || '';
  document.getElementById('modalFacturacionLabel').innerHTML = `<i class="bi bi-receipt text-primary me-2"></i>${pedidoExistente ? 'Editar pedido' : 'Nuevo pedido a facturar'}`;
  cargarSelectCatalogoFacturacion('factTienda', tiendasFacturacion, 'Seleccionar tienda...', pedidoExistente?.tienda || '');
  cargarSelectCatalogoFacturacion('factOperador', operadoresFacturacion, 'Seleccionar operador...', pedidoExistente?.operador || '');
  document.getElementById('factFechaCompra').value = pedidoExistente?.fecha_compra || new Date().toISOString().slice(0, 10);
  document.getElementById('factIdCompra').value = pedidoExistente?.id_compra || '';
  document.getElementById('factPedido').value = pedidoExistente?.pedido || '';
  document.getElementById('factEstado').value = pedidoExistente?.estado === 'Corregir' ? 'Corregir' : 'Pedido Nuevo';
  document.getElementById('factNotas').value = pedidoExistente?.notas || '';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalFacturacion')).show();
}

async function agregarCatalogoFacturacion(tipo) {
  if (!(await requireAuth()) || !puedeEditarFacturacion()) return;
  const nombre = textoFacturacion(window.prompt(`Nombre del nuevo ${tipo}:`), 100);
  if (!nombre) return;
  const tabla = tipo === 'tienda' ? 'facturacion_tiendas' : 'facturacion_operadores';
  const { error } = await supabaseClient.from(tabla).upsert({ nombre }, { onConflict: 'nombre' });
  if (error) return mostrarNotificacion(`No se pudo agregar el ${tipo}: ${error.message}`, 'danger');
  await cargarCatalogosFacturacion();
  cargarSelectCatalogoFacturacion(tipo === 'tienda' ? 'factTienda' : 'factOperador', tipo === 'tienda' ? tiendasFacturacion : operadoresFacturacion, tipo === 'tienda' ? 'Seleccionar tienda...' : 'Seleccionar operador...', nombre);
  mostrarNotificacion(`${tipo === 'tienda' ? 'Tienda' : 'Operador'} agregado.`, 'success');
}

async function guardarPedidoFacturacion(event) {
  event.preventDefault();
  if (!(await requireAuth()) || !puedeEditarFacturacion()) return;

  const id = document.getElementById('factPedidoId').value;
  const pedido = textoFacturacion(document.getElementById('factPedido').value, 100);
  let duplicateQuery = supabaseClient.from('facturacion_pedidos').select('id, estado').eq('pedido', pedido).limit(1);
  if (id) duplicateQuery = duplicateQuery.neq('id', id);
  const { data: duplicados, error: errorDuplicados } = await duplicateQuery;
  if (errorDuplicados) return mostrarNotificacion('No se pudo validar el pedido: ' + errorDuplicados.message, 'danger');
  if (duplicados?.length) {
    const confirmar = await confirmarAccionModal('Pedido duplicado', `El pedido "${pedido}" ya existe con estado "${duplicados[0].estado}". ¿Deseas cargarlo de todas formas?`);
    if (!confirmar) return;
  }

  const registro = {
    fecha_compra: document.getElementById('factFechaCompra').value,
    tienda: textoFacturacion(document.getElementById('factTienda').value, 100),
    id_compra: textoFacturacion(document.getElementById('factIdCompra').value, 100),
    pedido,
    operador: textoFacturacion(document.getElementById('factOperador').value, 100),
    estado: document.getElementById('factEstado').value || 'Pedido Nuevo',
    notas: textoFacturacion(document.getElementById('factNotas').value, 1000),
    en_caja: false
  };
  if (!registro.fecha_compra || !registro.tienda || !registro.pedido) return mostrarNotificacion('Fecha, tienda y pedido son obligatorios.', 'warning');

  const { error } = id
    ? await supabaseClient.from('facturacion_pedidos').update(registro).eq('id', id)
    : await supabaseClient.from('facturacion_pedidos').insert([registro]);
  if (error) return mostrarNotificacion(`No se pudo ${id ? 'actualizar' : 'guardar'} el pedido: ${error.message}`, 'danger');
  bootstrap.Modal.getInstance(document.getElementById('modalFacturacion'))?.hide();
  mostrarNotificacion(id ? 'Pedido actualizado correctamente.' : 'Pedido registrado correctamente.', 'success');
  await cargarFacturacion();
}

async function enviarPedidoACaja(id) {
  if (!(await requireAuth()) || !puedeEditarFacturacion()) return;
  const { error } = await supabaseClient.from('facturacion_pedidos').update({ en_caja: true }).eq('id', id);
  if (error) return mostrarNotificacion('No se pudo enviar el pedido a Caja: ' + error.message, 'danger');
  cambiarVistaFacturacion('caja');
  await cargarFacturacion();
  mostrarNotificacion('Pedido enviado a Caja.', 'success');
}

async function devolverPedidoACorreccion(id) {
  if (!(await requireAuth()) || !puedeEditarFacturacion()) return;
  const { error } = await supabaseClient.from('facturacion_pedidos').update({ en_caja: false, estado: 'Corregir' }).eq('id', id);
  if (error) return mostrarNotificacion('No se pudo devolver el pedido: ' + error.message, 'danger');
  cambiarVistaFacturacion('principal');
  await cargarFacturacion();
  mostrarNotificacion('Pedido devuelto para corregir.', 'warning');
}

function abrirModalComprobanteFacturacion(id) {
  if (!puedeEditarFacturacion()) return;
  document.getElementById('formComprobanteFacturacion').reset();
  document.getElementById('factComprobantePedidoId').value = id;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modalComprobanteFacturacion')).show();
}

async function confirmarFacturacion(event) {
  event.preventDefault();
  if (!(await requireAuth()) || !puedeEditarFacturacion()) return;
  const id = document.getElementById('factComprobantePedidoId').value;
  const numeroComprobante = textoFacturacion(document.getElementById('factNumeroComprobante').value, 100);
  const { data: duplicados, error: errorDuplicados } = await supabaseClient.from('facturacion_pedidos').select('id').eq('numero_comprobante', numeroComprobante).neq('id', id).limit(1);
  if (errorDuplicados) return mostrarNotificacion('No se pudo validar el comprobante: ' + errorDuplicados.message, 'danger');
  if (duplicados?.length) return mostrarNotificacion('Ese número de comprobante ya fue utilizado.', 'warning');

  const { error } = await supabaseClient.from('facturacion_pedidos').update({
    numero_comprobante: numeroComprobante,
    estado: 'Facturado',
    fecha_facturacion: new Date().toISOString()
  }).eq('id', id);
  if (error) return mostrarNotificacion('No se pudo facturar el pedido: ' + error.message, 'danger');
  bootstrap.Modal.getInstance(document.getElementById('modalComprobanteFacturacion'))?.hide();
  await enviarFacturadoAGoogleSheet(id, false);
  await cargarFacturacion();
  mostrarNotificacion('Pedido facturado correctamente.', 'success');
}

function getFacturacionWebhookUrl() {
  return window.AppConfig ? window.AppConfig.get('GOOGLE_SHEET_ARCHIVE_WEBHOOK_URL') : '';
}

async function enviarFacturadoAGoogleSheet(id, mostrarResultado = true) {
  const pedido = listaFacturacion.find(item => String(item.id) === String(id)) || (await supabaseClient.from('facturacion_pedidos').select('*').eq('id', id).maybeSingle()).data;
  if (!pedido) return;
  const webhook = getFacturacionWebhookUrl();
  if (!webhook || webhook.includes('TU_SCRIPT_ID')) {
    if (mostrarResultado) mostrarNotificacion('Falta configurar el webhook de Google Sheets.', 'warning');
    return;
  }
  try {
    await fetch(webhook, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...pedido, hoja_destino: 'pedidos_facturados', tipo_registro: 'facturacion' })
    });
    const { error } = await supabaseClient.from('facturacion_pedidos').update({ exportado_sheet: true, fecha_exportacion: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    const local = listaFacturacion.find(item => String(item.id) === String(id));
    if (local) local.exportado_sheet = true;
    if (mostrarResultado) {
      renderizarFacturacion();
      mostrarNotificacion('Pedido enviado a Google Sheets.', 'success');
    }
  } catch (error) {
    if (mostrarResultado) mostrarNotificacion('No se pudo enviar a Google Sheets: ' + error.message, 'danger');
  }
}

window.cargarFacturacion = cargarFacturacion;
window.renderizarFacturacion = renderizarFacturacion;
window.cambiarVistaFacturacion = cambiarVistaFacturacion;
window.abrirModalFacturacion = abrirModalFacturacion;
window.agregarCatalogoFacturacion = agregarCatalogoFacturacion;
window.guardarPedidoFacturacion = guardarPedidoFacturacion;
window.enviarPedidoACaja = enviarPedidoACaja;
window.devolverPedidoACorreccion = devolverPedidoACorreccion;
window.abrirModalComprobanteFacturacion = abrirModalComprobanteFacturacion;
window.confirmarFacturacion = confirmarFacturacion;
window.enviarFacturadoAGoogleSheet = enviarFacturadoAGoogleSheet;