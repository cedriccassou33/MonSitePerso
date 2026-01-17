// auth.js
// 1) Initialisation Supabase (mêmes <meta> que dans index.html)
const SUPABASE_URL = document.querySelector('meta[name="supabase-url"]').content;
const SUPABASE_ANON_KEY = document.querySelector('meta[name="supabase-anon"]').content;
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2) Si déjà connecté → aller sur index.html
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    window.location.href = 'index.html';
  }
})();

function setStatus(msg, ok = true) {
  const el = document.getElementById('status');
  el.className = ok ? 'ok' : 'err';
  el.textContent = msg;
}

// Convertit "admin" → "admin@local.test" si l'utilisateur n'a pas saisi d'email
function normalizeIdentifiant(id) {
  return id.includes('@') ? id : `${id}@local.test`;
}

// 3) Connexion
document.getElementById('btn-login').addEventListener('click', async () => {
  const id = document.getElementById('identifiant').value.trim();
  const pw = document.getElementById('password').value;

  if (!id || !pw) return setStatus('Identifiant et mot de passe requis.', false);

  const email = normalizeIdentifiant(id);
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
  if (error) return setStatus(error.message, false);

  // Optionnel : marquer la dernière connexion si tu as créé la fonction SQL 'mark_last_login'
  // (Variante A que nous avons définie auparavant)
  try {
    const uid = data.user.id;
    await sb.rpc('mark_last_login', { p_user: uid });
  } catch (_) {}

  // OK → aller sur index.html
  window.location.href = 'index.html';
});

// 4) Création de compte
document.getElementById('btn-signup').addEventListener('click', async () => {
  const id = document.getElementById('identifiant').value.trim();
  const pw = document.getElementById('password').value;
  if (!id || !pw) return setStatus('Identifiant et mot de passe requis.', false);

  const email = normalizeIdentifiant(id);
  const { data, error } = await sb.auth.signUp({ email, password: pw });
  if (error) return setStatus(error.message, false);

  // ⚠️ Par défaut, Supabase peut exiger une confirmation d'email.
  // Pour un accès immédiat après inscription, désactive "Email confirmations"
  // dans Auth → Providers → Email (ou coche "Confirm user" à la création).
  // Sinon, l'utilisateur devra cliquer dans l'email avant de se connecter. 
  // Réf : Password-based Auth + confirmations. 
  // (Tu peux ensuite faire un signInWithPassword juste après si auto-confirm actif.)
  setStatus('Compte créé. Si la confirmation email est activée, vérifiez votre boîte mail.', true);
});