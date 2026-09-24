// Copiá este archivo como "js/env.local.js" (ya está en .gitignore, no se sube al repo)
// para apuntar la app a un proyecto Supabase de PRUEBAS en tu entorno local,
// sin tocar los valores de producción en js/config.js.
//
// Cargalo en index.html justo ANTES de <script src="js/config.js">:
//   <script src="js/env.local.js"></script>
//   <script src="js/config.js"></script>
window.APP_ENV = {
  SUPABASE_URL: "https://TU-PROYECTO-DE-PRUEBAS.supabase.co",
  SUPABASE_KEY: "tu-anon-key-de-pruebas",
  EMAILJS_SERVICE_ID: "service_n9o55gp",
  EMAILJS_TEMPLATE_ID: "template_s8suav5",
  EMAILJS_PUBLIC_KEY: "kyyRWVy91lz7Wqh0Y"
};
