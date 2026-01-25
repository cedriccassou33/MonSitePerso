
/* global supabase */
(() => {
  // =============== CONFIG / STATE ===============
  let client = null;
  let currentUser = "";
  let cached = [];
  let cachedUsers = [];

  const $ = (id) => document.getElementById(id);
  const toastEl = $("toast");
  const whoamiEl = $("whoami");

  // ENUMS (doivent matcher ceux de la DB)
  const PRIORITIES = ["basse", "moyenne", "haute"];
  const STATUSES = ["a_faire", "en_cours", "fait", "annule"];

  // =============== HELPERS ===============
  function getMeta(name) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? el.getAttribute("content") : "";
  }

  function toast(msg, type = "ok") {
    if (!toastEl) return;
    toastEl.innerHTML = `<div class="toast ${type}">${msg}</div>`;
    setTimeout(() => (toastEl.innerHTML = ""), 3500);
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toDatetimeLocalValue(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  }

  function fromDatetimeLocalValue(v) {
    if (!v) return null;
    return new Date(v).toISOString();
  }

  function statusLabel(s) {
    return { a_faire: "à faire", en_cours: "en cours", fait: "fait", annule: "annulé" }[s] || s;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ensureOption(selectEl, value, label = value) {
    if (!value) return;
    const exists = [...selectEl.options].some((o) => o.value === value);
    if (!exists) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      selectEl.appendChild(opt);
    }
  }

  function populateUserSelect(selectId, users, keepValue = true) {
    const sel = $(selectId);
    if (!sel) return;

    const prev = keepValue ? sel.value : "";

    sel.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "— sélectionner un utilisateur —";
    sel.appendChild(placeholder);

    users.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.identifiant;
      opt.textContent = u.identifiant;
      sel.appendChild(opt);
    });

    if (prev) {
      ensureOption(sel, prev, prev);
      sel.value = prev;
    }
  }

  // =============== SUPABASE INIT ===============
  function initSupabase() {
    const url = getMeta("supabase-url");
    const anon = getMeta("supabase-anon");

    if (!url || !anon) {
      toast("Meta supabase-url / supabase-anon manquantes dans le HTML.", "err");
      return false;
    }
    if (!window.supabase?.createClient) {
      toast("supabase-js non chargé (vérifie le script CDN).", "err");
      return false;
    }
    client = window.supabase.createClient(url, anon);
    return true;
  }

  // =============== SESSION / LOGOUT ===============
  function getConnectedIdentifiantFromStorage() {
    // cohérent avec ton login (index.js) : localStorage.setItem("identifiant", identifiant)
    return (localStorage.getItem("identifiant") || "").trim(); // [2](https://sanofi-my.sharepoint.com/personal/cedric_cassou_sanofi_com/Documents/Microsoft%20Copilot%20Chat%20Files/index.js)
  }

  function logout() {
    localStorage.removeItem("identifiant");
    // Optionnel : nettoyer aussi d'autres clés si tu en ajoutes plus tard
    // localStorage.removeItem("token");
    window.location.href = "index.html";
  }

  async function validateConnectedUser(ident) {
    // Vérifie que l'identifiant existe bien dans public.comptes_utilisateurs
    const { data, error } = await client
      .from("comptes_utilisateurs")
      .select("identifiant")
      .eq("identifiant", ident)
      .maybeSingle();

    if (error) {
      console.error(error);
      toast("Erreur vérification utilisateur : " + error.message, "err");
      return false;
    }
    if (!data?.identifiant) {
      toast(`Utilisateur "${escapeHtml(ident)}" introuvable. Retour login.`, "err");
      return false;
    }
    return true;
  }

  async function loadConnectedUserOrRedirect() {
    const ident = getConnectedIdentifiantFromStorage();

    if (!ident) {
      toast("Aucun utilisateur connecté. Retour login.", "err");
      window.location.href = "index.html";
      return false;
    }

    const ok = await validateConnectedUser(ident);
    if (!ok) {
      localStorage.removeItem("identifiant");
      window.location.href = "index.html";
      return false;
    }

    currentUser = ident;

    if (whoamiEl) whoamiEl.textContent = currentUser;

    toast(`Connecté en tant que : <b>${escapeHtml(currentUser)}</b>`, "ok");
    return true;
  }

  // =============== USERS (comptes_utilisateurs) ===============
  async function loadUsers() {
    const { data, error } = await client
      .from("comptes_utilisateurs")
      .select("identifiant")
      .order("identifiant", { ascending: true });

    if (error) {
      console.error(error);
      toast(
        "Impossible de charger la liste des utilisateurs (comptes_utilisateurs). Vérifie RLS/policies. " +
          error.message,
        "err"
      );
      return;
    }

    cachedUsers = data ?? [];
    populateUserSelect("newAssignee", cachedUsers, true);
    populateUserSelect("editAssignee", cachedUsers, true);
  }

  // =============== CRUD ===============
  async function loadActions() {
    if (!currentUser) return;

    let query = client
      .from("actions")
      .select("*")
      .or(`author_id.eq.${currentUser},responsible_id.eq.${currentUser}`);

    const filterStatus = $("filterStatus")?.value || "";
    if (filterStatus) query = query.eq("status", filterStatus);

    const sortBy = $("sortBy")?.value || "created_desc";
    if (sortBy === "due_asc") query = query.order("due_date", { ascending: true, nullsFirst: false });
    if (sortBy === "due_desc") query = query.order("due_date", { ascending: false, nullsFirst: false });
    if (sortBy === "created_desc") query = query.order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error(error);
      toast("Erreur chargement : " + error.message, "err");
      return;
    }

    cached = data ?? [];
    renderList();
    toast(`Chargé : ${cached.length} action(s).`, "ok");
  }

  async function createAction() {
    if (!currentUser) return toast("Utilisateur non défini.", "err");

    const description = $("newDesc")?.value.trim() || "";
    const priority = $("newPriority")?.value || "moyenne";
    const status = $("newStatus")?.value || "a_faire";
    const due_date = fromDatetimeLocalValue($("newDue")?.value || "");
    const responsible_id = ($("newAssignee")?.value || "").trim();

    if (!description) return toast("Description obligatoire.", "err");
    if (description.length > 500) return toast("Description > 500 caractères.", "err");
    if (!PRIORITIES.includes(priority)) return toast("Priorité invalide.", "err");
    if (!STATUSES.includes(status)) return toast("État invalide.", "err");
    if (!responsible_id) return toast("Responsable obligatoire.", "err");

    const payload = { description, priority, status, due_date, author_id: currentUser, responsible_id };
    const { error } = await client.from("actions").insert(payload);

    if (error) {
      console.error(error);
      toast("Erreur création : " + error.message, "err");
      return;
    }

    $("newDesc").value = "";
    $("newDue").value = "";
    $("newAssignee").value = "";
    $("counter").textContent = "0";

    await loadActions();
    toast("Action créée ✅", "ok");
  }

  function openEdit(item) {
    $("editId").value = item.id;
    $("editDesc").value = item.description ?? "";
    $("editPriority").value = item.priority ?? "moyenne";
    $("editStatus").value = item.status ?? "a_faire";
    $("editDue").value = toDatetimeLocalValue(item.due_date);

    const sel = $("editAssignee");
    const value = item.responsible_id ?? "";
    ensureOption(sel, value, value);
    sel.value = value;

    $("editDialog").showModal();
  }

  async function saveEdit() {
    const id = $("editId").value;
    if (!id) return;

    const description = $("editDesc").value.trim();
    const priority = $("editPriority").value;
    const status = $("editStatus").value;
    const due_date = fromDatetimeLocalValue($("editDue").value);
    const responsible_id = $("editAssignee").value.trim();

    if (!description) return toast("Description obligatoire.", "err");
    if (description.length > 500) return toast("Description > 500 caractères.", "err");
    if (!responsible_id) return toast("Responsable obligatoire.", "err");

    const patch = { description, priority, status, due_date, responsible_id };
    const { error } = await client.from("actions").update(patch).eq("id", id);

    if (error) {
      console.error(error);
      toast("Erreur mise à jour : " + error.message, "err");
      return;
    }

    toast("Modifications enregistrées ✅", "ok");
    await loadActions();
  }

  async function deleteAction() {
    const id = $("editId").value;
    if (!id) return;

    if (!confirm("Supprimer cette action ?")) return;

    const { error } = await client.from("actions").delete().eq("id", id);
    if (error) {
      console.error(error);
      toast("Erreur suppression : " + error.message, "err");
      return;
    }

    $("editDialog").close();
    toast("Action supprimée ✅", "ok");
    await loadActions();
  }

  // =============== RENDER ===============
  function renderList() {
    const list = $("list");

    if (!cached.length) {
      list.innerHTML = `<div class="muted">Aucune action à afficher.</div>`;
      return;
    }

    list.innerHTML = cached
      .map((a) => {
        const due = a.due_date ? new Date(a.due_date).toLocaleString() : "—";
        const roleView = a.author_id === currentUser ? "auteur" : "responsable";
        const sClass = `status s-${a.status}`;

        return `
<div class="item">
  <div class="item-header">
    <div>
      <div class="item-title">${escapeHtml(a.description ?? "").slice(0, 80)}${
          (a.description?.length ?? 0) > 80 ? "…" : ""
        }</div>
      <div class="meta">
        <span class="${sClass}">${escapeHtml(statusLabel(a.status))}</span>
        <span class="badge">priorité: <b>${escapeHtml(a.priority)}</b></span>
        <span class="badge">échéance: <b>${escapeHtml(due)}</b></span>
        <span class="badge">auteur: <b>${escapeHtml(a.author_id)}</b></span>
        <span class="badge">responsable: <b>${escapeHtml(a.responsible_id)}</b></span>
        <span class="badge">vu en tant que: <b>${escapeHtml(roleView)}</b></span>
      </div>
    </div>
    <div>
      <button class="secondary" data-edit="${escapeHtml(a.id)}">Modifier</button>
    </div>
  </div>

  <p class="item-desc">${escapeHtml(a.description ?? "")}</p>
</div>
`;
      })
      .join("");

    list.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit");
        const item = cached.find((x) => String(x.id) === String(id));
        if (item) openEdit(item);
      });
    });
  }

  // =============== EVENTS ===============
  function bindEvents() {
    $("btnCreate")?.addEventListener("click", createAction);
    $("filterStatus")?.addEventListener("change", loadActions);
    $("sortBy")?.addEventListener("change", loadActions);

    $("newDesc")?.addEventListener("input", () => {
      $("counter").textContent = String($("newDesc").value.length);
    });

    $("btnSave")?.addEventListener("click", async (e) => {
      e.preventDefault();
      await saveEdit();
      $("editDialog").close();
    });

    $("btnDelete")?.addEventListener("click", deleteAction);

    // ✅ Déconnexion
    $("btnLogout")?.addEventListener("click", () => {
      if (confirm("Se déconnecter ?")) logout();
    });
  }

  // =============== BOOT ===============
  window.addEventListener("DOMContentLoaded", async () => {
    if (!initSupabase()) return;
    bindEvents();

    const ok = await loadConnectedUserOrRedirect();
    if (!ok) return;

    await loadUsers();
    await loadActions();
  });
})();
