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
  if (estado === 'Pedido Corregido') return 'bg-info text-dark';
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
  document.getElementById('accionesFacturados').hidden = vistaFacturacion !== 'facturados';
  document.getElementById('columnaSeleccionFacturados').hidden = vistaFacturacion !== 'facturados';

  if (!registros.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4">No hay pedidos en esta bandeja.</td></tr>';
    return;
  }

  tbody.innerHTML = registros.map(item => {
    const puedeEditar = puedeEditarFacturacion();
    let acciones = '';
    if (vistaFacturacion === 'principal') {
      acciones = `
        <button class="btn btn-sm btn-outline-secondary me-1" type="button" onclick="abrirModalFacturacion('${item.id}')" ${puedeEditar ? '' : 'hidden'} title="Editar pedido"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-primary me-1" type="button" onclick="enviarPedidoACaja('${item.id}')" ${puedeEditar ? '' : 'hidden'}><i class="bi bi-cash-stack"></i> Enviar a Caja</button>
        <button class="btn btn-sm btn-outline-danger" type="button" onclick="eliminarPedidoFacturacion('${item.id}')" ${puedeEditar ? '' : 'hidden'} title="Eliminar pedido"><i class="bi bi-trash"></i></button>`;
    } else if (vistaFacturacion === 'caja') {
      acciones = `
        <button class="btn btn-sm btn-outline-warning me-1" type="button" onclick="devolverPedidoACorreccion('${item.id}')" ${puedeEditar ? '' : 'hidden'} title="Devolver para corregir"><i class="bi bi-arrow-return-left"></i></button>
        <button class="btn btn-sm btn-success me-1" type="button" onclick="abrirModalComprobanteFacturacion('${item.id}')" ${puedeEditar ? '' : 'hidden'}><i class="bi bi-check2-circle"></i> Facturar</button>
        <button class="btn btn-sm btn-outline-danger" type="button" onclick="eliminarPedidoFacturacion('${item.id}')" ${puedeEditar ? '' : 'hidden'} title="Eliminar pedido"><i class="bi bi-trash"></i></button>`;
    } else {
      acciones = `<button class="btn btn-sm btn-outline-danger" type="button" onclick="eliminarPedidoFacturacion('${item.id}')" ${puedeEditar ? '' : 'hidden'} title="Eliminar pedido"><i class="bi bi-trash"></i></button>`;
    }

    const notas = vistaFacturacion === 'facturados' || !puedeEditar
      ? `<small>${escapeHtml(item.notas || '-')}</small>`
      : `<textarea class="form-control form-control-sm" rows="2" maxlength="1000" placeholder="Agregar comentario..." onchange="actualizarNotasFacturacion('${item.id}', this.value)">${escapeHtml(item.notas || '')}</textarea>`;

    const esObsoleto = vistaFacturacion !== 'facturados' && esRegistroObsoleto(item.created_at);
    return `<tr class="${esObsoleto ? 'table-warning' : ''}">
      ${vistaFacturacion === 'facturados' ? `<td class="text-center"><input class="form-check-input chk-facturado" type="checkbox" value="${item.id}" aria-label="Seleccionar pedido ${escapeHtml(item.pedido || '')}"></td>` : '<td hidden></td>'}
      <td>${item.fecha_compra ? new Date(`${item.fecha_compra}T00:00:00`).toLocaleDateString('es-AR') : '-'}</td>
      <td>${escapeHtml(item.tienda || '-')}</td>
      <td>${escapeHtml(item.id_compra || '-')}</td>
      <td><strong>${escapeHtml(item.pedido || '-')}</strong></td>
      <td>${escapeHtml(item.operador || '-')}</td>
      <td><span class="badge ${estadoClaseFacturacion(item.estado)}">${escapeHtml(item.estado || 'Pedido Nuevo')}</span></td>
      <td>${notas}</td>
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
  const esTienda = tipo === 'tienda';
  document.getElementById('formCatalogoFacturacion').reset();
  document.getElementById('factCatalogoTipo').value = tipo;
  document.getElementById('modalCatalogoFacturacionLabel').innerHTML = `<i class="bi bi-plus-circle text-primary me-2"></i>Agregar ${esTienda ? 'tienda' : 'operador'}`;
  document.getElementById('factCatalogoNombreLabel').textContent = `Nombre de ${esTienda ? 'la tienda' : 'el operador'}`;
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalCatalogoFacturacion'));
  modal.show();
  document.getElementById('modalCatalogoFacturacion').addEventListener('shown.bs.modal', () => document.getElementById('factCatalogoNombre').focus(), { once: true });
}

async function guardarCatalogoFacturacion(event) {
  event.preventDefault();
  if (!(await requireAuth()) || !puedeEditarFacturacion()) return;
  const tipo = document.getElementById('factCatalogoTipo').value;
  const nombre = textoFacturacion(document.getElementById('factCatalogoNombre').value, 100);
  if (!nombre) return;
  const tabla = tipo === 'tienda' ? 'facturacion_tiendas' : 'facturacion_operadores';
  const { error } = await supabaseClient.from(tabla).upsert({ nombre }, { onConflict: 'nombre' });
  if (error) return mostrarNotificacion(`No se pudo agregar el ${tipo}: ${error.message}`, 'danger');
  bootstrap.Modal.getInstance(document.getElementById('modalCatalogoFacturacion'))?.hide();
  await cargarCatalogosFacturacion();
  cargarSelectCatalogoFacturacion(tipo === 'tienda' ? 'factTienda' : 'factOperador', tipo === 'tienda' ? tiendasFacturacion : operadoresFacturacion, tipo === 'tienda' ? 'Seleccionar tienda...' : 'Seleccionar operador...', nombre);
  mostrarNotificacion(`${tipo === 'tienda' ? 'Tienda' : 'Operador'} agregado.`, 'success');
}

async function guardarPedidoFacturacion(event) {
  event.preventDefault();
  if (!(await requireAuth()) || !puedeEditarFacturacion()) return;

  const id = document.getElementById('factPedidoId').value;
  const pedido = textoFacturacion(document.getElementById('factPedido').value, 100);
  const idCompra = textoFacturacion(document.getElementById('factIdCompra').value, 100);
  if (!idCompra) return mostrarNotificacion('El ID de compra es obligatorio.', 'warning');

  let duplicateQuery = supabaseClient.from('facturacion_pedidos').select('id, pedido, estado').eq('id_compra', idCompra).limit(1);
  if (id) duplicateQuery = duplicateQuery.neq('id', id);
  const { data: duplicados, error: errorDuplicados } = await duplicateQuery;
  if (errorDuplicados) return mostrarNotificacion('No se pudo validar el ID de compra: ' + errorDuplicados.message, 'danger');
  if (duplicados?.length) {
    const confirmar = await confirmarAccionModal('ID de compra duplicado', `El ID de compra "${idCompra}" ya existe en el pedido "${duplicados[0].pedido}" con estado "${duplicados[0].estado}". ¿Deseas cargarlo de todas formas?`);
    if (!confirmar) return;
  }

  const registro = {
    fecha_compra: document.getElementById('factFechaCompra').value,
    tienda: textoFacturacion(document.getElementById('factTienda').value, 100),
    id_compra: idCompra,
    pedido,
    operador: textoFacturacion(document.getElementById('factOperador').value, 100),
    estado: document.getElementById('factEstado').value || 'Pedido Nuevo',
    notas: textoFacturacion(document.getElementById('factNotas').value, 1000),
    en_caja: false
  };
  if (!registro.fecha_compra || !registro.tienda || !registro.id_compra || !registro.pedido) return mostrarNotificacion('Fecha, tienda, ID de compra y pedido son obligatorios.', 'warning');

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
  const pedido = listaFacturacion.find(item => String(item.id) === String(id));
  const estado = pedido?.estado === 'Corregir' ? 'Pedido Corregido' : 'Pedido Nuevo';
  const { error } = await supabaseClient.from('facturacion_pedidos').update({ en_caja: true, estado }).eq('id', id);
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

async function eliminarPedidoFacturacion(id) {
  if (!(await requireAuth()) || !puedeEditarFacturacion()) return;
  const pedido = listaFacturacion.find(item => String(item.id) === String(id));
  const confirmar = await confirmarAccionModal(
    'Eliminar pedido',
    `¿Eliminar el pedido "${pedido?.pedido || 'sin número'}" de Facturación? Esta acción no se puede deshacer.`
  );
  if (!confirmar) return;

  const { error } = await supabaseClient.from('facturacion_pedidos').delete().eq('id', id);
  if (error) return mostrarNotificacion('No se pudo eliminar el pedido: ' + error.message, 'danger');
  listaFacturacion = listaFacturacion.filter(item => String(item.id) !== String(id));
  renderizarFacturacion();
  mostrarNotificacion('Pedido eliminado de Facturación.', 'success');
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
    notas: '',
    fecha_facturacion: new Date().toISOString()
  }).eq('id', id);
  if (error) return mostrarNotificacion('No se pudo facturar el pedido: ' + error.message, 'danger');
  bootstrap.Modal.getInstance(document.getElementById('modalComprobanteFacturacion'))?.hide();
  await cargarFacturacion();
  mostrarNotificacion('Pedido facturado correctamente.', 'success');
}

async function actualizarNotasFacturacion(id, value) {
  if (!(await requireAuth()) || !puedeEditarFacturacion()) return;
  const notas = textoFacturacion(value, 1000);
  const { error } = await supabaseClient.from('facturacion_pedidos').update({ notas }).eq('id', id);
  if (error) return mostrarNotificacion('No se pudo actualizar el comentario: ' + error.message, 'danger');
  const pedido = listaFacturacion.find(item => String(item.id) === String(id));
  if (pedido) pedido.notas = notas;
  mostrarNotificacion('Comentario actualizado.', 'success');
}

function seleccionarTodosFacturados(checked) {
  document.querySelectorAll('.chk-facturado').forEach(input => {
    input.checked = checked;
  });
}

function csvEscapeFacturacion(value) {
  const text = String(value ?? '');
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function descargarFacturadosSeleccionados() {
  if (!(await requireAuth()) || !puedeEditarFacturacion()) return;
  const ids = Array.from(document.querySelectorAll('.chk-facturado:checked')).map(input => input.value);
  if (!ids.length) return mostrarNotificacion('Seleccioná al menos un pedido facturado.', 'warning');

  const registros = listaFacturacion.filter(item => ids.includes(String(item.id)) && item.estado === 'Facturado');
  const confirmar = await confirmarAccionModal(
    'Descargar y quitar facturados',
    `Se descargará un CSV con ${registros.length} pedido(s) y luego se quitarán de la tabla de Facturación. ¿Confirmás la operación?`
  );
  if (!confirmar) return;

  const encabezados = ['Fecha compra', 'Tienda', 'ID compra', 'Pedido', 'Operador', 'Estado', 'Notas / comentarios', 'Número comprobante', 'Fecha facturación'];
  const csv = [
    encabezados.join(';'),
    ...registros.map(item => [
      item.fecha_compra || '', item.tienda || '', item.id_compra || '', item.pedido || '', item.operador || '', item.estado || '', item.notas || '', item.numero_comprobante || '', item.fecha_facturacion ? new Date(item.fecha_facturacion).toLocaleString('es-AR') : ''
    ].map(csvEscapeFacturacion).join(';'))
  ].join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `facturados_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  const { error } = await supabaseClient.from('facturacion_pedidos').delete().in('id', ids);
  if (error) return mostrarNotificacion('El CSV se descargó, pero no se pudieron quitar los pedidos: ' + error.message, 'danger');
  listaFacturacion = listaFacturacion.filter(item => !ids.includes(String(item.id)));
  renderizarFacturacion();
  mostrarNotificacion(`Se descargaron y quitaron ${ids.length} pedido(s) facturado(s).`, 'success');
}

window.cargarFacturacion = cargarFacturacion;
window.renderizarFacturacion = renderizarFacturacion;
window.cambiarVistaFacturacion = cambiarVistaFacturacion;
window.abrirModalFacturacion = abrirModalFacturacion;
window.agregarCatalogoFacturacion = agregarCatalogoFacturacion;
window.guardarCatalogoFacturacion = guardarCatalogoFacturacion;
window.guardarPedidoFacturacion = guardarPedidoFacturacion;
window.enviarPedidoACaja = enviarPedidoACaja;
window.devolverPedidoACorreccion = devolverPedidoACorreccion;
window.eliminarPedidoFacturacion = eliminarPedidoFacturacion;
window.abrirModalComprobanteFacturacion = abrirModalComprobanteFacturacion;
window.confirmarFacturacion = confirmarFacturacion;
window.actualizarNotasFacturacion = actualizarNotasFacturacion;
window.seleccionarTodosFacturados = seleccionarTodosFacturados;
window.descargarFacturadosSeleccionados = descargarFacturadosSeleccionados;
