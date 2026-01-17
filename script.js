
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
const logoutBtn = document.getElementById('logout-btn');

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

// [AJOUT] Gestion de la déconnexion
function attachLogoutHandler() {
  if (!logoutBtn) return;
  logoutBtn.addEventListener('click', async () => {
    try {
      const { error } = await db.auth.signOut();
      if (error) {
        setStatus(`Erreur déconnexion: ${error.message}`, false);
        return;
      }
      // Redirige vers la page publique d'accueil
      window.location.href = 'index.html';
    } catch (e) {
      setStatus(`Erreur déconnexion: ${e.message}`, false);
    }
  });
}

// 3) Attente robuste de la session (évite les faux négatifs)
async function waitForSession(maxTries = 3, delayMs = 250) {
  let { data: { session } } = await db.auth.getSession();
  if (session?.user) return session;

  for (let i = 0; i < maxTries; i++) {
    await new Promise(r => setTimeout(r, delayMs));
    const res = await db.auth.getSession();
    session = res.data.session;
    if (session?.user) return session;
  }
  const { data: { user } } = await db.auth.getUser();
  if (user) return { user };
  return null;
}

// 4) Garde d'auth et initialisation UI
(async () => {
  const session = await waitForSession();

  // Afficher/Masquer le bouton Déconnexion selon l'état d'auth
  if (logoutBtn) {
    if (session?.user) {
      logoutBtn.classList.remove('hidden');
    } else {
      logoutBtn.classList.add('hidden');
    }
  }

  if (!session || !session.user) {
    // --- Mode non connecté ---
    // Option 1 (défaut ici) : rester en lecture seule sur home.html
    setStatus('Vous n’êtes pas connecté·e. Affichage en lecture seule.', false);
    // Ne pas attacher l’édition si tu veux bloquer l’écriture :
    // attachFormHandler();  // ← laisse commenté pour bloquer
    await loadMessages();

    // Option 2 : si tu veux forcer la redirection :
    // window.location.href = 'index.html';
    return;
  }

  // --- Connecté ---
  attachFormHandler();
  attachLogoutHandler();
  await loadMessages();
})();
