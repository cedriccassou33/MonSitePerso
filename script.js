
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

// 👉 Nouveaux boutons
const logoutBtn = document.getElementById('logout-btn');
const actionsBtn = document.getElementById('actions-btn');

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

// 👉 Attache les handlers de boutons
function attachActionButtons() {
  if (actionsBtn) {
    actionsBtn.addEventListener('click', () => {
      // Redirection vers la page actions
      window.location.href = 'actions.html';
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await db.auth.signOut(); // Déconnecte l'utilisateur
      } catch (e) {
        // Même en cas d'échec réseau, on force la navigation
        console.warn('Erreur signOut:', e);
      } finally {
        // Redirige vers la page d'accueil (index.html)
        window.location.href = 'index.html';
      }
    });
  }
}

// 3) Attente robuste de la session (évite la redirection trop tôt)
async function waitForSession(maxTries = 3, delayMs = 250) {
  // 1ère tentative
  let { data: { session } } = await db.auth.getSession();
  if (session?.user) return session;

  // En cas de récupération lente, on ré-essaie un court instant
  for (let i = 0; i < maxTries; i++) {
    await new Promise(r => setTimeout(r, delayMs));
    const res = await db.auth.getSession();
    session = res.data.session;
    if (session?.user) return session;
  }

  // Dernière vérification côté serveur
  const { data: { user } } = await db.auth.getUser();
  if (user) {
    // Si user est là, on construit une session minimale
    return { user };
  }
  return null;
}

// 4) Garde d'auth : on attend la session, sinon on redirige (optionnel)
(async () => {
  const session = await waitForSession();

  // Si tu veux protéger la page, décommente :
  // if (!session || !session.user) {
  //   window.location.href = 'index.html';
  //   return;
  // }

  // Session OK → on attache les handlers et on charge les données
  attachFormHandler();
  attachActionButtons(); // ← attache les nouveaux boutons
  await loadMessages();
})();