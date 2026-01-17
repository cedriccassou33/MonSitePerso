
// =======================
// script.js
// =======================

// 0) Initialisation Supabase
const SUPABASE_URL = document.querySelector('meta[name="supabase-url"]').content;
const SUPABASE_ANON_KEY = document.querySelector('meta[name="supabase-anon"]').content;
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 1) Références DOM
const form = document.getElementById('msg-form');
const input = document.getElementById('msg-input');
const list = document.getElementById('list');
const statusEl = document.getElementById('status');

// 2) Helpers
function setStatus(msg, ok = true) {
  if (!statusEl) return;
  statusEl.className = ok ? 'ok' : 'err';
  statusEl.textContent = msg;
}

async function loadMessages() {
  const { data, error } = await db
    .from('messages')
    .select('id, content, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    setStatus(`Erreur lecture: ${error.message}`, false);
    return;
  }
  list.innerHTML = '';
  (data || []).forEach(row => {
    const li = document.createElement('li');
    li.textContent = `${new Date(row.created_at).toLocaleString()} — ${row.content}`;
    list.appendChild(li);
  });
}

function attachFormHandler() {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = input.value.trim();
    if (!content) return setStatus('Veuillez saisir un texte.', false);
    if (content.length > 500) return setStatus('500 caractères max.', false);

    const { error } = await db.from('messages').insert({ content });
    if (error) return setStatus(`Erreur insertion: ${error.message}`, false);

    setStatus('Enregistré ✔');
    input.value = '';
    await loadMessages();
  });
}

// 3) Attente robuste de la session (évite la redirection trop tôt)
async function waitForSession(maxTries = 3, delayMs = 250) {
  // 1ere tentative
  let { data: { session } } = await db.auth.getSession();
  if (session?.user) return session;

  // En cas de récupération lente, on ré-essaie un court instant
  for (let i = 0; i < maxTries; i++) {
    await new Promise(r => setTimeout(r, delayMs));
    const res = await db.auth.getSession();
    session = res.data.session;
    if (session?.user) return session;
  }

  // Dernière vérification côté serveur (getUser interroge l'API avec le token s'il existe)
  const { data: { user } } = await db.auth.getUser();
  if (user) {
    // Si user est là, on construit une session minimale
    return { user };
  }

  return null;
}

/* // 4) Garde d'auth : on attend la session, sinon on redirige
(async () => {
  const session = await waitForSession();
  if (!session || !session.user) {
    // Pas de session même après attente → on renvoie vers le login
    window.location.href = 'home.html';
    return;
  } */

  // Session OK → on attache les handlers et on charge les données
  attachFormHandler();
  await loadMessages();
})();