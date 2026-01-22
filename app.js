
// ====== CONFIG SUPABASE ======
const SUPABASE_URL = document.querySelector('meta[name="supabase-url"]').content;
const SUPABASE_ANON_KEY = document.querySelector('meta[name="supabase-anon"]').content;
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== STATE ======
let currentUser = null;
let cache = [];     // toutes les actions récupérées
let filtered = [];  // vue filtrée + triée

// ====== SHORTCUTS / UTILS ======
const $ = (sel) => document.querySelector(sel);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(dt) {
  if (!dt) return '—';
  try {
    const d = new Date(dt);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return '—';
  }
}

function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60000;
  const local = new Date(d - tzOffset).toISOString().slice(0, 16);
  return local;
}

function toTimestamptz(inputEl) {
  const v = inputEl.value?.trim();
  if (!v) return null;
  return new Date(v).toISOString(); // converti en UTC
}

function chipEtat(etat) {
  const map = { "à faire": "etat-afaire", "en cours": "etat-encours", "fait": "etat-fait", "annulé": "etat-annule" };
  const cls = map[etat] ?? '';
  return `<span class="chip ${cls}">${escapeHtml(etat)}</span>`;
}

function chipPrio(p) {
  const map = { faible: "prio-faible", moyenne: "prio-moyenne", haute: "prio-haute" };
  const cls = map[p] ?? '';
  return `<span class="chip ${cls}">${escapeHtml(p)}</span>`;
}

function roleBadge(row) {
  const amAuthor = row.auteur_id === currentUser.id;
  const amResp = row.responsable_id === currentUser.id;
  let parts = [];
  if (amAuthor) parts.push('Auteur: moi');
  if (amResp) parts.push('Responsable: moi');
  if (!parts.length) parts.push('—');
  return parts.join(' ');
}

function setStatus(msg, ok = true, where = 'list') {
  const el = where === 'create' ? $('#createMsg') : where === 'edit' ? $('#editMsg') : $('#listMsg');
  el.innerHTML = msg ? `\n${msg}\n` : '';
}

// ====== DB HEALTHCHECK (table actions) ======
async function testActionsTable() {
  const el = document.querySelector('#dbHealth');
  if (!el) return;

  el.innerHTML = `Test connexion table <b>actions</b> : <span class="muted">en cours…</span>`;

  try {
    const { data, error } = await db
      .from('actions')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      el.innerHTML = `
        Test connexion table <b>actions</b> : <span style="color:#b42318;">KO ❌</span>
        <div class="hint">Erreur: ${escapeHtml(error.message)}</div>
      `;
      return;
    }

    if (data && data.length > 0) {
      const row = data[0];
      el.innerHTML = `
        Table <b>actions</b> opérationnelle ✅
        <div class="hint">
          Preuve: dernière ligne visible → <code>${escapeHtml(row.id)}</code>
          (créée le ${escapeHtml(formatDate(row.created_at))})
        </div>
      `;
    } else {
      el.innerHTML = `
        Table <b>actions</b> opérationnelle ✅
        <div class="hint">Preuve: lecture OK, mais aucune ligne visible (0 résultat).</div>
      `;
    }
  } catch (e) {
    el.innerHTML = `
      Test connexion table <b>actions</b> : <span style="color:#b42318;">KO ❌</span>
      <div class="hint">Exception: ${escapeHtml(e?.message || String(e))}</div>
    `;
  }
}

// ====== INIT ======
(async function init() {
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) {
    window.location.href = '/login.html';
    return;
  }
  currentUser = user;
  $('#userInfo').textContent = user.email ?? user.id;

  bindUI();

  // ✅ Nouveau : test simple que la table répond
  await testActionsTable();

  await loadActions();
  subscribeRealtime();
})();

// ====== REALTIME ======
function subscribeRealtime() {
  db
    .channel('public:actions')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'actions' }, (payload) => {
      const r = payload.new ?? payload.old ?? {};
      if (!r) return;
      if (r.auteur_id === currentUser.id || r.responsable_id === currentUser.id) {
        loadActions();
      }
    })
    .subscribe();
}

// ====== LOAD / FILTER / SORT / RENDER ======
async function loadActions() {
  setStatus('Chargement…', true, 'list');
  const { data, error } = await db
    .from('actions')
    .select('*')
    .or(`auteur_id.eq.${currentUser.id},responsable_id.eq.${currentUser.id}`);

  if (error) {
    setStatus(`Erreur de chargement : ${error.message}`, false, 'list');
    return;
  }
  cache = data ?? [];
  applyFiltersAndRender();
}

function applyFiltersAndRender() {
  const fEtat = $('#filterEtat').value;
  const fPrio = $('#filterPriorite').value;
  const sortField = $('#sortField').value;
  const asc = $('#sortDir').value === 'asc';

  // Filter
  filtered = cache.filter(r => {
    const okEtat = (fEtat === 'all') || (r.etat === fEtat);
    const okPrio = (fPrio === 'all') || (r.priorite === fPrio);
    return okEtat && okPrio;
  });

  // Sort
  filtered.sort((a, b) => {
    const va = a[sortField], vb = b[sortField];

    // handle nulls
    if (va == null && vb != null) return asc ? -1 : 1;
    if (va != null && vb == null) return asc ? 1 : -1;
    if (va == null && vb == null) return 0;

    // dates & strings
    if (sortField === 'echeance' || sortField === 'created_at' || sortField === 'updated_at') {
      const da = new Date(va).getTime(), db = new Date(vb).getTime();
      return asc ? (da - db) : (db - da);
    }
    const sa = String(va).toLocaleLowerCase();
    const sb = String(vb).toLocaleLowerCase();
    if (sa < sb) return asc ? -1 : 1;
    if (sa > sb) return asc ? 1 : -1;
    return 0;
  });

  renderTable(filtered);
  setStatus(`${filtered.length} action(s) affichée(s)`, true, 'list');
}

function renderTable(rows) {
  const tbody = $('#tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Aucune action</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    return `
      <tr>
        <td>
          <div class="strong">${escapeHtml(r.description ?? '')}</div>
          <div class="muted">Créée: ${formatDate(r.created_at)} • MAJ: ${formatDate(r.updated_at)}</div>
        </td>
        <td>${chipEtat(r.etat)} ${chipPrio(r.priorite)}</td>
        <td>${formatDate(r.echeance)}</td>
        <td>${escapeHtml(roleBadge(r))}</td>
        <td>
          <button class="ghost btn-edit" data-id="${escapeHtml(r.id)}">Modifier</button>
          <button class="ghost btn-del" data-id="${escapeHtml(r.id)}">Supprimer</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ====== UI BINDINGS ======
function bindUI() {
  // Filtres / tri / refresh / export
  $('#filterEtat').addEventListener('change', applyFiltersAndRender);
  $('#filterPriorite').addEventListener('change', applyFiltersAndRender);
  $('#sortField').addEventListener('change', applyFiltersAndRender);
  $('#sortDir').addEventListener('change', applyFiltersAndRender);
  $('#refreshBtn').addEventListener('click', loadActions);
  $('#exportCsvBtn').addEventListener('click', onExportCsv);

  // Création
  const cMode = $('#c_responsable_mode');
  cMode.addEventListener('change', () => {
    if (cMode.value === 'uuid') show($('#c_responsable_uuid_wrap'));
    else hide($('#c_responsable_uuid_wrap'));
  });

  $('#resetCreate').addEventListener('click', () => {
    $('#c_description').value = '';
    $('#c_priorite').value = 'moyenne';
    $('#c_etat').value = 'à faire';
    $('#c_echeance').value = '';
    $('#c_responsable_mode').value = 'me';
    hide($('#c_responsable_uuid_wrap'));
    $('#c_responsable_uuid').value = '';
    setStatus('', true, 'create');
  });

  $('#createForm').addEventListener('submit', onCreate);

  // Edition (modal)
  $('#closeEdit').addEventListener('click', hideModal);

  $('#e_responsable_mode').addEventListener('change', () => {
    if ($('#e_responsable_mode').value === 'uuid') show($('#e_responsable_uuid_wrap'));
    else hide($('#e_responsable_uuid_wrap'));
  });

  $('#editForm').addEventListener('submit', onSaveEdit);

  // Délégation d'événements pour Edit/Delete
  $('#tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('btn-edit')) {
      onEdit(id);
    } else if (btn.classList.contains('btn-del')) {
      onDelete(id);
    }
  });
}

// ====== CREATE ======
async function onCreate(e) {
  e.preventDefault();
  setStatus('', true, 'create');

  const description = $('#c_description').value.trim();
  const priorite = $('#c_priorite').value;
  const etat = $('#c_etat').value;
  const echeance = toTimestamptz($('#c_echeance'));

  let responsable_id = currentUser.id;
  if ($('#c_responsable_mode').value === 'uuid') {
    const uuid = $('#c_responsable_uuid').value.trim();
    if (!uuid) return setStatus('UUID responsable requis.', false, 'create');
    responsable_id = uuid;
  }

  const { data, error } = await db.rpc('create_action', {
    p_responsable_id: responsable_id,
    p_description: description,
    p_etat: etat,
    p_priorite: priorite,
    p_echeance: echeance
  });

  if (error) {
    setStatus(`Erreur de création : ${error.message}`, false, 'create');
    return;
  }

  setStatus('Action créée ✅', true, 'create');
  $('#resetCreate').click();
  await loadActions();
}

// ====== EDIT ======
function onEdit(id) {
  const row = cache.find(x => x.id === id);
  if (!row) return;

  $('#e_id').value = row.id;
  $('#e_description').value = row.description ?? '';
  $('#e_priorite').value = row.priorite ?? 'moyenne';
  $('#e_etat').value = row.etat ?? 'à faire';
  $('#e_echeance').value = toLocalInputValue(row.echeance);

  $('#e_responsable_mode').value = 'keep';
  $('#e_responsable_uuid').value = '';
  hide($('#e_responsable_uuid_wrap'));

  setStatus('', true, 'edit');
  showModal();
}

async function onSaveEdit(e) {
  e.preventDefault();
  setStatus('', true, 'edit');

  const id = $('#e_id').value;
  const description = $('#e_description').value.trim();
  const priorite = $('#e_priorite').value;
  const etat = $('#e_etat').value;
  const echeance = toTimestamptz($('#e_echeance'));

  const upd = { description, priorite, etat, echeance };

  const mode = $('#e_responsable_mode').value;
  if (mode === 'me') {
    upd.responsable_id = currentUser.id;
  } else if (mode === 'uuid') {
    const uuid = $('#e_responsable_uuid').value.trim();
    if (!uuid) return setStatus('UUID responsable requis.', false, 'edit');
    upd.responsable_id = uuid;
  }

  const { error } = await db.from('actions').update(upd).eq('id', id);
  if (error) {
    setStatus(`Erreur de mise à jour : ${error.message}`, false, 'edit');
    return;
  }

  setStatus('Action mise à jour ✅', true, 'edit');
  hideModal();
  await loadActions();
}

// ====== DELETE ======
async function onDelete(id) {
  const row = cache.find(x => x.id === id);
  const short = row?.description?.slice(0, 80) ?? id;
  const ok = confirm(`Supprimer cette action ?\n\n${short}\n\nCette opération est irréversible.`);
  if (!ok) return;

  const { error } = await db.from('actions').delete().eq('id', id);
  if (error) {
    alert('Erreur de suppression : ' + error.message);
    return;
  }
  await loadActions();
}

// ====== EXPORT CSV ======
function onExportCsv() {
  const rows = filtered.length ? filtered : [];
  if (!rows.length) {
    alert('Aucune ligne à exporter.');
    return;
  }

  const headers = ['id', 'description', 'etat', 'priorite', 'echeance', 'created_at', 'updated_at', 'role'];
  const esc = (v) => {
    const s = String(v ?? '');
    const q = s.replaceAll('"', '""').replaceAll('\r', ' ').replaceAll('\n', ' ');
    return `"${q}"`;
  };

  const csvLines = [];
  csvLines.push(headers.join(','));

  rows.forEach(r => {
    const role =
      (r.auteur_id === currentUser.id ? 'auteur' : '') +
      (r.responsable_id === currentUser.id ? ((r.auteur_id === currentUser.id ? ' & ' : '') + 'responsable') : '');

    csvLines.push([
      r.id,
      esc(r.description),
      r.etat,
      r.priorite,
      r.echeance ?? '',
      r.created_at ?? '',
      r.updated_at ?? '',
      role ?? ''
    ].join(','));
  });

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replaceAll(':', '-');
  a.href = url;
  a.download = `actions_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ====== MODAL HELPERS ======
function showModal() {
  $('#editModal').style.display = 'flex';
  $('#editModal').setAttribute('aria-hidden', 'false');
}

function hideModal() {
  $('#editModal').style.display = 'none';
  $('#editModal').setAttribute('aria-hidden', 'true');
}