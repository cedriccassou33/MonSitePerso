
// <<< REMPLACE AVEC TES VALEURS SUPABASE >>>
const SUPABASE_URL = "https://axlzgvfbmqjwvmmzpimr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4bHpndmZibXFqd3ZtbXpwaW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDI3NjQsImV4cCI6MjA4NDA3ODc2NH0.7S7PbON5F_FH2x2Ashd1-9XU6JW2qYMZ482uv0m4kFI";

// --------------------------
const loginBtn = document.getElementById("loginBtn");

document.getElementById("togglePwd").onclick = () => {
    const fld = document.getElementById("motdepasse");
    fld.type = fld.type === "password" ? "text" : "password";
};

loginBtn.onclick = async () => {
    const identifiant = document.getElementById("identifiant").value;
    const motdepasse = document.getElementById("motdepasse").value;

    if (!identifiant || !motdepasse) {
        alert("Veuillez remplir les deux champs.");
        return;
    }

    // 🔎 1) Récupérer l’utilisateur (REST API Supabase)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/comptes_utilisateurs?identifiant=eq.${identifiant}`, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
    });

    const data = await res.json();

    if (data.length === 0) {
        alert("Utilisateur inconnu");
        return;
    }

    const user = data[0];

    // 🔐 2) Vérification du mot de passe par l’API RPC
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_password`, {
        method: "POST",
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            input_password: motdepasse,
            stored_hash: user.mot_de_passe_hash
        })
    });

    const isValid = await checkRes.json();

    if (!isValid) {
        // ❌ Incrémenter tentatives
        await fetch(`${SUPABASE_URL}/rest/v1/comptes_utilisateurs?identifiant=eq.${identifiant}`, {
            method: "PATCH",
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                connexions_echouees: user.connexions_echouees + 1
            })
        });

        alert(`Mot de passe erroné, tentative ${user.connexions_echouees + 1}`);
        return;
    }

    // 🎉 3) Succès
    alert("Connexion réussie !");
};
