// 1. CONFIGURACIÓN DE APIS (Sin duplicaciones)
const SUPABASE_URL = "https://ievbmsddbydxgnzknavl.supabase.co";
const SUPABASE_KEY = "sb_publishable_kBv1ve1gybdtaigXFuJ_Mw_7DmuGj_s";

const EMAILJS_SERVICE_ID = "service_n9o55gp";   
const EMAILJS_TEMPLATE_ID = "template_s8suav5";
const EMAILJS_PUBLIC_KEY = "kyyRWVy91lz7Wqh0Y";            

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

if (EMAILJS_PUBLIC_KEY && EMAILJS_PUBLIC_KEY !== "TU_PUBLIC_KEY") {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

let clientesData = [];
let templatesData = [];

// 2. NAVEGACIÓN Y NAVEGABILIDAD
function navegar(idSeccion, elementoLink) {
  document.querySelectorAll('.seccion-app').forEach(sec => sec.classList.add('d-none'));
  document.querySelectorAll('.sidebar .nav-link').forEach(link => link.classList.remove('active'));
  
  document.getElementById(idSeccion).classList.remove('d-none');
  elementoLink.classList.add('active');
}

// 3. LOGIN Y AUTH
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    alert("Error al ingresar: " + error.message);
  } else {
    checkUser();
  }
});

async function checkUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    document.getElementById('loginSection').classList.add('d-none');
    document.getElementById('appSection').classList.remove('d-none');
    cargarDatos();
  } else {
    document.getElementById('loginSection').classList.remove('d-none');
    document.getElementById('appSection').classList.add('d-none');
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  checkUser();
}

// 4. CARGA DE DATOS DE ENVÍOS Y PLANTILLAS
async function cargarDatos() {
  const { data: templates } = await supabaseClient.from('templates').select('*');
  const { data: clientes } = await supabaseClient.from('clientes').select('*').order('created_at', { ascending: false });
  
  templatesData = templates || [];
  clientesData = clientes || [];
  
  renderTabla();
  renderTemplates();
}

function renderTabla() {
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

// 5. ACCIONES DE CLIENTES Y PLANTILLAS
async function asignarPlantilla(clienteId, templateId) {
  const cliente = clientesData.find(c => String(c.id) === String(clienteId));
  if (cliente) {
    cliente.template_id = templateId;
  }

  const { error } = await supabaseClient
    .from('clientes')
    .update({ template_id: templateId })
    .eq('id', clienteId);

  if (error) {
    alert("Error al asignar plantilla: " + error.message);
  }
}

async function enviarMail(clienteId) {
  const cliente = clientesData.find(c => String(c.id) === String(clienteId));
  if (!cliente) return;

  if (!cliente.template_id) {
    alert("Por favor, selecciona una plantilla para este cliente antes de enviar.");
    return;
  }

  const template = templatesData.find(t => String(t.id) === String(cliente.template_id));
  if (!template) {
    alert("La plantilla seleccionada no existe.");
    return;
  }

  const asuntoFinal = template.nombre.replace(/\{\{nombre\}\}/g, cliente.nombre).replace(/\{\{pedido\}\}/g, cliente.pedido || '');
  const cuerpoFinal = template.cuerpo.replace(/\{\{nombre\}\}/g, cliente.nombre).replace(/\{\{pedido\}\}/g, cliente.pedido || '');

  const btn = document.getElementById(`btn-send-${clienteId}`);
  if (btn) btn.disabled = true;

  try {
    const params = {
      email_destino: cliente.mail,
      asunto: asuntoFinal,
      mensaje: cuerpoFinal
    };

    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);

    await supabaseClient.from('clientes').update({ estado: 'enviado', fecha_envio: new Date() }).eq('id', clienteId);
    
    alert(`📧 Mail enviado con éxito a ${cliente.mail}`);
    cargarDatos();

  } catch (err) {
    alert("❌ Error al enviar mail: " + JSON.stringify(err));
    await supabaseClient.from('clientes').update({ estado: 'error' }).eq('id', clienteId);
    cargarDatos();
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function guardarCliente() {
  const nombre = document.getElementById('newNombre').value;
  const pedido = document.getElementById('newPedido').value;
  const mail = document.getElementById('newMail').value;

  if (!nombre || !mail) {
    alert('Nombre y correo son requeridos.');
    return;
  }

  const { error } = await supabaseClient.from('clientes').insert([{ nombre, pedido, mail, estado: 'sin aviso' }]);
  if (error) {
    alert("Error al guardar: " + error.message);
  } else {
    const modalEl = document.getElementById('modalCliente');
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.hide();
    document.getElementById('formCliente').reset();
    cargarDatos();
  }
}

async function guardarTemplate() {
  const id = document.getElementById('tplId').value.trim();
  const nombre = document.getElementById('tplNombre').value;
  const cuerpo = document.getElementById('tplCuerpo').value;

  if (!id || !nombre || !cuerpo) {
    alert('Todos los campos son obligatorios.');
    return;
  }

  const { error } = await supabaseClient.from('templates').insert([{ id, nombre, cuerpo }]);
  if (error) {
    alert("Error al guardar plantilla: " + error.message);
  } else {
    document.getElementById('formTemplate').reset();
    cargarDatos();
  }
}

async function eliminarCliente(id) {
  if (confirm("¿Estás seguro de eliminar este registro?")) {
    await supabaseClient.from('clientes').delete().eq('id', id);
    cargarDatos();
  }
}

function filtrarTabla() {
  const text = document.getElementById('searchInput').value.toLowerCase();
  const rows = document.querySelectorAll('#tableBody tr');
  rows.forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(text) ? '' : 'none';
  });
}

window.onload = checkUser;