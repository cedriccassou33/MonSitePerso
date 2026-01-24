
// <<< REMPLACE AVEC TES VALEURS SUPABASE >>>
const SUPABASE_URL = "https://axlzgvfbmqjwvmmzpimr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4bHpndmZibXFqd3ZtbXpwaW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDI3NjQsImV4cCI6MjA4NDA3ODc2NH0.7S7PbON5F_FH2x2Ashd1-9XU6JW2qYMZ482uv0m4kFI";

const loginBtn = document.getElementById("loginBtn");

document.getElementById("togglePwd").onclick = () => {
  const fld = document.getElementById("motdepasse");
  fld.type = fld.type === "password" ? "text" : "password";
};

function extractBooleanRpcResult(payload) {
  // Cas 1: PostgREST renvoie un booléen JSON direct : true/false
  if (typeof payload === "boolean") return payload;

  // Cas 2: renvoie un objet { ... } contenant une propriété (selon le nom)
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    // essaie plusieurs clés possibles
    if (typeof payload.check_password === "boolean") return payload.check_password;
    if (typeof payload.result === "boolean") return payload.result;
    if (typeof payload.data === "boolean") return payload.data;
  }

  // Cas 3: renvoie un tableau du style [{ check_password: false }]
  if (Array.isArray(payload) && payload.length > 0 && payload[0]) {
    if (typeof payload[0].check_password === "boolean") return payload[0].check_password;
    if (typeof payload[0].result === "boolean") return payload[0].result;
  }

  // Par défaut : considère que c'est invalide (sécurité)
  return false;
}

loginBtn.onclick = async () => {
  const identifiant = document.getElementById("identifiant").value.trim();
  const motdepasse = document.getElementById("motdepasse").value;

  if (!identifiant || !motdepasse) {
    alert("Veuillez remplir les deux champs.");
    return;
  }

  // 1) Récupérer l’utilisateur
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/comptes_utilisateurs?identifiant=eq.${encodeURIComponent(
      identifiant
    )}&select=identifiant,mot_de_passe_hash,connexions_echouees`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );

  if (!res.ok) {
    alert("Erreur serveur (lecture utilisateur).");
    return;
  }

  const data = await res.json();

  if (!Array.isArray(data) || data.length === 0) {
    alert("Utilisateur inconnu");
    return;
  }

  const user = data[0];

  // 2) Vérification mot de passe via RPC
  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input_password: motdepasse,
      stored_hash: user.mot_de_passe_hash,
    }),
  });

  if (!checkRes.ok) {
    // Très utile pour debug : affiche le corps renvoyé
    const errText = await checkRes.text();
    console.error("RPC error:", checkRes.status, errText);
    alert("Erreur serveur (vérification mot de passe).");
    return;
  }

  const payload = await checkRes.json();
  const isValid = extractBooleanRpcResult(payload);

  if (!isValid) {
    const next = (user.connexions_echouees ?? 0) + 1;

    // 3) Incrémenter tentatives
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/comptes_utilisateurs?identifiant=eq.${encodeURIComponent(
        identifiant
      )}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ connexions_echouees: next }),
      }
    );

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error("PATCH error:", patchRes.status, errText);
      // On affiche quand même le message d’échec
    }

    alert(`Mot de passe erroné, tentative ${next}`);
    return;
  }

  // ✅ 4) Mot de passe correct => remise à zéro du compteur (si nécessaire)
  if ((user.connexions_echouees ?? 0) > 0) {
    const resetRes = await fetch(
      `${SUPABASE_URL}/rest/v1/comptes_utilisateurs?identifiant=eq.${encodeURIComponent(
        identifiant
      )}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ connexions_echouees: 0 }),
      }
    );

    if (!resetRes.ok) {
      const errText = await resetRes.text();
      console.error("RESET error:", resetRes.status, errText);
      // Non bloquant pour un proto : on laisse la connexion passer
    }
  }

  alert("Connexion réussie !");
};