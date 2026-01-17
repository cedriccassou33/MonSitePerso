
// =======================
// script.js (patch)
// =======================

// 0) Initialisation Supabase (avec options d'auth recommandées)
const SUPABASE_URL = document.querySelector('meta[name="supabase-url"]').content;
const SUPABASE_ANON_KEY = document.querySelector('meta[name="supabase-anon"]').content;

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // important après redirection OAuth / magic link
    flowType: 'pkce',         // sans danger si non utilisé, recommandé pour web
  },
});

// 1) Références DOM
const form = document.getElementById('msg-form');
const input = document.getElementById('msg-input');
const list = document.getElementById('list');
const statusEl = document.getElementById('status');
const logoutBtn = document.getElementById('logout-btn');

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

function attachLogoutHandler() {
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', async () => {
    try {
      const { error } = await db.auth.signOut();
      if (error) {
        setStatus(`Erreur déconnexion: ${error.message}`, false);
        return;
      }
      window.location.href = 'index.html';
    } catch (e) {
      setStatus(`Erreur déconnexion: ${e.message}`, false);
    }
  });
}

// 3) Attente robuste de session
async function waitForSession({ tries = 12, delayMs = 250 } = {}) {
  // 1) Laisse Supabase consommer l'URL hash (#access_token...) si présent
  //    (detectSessionInUrl: true s'en charge au premier getSession)
  let { data: { session } } = await db.auth.getSession();
  if (session?.user) return session;

  // 2) Retente sur une courte fenêtre (3s par défaut)
  for (let i = 0; i < tries; i++) {
    await new Promise(r => setTimeout(r, delayMs));
    const res = await db.auth.getSession();
    session = res.data.session;
    if (session?.user) return session;
  }

  // 3) Dernier recours : interroger l'API
  const { data: { user }, error } = await db.auth.getUser();
  if (user && !error) return { user };

  return null;
}

// 4) Gestion de l'état d'auth en direct
db.auth.onAuthStateChange(async (event, _session) => {
  // Si on reçoit SIGNED_IN juste après la redirection, (ré-)initialise l'UI complète
  if (event === 'SIGNED_IN') {
    // Affiche le bouton déconnexion
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    // Active le formulaire
    attachFormHandler();
    attachLogoutHandler();
    // Charge les messages
    await loadMessages();
    // Nettoie un éventuel message d'attente
    setStatus('');
  }
});

// 5) Bootstrap de la page
(async () => {
  const hasAccessTokenInHash = location.hash.includes('access_token=');

  if (hasAccessTokenInHash) {
    // Le SDK va consommer ce hash lors de getSession(); on évite d'afficher "lecture seule" trop vite
    setStatus('Connexion en cours…', true);
  }

  const session = await waitForSession({ tries: 12, delayMs: 250 });

  // Afficher/Masquer le bouton Déconnexion
  if (logoutBtn) {
    if (session?.user) logoutBtn.classList.remove('hidden');
    else logoutBtn.classList.add('hidden');
  }

  if (!session || !session.user) {
    // --- Mode non connecté ---
    // Par défaut : lecture seule
    setStatus('Vous n’êtes pas connecté·e. Affichage en lecture seule.', false);
    await loadMessages();

    // Si tu préfères forcer la redirection des non-connectés :
    // window.location.href = 'index.html';
    return;
  }

  // --- Connecté ---
  setStatus('');
  attachFormHandler();
  attachLogoutHandler();
  await loadMessages();
})();
