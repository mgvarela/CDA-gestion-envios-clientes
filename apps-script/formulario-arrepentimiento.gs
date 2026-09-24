// =========================================================================
// CONFIGURACIÓN DE SUPABASE (Paso Entrada)
// =========================================================================
const SUPABASE_URL = "https://ievbmsddbydxgnzknavl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_kBv1ve1gybdtaigXFuJ_Mw_7DmuGj_s";

// NOMBRE EXACTO DE LAS PESTAÑAS DENTRO DE TU SHEET
const NOMBRE_HOJA_FORMULARIO = "Respuestas de Formulario 1";
const NOMBRE_HOJA_CERRADOS_DEFAULT = "Historico_Cerrados";

// =========================================================================
// 1. ENTRADA: Google Forms -> Supabase (Trigger al enviar formulario)
// =========================================================================
function enviarASupabase(e) {
  try {
    if (!e) return;

    // e.namedValues obtiene los datos mapeados por el título exacto de la pregunta/columna
    var nv = e.namedValues || {};
    var fila = e.values || [];

    var obtenerValor = function(nombreColumna, indiceFallback) {
      if (nv[nombreColumna] && nv[nombreColumna][0]) {
        return nv[nombreColumna][0].toString().trim();
      }
      return fila[indiceFallback] ? fila[indiceFallback].toString().trim() : '';
    };

    var payload = {
      cliente_nombre: obtenerValor('Nombre y Apellido', 1) || obtenerValor('Nombre', 1) || 'Sin Nombre',
      cliente_email: obtenerValor('Email', 2) || obtenerValor('Correo electrónico', 2) || '',
      cliente_telefono: obtenerValor('Teléfono', 3) || obtenerValor('Telefono', 3) || '',
      cliente_dni: obtenerValor('DNI', 4) || obtenerValor('Documento', 4) || '',
      pedido_id: obtenerValor('N° Orden de compra', 5) || obtenerValor('N° Pedido', 5) || obtenerValor('Pedido', 5) || 'S/N',
      numero_pedido: obtenerValor('N° Orden de compra', 5) || obtenerValor('N° Pedido', 5) || 'S/N',
      pedido: obtenerValor('N° Orden de compra', 5) || obtenerValor('N° Pedido', 5) || 'S/N',
      motivo: obtenerValor('Motivo', 6) || 'Arrepentimiento de compra',
      comentario: obtenerValor('Comentarios', 7) || obtenerValor('Comentario', 7) || '',
      // El formulario web solo recolecta datos: no clasifica el caso, por eso
      // debe entrar a revisión ("Otros") y no directo a "Enviado a Caja",
      // que es un estado exclusivo para derivar a Facturación desde la app.
      canal: 'web',
      estado: 'Otros',
      estado_cliente: 'Pendiente'
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Prefer': 'return=minimal'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/arrepentimientos', options);
    Logger.log('Respuesta Supabase: ' + response.getContentText());

  } catch (error) {
    Logger.log('Error al enviar a Supabase: ' + error.toString());
  }
}

// =========================================================================
// 2. SALIDA: Control Hub -> Google Sheet (Webhook de archivado)
// =========================================================================
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // La app manda la pestaña destino en "hoja_destino" (ej: "Cerrado sin gestion",
    // "Historico_Cerrados"). Antes se ignoraba este campo y siempre se escribía
    // en "Historico_Cerrados" con el estado fijo "Cerrado".
    var nombreHoja = data.hoja_destino || NOMBRE_HOJA_CERRADOS_DEFAULT;
    var estadoArchivo = data.estado_archivo || 'Cerrado';

    var sheetDestino = ss.getSheetByName(nombreHoja);
    if (!sheetDestino) {
      sheetDestino = ss.insertSheet(nombreHoja);
    }
    // Si la pestaña ya existía pero sin filas (creada manualmente desde Sheets), le agrega los títulos.
    if (sheetDestino.getLastRow() === 0) {
      sheetDestino.appendRow(['Fecha Cierre', 'N° Pedido', 'Cliente', 'DNI', 'Teléfono', 'Email', 'Motivo', 'Comentario', 'Estado', 'Fecha Envío Email']);
    }

    sheetDestino.appendRow([
      new Date(),
      data.pedido_id || data.numero_pedido || 'S/N',
      data.cliente_nombre || '',
      data.cliente_dni || '',
      data.cliente_telefono || '',
      data.cliente_email || data.cliente_mail || '',
      data.motivo || '',
      data.comentario || '',
      estadoArchivo,
      data.fecha_envio ? new Date(data.fecha_envio) : new Date()
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
