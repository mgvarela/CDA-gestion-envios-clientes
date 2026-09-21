// ==========================================
// CONFIGURACIÓN DE APIS Y CLAVES
// ==========================================
const DISPATCHTRACK_API_KEY = ""; 
const EPRESIS_API_KEY = "";       
const MERCADO_FLEX_TOKEN = "";    

// AUXILIARES DE SEGURIDAD Y LIMPIEZA
function escaparSeguimiento(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function primerValor(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== '') || '-';
}

function obtenerDatosContacto(order) {
  const contacto = order.contact || order.contact_info || order.customer || order.recipient || {};
  return {
    nombre: primerValor(contacto.name, contacto.full_name, order.contact_name, order.customer_name),
    identificador: primerValor(contacto.id, contacto.identifier, contacto.contact_id, order.contact_id),
    telefono: primerValor(contacto.phone, contacto.telephone, contacto.mobile, order.phone),
    direccion: primerValor(contacto.address, contacto.full_address, order.address, order.delivery_address),
    intentos: primerValor(order.attempts, order.number_of_attempts, order.delivery_attempts),
    estado: primerValor(order.status, order.last_status, order.delivery_status),
    franja: primerValor(
      order.estimated_delivery_time_slot,
      order.estimated_time_of_arrival,
      order.delivery_time_window,
      order.eta
    ),
    proveedor: primerValor(order.carrier, order.logistics_provider, 'DispatchTrack'),
    contactoUrl: primerValor(contacto.url, contacto.contact_url, order.contact_url)
  };
}

// RENDERIZADOR ÚNICO REUTILIZABLE
function renderizarResultadoSeguimiento(order, nroFactura, esSimulacion = false) {
  const datos = obtenerDatosContacto(order);
  const nombre = escaparSeguimiento(datos.nombre);
  const nombreHtml = datos.contactoUrl !== '-' && /^https:\/\//i.test(datos.contactoUrl)
    ? `<a href="${escaparSeguimiento(datos.contactoUrl)}" target="_blank" rel="noopener noreferrer">${nombre}</a>`
    : nombre;

  return `
    <div class="alert ${esSimulacion ? 'alert-info' : 'alert-success'} mb-0 py-3">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <strong>Comprobante: ${escaparSeguimiento(nroFactura)} <small class="text-muted">(${escaparSeguimiento(datos.proveedor)})</small></strong>
        <span class="badge bg-primary">${escaparSeguimiento(datos.estado).toUpperCase()}</span>
      </div>
      <div class="row g-2 text-dark small">
        <div class="col-md-6"><strong>Nombre:</strong> ${nombreHtml}</div>
        <div class="col-md-6"><strong>Identificador de contacto:</strong> ${escaparSeguimiento(datos.identificador)}</div>
        <div class="col-md-6"><strong>Teléfono:</strong> ${escaparSeguimiento(datos.telefono)}</div>
        <div class="col-md-6"><strong>Dirección:</strong> ${escaparSeguimiento(datos.direccion)}</div>
        <div class="col-md-6"><strong>Núm. intentos:</strong> ${escaparSeguimiento(datos.intentos)}</div>
        <div class="col-md-6"><strong>Último estado:</strong> ${escaparSeguimiento(datos.estado)}</div>
        <div class="col-12"><strong>Franja horaria / ETA:</strong> ${escaparSeguimiento(datos.franja)}</div>
      </div>
      ${esSimulacion ? '<small class="text-muted d-block mt-2">* Respuesta de prueba: configurá las claves API para consultar datos reales.</small>' : ''}
    </div>`;
}

// 1. DISPATCHTRACK
async function consultarDispatchTrack(nroFactura) {
  if (!DISPATCHTRACK_API_KEY) {
    return renderizarResultadoSeguimiento({
      carrier: 'DispatchTrack',
      status: 'EN CAMINO',
      contact: { name: 'Laboratorios Casasco S.A.I.C', id: '50159608', phone: '+5491159346621', address: 'Bacacay 1845, Capital Federal' },
      attempts: 1,
      estimated_delivery_time_slot: 'Hoy entre 14:00 y 18:00 hs'
    }, nroFactura, true);
  }

  const response = await fetch(`https://api.dispatchtrack.com/api/v1/orders/${encodeURIComponent(nroFactura)}`, {
    headers: { 'X-DISPATCHTRACK-KEY': DISPATCHTRACK_API_KEY, 'Content-Type': 'application/json' }
  });
  if (!response.ok) throw new Error(response.status === 404 ? "Factura no encontrada en DispatchTrack." : "Error de conexión con DispatchTrack.");
  const data = await response.json();
  return renderizarResultadoSeguimiento(data.response || data, nroFactura);
}

// 2. MERCADO EN VÍOS FLEX
async function consultarFlex(nroFactura) {
  if (!MERCADO_FLEX_TOKEN) {
    return renderizarResultadoSeguimiento({
      carrier: 'Mercado Envíos Flex',
      status: 'EN REPARTO (FLEX)',
      contact: { name: 'Cliente MercadoLibre', id: 'MLA-98234112', phone: '+5491144332211', address: 'Av. Corrientes 1234, CABA' },
      attempts: 0,
      estimated_delivery_time_slot: 'Entrega en el día (Flex)'
    }, nroFactura, true);
  }

  const response = await fetch(`https://api.mercadolibre.com/shipments/${encodeURIComponent(nroFactura)}`, {
    headers: { 'Authorization': `Bearer ${MERCADO_FLEX_TOKEN}` }
  });
  if (!response.ok) throw new Error("Envío Flex no encontrado o Token expirado.");
  const data = await response.json();
  
  return renderizarResultadoSeguimiento({
    carrier: 'Mercado Envíos Flex',
    status: data.status || 'En tránsito',
    contact: {
      name: data.receiver_address?.receiver_name,
      phone: data.receiver_address?.receiver_phone,
      address: `${data.receiver_address?.street_name} ${data.receiver_address?.street_number}`
    },
    attempts: data.substatus_history?.length || 0,
    estimated_delivery_time_slot: 'Llega hoy'
  }, nroFactura);
}

// RUTEADOR PRINCIPAL
async function buscarEstadoPorFactura() {
  const nroFactura = document.getElementById('inputFactura').value.trim();
  const proveedor = document.getElementById('selectProveedor').value;
  const contenedorResultado = document.getElementById('resultadoLogistica');

  if (!nroFactura) return alert("Por favor, ingresá un número de factura o envío.");

  contenedorResultado.innerHTML = `
    <div class="d-flex align-items-center text-primary">
      <div class="spinner-border spinner-border-sm me-2" role="status"></div>
      <small>Consultando estado en ${proveedor.toUpperCase()}...</small>
    </div>`;

  try {
    let htmlResult = '';
    if (proveedor === 'dispatchtrack') htmlResult = await consultarDispatchTrack(nroFactura);
    else if (proveedor === 'flex') htmlResult = await consultarFlex(nroFactura);

    contenedorResultado.innerHTML = htmlResult;
  } catch (err) {
    contenedorResultado.innerHTML = `
      <div class="alert alert-warning mb-0 py-2">
        <i class="bi bi-exclamation-triangle-fill me-1"></i> <small>${escaparSeguimiento(err.message)}</small>
      </div>`;
  }
}