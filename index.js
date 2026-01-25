// <<< REMPLACE AVEC TES VALEURS SUPABASE >>>
const SUPABASE_URL = "https://axlzgvfbmqjwvmmzpimr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4bHpndmZibXFqd3ZtbXpwaW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDI3NjQsImV4cCI6MjA4NDA3ODc2NH0.7S7PbON5F_FH2x2Ashd1-9XU6JW2qYMZ482uv0m4kFI";

const loginBtn = document.getElementById("loginBtn");
const createAccountBtn = document.getElementById("createAccountBtn");
const messageEl = document.getElementById("message");

document.getElementById("togglePwd").onclick = () => {
  const fld = document.getElementById("motdepasse");
  fld.type = fld.type === "password" ? "text" : "password";
};

// showMessage affiche le contenu de la variable text dans la zone "message" du HTML
function showMessage(text, type = "info") {
  // fallback si l'élément n'existe pas
  if (!messageEl) {
    alert(text);
    return;
  }

  messageEl.textContent = text || "";
  if (!text) {
    messageEl.removeAttribute("style");
    return;
  }

  // Style minimal inline pour éviter de toucher au CSS
  messageEl.style.marginTop = "12px";
  messageEl.style.padding = "10px";
  messageEl.style.borderRadius = "8px";
  messageEl.style.fontSize = "0.95rem";
  messageEl.style.border = "1px solid transparent";

  if (type === "error") {
    messageEl.style.color = "#b00020";
    messageEl.style.background = "#fde7ea";
    messageEl.style.borderColor = "#f5c2c7";
  } else if (type === "success") {
    messageEl.style.color = "#0b6a0b";
    messageEl.style.background = "#e8f5e9";
    messageEl.style.borderColor = "#c8e6c9";
  } else {
    messageEl.style.color = "#1b1b1b";
    messageEl.style.background = "#eef2ff";
    messageEl.style.borderColor = "#d7ddff";
  }
}

function extractBooleanRpcResult(payload) {
  // Cas 1: PostgREST renvoie un booléen JSON direct : true/false
  if (typeof payload === "boolean") return payload;

  // Cas 2: renvoie un objet { ... } contenant une propriété (selon le nom)
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    if (typeof payload.check_password === "boolean") return payload.check_password;
    if (typeof payload.result === "boolean") return payload.result;
    if (typeof payload.data === "boolean") return payload.data;
  }

  // Cas 3: renvoie un tableau du style [{ check_password: false }]
  if (Array.isArray(payload) && payload.length > 0 && payload[0]) {
    if (typeof payload[0].check_password === "boolean") return payload[0].check_password;
    if (typeof payload[0].result === "boolean") return payload[0].result;
  }

  // Par défaut : invalide (sécurité)
  return false;
}

function extractStringRpcResult(payload) {
  // Cas 1: RPC renvoie une string direct
  if (typeof payload === "string") return payload;

  // Cas 2: objet avec propriété string
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    for (const k of ["hash", "hash_password", "result", "data"]) {
      if (typeof payload[k] === "string") return payload[k];
    }
  }

  // Cas 3: tableau du style [{ hash: "..." }]
  if (Array.isArray(payload) && payload.length > 0 && payload[0]) {
    for (const k of ["hash", "hash_password", "result", "data"]) {
      if (typeof payload[0][k] === "string") return payload[0][k];
    }
  }

  return null;
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extra,
  };
}

/**
 * Vérifie si l'identifiant existe déjà
 */
async function userExists(identifiant) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/comptes_utilisateurs?identifiant=eq.${encodeURIComponent(
      identifiant
    )}&select=identifiant&limit=1`,
    { headers: supabaseHeaders() }
  );

  if (!res.ok) {
    throw new Error("Erreur serveur (vérification existence utilisateur).");
  }

  const data = await res.json();
  return Array.isArray(data) && data.length > 0;
}

/**
 * Tente de hasher le mot de passe via une RPC (recommandé).
 * -> nécessite une fonction SQL côté Supabase nommée "hash_password".
 */
async function hashPassword(motdepasse) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/hash_password`, {
    method: "POST",
    headers: supabaseHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ input_password: motdepasse }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("RPC hash_password error:", res.status, errText);
    throw new Error(
      "Impossible de créer le compte : la fonction de hachage (rpc/hash_password) est manquante ou en erreur."
    );
  }

  const payload = await res.json();
  const hash = extractStringRpcResult(payload);

  if (!hash) {
    console.error("RPC hash_password payload inattendu:", payload);
    throw new Error("Impossible de créer le compte : réponse de hachage invalide.");
  }

  return hash;
}

loginBtn.onclick = async () => {
  showMessage(""); // reset message
  const identifiant = document.getElementById("identifiant").value.trim();
  const motdepasse = document.getElementById("motdepasse").value;

  if (!identifiant || !motdepasse) {
    showMessage("Veuillez remplir les deux champs.", "error");
    return;
  }

  try {
    // 1) Récupérer l’utilisateur
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/comptes_utilisateurs?identifiant=eq.${encodeURIComponent(
        identifiant
      )}&select=identifiant,mot_de_passe_hash,connexions_echouees`,
      { headers: supabaseHeaders() }
    );

    if (!res.ok) {
      showMessage("Erreur serveur (lecture utilisateur).", "error");
      return;
    }

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      showMessage("Utilisateur inconnu", "error");
      return;
    }

    const user = data[0];

    // 2) Vérification mot de passe via RPC
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_password`, {
      method: "POST",
      headers: supabaseHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        input_password: motdepasse,
        stored_hash: user.mot_de_passe_hash,
      }),
    });

    if (!checkRes.ok) {
      const errText = await checkRes.text();
      console.error("RPC error:", checkRes.status, errText);
      showMessage("Erreur serveur (vérification mot de passe).", "error");
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
          headers: supabaseHeaders({
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          }),
          body: JSON.stringify({ connexions_echouees: next }),
        }
      );

      if (!patchRes.ok) {
        const errText = await patchRes.text();
        console.error("PATCH error:", patchRes.status, errText);
        // non bloquant
      }

      showMessage(`Mot de passe erroné, tentative ${next}`, "error");
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
          headers: supabaseHeaders({
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          }),
          body: JSON.stringify({ connexions_echouees: 0 }),
        }
      );

      if (!resetRes.ok) {
        const errText = await resetRes.text();
        console.error("RESET error:", resetRes.status, errText);
        // non bloquant
      }
    }

    showMessage("Connexion réussie !", "success");

    // ✅ IMPORTANT : stocker l’identifiant connecté (issu de comptes_utilisateurs)
    localStorage.setItem("identifiant", identifiant);

    // redirection après un court délai
    setTimeout(() => {
      window.location.href = "actions.html";
    }, 800);
  } catch (e) {
    console.error(e);
    showMessage("Erreur réseau / serveur.", "error");
  }
};

createAccountBtn.onclick = async () => {
  showMessage(""); // reset message
  const identifiant = document.getElementById("identifiant").value.trim();
  const motdepasse = document.getElementById("motdepasse").value;

  // 1) Champs obligatoires
  if (!identifiant || !motdepasse) {
    showMessage(
      "Veuillez remplir l'identifiant et le mot de passe avant de créer un compte.",
      "error"
    );
    return;
  }

  // désactive le bouton pendant le traitement (évite double clic)
  createAccountBtn.disabled = true;

  try {
    // 2) Identifiant déjà existant ?
    const exists = await userExists(identifiant);
    if (exists) {
      showMessage("Cet identifiant existe déjà. Merci d'en choisir un autre.", "error");
      return;
    }

    // 3) Hash du mot de passe (bloquant si la RPC n’existe pas)
    const passwordHash = await hashPassword(motdepasse);

    // 4) Création du compte
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/comptes_utilisateurs`, {
      method: "POST",
      headers: supabaseHeaders({
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      }),
      body: JSON.stringify({
        identifiant,
        mot_de_passe_hash: passwordHash,
        connexions_echouees: 0,
      }),
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text().catch(() => "");
      console.error("INSERT error:", insertRes.status, errText);

      if (insertRes.status === 409) {
        showMessage("Cet identifiant existe déjà. Merci d'en choisir un autre.", "error");
      } else {
        showMessage("Erreur serveur (création du compte).", "error");
      }
      return;
    }

    showMessage("✅ Compte créé avec succès ! Vous pouvez maintenant vous connecter.", "success");
  } catch (e) {
    console.error(e);
    showMessage(e?.message || "Erreur réseau / serveur.", "error");
  } finally {
    createAccountBtn.disabled = false;
  }
};
