// ======================================
// Script JS — version la plus simple possible
// ======================================

// 1) Initialisation Supabase (lecture des <meta>)
const url = document.querySelector('meta[name="supabase-url"]').content;
const anon = document.querySelector('meta[name="supabase-anon"]').content;
const db = supabase.createClient(url, anon);

// 2) Sélection des éléments du DOM
const form = document.getElementById('msg-form');
const input = document.getElementById('msg-input');
const list = document.getElementById('list');
const statusEl = document.getElementById('status');
const logoutBtn = document.getElementById('logout-btn');

// ---------------------
// Fonctions utilitaires
// ---------------------
function setStatus(msg, ok) {
  statusEl.className = ok ? "ok" : "err";
  statusEl.textContent = msg;
}

// -------------------------------
// Chargement des 10 derniers msgs
// -------------------------------
function loadMessages() {
  db.from('messages')
    .select('content, created_at')
    .order('created_at', { ascending: false })
    .limit(10)
    .then(function (result) {
      if (result.error) {
        setStatus("Erreur lecture : " + result.error.message, false);
        return;
      }

      list.innerHTML = "";
      (result.data || []).forEach(function (row) {
        const li = document.createElement('li');
        li.textContent =
          new Date(row.created_at).toLocaleString() + " — " + row.content;
        list.appendChild(li);
      });
    });
}

// ----------------------
// Envoi d’un nouveau msg
// ----------------------
form.addEventListener('submit', function (e) {
  e.preventDefault();

  const content = input.value.trim();
  if (!content) {
    setStatus("Veuillez saisir un texte.", false);
    return;
  }

  db.from('messages')
    .insert({ content })
    .then(function (result) {
      if (result.error) {
        setStatus("Erreur insertion : " + result.error.message, false);
        return;
      }

      setStatus("Enregistré ✔", true);
      input.value = "";
      loadMessages();
    });
});

// ----------------------
// Gestion du bouton logout
// ----------------------
logoutBtn.addEventListener('click', function () {
  db.auth.signOut().then(function () {
    window.location.href = "index.html";
  });
});

// ----------------------------------------
// Vérification très simple de la session
// (si pas de session → redirection login)
// ----------------------------------------
db.auth.getSession().then(function (result) {
  const session = result.data && result.data.session;

  if (!session || !session.user) {
    // pas connecté → retour login
    window.location.href = "index.html";
    return;
  }

  // connecté → on charge les messages
  loadMessages();
});