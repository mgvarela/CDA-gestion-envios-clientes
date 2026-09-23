// CONFIGURACIÓN CENTRAL DE APIS
const SUPABASE_URL = window.APP_ENV?.SUPABASE_URL || "https://ievbmsddbydxgnzknavl.supabase.co";
const SUPABASE_KEY = window.APP_ENV?.SUPABASE_KEY || "sb_publishable_kBv1ve1gybdtaigXFuJ_Mw_7DmuGj_s";

const EMAILJS_SERVICE_ID = window.APP_ENV?.EMAILJS_SERVICE_ID || "service_n9o55gp";   
const EMAILJS_TEMPLATE_ID = window.APP_ENV?.EMAILJS_TEMPLATE_ID || "template_s8suav5";
const EMAILJS_PUBLIC_KEY = window.APP_ENV?.EMAILJS_PUBLIC_KEY || "kyyRWVy91lz7Wqh0Y";            

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabaseClient = supabaseClient;
let currentUserRole = 'viewer';
let currentUserModulePermissions = {};
let currentModule = '';

const APP_MODULES = ['admin', 'envios', 'pedidos', 'facturacion', 'arrepentimiento', 'seguimiento', 'plantillas'];

function getModulePermission(module) {
  return currentUserModulePermissions?.[module] || '';
}

function canAccessModule(module) {
  return currentUserRole === 'admin' || ['view', 'edit'].includes(getModulePermission(module));
}

function canWrite(module = currentModule) {
  return currentUserRole === 'admin' || (currentUserRole === 'editor' && getModulePermission(module) === 'edit');
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

  document.querySelectorAll('[data-module]').forEach(el => {
    el.hidden = !canAccessModule(el.dataset.module);
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
    .select('role, module_permissions')
    .eq('id', session.user.id)
    .maybeSingle();

  currentUserRole = (!profileError && data?.role) ? data.role : 'viewer';
  currentUserModulePermissions = (!profileError && data?.module_permissions && typeof data.module_permissions === 'object')
    ? data.module_permissions
    : {};
  applyRolePermissions();

  if (currentUserRole === 'admin' && window.AppConfig && typeof window.AppConfig.loadFromDatabase === 'function') {
    await window.AppConfig.loadFromDatabase(supabaseClient);
  }
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
async function navegar(seccion, elementoLink, subvista = '') {
  if (!canAccessModule(seccion)) {
    mostrarNotificacion('No tenés acceso a este módulo.', 'danger');
    return;
  }

  currentModule = seccion;
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
    if (seccion === 'pedidos' && typeof cargarPedidos === 'function') cargarPedidos();
    if (seccion === 'facturacion' && typeof cargarFacturacion === 'function') cargarFacturacion();
    if (seccion === 'arrepentimiento' && typeof cargarArrepentimientos === 'function') {
      await cargarArrepentimientos();
      if (subvista === 'caja' && typeof cambiarVistaArrepentimientos === 'function') cambiarVistaArrepentimientos('caja');
    }

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

function toggleSidebarCompact() {
  const app = document.getElementById('appSection');
  if (!app) return;
  const compact = app.classList.toggle('sidebar-compact');
  localStorage.setItem('sidebarCompact', compact ? 'true' : 'false');

  const button = document.querySelector('.sidebar-collapse-button');
  if (button) {
    button.setAttribute('aria-label', compact ? 'Expandir menú' : 'Contraer menú');
    button.setAttribute('title', compact ? 'Expandir menú' : 'Contraer menú');
    button.innerHTML = `<i class="bi ${compact ? 'bi-chevron-right' : 'bi-chevron-left'}"></i>`;
  }
}

function restaurarEstadoSidebar() {
  if (window.innerWidth < 768) return;
  const app = document.getElementById('appSection');
  if (!app || localStorage.getItem('sidebarCompact') !== 'true') return;
  app.classList.add('sidebar-compact');
  const button = document.querySelector('.sidebar-collapse-button');
  if (button) {
    button.setAttribute('aria-label', 'Expandir menú');
    button.setAttribute('title', 'Expandir menú');
    button.innerHTML = '<i class="bi bi-chevron-right"></i>';
  }
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

window.mostrarPanelConfiguracion = function mostrarPanelConfiguracionGlobal() {
  document.querySelectorAll('#adminTabs .nav-link').forEach(link => link.classList.remove('active'));
  document.querySelectorAll('.tab-content .tab-pane').forEach(panel => panel.classList.remove('show', 'active'));

  const tab = document.getElementById('tab-configuracion');
  const panel = document.getElementById('content-configuracion');
  if (!tab || !panel) return;

  tab.classList.add('active');
  panel.classList.add('show', 'active');

  if (typeof cargarConfiguracionesSistema === 'function') {
    cargarConfiguracionesSistema();
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
    restaurarEstadoSidebar();
    const firstAccessibleLink = document.querySelector('.sidebar [data-module]:not([hidden]) .nav-link');
    const firstAccessibleModule = firstAccessibleLink?.closest('[data-module]')?.dataset.module;
    if (firstAccessibleModule) navegar(firstAccessibleModule, firstAccessibleLink);
    else document.getElementById('mainContent').innerHTML = '<div class="alert alert-warning m-4">Tu usuario no tiene módulos asignados. Pedile a un administrador que habilite al menos uno.</div>';
  } else {
    currentUserRole = 'viewer';
    currentUserModulePermissions = {};
    currentModule = '';
    document.getElementById('loginSection').classList.remove('d-none');
    document.getElementById('appSection').classList.add('d-none');
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  checkUser();
}

window.onload = checkUser;

// UTILIDAD DE ESCAPADO HTML GLOBAL
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.escapeHtml = escapeHtml;

// HELPER DE NOTIFICACIONES DENTRO DEL PROYECTO (Sin alert JS)
function mostrarNotificacion(mensaje, tipo = 'info', duracion = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return alert(mensaje); // Fallback de seguridad

  const toast = document.createElement('div');
  const tipoClase = tipo === 'error' || tipo === 'danger' ? 'danger' : (tipo === 'success' ? 'success' : (tipo === 'warning' ? 'warning' : 'info'));
  
  toast.className = `alert alert-${tipoClase} alert-dismissible fade show`;
  toast.role = 'alert';
  toast.innerHTML = `
    <div class="d-flex align-items-center small">
      <i class="bi bi-info-circle-fill me-2 fs-6"></i>
      <div>${escapeHtml(mensaje)}</div>
    </div>
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, duracion);
}

// HELPER DE CONFIRMACIÓN MEDIANTE MODAL BOOTSTRAP (Sin confirm JS)
function confirmarAccionModal(titulo, mensaje) {
  return new Promise((resolve) => {
    const modalEl = document.getElementById('modalConfirmacionGlobal');
    if (!modalEl) {
      resolve(confirm(mensaje));
      return;
    }

    document.getElementById('modalConfirmacionTitulo').textContent = titulo;
    document.getElementById('modalConfirmacionMensaje').textContent = mensaje;

    const bsModal = new bootstrap.Modal(modalEl);
    const btnAceptar = document.getElementById('btnModalConfirmarAceptar');

    const handleAceptar = () => {
      cleanup();
      bsModal.hide();
      resolve(true);
    };

    const handleHidden = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      btnAceptar.removeEventListener('click', handleAceptar);
      modalEl.removeEventListener('hidden.bs.modal', handleHidden);
    };

    btnAceptar.addEventListener('click', handleAceptar);
    modalEl.addEventListener('hidden.bs.modal', handleHidden, { once: true });

    bsModal.show();
  });
}

window.mostrarNotificacion = mostrarNotificacion;
window.confirmarAccionModal = confirmarAccionModal;
