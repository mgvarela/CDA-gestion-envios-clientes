-- Control Hub - perfiles y permisos RLS
-- Ejecutar en Supabase > SQL Editor.
-- Cambiar el email del bloque de bootstrap por el usuario administrador real.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('viewer', 'editor', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibilidad con una tabla profiles creada anteriormente.
alter table public.profiles
  add column if not exists email text;
alter table public.profiles
  add column if not exists role text default 'viewer';
alter table public.profiles
  add column if not exists created_at timestamptz default now();
alter table public.profiles
  add column if not exists updated_at timestamptz default now();

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

update public.profiles
set role = 'viewer'
where role is null;

update public.profiles
set updated_at = now()
where updated_at is null;

alter table public.profiles enable row level security;

-- Pedidos de mercaderia importados desde Excel o CSV.
create table if not exists public.pedidos_mercaderia (
  id uuid primary key default gen_random_uuid(),
  fila_origen integer,
  cod_suc_vta text,
  sucursal_vta text,
  documento text,
  fecha_venta text,
  fecha_programada text,
  clave text,
  familia text,
  articulo text,
  cantidad numeric default 0,
  st_disponible numeric default 0,
  st_reservado numeric default 0,
  cod_suc_ent text,
  sucursal_ent text,
  cod_cliente text,
  cliente text,
  confirmo text,
  actualizado text,
  st_depo numeric default 0,
  emails_destino text,
  desde_hasta text,
  tipo_plantilla text default 'pedido_mercaderia',
  estado text not null default 'pendiente',
  fecha_envio timestamptz,
  created_at timestamptz not null default now()
);

-- Compatibilidad con arrepentimientos creados antes de este modulo.
create table if not exists public.arrepentimientos (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz default now(),
  cliente_nombre text not null,
  pedido_id text not null,
  motivo text not null,
  estado text not null default 'pendiente',
  fecha_envio timestamptz,
  created_at timestamptz not null default now()
);

alter table public.arrepentimientos add column if not exists fecha_envio timestamptz;
alter table public.arrepentimientos add column if not exists created_at timestamptz default now();
alter table public.pedidos_mercaderia add column if not exists emails_destino text;
alter table public.pedidos_mercaderia add column if not exists desde_hasta text;
alter table public.pedidos_mercaderia add column if not exists tipo_plantilla text default 'pedido_mercaderia';
alter table public.pedidos_mercaderia add column if not exists fecha_envio timestamptz;

-- La funcion evita consultar profiles desde una policy de profiles y caer en recursion.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'viewer');
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

-- Crea automaticamente un perfil viewer cuando se registra un usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Sincroniza usuarios existentes que todavia no tienen perfil.
insert into public.profiles (id, email, role)
select id, email, 'viewer'
from auth.users
where not exists (
  select 1 from public.profiles p where p.id = auth.users.id
)
on conflict (id) do nothing;

-- Bootstrap del administrador principal.
-- Debe coincidir exactamente con el email registrado en Authentication > Users.
update public.profiles
set role = 'admin', updated_at = now()
where id = (
  select id from auth.users
  where lower(email) = lower('varelamatiasgerardo@gmail.com')
  limit 1
);

-- Profiles: un usuario ve su perfil; un admin ve y modifica todos.
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
on public.profiles for select to authenticated
using (id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
on public.profiles for update to authenticated
using (public.current_user_role() = 'admin')
with check (role in ('viewer', 'editor', 'admin'));

-- El alta de perfiles se realiza por el trigger; no se permite insertarlo desde el front.
drop policy if exists profiles_insert_none on public.profiles;
create policy profiles_insert_none
on public.profiles for insert to authenticated
with check (false);

drop policy if exists profiles_delete_none on public.profiles;
create policy profiles_delete_none
on public.profiles for delete to authenticated
using (false);

-- Agrega created_at a las tablas del dashboard si ya existen sin esa columna.
alter table if exists public.admin_promos
  add column if not exists created_at timestamptz not null default now();
alter table if exists public.admin_promos_bancarias
  add column if not exists created_at timestamptz not null default now();
alter table if exists public.admin_novedades
  add column if not exists created_at timestamptz not null default now();
alter table public.clientes
  add column if not exists fecha_envio timestamptz;

-- Activa RLS en todas las tablas usadas por la aplicacion.
alter table if exists public.clientes enable row level security;
alter table if exists public.templates enable row level security;
alter table if exists public.admin_promos enable row level security;
alter table if exists public.admin_promos_bancarias enable row level security;
alter table if exists public.admin_novedades enable row level security;
alter table public.pedidos_mercaderia enable row level security;
alter table public.arrepentimientos enable row level security;

-- Lectura: cualquier usuario autenticado puede consultar la informacion operativa.
drop policy if exists clientes_select_authenticated on public.clientes;
create policy clientes_select_authenticated on public.clientes
for select to authenticated using (true);

drop policy if exists templates_select_authenticated on public.templates;
create policy templates_select_authenticated on public.templates
for select to authenticated using (true);

drop policy if exists admin_promos_select_authenticated on public.admin_promos;
create policy admin_promos_select_authenticated on public.admin_promos
for select to authenticated using (true);

drop policy if exists admin_promos_bancarias_select_authenticated on public.admin_promos_bancarias;
create policy admin_promos_bancarias_select_authenticated on public.admin_promos_bancarias
for select to authenticated using (true);

drop policy if exists admin_novedades_select_authenticated on public.admin_novedades;
create policy admin_novedades_select_authenticated on public.admin_novedades
for select to authenticated using (true);

drop policy if exists pedidos_mercaderia_select_authenticated on public.pedidos_mercaderia;
create policy pedidos_mercaderia_select_authenticated on public.pedidos_mercaderia
for select to authenticated using (true);

drop policy if exists arrepentimientos_select_authenticated on public.arrepentimientos;
create policy arrepentimientos_select_authenticated on public.arrepentimientos
for select to authenticated using (true);

-- Escritura: editor y admin.
drop policy if exists clientes_insert_editor_admin on public.clientes;
create policy clientes_insert_editor_admin on public.clientes
for insert to authenticated
with check (public.current_user_role() in ('editor', 'admin'));

drop policy if exists clientes_update_editor_admin on public.clientes;
create policy clientes_update_editor_admin on public.clientes
for update to authenticated
using (public.current_user_role() in ('editor', 'admin'))
with check (public.current_user_role() in ('editor', 'admin'));

drop policy if exists templates_insert_editor_admin on public.templates;
create policy templates_insert_editor_admin on public.templates
for insert to authenticated
with check (public.current_user_role() in ('editor', 'admin'));

drop policy if exists templates_update_editor_admin on public.templates;
create policy templates_update_editor_admin on public.templates
for update to authenticated
using (public.current_user_role() in ('editor', 'admin'))
with check (public.current_user_role() in ('editor', 'admin'));

drop policy if exists admin_promos_insert_editor_admin on public.admin_promos;
create policy admin_promos_insert_editor_admin on public.admin_promos
for insert to authenticated
with check (public.current_user_role() in ('editor', 'admin'));

drop policy if exists admin_promos_update_editor_admin on public.admin_promos;
create policy admin_promos_update_editor_admin on public.admin_promos
for update to authenticated
using (public.current_user_role() in ('editor', 'admin'))
with check (public.current_user_role() in ('editor', 'admin'));

drop policy if exists admin_promos_bancarias_insert_editor_admin on public.admin_promos_bancarias;
create policy admin_promos_bancarias_insert_editor_admin on public.admin_promos_bancarias
for insert to authenticated
with check (public.current_user_role() in ('editor', 'admin'));

drop policy if exists admin_promos_bancarias_update_editor_admin on public.admin_promos_bancarias;
create policy admin_promos_bancarias_update_editor_admin on public.admin_promos_bancarias
for update to authenticated
using (public.current_user_role() in ('editor', 'admin'))
with check (public.current_user_role() in ('editor', 'admin'));

drop policy if exists admin_novedades_insert_editor_admin on public.admin_novedades;
create policy admin_novedades_insert_editor_admin on public.admin_novedades
for insert to authenticated
with check (public.current_user_role() in ('editor', 'admin'));

drop policy if exists admin_novedades_update_editor_admin on public.admin_novedades;
create policy admin_novedades_update_editor_admin on public.admin_novedades
for update to authenticated
using (public.current_user_role() in ('editor', 'admin'))
with check (public.current_user_role() in ('editor', 'admin'));

drop policy if exists pedidos_mercaderia_insert_editor_admin on public.pedidos_mercaderia;
create policy pedidos_mercaderia_insert_editor_admin on public.pedidos_mercaderia
for insert to authenticated
with check (public.current_user_role() in ('editor', 'admin'));

drop policy if exists pedidos_mercaderia_update_editor_admin on public.pedidos_mercaderia;
create policy pedidos_mercaderia_update_editor_admin on public.pedidos_mercaderia
for update to authenticated
using (public.current_user_role() in ('editor', 'admin'))
with check (public.current_user_role() in ('editor', 'admin'));

drop policy if exists arrepentimientos_insert_editor_admin on public.arrepentimientos;
create policy arrepentimientos_insert_editor_admin on public.arrepentimientos
for insert to authenticated
with check (public.current_user_role() in ('editor', 'admin'));

drop policy if exists arrepentimientos_update_editor_admin on public.arrepentimientos;
create policy arrepentimientos_update_editor_admin on public.arrepentimientos
for update to authenticated
using (public.current_user_role() in ('editor', 'admin'))
with check (public.current_user_role() in ('editor', 'admin'));

-- Solo admin puede eliminar registros.
drop policy if exists clientes_delete_admin on public.clientes;
create policy clientes_delete_admin on public.clientes
for delete to authenticated using (public.current_user_role() = 'admin');

drop policy if exists templates_delete_admin on public.templates;
create policy templates_delete_admin on public.templates
for delete to authenticated using (public.current_user_role() = 'admin');

drop policy if exists admin_promos_delete_admin on public.admin_promos;
create policy admin_promos_delete_admin on public.admin_promos
for delete to authenticated using (public.current_user_role() = 'admin');

drop policy if exists admin_promos_bancarias_delete_admin on public.admin_promos_bancarias;
create policy admin_promos_bancarias_delete_admin on public.admin_promos_bancarias
for delete to authenticated using (public.current_user_role() = 'admin');

drop policy if exists admin_novedades_delete_admin on public.admin_novedades;
create policy admin_novedades_delete_admin on public.admin_novedades
for delete to authenticated using (public.current_user_role() = 'admin');

drop policy if exists pedidos_mercaderia_delete_admin on public.pedidos_mercaderia;
create policy pedidos_mercaderia_delete_admin on public.pedidos_mercaderia
for delete to authenticated using (public.current_user_role() = 'admin');

drop policy if exists arrepentimientos_delete_admin on public.arrepentimientos;
create policy arrepentimientos_delete_admin on public.arrepentimientos
for delete to authenticated using (public.current_user_role() = 'admin');

-- Refresca updated_at en perfiles modificados.
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_profiles_updated_at();

-- Comprobacion final: deberia devolver el usuario bootstrap con role = admin.
select p.id, u.email, p.role
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower('varelamatiasgerardo@gmail.com');
