// =======================================================
// CONFIGURACIÓN CENTRALIZADA DEL SISTEMA (Control Hub)
// =======================================================

// 1. Parámetros públicos de conexión (cliente)
// Si "js/env.local.js" se cargó antes que este archivo (solo en desarrollo local,
// no versionado), respeta esos valores para apuntar a un proyecto Supabase de pruebas.
const APP_ENV = window.APP_ENV || {
  SUPABASE_URL: "https://ievbmsddbydxgnzknavl.supabase.co",
  SUPABASE_KEY: "sb_publishable_kBv1ve1gybdtaigXFuJ_Mw_7DmuGj_s",
  EMAILJS_SERVICE_ID: "service_n9o55gp",
  EMAILJS_TEMPLATE_ID: "template_s8suav5",
  EMAILJS_PUBLIC_KEY: "kyyRWVy91lz7Wqh0Y"
};
window.APP_ENV = APP_ENV;

// 2. Valores predeterminados para variables dinámicas / sensibles
const CONFIG_DEFAULTS = {
  DISPATCHTRACK_API_KEY: "",
  EPRESIS_API_KEY: "",
  MERCADO_FLEX_TOKEN: "",
  DESTINATARIO_FACTURACION: "mvarela@casadelaudio.com",
  EMAIL_ADMIN_GRUPO: "info---ecommerce@googlegroups.com",
  GOOGLE_SHEET_ARCHIVE_WEBHOOK_URL: "https://script.google.com/macros/s/AKfycbyOHK_tiJJgVY9HffudGWQuyfCIIld70VpFg7d4EonvYe2dbOm30p8CAqm9rczkQv9R/exec"
};

// 3. Gestor de Configuración Dinámica en Memoria
const AppConfig = {
  _cache: { ...CONFIG_DEFAULTS },
  _loaded: false,

  // Obtener un valor con fallback seguro al valor por defecto
  get(key) {
    const cached = this._cache[key];
    if (cached !== undefined && cached !== null && String(cached).trim() !== "") {
      return cached;
    }
    return CONFIG_DEFAULTS[key] ?? "";
  },

  // Asignar en memoria
  set(key, value) {
    this._cache[key] = value;
  },

  // Carga configuraciones desde la base de datos Supabase
  async loadFromDatabase(supabaseClientInstance) {
    const client = supabaseClientInstance || window.supabaseClient;
    if (!client) return;

    try {
      const { data, error } = await client
        .from('configuraciones_sistema')
        .select('clave, valor, es_secreta');

      if (!error && data && data.length > 0) {
        data.forEach(item => {
          this._cache[item.clave] = item.valor;
        });
        this._loaded = true;
      }
    } catch (e) {
      console.warn("No se pudieron cargar configuraciones dinámicas desde Supabase:", e.message);
    }
  }
};

// Exposición en el objeto global window
window.APP_ENV = APP_ENV;
window.CONFIG_DEFAULTS = CONFIG_DEFAULTS;
window.AppConfig = AppConfig;