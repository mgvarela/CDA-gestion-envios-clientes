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
  estado: ['Estado']
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
          const parsed = Papa.parse(new TextDecoder('utf-8').decode(buffer), { header: true, skipEmptyLines: true });
          if (parsed.errors.length) throw new Error(parsed.errors[0].message);
          resolve(parsed.data);
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

function renderizarPedidos() {
  const tbody = document.getElementById('cuerpoPedidos');
  if (!tbody) return;
  const query = textoSeguro(document.getElementById('busquedaPedidos')?.value).toLowerCase();
  const visibles = pedidosMercaderia.filter(pedido => Number(pedido.st_depo) <= 0).filter(pedido => {
    const searchable = [pedido.cliente, pedido.cod_cliente, pedido.documento, pedido.clave, pedido.articulo].join(' ').toLowerCase();
    return !query || searchable.includes(query);
  });

  document.getElementById('resumenPedidos').textContent = `${visibles.length} registros`;
  if (!visibles.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="text-center py-4">No hay registros para mostrar.</td></tr>';
    return;
  }

  tbody.innerHTML = visibles.map(pedido => `
    <tr>
      <td><input type="checkbox" class="pedido-checkbox" value="${pedido.id}"></td>
      <td><strong>${escapeHtml(pedido.cliente || 'Sin nombre')}</strong></td>
      <td>${escapeHtml(pedido.cod_cliente || '-')}</td>
      <td>${escapeHtml(pedido.documento || '-')}</td>
      <td>${escapeHtml(pedido.fecha_venta || '-')}</td>
      <td><strong>${escapeHtml(pedido.clave || '-')}</strong><br><small>${escapeHtml(pedido.articulo || '-')}</small></td>
      <td>${pedido.cantidad ?? 0}</td>
      <td>${pedido.st_disponible ?? 0}</td>
      <td><span class="badge ${Number(pedido.st_depo) > 1 ? 'bg-success' : 'bg-secondary'}">${pedido.st_depo ?? 0}</span></td>
      <td>${escapeHtml(pedido.sucursal_ent || '-')}</td>
      <td><span class="badge ${pedido.estado === 'enviado' ? 'bg-success' : 'bg-warning text-dark'}">${escapeHtml(pedido.estado || 'pendiente')}</span></td>
    </tr>
  `).join('');
}

function filtrarPedidos() {
  renderizarPedidos();
}

function seleccionarTodosPedidos(checked) {
  document.querySelectorAll('.pedido-checkbox').forEach(input => { input.checked = checked; });
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

async function cargarArrepentimientos() {
  const tbody = document.getElementById('tblArrepentimientos');
  if (!tbody) return;
  if (typeof requireAuth === 'function' && !(await requireAuth())) return;

  const { data, error } = await supabaseClient.from('arrepentimientos').select('*').order('created_at', { ascending: false });
  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">No se pudieron cargar: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  tbody.innerHTML = (data || []).map(item => `
    <tr>
      <td>${escapeHtml(item.cliente_nombre || '-')}</td>
      <td>${escapeHtml(item.pedido_id || '-')}</td>
      <td>${escapeHtml(item.motivo || '-')}</td>
      <td><span class="badge bg-secondary">${escapeHtml(item.estado || 'pendiente')}</span></td>
      <td>${item.fecha_envio ? new Date(item.fecha_envio).toLocaleString('es-AR') : '-'}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="text-center py-4">Sin solicitudes registradas.</td></tr>';
}

window.cargarPedidos = cargarPedidos;
window.importarPedidos = importarPedidos;
window.exportarStockPositivo = exportarStockPositivo;
window.filtrarPedidos = filtrarPedidos;
window.seleccionarTodosPedidos = seleccionarTodosPedidos;
window.cargarArrepentimientos = cargarArrepentimientos;
