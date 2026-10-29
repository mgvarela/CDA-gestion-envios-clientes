CREATE TABLE IF NOT EXISTS public.facturacion_operadores_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.facturacion_operadores_caja ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.facturacion_operadores_caja TO authenticated;

DROP POLICY IF EXISTS facturacion_operadores_caja_select_authenticated
ON public.facturacion_operadores_caja;
CREATE POLICY facturacion_operadores_caja_select_authenticated
ON public.facturacion_operadores_caja FOR SELECT TO authenticated
USING (public.can_access_module('facturacion'));

DROP POLICY IF EXISTS facturacion_operadores_caja_write
ON public.facturacion_operadores_caja;
CREATE POLICY facturacion_operadores_caja_write
ON public.facturacion_operadores_caja FOR ALL TO authenticated
USING (public.can_edit_module('facturacion'))
WITH CHECK (public.can_edit_module('facturacion'));

NOTIFY pgrst, 'reload schema';
