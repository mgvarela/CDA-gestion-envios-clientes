let clientesData = [];
let templatesData = [];

async function cargarDatosEnvios() {
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

    let selectOptions = `<option value="">Seleccionar plantilla...</option>`;
    templatesData.forEach(t => {
      let isSelected = (String(t.id).trim() === String(c.template_id).trim()) ? 'selected' : '';
      selectOptions += `<option value="${t.id}" ${isSelected}>${t.nombre}</option>`;
    });

    tbody.innerHTML += `
      <tr>
        <td><strong>${c.nombre}</strong></td>
        <td>${c.pedido || '-'}</td>
        <td>${c.mail}</td>
        <td>
          <select class="form-select form-select-sm" onchange="asignarPlantilla('${c.id}', this.value)">
            ${selectOptions}
          </select>
        </td>
        <td>
          <button class="btn btn-sm btn-primary" id="btn-send-${c.id}" onclick="enviarMail('${c.id}')">
            <i class="bi bi-send"></i> Enviar
          </button>
        </td>
        <td><span class="badge ${badgeClass}" id="badge-${c.id}">${c.estado}</span></td>
        <td class="text-center">
          <button class="btn btn-sm btn-outline-danger" onclick="eliminarCliente('${c.id}')"><i class="bi bi-trash"></i></button>
        </td>
      </tr>
    `;
  });
}

function renderTemplates() {
  const list = document.getElementById('listTemplates');
  if (!list) return;
  list.innerHTML = '';
  templatesData.forEach(t => {
    list.innerHTML += `<li class="list-group-item"><strong>${t.nombre}</strong> <small class="text-muted">(${t.id})</small><br><small>${t.cuerpo}</small></li>`;
  });
}

async function asignarPlantilla(clienteId, templateId) {
  const cliente = clientesData.find(c => String(c.id) === String(clienteId));
  if (cliente) cliente.template_id = templateId;

  const { error } = await supabaseClient.from('clientes').update({ template_id: templateId }).eq('id', clienteId);
  if (error) alert("Error al asignar plantilla: " + error.message);
}

async function enviarMail(clienteId) {
  const cliente = clientesData.find(c => String(c.id) === String(clienteId));
  if (!cliente || !cliente.template_id) return alert("Por favor, selecciona una plantilla.");

  const template = templatesData.find(t => String(t.id) === String(cliente.template_id));
  if (!template) return;

  const asuntoFinal = template.nombre.replace(/\{\{nombre\}\}/g, cliente.nombre).replace(/\{\{pedido\}\}/g, cliente.pedido || '');
  const cuerpoFinal = template.cuerpo.replace(/\{\{nombre\}\}/g, cliente.nombre).replace(/\{\{pedido\}\}/g, cliente.pedido || '');

  const btn = document.getElementById(`btn-send-${clienteId}`);
  if (btn) btn.disabled = true;

  try {
    const params = { email_destino: cliente.mail, asunto: asuntoFinal, mensaje: cuerpoFinal };
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
    await supabaseClient.from('clientes').update({ estado: 'enviado', fecha_envio: new Date() }).eq('id', clienteId);
    
    alert(`📧 Mail enviado con éxito a ${cliente.mail}`);
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
  const nombre = document.getElementById('newNombre').value;
  const pedido = document.getElementById('newPedido').value;
  const mail = document.getElementById('newMail').value;

  if (!nombre || !mail) return alert('Nombre y correo son requeridos.');

  const { error } = await supabaseClient.from('clientes').insert([{ nombre, pedido, mail, estado: 'sin aviso' }]);
  if (error) alert("Error al guardar: " + error.message);
  else {
    bootstrap.Modal.getInstance(document.getElementById('modalCliente')).hide();
    document.getElementById('formCliente').reset();
    cargarDatosEnvios();
  }
}

async function guardarTemplate() {
  const id = document.getElementById('tplId').value.trim();
  const nombre = document.getElementById('tplNombre').value;
  const cuerpo = document.getElementById('tplCuerpo').value;

  if (!id || !nombre || !cuerpo) return alert('Todos los campos son obligatorios.');

  const { error } = await supabaseClient.from('templates').insert([{ id, nombre, cuerpo }]);
  if (error) alert("Error al guardar plantilla: " + error.message);
  else {
    document.getElementById('formTemplate').reset();
    cargarDatosEnvios();
  }
}

async function eliminarCliente(id) {
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