
// ====== CONFIG SUPABASE ======
const SUPABASE_URL = "https://axlzgvfbmqjwvmmzpimr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4bHpndmZibXFqd3ZtbXpwaW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDI3NjQsImV4cCI6MjA4NDA3ODc2NH0.7S7PbON5F_FH2x2Ashd1-9XU6JW2qYMZ482uv0m4kFI";
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Supabase URL/Anon key manquants dans app.js");
}
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== STATE ======
let currentUser = null;
let cache = [];      // toutes les actions
let filtered = [];   // vue filtrée+triée

// ====== UTILS ======
const $ = (sel) => document.querySelector(sel);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;')
    .replaceAll('>','&gt;').replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}
function formatDate(dt) {
  if (!dt) return '—';
  try {
    const d = new Date(dt);
    return d.toLocaleString(undefined, {
      year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
    });
  } catch { return '—'; }
}
function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d - tzOffset).toISOString().slice(0,16);
}
function toTimestamptz(inputEl) {
  const v = inputEl.value?.trim();
  if (!v) return null;
  return new Date(v).toISOString(); // UTC
}
function chipEtat(etat) {
  const map = { "à faire":"etat-afaire", "en cours":"etat-encours", "fait":"etat-fait", "annulé":"etat-annule" };
  return `<span class="chip ${map[etat] || ''}">${etat}</span>`;
}
function chipPrio(p) {
  const map = { faible:"prio-faible", moyenne:"prio-moyenne", haute:"prio-haute" };
  return `<span class="chip ${map[p] || ''}">${p}</span>`;
}
function roleBadge(row) {
  const amAuthor = row.auteur_id === currentUser.id;
  const amResp = row.responsable_id === currentUser.id;
  let parts = [];
  if (amAuthor) parts.push('<span class="chip">Auteur: moi</span>');
  if (amResp) parts.push('<span class="chip">Responsable: moi</span>');
  if (!parts.length) parts.push('<span class="chip">—</span>');
  return parts.join(' ');
}
function setStatus(msg, ok = true, where = 'list') {
  const el = where === 'create' ? $('#createMsg') : where === 'edit' ? $('#editMsg') : $('#listMsg');
  el.innerHTML = msg ? `<div class="${ok ? 'success':'error'}">${msg}</div>` : '';
}

// ====== INIT ======
(async function init() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('auth.getUser error:', error);
    }
    if (!user) {
      // Non connecté -> redirection
      window.location.href = '/login.html';
      return;
    }
    currentUser = user;
    $('#userInfo').textContent = user.email || user.id;

    bindUI();
    await loadActions();
    subscribeRealtime();
  } catch (e) {
    console.error('Init fatal error:', e);
    setStatus('Erreur d’initialisation', false, 'list');
  }
})();

// ====== REALTIME ======
function subscribeRealtime() {
  supabase
    .channel('public:actions')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'actions' }, (payload) => {
      const r = payload.new || payload.old || {};
      if (!r) return;
      if (r.auteur_id === currentUser.id || r.responsable_id === currentUser.id) {
        loadActions();
      }
    })
    .subscribe((status) => {
      // Debug
      // console.log('Realtime status', status);
    });
}

// ====== LOAD / FILTER / SORT / RENDER ======
async function loadActions() {
  setStatus('Chargement…', true, 'list');
  const { data, error } = await supabase
    .from('actions')
    .select('*')
    .or(`auteur_id.eq.${currentUser.id},responsable_id.eq.${currentUser.id}`);
  if (error) {
    console.error('Load actions error:', error);
    setStatus(`Erreur de chargement : ${error.message}`, false, 'list');
    return;
  }
  cache = data || [];
  applyFiltersAndRender();
}

function applyFiltersAndRender() {
  const fEtat = $('#filterEtat').value;
  const fPrio = $('#filterPriorite').value;
  const sortField = $('#sortField').value;
  const asc = $('#sortDir').value === 'asc';

  filtered = cache.filter(r => {
    const okEtat = (fEtat === 'all') || (r.etat === fEtat);
    const okPrio = (fPrio === 'all') || (r.priorite === fPrio);
    return okEtat && okPrio;
  });

  filtered.sort((a,b) => {
    const va = a[sortField], vb = b[sortField];
    if (va == null && vb != null) return asc ? -1 : 1;
    if (va != null && vb == null) return asc ? 1 : -1;
    if (va == null && vb == null) return 0;
    if (['echeance','created_at','updated_at'].includes(sortField)) {
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
    return `<tr data-id="${r.id}">
      <td>
        <div>${escapeHtml(r.description || '')}</div>
        <div class="muted">Créée: ${formatDate(r.created_at)} • MAJ: ${formatDate(r.updated_at)}</div>
      </td>
      <td><div class="chips">${chipEtat(r.etat)} ${chipPrio(r.priorite)}</div></td>
      <td>${formatDate(r.echeance)}</td>
      <td>${roleBadge(r)}</td>
      <td>
        <button class="ghost btn-edit" data-id="${r.id}">Modifier</button>
        <button class="danger btn-del" data-id="${r.id}">Supprimer</button>
      </td>
    </tr>`;
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

  // Délégation d'événements Edit/Delete
  $('#tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.classList.contains('btn-edit')) onEdit(id);
    if (btn.classList.contains('btn-del')) onDelete(id);
  });
}

// ====== CREATE (RPC + fallback direct insert) ======
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
    if (!uuid) {
      setStatus('UUID responsable requis.', false, 'create');
      return;
    }
    responsable_id = uuid;
  }

  // 1) Tenter le RPC
  let ok = false;
  let errMsg = '';
  try {
    const { data, error } = await supabase.rpc('create_action', {
      p_responsable_id: responsable_id,
      p_description: description,
      p_etat: etat,
      p_priorite: priorite,
      p_echeance: echeance
    });
    if (error) throw error;
    ok = true;
  } catch (err) {
    console.warn('RPC create_action a échoué, fallback direct insert →', err);
    errMsg = err?.message || String(err);
  }

  // 2) Fallback : insertion directe (RLS autorise si authentifié)
  if (!ok) {
    try {
      const { error: insErr } = await supabase.from('actions').insert([{
        auteur_id: currentUser.id,             // RLS: doit == auth.uid()
        responsable_id,
        description,
        etat,
        priorite,
        echeance
      }]);
      if (insErr) throw insErr;
      ok = true;
    } catch (err2) {
      console.error('Insert direct error:', err2);
      setStatus(`Erreur de création : ${errMsg || ''} ${err2?.message || ''}`.trim(), false, 'create');
      return;
    }
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
  $('#e_description').value = row.description || '';
  $('#e_priorite').value = row.priorite || 'moyenne';
  $('#e_etat').value = row.etat || 'à faire';
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
  if (mode === 'me') upd.responsable_id = currentUser.id;
  else if (mode === 'uuid') {
    const uuid = $('#e_responsable_uuid').value.trim();
    if (!uuid) return setStatus('UUID responsable requis.', false, 'edit');
    upd.responsable_id = uuid;
  }

  const { error } = await supabase.from('actions').update(upd).eq('id', id);
  if (error) {
    console.error('Update error:', error);
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
  const short = row?.description?.slice(0, 80) || id;
  const ok = confirm(`Supprimer cette action ?\n\n${short}\n\nCette opération est irréversible.`);
  if (!ok) return;

  const { error } = await supabase.from('actions').delete().eq('id', id);
  if (error) {
    console.error('Delete error:', error);
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
  const headers = ['id','description','etat','priorite','echeance','created_at','updated_at','role'];
  const esc = (v) => {
    const s = String(v ?? '').replaceAll('"','""').replaceAll('\r',' ').replaceAll('\n',' ');
    return `"${s}"`;
  };

  const csvLines = [headers.join(',')];
  rows.forEach(r => {
    const role = (r.auteur_id === currentUser.id ? 'auteur' : '')
               + (r.responsable_id === currentUser.id ? (r.auteur_id === currentUser.id ? ' & ' : '') + 'responsable' : '');
    csvLines.push([
      r.id,
      esc(r.description),
      r.etat,
      r.priorite,
      r.echeance || '',
      r.created_at || '',
      r.updated_at || '',
      role || ''
    ].join(','));
  });

  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replaceAll(':','-');
  a.href = url;
  a.download = `actions_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ====== MODAL HELPERS ======
function showModal() { $('#editModal').style.display = 'flex'; $('#editModal').setAttribute('aria-hidden','false'); }
function hideModal() { $('#editModal').style.display = 'none'; $('#editModal').setAttribute('aria-hidden','true'); }