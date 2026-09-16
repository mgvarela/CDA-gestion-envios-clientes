// CONFIGURACIÓN CENTRAL DE APIS
const SUPABASE_URL = "https://ievbmsddbydxgnzknavl.supabase.co";
const SUPABASE_KEY = "sb_publishable_kBv1ve1gybdtaigXFuJ_Mw_7DmuGj_s";

const EMAILJS_SERVICE_ID = "service_n9o55gp";   
const EMAILJS_TEMPLATE_ID = "template_s8suav5";
const EMAILJS_PUBLIC_KEY = "kyyRWVy91lz7Wqh0Y";            

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUserRole = 'viewer';

function canWrite() {
  return ['admin', 'editor'].includes(currentUserRole);
}

function canDelete() {
  return currentUserRole === 'admin';
}

function applyRolePermissions() {
  const canWriteAction = canWrite();
  const canDeleteAction = canDelete();
  const roleBadge = document.getElementById('currentUserRoleLabel');

  if (roleBadge) {
    roleBadge.textContent = currentUserRole;
  }

  document.querySelectorAll('[data-role-action="write"]').forEach(el => {
    el.hidden = !canWriteAction;
  });

  document.querySelectorAll('[data-role-action="delete"]').forEach(el => {
    el.hidden = !canDeleteAction;
  });

  const adminOnlyEls = document.querySelectorAll('[data-admin-only="true"]');
  adminOnlyEls.forEach(el => {
    el.hidden = currentUserRole !== 'admin';
  });
}

async function loadUserRole() {
  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error || !session) {
    currentUserRole = 'viewer';
    applyRolePermissions();
    return;
  }

  const { data, error: profileError } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle();

  currentUserRole = (!profileError && data?.role) ? data.role : 'viewer';
  applyRolePermissions();
}

async function requireAuth() {
  const { data: { session }, error } = await supabaseClient.auth.getSession();

  if (error || !session) {
    alert('Tu sesión expiró o no estás autenticado. Iniciá sesión nuevamente.');
    const loginSection = document.getElementById('loginSection');
    const appSection = document.getElementById('appSection');
    if (loginSection) loginSection.classList.remove('d-none');
    if (appSection) appSection.classList.add('d-none');
    return false;
  }

  await loadUserRole();
  return true;
}

if (EMAILJS_PUBLIC_KEY && EMAILJS_PUBLIC_KEY !== "TU_PUBLIC_KEY") {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

// NAVEGACIÓN Y CARGA DINÁMICA DE VISTAS
async function navegar(seccion, elementoLink) {
  closeSidebar();
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
    applyRolePermissions();

    // Disparar carga de datos según sección
    if (seccion === 'envios' && typeof cargarDatosEnvios === 'function') cargarDatosEnvios();
    if (seccion === 'admin' && typeof cargarDatosAdmin === 'function') cargarDatosAdmin();

  } catch (err) {
    mainContent.innerHTML = `<div class="alert alert-danger m-4">No se pudo cargar la sección. ${err.message}</div>`;
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('appSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar || !overlay) return;

  sidebar.classList.toggle('is-open');
  overlay.classList.toggle('is-visible');
}

function closeSidebar() {
  const sidebar = document.getElementById('appSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar || !overlay) return;

  sidebar.classList.remove('is-open');
  overlay.classList.remove('is-visible');
}

// Compatibilidad con vistas cacheadas que todavía llaman la función sin window.
window.mostrarPanelUsuarios = function mostrarPanelUsuariosGlobal() {
  document.querySelectorAll('#adminTabs .nav-link').forEach(link => link.classList.remove('active'));
  document.querySelectorAll('.tab-content .tab-pane').forEach(panel => panel.classList.remove('show', 'active'));

  const tab = document.getElementById('tab-usuarios');
  const panel = document.getElementById('content-usuarios');
  if (!tab || !panel) return;

  tab.classList.add('active');
  panel.classList.add('show', 'active');

  if (typeof cargarUsuariosRoles === 'function') {
    cargarUsuariosRoles();
  }
};

// CARGA DE COMPONENTES MODALES
async function cargarModales() {
  const container = document.getElementById('modalsContainer');
  if (!container) return;

  try {
    const [mCliente, mNovedad, mPromoBancaria, mPromo, mTemplates] = await Promise.all([
      fetch('modals/modal-cliente.html').then(r => r.text()),
      fetch('modals/modal-novedad.html').then(r => r.text()),
      fetch('modals/modal-promo-bancaria.html').then(r => r.text()),
      fetch('modals/modal-promo.html').then(r => r.text()),
      fetch('modals/modal-templates.html').then(r => r.text())
    ]);
    container.innerHTML = mCliente + mNovedad + mPromoBancaria + mPromo + mTemplates;
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
    await loadUserRole();
    document.getElementById('loginSection').classList.add('d-none');
    document.getElementById('appSection').classList.remove('d-none');
    navegar('admin', document.querySelector('.sidebar .nav-link.active'));
  } else {
    currentUserRole = 'viewer';
    document.getElementById('loginSection').classList.remove('d-none');
    document.getElementById('appSection').classList.add('d-none');
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  checkUser();
}

window.onload = checkUser;