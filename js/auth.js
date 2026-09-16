// CONFIGURACIÓN CENTRAL DE APIS
const SUPABASE_URL = "https://ievbmsddbydxgnzknavl.supabase.co";
const SUPABASE_KEY = "sb_publishable_kBv1ve1gybdtaigXFuJ_Mw_7DmuGj_s";

const EMAILJS_SERVICE_ID = "service_n9o55gp";   
const EMAILJS_TEMPLATE_ID = "template_s8suav5";
const EMAILJS_PUBLIC_KEY = "kyyRWVy91lz7Wqh0Y";            

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

if (EMAILJS_PUBLIC_KEY && EMAILJS_PUBLIC_KEY !== "TU_PUBLIC_KEY") {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

// NAVEGACIÓN Y CARGA DINÁMICA DE VISTAS
async function navegar(seccion, elementoLink) {
  document.querySelectorAll('.sidebar .nav-link').forEach(link => link.classList.remove('active'));
  if (elementoLink) elementoLink.classList.add('active');

  const mainContent = document.getElementById('mainContent');
  mainContent.innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2">Cargando...</p></div>`;

  try {
    const resView = await fetch(`views/${seccion}.html`);
    if (!resView.ok) throw new Error("Error al cargar la vista.");
    mainContent.innerHTML = await resView.text();

    // Cargar modales asociados
    cargarModales();

    // Disparar carga de datos según sección
    if (seccion === 'envios' && typeof cargarDatosEnvios === 'function') cargarDatosEnvios();
    if (seccion === 'admin' && typeof cargarDatosAdmin === 'function') cargarDatosAdmin();

  } catch (err) {
    mainContent.innerHTML = `<div class="alert alert-danger m-4">No se pudo cargar la sección. ${err.message}</div>`;
  }
}

// CARGA DE COMPONENTES MODALES
async function cargarModales() {
  const container = document.getElementById('modalsContainer');
  if (!container) return;

  try {
    const [mCliente, mTemplates, mPromo] = await Promise.all([
      fetch('modals/modal-cliente.html').then(r => r.text()),
      fetch('modals/modal-novedad.html').then(r => r.text()),
      fetch('modals/modal-promo-bancaria.html').then(r => r.text()),
      fetch('modals/modal-promo.html').then(r => r.text()),
      fetch('modals/modal-templates.html').then(r => r.text())
    ]);
    container.innerHTML = mCliente + mTemplates + mPromo;
  } catch (err) {
    console.error("Error al cargar modales:", err);
  }
}

// MANEJO DE SESIÓN
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) alert("Error al ingresar: " + error.message);
  else checkUser();
});

async function checkUser() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    document.getElementById('loginSection').classList.add('d-none');
    document.getElementById('appSection').classList.remove('d-none');
    navegar('envios', document.querySelector('.sidebar .nav-link.active'));
  } else {
    document.getElementById('loginSection').classList.remove('d-none');
    document.getElementById('appSection').classList.add('d-none');
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  checkUser();
}

window.onload = checkUser;