# 🚀 Admin PostVenta / Facturacion

### Sistema Integrado de Gestión de Pedidos, Envíos y Clientes

Admin PostVenta / Facturacion es un **panel de administración centralizado** desarrollado como **Single Page Application (SPA)** para optimizar procesos operativos, logísticos y de comunicación **post-venta** de un e-commerce.

La plataforma centraliza diferentes tareas internas en una única interfaz, reduciendo procesos manuales y facilitando el seguimiento de clientes, pedidos, comunicaciones y gestiones post-compra.

---

## 📋 Funcionalidades

### 🚚 Gestión de pedidos y envíos

* Visualización centralizada del estado de los envíos.
* Estados disponibles:

  * `Sin aviso`
  * `En proceso`
  * `Enviado`
  * `Error`
* Asignación de plantillas de correo por cliente.
* Envío de notificaciones personalizadas.
* Integración con **EmailJS**.
* Alta de nuevos clientes.
* Filtrado y búsqueda en tiempo real.

---

### ⭐ Solicitud de Reviews

Módulo orientado a la gestión de comunicaciones post-venta.

Permite:

* Registrar clientes y productos adquiridos.
* Enviar solicitudes de opinión mediante correo electrónico.
* Registrar el estado del envío.
* Almacenar la valoración recibida.

Estados principales:

`Pendiente` · `Enviado` · `Error`

---

### 📊 Dashboard Operativo

Panel interno para visualizar información relevante de la operación.

Incluye:

* 📢 Campañas activas.
* 💳 Promociones bancarias.
* 🚚 Novedades logísticas.
* ⚠️ Alertas operativas.
* 📅 Información de campañas y acciones comerciales.

El objetivo es concentrar información que normalmente se encuentra distribuida entre diferentes herramientas y canales internos.

---

### ↩️ Gestión de Botón de Arrepentimiento

Módulo destinado al registro y seguimiento de solicitudes de cancelación o devolución.

Permite:

* Registrar o importar solicitudes.
* Asociar automáticamente una plantilla activa según el estado del pedido.
* Enviar avisos al cliente, a sucursales o a Facturación.
* Diferenciar el resultado de envío entre `Notificado cliente` y `Notificada Sucursal`.
* Exportar solicitudes y consultar errores de envío.

Estados iniciales:

`Devuelve Sucursal` · `Aviso Transferencia` · `Reembolso / anulacion Automatica` · `Retiro en domicilio` · `Enviado a Caja`

Flujo de devolución en sucursal: al enviar el aviso al cliente desde `Devuelve Sucursal`, el pedido pasa a `Avisar a Sucursal`. Luego de notificar a la sucursal, el pedido queda en `En espera de respuesta`.

Los avisos de transferencia y de reembolso/anulación también pasan a `En espera de respuesta` después de enviar el correo.

### Facturación

El módulo **Facturación** registra `Fecha de compra`, `Tienda`, `ID de compra`, `Pedido`, `Operador`, `Estado` y notas. Los pedidos se cargan en la bandeja principal con estado `Pedido Nuevo` o `Corregir`; desde allí se envían a **En Caja**. Caja puede devolverlos a corrección o informar un número de comprobante único, momento en que pasan a **Facturados**.

Los pedidos facturados se envían al webhook configurado en `GOOGLE_SHEET_ARCHIVE_WEBHOOK_URL` con `hoja_destino: "pedidos_facturados"`. El Apps Script asociado debe usar ese valor para insertar la fila en la pestaña correspondiente de Google Sheets.

### Plantillas de correo

Cada plantilla tiene un `ID interno`, un asunto, cuerpo, módulo y estado opcional. Los selectores muestran el ID interno y cada pantalla solo muestra plantillas de su módulo o del módulo `todos`.

| Módulo | Valor para la plantilla |
| --- | --- |
| Arrepentimientos | `arrepentimiento` |
| Envíos | `envios` |
| Pedidos de mercadería | `pedidos` |
| Disponible en todos los módulos | `todos` |

Una plantilla vinculada a un estado de arrepentimiento se utiliza automáticamente al crear o cambiar una solicitud. Si no existe una plantilla específica activa, la aplicación muestra una advertencia y usa la plantilla general del módulo cuando esté disponible.

---

# 🛠️ Stack Tecnológico

| Tecnología         | Uso                                  |
| ------------------ | ------------------------------------ |
| HTML5              | Estructura de la aplicación          |
| CSS3               | Estilos y componentes personalizados |
| Bootstrap 5.3      | UI y diseño responsive               |
| Bootstrap Icons    | Iconografía                          |
| JavaScript         | Lógica de negocio e interacción      |
| Supabase           | Base de datos y autenticación        |
| PostgreSQL         | Persistencia de datos                |
| Supabase Auth      | Autenticación de usuarios            |
| EmailJS            | Envío de correos                     |
| Git                | Control de versiones                 |
| GitHub             | Repositorio                          |
| GitHub Pages       | Hosting                              |
| Visual Studio Code | Entorno de desarrollo                |

---

# 🏗️ Arquitectura

La aplicación utiliza una arquitectura frontend ligera basada en una **SPA**, con Supabase como backend gestionado.

```text
┌─────────────────────────────┐
│        Admin PostVenta / Facturacion          │
│          SPA                │
└──────────────┬──────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌─────────────┐   ┌─────────────┐
│  Supabase   │   │   EmailJS   │
│             │   │             │
│ PostgreSQL  │   │  Emails     │
│ Auth        │   │ Automáticos │
└─────────────┘   └─────────────┘
```

---

# 📁 Estructura del proyecto

```text
/
├── index.html      # Aplicación principal y navegación SPA
├── styles.css      # Estilos personalizados y responsive design
├── app.js          # Lógica de negocio e integraciones
└── README.md       # Documentación del proyecto
```

---

# 🗄️ Base de Datos

La aplicación utiliza **Supabase / PostgreSQL**.

## Tabla `clientes`

```sql
CREATE TABLE clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  pedido TEXT,
  mail TEXT NOT NULL,
  template_id TEXT,
  estado TEXT DEFAULT 'sin aviso',
  fecha_envio TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Tabla `templates`

```sql
CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  modulo TEXT NOT NULL DEFAULT 'todos',
  estado TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Tabla `reviews`

```sql
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_nombre TEXT NOT NULL,
  producto TEXT NOT NULL,
  mail TEXT NOT NULL,
  estado_envio TEXT DEFAULT 'pendiente',
  rating INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Tabla `arrepentimientos`

```sql
CREATE TABLE arrepentimientos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  cliente_nombre TEXT NOT NULL,
  pedido_id TEXT NOT NULL,
  motivo TEXT NOT NULL,
  estado TEXT DEFAULT 'pendiente'
  ,fecha_envio TIMESTAMPTZ
);
```

## Tabla `pedidos_mercaderia`

La migración completa está en `supabase/permissions.sql`. Esta tabla recibe las columnas de la planilla de pedidos, permite importar archivos Excel/CSV desde el módulo **Pedidos de Mercadería** y aplica RLS para que solo usuarios `editor` o `admin` puedan importar datos.

El botón **Exportar stock > 1** descarga un CSV con los registros cuyo `st_depo` sea superior a 1.

### Migraciones

Después de actualizar el proyecto, ejecutá [supabase/permissions.sql](supabase/permissions.sql) en el SQL Editor de Supabase. El script crea o completa las columnas necesarias, configura permisos y migra el estado anterior `Notificado` a `En espera de respuesta` tanto en solicitudes como en plantillas.

### Permisos por módulo

El usuario con rol `admin` ve y administra todos los módulos. En **Admin novedades > Usuarios / Permisos**, el administrador puede asignar a cada usuario `Ver` o `Editar` para Admin, Envíos, Pedidos, Arrepentimiento, Seguimiento y Plantillas. Al marcar `Editar`, el rol se establece en `editor` y también se habilita `Ver`. Los módulos no asignados no aparecen en el menú y sus datos quedan protegidos por RLS.

---

# 🚀 Instalación

## 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/tu-repositorio.git
cd tu-repositorio
```

## 2. Ejecutar la aplicación

El proyecto no requiere un servidor backend propio.

Podés:

* Abrir `index.html` directamente en el navegador.
* Utilizar **Live Server** desde Visual Studio Code.
* Publicarlo mediante **GitHub Pages**.

---

# 🔐 Configuración

La aplicación requiere configurar las credenciales correspondientes a Supabase y EmailJS.

Ejemplo:

```javascript
const SUPABASE_URL = "https://tu-proyecto.supabase.co";
const SUPABASE_KEY = "tu-anon-key";

const EMAILJS_SERVICE_ID = "tu-service-id";
const EMAILJS_TEMPLATE_ID = "tu-template-id";
const EMAILJS_PUBLIC_KEY = "tu-public-key";
```

### ⚠️ Seguridad

No subir al repositorio:

* Service Role Keys de Supabase.
* Passwords.
* Tokens privados.
* API Keys con permisos administrativos.

Para un entorno productivo se recomienda utilizar **variables de entorno, configuración segura y políticas RLS (Row Level Security) en Supabase**.

---

# 🌐 Deploy con GitHub Pages

El proyecto puede publicarse como sitio estático utilizando GitHub Pages.

Configuración:

```text
Repository
   ↓
Settings
   ↓
Pages
   ↓
Deploy from branch
   ↓
main / root
```

Una vez configurado, GitHub generará una URL pública para acceder a la aplicación.

---

# 🔄 Flujo principal

```text
Usuario interno
      │
      ▼
┌─────────────────┐
│   Admin PostVenta / Facturacion   │
└────────┬────────┘
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
Supabase    EmailJS
    │          │
    ▼          ▼
 Datos       Emails
```

---

# 📝 Conventional Commits

El proyecto utiliza **Conventional Commits** para mantener un historial claro y consistente.

| Prefijo     | Uso                           |
| ----------- | ----------------------------- |
| `feat:`     | Nueva funcionalidad           |
| `fix:`      | Corrección de errores         |
| `docs:`     | Cambios en documentación      |
| `refactor:` | Reestructuración del código   |
| `style:`    | Cambios visuales o de formato |
| `chore:`    | Tareas de mantenimiento       |
| `perf:`     | Mejoras de rendimiento        |

### Ejemplos

```bash
git commit -m "feat: agregar gestión de reviews"

git commit -m "fix: corregir filtro de pedidos"

git commit -m "docs: actualizar README"

git commit -m "style: mejorar dashboard responsive"
```

---

# 🤖 Documentación asistida por IA

El proyecto puede complementarse con un **Gem / Notebook** utilizado como asistente técnico del proyecto.

La documentación puede utilizarse como fuente de conocimiento para consultar:

* Arquitectura.
* Estructura del proyecto.
* Base de datos.
* Flujos de negocio.
* Integraciones.
* Convenciones de código.
* Próximas funcionalidades.
* Decisiones técnicas.

Esto permite utilizar IA como una capa adicional de documentación y soporte durante la evolución de **Admin PostVenta / Facturacion**.

---

# 🗺️ Roadmap

Algunas funcionalidades previstas:

* [ ] Gestión de usuarios y roles.
* [ ] Auditoría de acciones.
* [ ] Dashboard con métricas.
* [ ] Historial de comunicaciones.
* [ ] Importación masiva de clientes.
* [ ] Exportación de información.
* [ ] Integración con APIs externas.
* [ ] Sistema de notificaciones internas.
* [ ] Mejoras de permisos mediante Supabase RLS.
* [ ] Optimización para dispositivos móviles.

---

# 📌 Estado del proyecto

**En desarrollo 🚧**

Admin PostVenta / Facturacion se encuentra en evolución continua y puede incorporar nuevos módulos, integraciones y automatizaciones según las necesidades operativas.

---

## 📄 Licencia

Proyecto de uso interno.

© 2026 Admin PostVenta / Facturacion
