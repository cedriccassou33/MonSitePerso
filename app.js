// ---- CONFIG SUPABASE ----
const SUPABASE_URL = "https://axlzgvfbmqjwvmmzpimr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4bHpndmZibXFqd3ZtbXpwaW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDI3NjQsImV4cCI6MjA4NDA3ODc2NH0.7S7PbON5F_FH2x2Ashd1-9XU6JW2qYMZ482uv0m4kFI";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- FORM ----
document.getElementById("createForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const description = document.getElementById("description").value.trim();
  const msg = document.getElementById("msg");

  if (!description) {
    msg.textContent = "Description obligatoire.";
    return;
  }

  // Valeurs par défaut
  const dataToSend = {
    p_description: description,
    p_priorite: "moyenne",
    p_etat: "à faire",
    p_echeance: null,
    p_responsable_id: null
  };

  // Exécution RPC create_action()
  const { data, error } = await supabase.rpc("create_action", dataToSend);

  if (error) {
    msg.textContent = "Erreur: " + error.message;
    return;
  }

  msg.textContent = "Action créée ✔️";
  document.getElementById("description").value = "";
});
