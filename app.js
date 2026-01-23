console.log("🚀 app.js exécuté");

document.addEventListener("DOMContentLoaded", () => {
  if (window.__SUPABASE_ALREADY_INIT__) return;
  window.__SUPABASE_ALREADY_INIT__ = true;

  const SUPABASE_URL = "https://axlzgvfbmqjwvmmzpimr.supabase.co";
  const SUPABASE_ANON_KEY = "…";

  const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  console.log("✅ Supabase initialisé");

  document.getElementById("createForm").addEventListener("submit", async (e) => {
    console.log("📨 submit détecté");
    e.preventDefault();

    const description = document.getElementById("description").value.trim();
    const msg = document.getElementById("msg");

    if (!description) {
      msg.textContent = "Description obligatoire.";
      return;
    }

    const { data, error } = await supabase.rpc("create_action", {
      p_description: description,
      p_priorite: "moyenne",
      p_etat: "à faire",
      p_echeance: null,
      p_responsable_id: null
    });

    console.log("➡️ data:", data);
    console.log("❌ error:", error);

    if (error) {
      msg.textContent = "Erreur: " + error.message;
      return;
    }

    msg.textContent = "Action créée ✔️";
  });
});
