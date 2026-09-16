// ==========================================
// CONSULTA DE ESTADO EN DISPATCHTRACK
// ==========================================
const DISPATCHTRACK_API_KEY = ""; // Pegar la API Key de Beetrack/DispatchTrack cuando la tengan

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
    contactoUrl: primerValor(contacto.url, contacto.contact_url, order.contact_url)
  };
}

function renderizarResultadoSeguimiento(order, nroFactura, esSimulacion = false) {
  const datos = obtenerDatosContacto(order);
  const nombre = escaparSeguimiento(datos.nombre);
  const nombreHtml = datos.contactoUrl !== '-' && /^https:\/\//i.test(datos.contactoUrl)
    ? `<a href="${escaparSeguimiento(datos.contactoUrl)}" target="_blank" rel="noopener noreferrer">${nombre}</a>`
    : nombre;

  return `
    <div class="alert ${esSimulacion ? 'alert-info' : 'alert-success'} mb-0 py-3">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <strong>Factura: ${escaparSeguimiento(nroFactura)}</strong>
        <span class="badge bg-primary">${escaparSeguimiento(datos.estado).toUpperCase()}</span>
      </div>
      <div class="row g-2 text-dark small">
        <div class="col-md-6"><strong>Nombre:</strong> ${nombreHtml}</div>
        <div class="col-md-6"><strong>Identificador de contacto:</strong> ${escaparSeguimiento(datos.identificador)}</div>
        <div class="col-md-6"><strong>Teléfono:</strong> ${escaparSeguimiento(datos.telefono)}</div>
        <div class="col-md-6"><strong>Dirección:</strong> ${escaparSeguimiento(datos.direccion)}</div>
        <div class="col-md-6"><strong>Núm. intentos:</strong> ${escaparSeguimiento(datos.intentos)}</div>
        <div class="col-md-6"><strong>Último estado:</strong> ${escaparSeguimiento(datos.estado)}</div>
        <div class="col-12"><strong>Franja horaria de entrega estimada:</strong> ${escaparSeguimiento(datos.franja)}</div>
      </div>
      ${esSimulacion ? '<small class="text-muted d-block mt-2">Respuesta de prueba: configurá DispatchTrack para consultar datos reales.</small>' : ''}
    </div>`;
}

async function buscarEstadoPorFactura() {
  const nroFactura = document.getElementById('inputFactura').value.trim();
  const contenedorResultado = document.getElementById('resultadoLogistica');

  if (!nroFactura) {
    alert("Por favor, ingresá un número de factura.");
    return;
  }

  contenedorResultado.innerHTML = `
    <div class="d-flex align-items-center text-primary">
      <div class="spinner-border spinner-border-sm me-2" role="status"></div>
      <small>Consultando estado en DispatchTrack...</small>
    </div>`;

  // MODO SIMULACIÓN (Si no hay API Key cargada todavía)
  if (!DISPATCHTRACK_API_KEY) {
    setTimeout(() => {
      contenedorResultado.innerHTML = renderizarResultadoSeguimiento({
        status: 'EN CAMINO',
        contact: {
          name: 'Laboratorios Casasco S.A.I.C',
          id: '50159608',
          phone: '+5491159346621',
          address: 'Bacacay 1845, Capital Federal'
        },
        attempts: 1,
        estimated_delivery_time_slot: 'Hoy entre 14:00 y 18:00 hs'
      }, nroFactura, true);
    }, 600);
    return;
  }

  // MODO REAL (Petición GET de lectura a DispatchTrack)
  try {
    const response = await fetch(`https://api.dispatchtrack.com/api/v1/orders/${encodeURIComponent(nroFactura)}`, {
      method: 'GET',
      headers: {
        'X-DISPATCHTRACK-KEY': DISPATCHTRACK_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) throw new Error("Factura o pedido no encontrado.");
      throw new Error("No se pudo conectar con el servicio de logística.");
    }

    const data = await response.json();
    const order = data.response || data;

    contenedorResultado.innerHTML = renderizarResultadoSeguimiento(order, nroFactura);

  } catch (err) {
    contenedorResultado.innerHTML = `
      <div class="alert alert-warning mb-0 py-2">
        <i class="bi bi-exclamation-triangle-fill me-1"></i> <small>${escaparSeguimiento(err.message)}</small>
      </div>`;
  }
}