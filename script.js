
// =======================
// script.js (sans mécanisme de déconnexion)
// =======================

// 0) Initialisation Supabase (avec options recommandées pour fiabilité auth)
const SUPABASE_URL = document.querySelector('meta[name="supabase-url"]').content;
const SUPABASE_ANON_KEY = document.querySelector('meta[name="supabase-anon"]').content;

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});

// 1) Références DOM
const form = document.getElementById('msg-form');
const input = document.getElementById('msg-input');
const list = document.getElementById('list');
const statusEl = document.getElementById('status');

// 2) Helpers UI
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
  (data ?? []).forEach(row => {
    const li = document.createElement('li');
    li.textContent = `${new Date(row.created_at).toLocaleString()} — ${row.content}`;
    list.appendChild(li);
  });
}

function attachFormHandler() {
  if (!form) return;
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

// 3) Attente robuste de session (évite le faux "non connecté" après login)
async function waitForSession({ tries = 12, delayMs = 250 } = {}) {
  // Laisse Supabase consommer le hash d'URL si présent
  let { data: { session } } = await db.auth.getSession();
  if (session?.user) return session;

  for (let i = 0; i < tries; i++) {
    await new Promise(r => setTimeout(r, delayMs));
    const res = await db.auth.getSession();
    session = res.data.session;
    if (session?.user) return session;
  }

  const { data: { user }, error } = await db.auth.getUser();
  if (user && !error) return { user };
  return null;
}

// 4) Écoute des changements d'état d'auth (optionnel mais utile)
db.auth.onAuthStateChange(async (event, _session) => {
  if (event === 'SIGNED_IN') {
    setStatus('');
    attachFormHandler();
    await loadMessages();
  }
});

// 5) Bootstrap de la page
(async () => {
  const hasAccessTokenInHash = location.hash.includes('access_token=');
  if (hasAccessTokenInHash) {
    setStatus('Connexion en cours…', true);
  }

  const session = await waitForSession({ tries: 12, delayMs: 250 });

  if (!session || !session.user) {
    // --- Mode non connecté : lecture seule ---
    setStatus('Vous n’êtes pas connecté·e. Affichage en lecture seule.', false);
    // Laisse le formulaire inactif si tu veux vraiment "lecture seule" :
    // (ne pas appeler attachFormHandler)
    await loadMessages();

    // Si tu préfères rediriger les non-connectés :
    // window.location.href = 'index.html';
    return;
  }

  // --- Connecté ---
  setStatus('');
  attachFormHandler();
  await loadMessages();
})();