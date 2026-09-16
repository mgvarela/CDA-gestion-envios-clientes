// Carga general de datos de Admin Interno
async function cargarDatosAdmin() {
  await Promise.all([
    cargarPromosWeb(),
    cargarPromosBancarias(),
    cargarNovedadesOperativas()
  ]);
}

// 1. Cargar Promos Web
async function cargarPromosWeb() {
  const { data: promos, error } = await supabaseClient.from('admin_promos').select('*');
  const tbody = document.getElementById('tblAdminPromos');
  if (error || !promos) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Sin datos.</td></tr>';
    return;
  }

  let activas = 0, inactivas = 0;
  tbody.innerHTML = '';

  promos.forEach(p => {
    const isActiva = p.estado?.toLowerCase() === 'activa';
    if (isActiva) activas++; else inactivas++;

    const badgeClass = isActiva ? 'bg-success' : 'bg-danger';
    const landingLink = p.landing ? `<a href="${p.landing}" target="_blank" class="text-truncate d-inline-block" style="max-width: 150px;">Enlace</a>` : '-';

    tbody.innerHTML += `
      <tr>
        <td><small class="fw-bold">${p.id}</small></td>
        <td><strong>${p.promo}</strong></td>
        <td><small>${p.inicio ? new Date(p.inicio).toLocaleDateString() : '-'}</small></td>
        <td><small>${p.fin ? new Date(p.fin).toLocaleDateString() : '-'}</small></td>
        <td>${landingLink}</td>
        <td><span class="badge bg-secondary">${p.canal || 'web'}</span></td>
        <td><small class="text-muted">${p.observaciones || '-'}</small></td>
        <td><span class="badge ${badgeClass}">${p.estado}</span></td>
      </tr>
    `;
  });

  document.getElementById('kpiPromosActivas').innerText = activas;
  document.getElementById('kpiPromosInactivas').innerText = inactivas;
}

// 2. Cargar Promos Bancarias
async function cargarPromosBancarias() {
  const { data: bancarias, error } = await supabaseClient.from('admin_promos_bancarias').select('*');
  const tbody = document.getElementById('tblAdminBancarias');
  if (error || !bancarias) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Sin datos.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  document.getElementById('kpiPromosBancarias').innerText = bancarias.length;

  bancarias.forEach(b => {
    const isActiva = b.activa === 'SI' || b.estado_vigencia === 'ACTIVA';
    const badgeClass = isActiva ? 'bg-success' : 'bg-secondary';

    tbody.innerHTML += `
      <tr>
        <td><small class="fw-bold">${b.id}</small></td>
        <td><strong>${b.banco}</strong></td>
        <td>${b.descuento || 'Sin desc.'}</td>
        <td><span class="badge bg-info text-dark">${b.cuotas ? b.cuotas + ' cuotas' : '-'}</span></td>
        <td><small>${b.vigencia_inicio || ''} → ${b.vigencia_fin || ''}</small></td>
        <td>${b.alcance || 'web'}</td>
        <td><span class="badge ${badgeClass}">${b.estado_vigencia || 'ACTIVA'}</span></td>
      </tr>
    `;
  });
}

// 3. Cargar Novedades Operativas
async function cargarNovedadesOperativas() {
  const { data: novedades, error } = await supabaseClient.from('admin_novedades').select('*');
  const tbody = document.getElementById('tblAdminNovedades');
  if (error || !novedades) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Sin datos.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  document.getElementById('kpiNovedades').innerText = novedades.length;

  novedades.forEach(n => {
    tbody.innerHTML += `
      <tr>
        <td><small class="fw-bold">${n.id}</small></td>
        <td><strong>${n.categoria}</strong></td>
        <td>${n.descripcion}</td>
        <td><span class="badge ${n.activa === 'Si' ? 'bg-success' : 'bg-secondary'}">${n.activa}</span></td>
      </tr>
    `;
  });
}