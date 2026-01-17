
// script.js

// 0) Initialisation Supabase
const SUPABASE_URL = document.querySelector('meta[name="supabase-url"]').content;
const SUPABASE_ANON_KEY = document.querySelector('meta[name="supabase-anon"]').content;
// Le CDN expose un global `supabase`
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 1) Références DOM
const form = document.getElementById('msg-form');
const input = document.getElementById('msg-input');
const list = document.getElementById('list');
const statusEl = document.getElementById('status');

// 2) Helpers
function setStatus(msg, ok = true) {
  statusEl.className = ok ? 'ok' : 'err';
  statusEl.textContent = msg;
}

async function loadMessages() {
  // SELECT * FROM messages ORDER BY created_at DESC LIMIT 10
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
    if (!content) {
      setStatus('Veuillez saisir un texte.', false);
      return;
    }
    if (content.length > 500) {
      setStatus('500 caractères max.', false);
      return;
    }

    // INSERT INTO messages(content) VALUES (...)
    const { error } = await db.from('messages').insert({ content });
    if (error) {
      setStatus(`Erreur insertion: ${error.message}`, false);
      return;
    }

    setStatus('Enregistré ✔');
    input.value = '';
    await loadMessages();
  });
}

// 3) Garde d'authentification : si non connecté → redirection vers login.html
(async () => {
  const { data: { session }, error } = await db.auth.getSession();

  // En cas d'erreur API, on redirige aussi (pour forcer une authentification propre)
  if (error || !session || !session.user) {
    window.location.href = 'login.html';
    return;
  }

  // L'utilisateur est authentifié → on attache les handlers et on charge les données
  attachFormHandler();
  await loadMessages();
})();