// ==========================================
// CONFIGURACIÓN CENTRAL DE SUPABASE Y EMAILJS
// ==========================================
const SUPABASE_URL = "https://ievbmsddbydxgnzknavl.supabase.co";
const SUPABASE_KEY = "sb_publishable_kBv1ve1gybdtaigXFuJ_Mw_7DmuGj_s";

const EMAILJS_SERVICE_ID = "service_n9o55gp";   
const EMAILJS_TEMPLATE_ID = "template_s8suav5";
const EMAILJS_PUBLIC_KEY = "kyyRWVy91lz7Wqh0Y";            

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

if (EMAILJS_PUBLIC_KEY && EMAILJS_PUBLIC_KEY !== "TU_PUBLIC_KEY") {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

// ==========================================
// NAVEGACIÓN ENTRE SECCIONES
// ==========================================
function navegar(idSeccion, elementoLink) {
  document.querySelectorAll('.seccion-app').forEach(sec => sec.classList.add('d-none'));
  document.querySelectorAll('.sidebar .nav-link').forEach(link => link.classList.remove('active'));
  
  document.getElementById(idSeccion).classList.remove('d-none');
  elementoLink.classList.add('active');

  // Carga condicional al cambiar de pestaña
  if (idSeccion === 'secAdmin' && typeof cargarDatosAdmin === 'function') {
    cargarDatosAdmin();
  }
}

// ==========================================
// CONTROL DE AUTENTICACIÓN
// ==========================================
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
    
    // Carga inicial de datos tras el login
    if (typeof cargarDatosEnvios === 'function') cargarDatosEnvios();
    if (typeof cargarDatosAdmin === 'function') cargarDatosAdmin();
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