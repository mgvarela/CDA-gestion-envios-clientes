-- =======================================================
-- ÍNDICE DE FUNCIONES SQL (PUBLIC)
-- 1. can_access_module(text)
-- 2. can_edit_module(text)
-- 3. current_user_role()
-- 4. desactivar_promos_vencidas()
-- 5. handle_new_user()
-- 6. log_app_table_change()
-- 7. purgar_app_logs_antiguos()
-- 8. set_profiles_updated_at()
-- =======================================================

-- =======================================================
-- 1. EXTENSIONES
-- =======================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =======================================================
-- 2. ESTRUCTURA DE TABLAS PRINCIPALES
-- =======================================================

-- Profiles (Gestión de usuarios y roles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
  module_permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clientes (Envíos)
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  pedido TEXT,
  mail TEXT NOT NULL,
  template_id TEXT,
  estado TEXT DEFAULT 'sin aviso',
  fecha_envio TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates / Plantillas
CREATE TABLE IF NOT EXISTS public.templates (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  es_contenido_app BOOLEAN NOT NULL DEFAULT true,
  modulo TEXT NOT NULL DEFAULT 'todos',
  estado TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pedidos de Mercadería
CREATE TABLE IF NOT EXISTS public.pedidos_mercaderia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fila_origen INTEGER,
  cod_suc_vta TEXT,
  sucursal_vta TEXT,
  documento TEXT,
  fecha_venta TEXT,
  fecha_programada TEXT,
  clave TEXT,
  familia TEXT,
  articulo TEXT,
  cantidad NUMERIC DEFAULT 0,
  st_disponible NUMERIC DEFAULT 0,
  st_reservado NUMERIC DEFAULT 0,
  cod_suc_ent TEXT,
  sucursal_ent TEXT,
  cod_cliente TEXT,
  cliente TEXT,
  confirmo TEXT,
  actualizado TEXT,
  st_depo NUMERIC DEFAULT 0,
  emails_destino TEXT,
  desde_hasta TEXT,
  tipo_plantilla TEXT DEFAULT 'pedido_mercaderia',
  template_id TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  fecha_envio TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solicitudes de Arrepentimiento
CREATE TABLE IF NOT EXISTS public.arrepentimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha TIMESTAMPTZ DEFAULT NOW(),
  cliente_nombre TEXT,
  cliente_dni TEXT,
  cliente_telefono TEXT,
  cliente_email TEXT,
  cliente_mail TEXT,
  pedido_id TEXT,
  numero_pedido TEXT,
  pedido TEXT,
  canal TEXT,
  monto_devolver NUMERIC,
  motivo TEXT,
  otro TEXT,
  sucursal TEXT,
  template_id TEXT,
  comentario TEXT,
  estado TEXT NOT NULL DEFAULT 'Otros',
  estado_cliente TEXT DEFAULT 'Pendiente',
  emails_destino TEXT,
  check_envio BOOLEAN DEFAULT false,
  fecha_envio TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Módulo de Admin: Promociones Web
CREATE TABLE IF NOT EXISTS public.admin_promos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE,
  promo TEXT NOT NULL,
  inicio TIMESTAMPTZ,
  fin TIMESTAMPTZ,
  landing TEXT,
  observaciones TEXT,
  canal TEXT DEFAULT 'web',
  estado TEXT DEFAULT 'Activa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Módulo de Admin: Promociones Bancarias
CREATE TABLE IF NOT EXISTS public.admin_promos_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE,
  banco TEXT NOT NULL,
  descuento TEXT,
  cuotas TEXT,
  vigencia_inicio DATE,
  vigencia_fin DATE,
  alcance TEXT DEFAULT 'web',
  activa BOOLEAN DEFAULT true,
  estado_vigencia TEXT DEFAULT 'ACTIVA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Módulo de Admin: Novedades Operativas
CREATE TABLE IF NOT EXISTS public.admin_novedades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE,
  categoria TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  activa TEXT DEFAULT 'Si',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Módulo de Facturación
CREATE TABLE IF NOT EXISTS public.facturacion_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_compra DATE NOT NULL,
  tienda TEXT NOT NULL,
  id_compra TEXT,
  pedido TEXT NOT NULL,
  operador TEXT,
  estado TEXT NOT NULL DEFAULT 'Pedido Nuevo' CHECK (estado IN ('Pedido Nuevo', 'Corregir', 'Pedido Corregido', 'Facturado')),
  notas TEXT,
  en_caja BOOLEAN NOT NULL DEFAULT false,
  numero_comprobante TEXT UNIQUE,
  fecha_facturacion TIMESTAMPTZ,
  exportado_sheet BOOLEAN NOT NULL DEFAULT false,
  fecha_exportacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.facturacion_tiendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.facturacion_operadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configuraciones de Sistema (Credenciales y variables globales)
CREATE TABLE IF NOT EXISTS public.configuraciones_sistema (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  descripcion TEXT,
  es_secreta BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registro Global de Logs / Auditoría
CREATE TABLE IF NOT EXISTS public.app_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo TEXT NOT NULL,
  accion TEXT NOT NULL,
  referencia TEXT,
  detalle TEXT,
  usuario_id UUID,
  usuario_email TEXT,
  origen_id UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =======================================================
-- 3. FUNCIONES AUXILIARES Y DE SEGURIDAD (RPC)
-- =======================================================

-- Obtiene el rol del usuario actual
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), 'viewer');
$$;

-- Validación de permisos de módulos
CREATE OR REPLACE FUNCTION public.can_access_module(module_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.current_user_role() = 'admin'
    OR COALESCE((SELECT module_permissions ->> module_name FROM public.profiles WHERE id = auth.uid()), '') IN ('view', 'edit');
$$;

CREATE OR REPLACE FUNCTION public.can_edit_module(module_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT public.current_user_role() = 'admin'
    OR (
      public.current_user_role() = 'editor'
      AND COALESCE((SELECT module_permissions ->> module_name FROM public.profiles WHERE id = auth.uid()), '') = 'edit'
    );
$$;

-- Desactivar promociones vencidas
CREATE OR REPLACE FUNCTION public.desactivar_promos_vencidas()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.admin_promos
  SET estado = 'Inactiva'
  WHERE fin IS NOT NULL AND fin < NOW() AND COALESCE(LOWER(estado), '') <> 'inactiva';

  UPDATE public.admin_promos_bancarias
  SET estado_vigencia = 'INACTIVA', activa = false
  WHERE vigencia_fin IS NOT NULL AND vigencia_fin < CURRENT_DATE
    AND (COALESCE(UPPER(estado_vigencia), '') <> 'INACTIVA' OR activa IS DISTINCT FROM false);
END;
$$;

-- Purga de logs antiguos (Mayores a 10 días, coincide con el badge "+10 días" del panel)
CREATE OR REPLACE FUNCTION public.purgar_app_logs_antiguos()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM public.app_logs
  WHERE created_at < NOW() - INTERVAL '10 days';
END;
$$;

-- Permisos de ejecución de funciones
REVOKE ALL ON FUNCTION public.current_user_role() FROM public;
REVOKE ALL ON FUNCTION public.can_access_module(TEXT) FROM public;
REVOKE ALL ON FUNCTION public.can_edit_module(TEXT) FROM public;
REVOKE ALL ON FUNCTION public.desactivar_promos_vencidas() FROM public;
REVOKE ALL ON FUNCTION public.purgar_app_logs_antiguos() FROM public;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_module(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_module(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desactivar_promos_vencidas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.purgar_app_logs_antiguos() TO authenticated;

-- =======================================================
-- 4. TRIGGERS AUTOMÁTICOS
-- =======================================================

-- Auto-crear perfil cuando se registra un usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'viewer')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger para refrescar updated_at en Profiles
CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = NOW();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at 
BEFORE UPDATE ON public.profiles 
FOR EACH ROW EXECUTE PROCEDURE public.set_profiles_updated_at();

-- Auditoría automática de cambios en tablas hacia app_logs
CREATE OR REPLACE FUNCTION public.log_app_table_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  record_reference TEXT;
BEGIN
  IF tg_op = 'DELETE' THEN
    record_reference := COALESCE(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'clave', 'sin referencia');
  ELSE
    record_reference := COALESCE(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'clave', 'sin referencia');
  END IF;

  INSERT INTO public.app_logs (modulo, accion, referencia, detalle, usuario_id, usuario_email)
  VALUES (
    tg_table_name,
    tg_op,
    record_reference,
    CASE tg_op
      WHEN 'INSERT' THEN 'Registro creado'
      WHEN 'UPDATE' THEN 'Registro modificado'
      ELSE 'Registro eliminado'
    END,
    auth.uid(),
    COALESCE(auth.jwt() ->> 'email', 'sistema')
  );

  IF tg_op = 'DELETE' THEN RETURN old; END IF;
  RETURN new;
END;
$$;

-- Aplicar Trigger de auditoría a todas las tablas operativas
DO $$
DECLARE
  tbl_name TEXT;
BEGIN
  FOREACH tbl_name IN ARRAY ARRAY[
    'profiles', 'clientes', 'templates', 'admin_promos', 'admin_promos_bancarias',
    'admin_novedades', 'pedidos_mercaderia', 'arrepentimientos',
    'facturacion_pedidos', 'facturacion_tiendas', 'facturacion_operadores',
    'configuraciones_sistema'
  ] LOOP
    IF to_regclass('public.' || tbl_name) IS NOT NULL THEN
      EXECUTE FORMAT('DROP TRIGGER IF EXISTS %I ON public.%I', 'app_audit_' || tbl_name, tbl_name);
      EXECUTE FORMAT(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_app_table_change()',
        'app_audit_' || tbl_name, tbl_name
      );
    END IF;
  END LOOP;
END;
$$;

-- =======================================================
-- 5. TAREAS PROGRAMADAS (PG_CRON)
-- =======================================================

-- Reprogramación limpia del job de purga
SELECT cron.unschedule('purgar-logs-24h') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'purgar-logs-24h'
);

SELECT cron.schedule(
  'purgar-logs-10dias',
  '0 0 * * *',
  'SELECT public.purgar_app_logs_antiguos();'
);

-- =======================================================
-- 6. POLÍTICAS DE SEGURIDAD (ROW LEVEL SECURITY)
-- =======================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_mercaderia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arrepentimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_promos_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_novedades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturacion_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturacion_tiendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturacion_operadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuraciones_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;
CREATE POLICY profiles_select_own_or_admin ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.current_user_role() = 'admin');
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin ON public.profiles FOR UPDATE TO authenticated USING (public.current_user_role() = 'admin') WITH CHECK (role IN ('viewer', 'editor', 'admin'));

-- Clientes
DROP POLICY IF EXISTS clientes_select_authenticated ON public.clientes;
CREATE POLICY clientes_select_authenticated ON public.clientes FOR SELECT TO authenticated USING (public.can_access_module('envios'));
DROP POLICY IF EXISTS clientes_insert_editor_admin ON public.clientes;
CREATE POLICY clientes_insert_editor_admin ON public.clientes FOR INSERT TO authenticated WITH CHECK (public.can_edit_module('envios'));
DROP POLICY IF EXISTS clientes_update_editor_admin ON public.clientes;
CREATE POLICY clientes_update_editor_admin ON public.clientes FOR UPDATE TO authenticated USING (public.can_edit_module('envios')) WITH CHECK (public.can_edit_module('envios'));
DROP POLICY IF EXISTS clientes_delete_admin ON public.clientes;
CREATE POLICY clientes_delete_admin ON public.clientes FOR DELETE TO authenticated USING (public.current_user_role() = 'admin');

-- Templates
DROP POLICY IF EXISTS templates_select_authenticated ON public.templates;
CREATE POLICY templates_select_authenticated ON public.templates FOR SELECT TO authenticated USING (
  public.can_access_module('plantillas')
  OR (modulo IN ('todos', 'envios') AND public.can_access_module('envios'))
  OR (modulo IN ('todos', 'pedidos') AND public.can_access_module('pedidos'))
  OR (modulo IN ('todos', 'arrepentimiento') AND public.can_access_module('arrepentimiento'))
);
DROP POLICY IF EXISTS templates_insert_editor_admin ON public.templates;
CREATE POLICY templates_insert_editor_admin ON public.templates FOR INSERT TO authenticated WITH CHECK (public.can_edit_module('plantillas'));
DROP POLICY IF EXISTS templates_update_editor_admin ON public.templates;
CREATE POLICY templates_update_editor_admin ON public.templates FOR UPDATE TO authenticated USING (public.can_edit_module('plantillas')) WITH CHECK (public.can_edit_module('plantillas'));
DROP POLICY IF EXISTS templates_delete_admin ON public.templates;
CREATE POLICY templates_delete_admin ON public.templates FOR DELETE TO authenticated USING (public.current_user_role() = 'admin');

-- Arrepentimientos
DROP POLICY IF EXISTS arrepentimientos_select_authenticated ON public.arrepentimientos;
CREATE POLICY arrepentimientos_select_authenticated ON public.arrepentimientos FOR SELECT TO authenticated USING (public.can_access_module('arrepentimiento'));
DROP POLICY IF EXISTS arrepentimientos_insert_editor_admin ON public.arrepentimientos;
CREATE POLICY arrepentimientos_insert_editor_admin ON public.arrepentimientos FOR INSERT TO authenticated WITH CHECK (public.can_edit_module('arrepentimiento'));
DROP POLICY IF EXISTS arrepentimientos_insert_formulario_publico ON public.arrepentimientos;
CREATE POLICY arrepentimientos_insert_formulario_publico ON public.arrepentimientos FOR INSERT TO anon WITH CHECK (estado = 'Otros' AND canal = 'web');
DROP POLICY IF EXISTS arrepentimientos_update_editor_admin ON public.arrepentimientos;
CREATE POLICY arrepentimientos_update_editor_admin ON public.arrepentimientos FOR UPDATE TO authenticated USING (public.can_edit_module('arrepentimiento')) WITH CHECK (public.can_edit_module('arrepentimiento'));
DROP POLICY IF EXISTS arrepentimientos_delete_admin ON public.arrepentimientos;
CREATE POLICY arrepentimientos_delete_admin ON public.arrepentimientos FOR DELETE TO authenticated USING (public.current_user_role() = 'admin');

-- Configuraciones Sistema
DROP POLICY IF EXISTS configuraciones_select_admin ON public.configuraciones_sistema;
CREATE POLICY configuraciones_select_admin ON public.configuraciones_sistema FOR SELECT TO authenticated USING (public.current_user_role() = 'admin');
DROP POLICY IF EXISTS configuraciones_insert_admin ON public.configuraciones_sistema;
CREATE POLICY configuraciones_insert_admin ON public.configuraciones_sistema FOR INSERT TO authenticated WITH CHECK (public.current_user_role() = 'admin');
DROP POLICY IF EXISTS configuraciones_update_admin ON public.configuraciones_sistema;
CREATE POLICY configuraciones_update_admin ON public.configuraciones_sistema FOR UPDATE TO authenticated USING (public.current_user_role() = 'admin') WITH CHECK (public.current_user_role() = 'admin');
DROP POLICY IF EXISTS configuraciones_delete_admin ON public.configuraciones_sistema;
CREATE POLICY configuraciones_delete_admin ON public.configuraciones_sistema FOR DELETE TO authenticated USING (public.current_user_role() = 'admin');

-- App Logs
DROP POLICY IF EXISTS app_logs_select_admin ON public.app_logs;
CREATE POLICY app_logs_select_admin ON public.app_logs FOR SELECT TO authenticated USING (public.current_user_role() = 'admin');
DROP POLICY IF EXISTS app_logs_insert_authenticated ON public.app_logs;
CREATE POLICY app_logs_insert_authenticated ON public.app_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id OR usuario_id IS NULL);

-- =======================================================
-- 7. DATOS INICIALES & BOOTSTRAP DE ADMIN
-- =======================================================

-- Admin Principal
UPDATE public.profiles
SET role = 'admin', updated_at = NOW()
WHERE id = (
  SELECT id FROM auth.users
  WHERE LOWER(email) = LOWER('varelamatiasgerardo@gmail.com')
  LIMIT 1
);

-- Catalogos iniciales de facturación
INSERT INTO public.facturacion_tiendas (nombre) VALUES
  ('Provincia Wins'), ('Personal'), ('Shell'), ('Infobae'), ('Nación'), ('Credicoop'), ('Comafi'), ('Macro')
ON CONFLICT (nombre) DO NOTHING;

-- Configuraciones base
INSERT INTO public.configuraciones_sistema (clave, valor, descripcion, es_secreta) VALUES
  ('DISPATCHTRACK_API_KEY', '', 'API Key de DispatchTrack para seguimiento logístico', true),
  ('EPRESIS_API_KEY', '', 'API Key de Epresis para seguimiento', true),
  ('MERCADO_FLEX_TOKEN', '', 'Token de autorización OAuth de Mercado Envíos Flex', true),
  ('DESTINATARIO_FACTURACION', 'mvarela@casadelaudio.com', 'Email destinatario para avisos de facturación y caja', false),
  ('EMAIL_ADMIN_GRUPO', 'info---ecommerce@googlegroups.com', 'Email grupal para alertas de cambios operativos y promociones', false),
  ('GOOGLE_SHEET_ARCHIVE_WEBHOOK_URL', 'https://script.google.com/macros/s/AKfycbyOHK_tiJJgVY9HffudGWQuyfCIIld70VpFg7d4EonvYe2dbOm30p8CAqm9rczkQv9R/exec', 'Webhook URL de Google Apps Script para archivado de arrepentimientos', true)
ON CONFLICT (clave) DO NOTHING;


-- =======================================================
-- TAREAS PROGRAMADAS (PG_CRON)
-- =======================================================

-- 1. Desactivación diaria de promociones vencidas
CREATE OR REPLACE FUNCTION public.desactivar_promos_vencidas()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.admin_promos
  SET estado = 'Inactiva'
  WHERE fin IS NOT NULL 
    AND fin < NOW() 
    AND COALESCE(LOWER(estado), '') <> 'inactiva';

  UPDATE public.admin_promos_bancarias
  SET estado_vigencia = 'INACTIVA', activa = false
  WHERE vigencia_fin IS NOT NULL 
    AND vigencia_fin < CURRENT_DATE
    AND (
      COALESCE(UPPER(estado_vigencia), '') <> 'INACTIVA'
      OR activa IS DISTINCT FROM false
    );
END;
$$;

SELECT cron.unschedule('desactivar-promos-vencidas-diario') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'desactivar-promos-vencidas-diario'
);

SELECT cron.schedule(
  'desactivar-promos-vencidas-diario',
  '0 0 * * *',
  'SELECT public.desactivar_promos_vencidas();'
);

-- 2. Mantenimiento semanal y optimización de tablas
CREATE OR REPLACE FUNCTION public.mantenimiento_optimizar_tablas()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  EXECUTE 'VACUUM ANALYZE public.app_logs';
  EXECUTE 'VACUUM ANALYZE public.clientes';
  EXECUTE 'VACUUM ANALYZE public.arrepentimientos';
  EXECUTE 'VACUUM ANALYZE public.facturacion_pedidos';
END;
$$;

-- Solo la ejecuta pg_cron; no debe quedar expuesta como RPC pública.
REVOKE ALL ON FUNCTION public.mantenimiento_optimizar_tablas() FROM public;

SELECT cron.unschedule('mantenimiento-semanal-vacuum') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'mantenimiento-semanal-vacuum'
);

SELECT cron.schedule(
  'mantenimiento-semanal-vacuum',
  '0 3 * * 0',
  'SELECT public.mantenimiento_optimizar_tablas();'
);

-- 3. Marcado de logs obsoletos a los 10 días
ALTER TABLE public.app_logs 
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo';

CREATE OR REPLACE FUNCTION public.marcar_app_logs_obsoletos()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE public.app_logs
  SET estado = 'obsoleto'
  WHERE created_at < NOW() - INTERVAL '10 days'
    AND COALESCE(estado, 'activo') <> 'obsoleto';
END;
$$;

-- Solo la ejecuta pg_cron; no debe quedar expuesta como RPC pública.
REVOKE ALL ON FUNCTION public.marcar_app_logs_obsoletos() FROM public;

SELECT cron.unschedule('marcar-logs-obsoletos-diario') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'marcar-logs-obsoletos-diario'
);

SELECT cron.schedule(
  'marcar-logs-obsoletos-diario',
  '0 0 * * *',
  'SELECT public.marcar_app_logs_obsoletos();'
);


-- 1. Asegurar campos en las tablas principales
ALTER TABLE public.app_logs ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo';
ALTER TABLE public.admin_promos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Activa';
ALTER TABLE public.arrepentimientos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Otros';
ALTER TABLE public.facturacion_pedidos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Pedido Nuevo';

-- El resaltado de "+10 días sin finalizar" se resuelve en el front-end
-- comparando created_at (no se modifica ningún estado desde el backend,
-- para no interferir con los flujos de cierre de cada módulo).
SELECT cron.unschedule('marcar-obsoletos-todos-modulos') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'marcar-obsoletos-todos-modulos'
);
DROP FUNCTION IF EXISTS public.marcar_registros_obsoletos_10dias();

-- Notificar recarga de esquemas
NOTIFY pgrst, 'reload schema';