
/* global supabase */
(() => {
  // =============== CONFIG / STATE ===============
  let client = null;
  let currentUser = "";
  let cached = [];

  const $ = (id) => document.getElementById(id);
  const toastEl = $("toast");

  // ENUMS (doivent matcher ceux de la DB)
  const PRIORITIES = ["basse", "moyenne", "haute"];
  const STATUSES = ["a_faire", "en_cours", "fait", "annule"];

  // =============== HELPERS ===============
  function getMeta(name) {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? el.getAttribute("content") : "";
  }

  function toast(msg, type = "ok") {
    toastEl.innerHTML = `<div class="toast ${type}">${msg}</div>`;
    setTimeout(() => (toastEl.innerHTML = ""), 3500);
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toDatetimeLocalValue(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  // =============== CRUD ===============
  async function loadActions() {
    if (!client) return;

    const ident = $("userId").value.trim();
    if (!ident) {
      toast("Renseigne ton identifiant.", "err");
      return;
    }
    currentUser = ident;

    let query = client
      .from("actions")
      .select("*")
      // IMPORTANT: bons noms de colonnes
      .or(`author_id.eq.${ident},responsible_id.eq.${ident}`);

    const filterStatus = $("filterStatus").value;
    if (filterStatus) query = query.eq("status", filterStatus);

    const sortBy = $("sortBy").value;
    if (sortBy === "due_asc") query = query.order("due_date", { ascending: true, nullsFirst: false });
    if (sortBy === "due_desc") query = query.order("due_date", { ascending: false, nullsFirst: false });
    if (sortBy === "created_desc") query = query.order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error(error);
      toast("Erreur chargement : " + error.message, "err");
      return;
    }

    cached = data || [];
    renderList();
    toast(`Chargé : ${cached.length} action(s).`, "ok");
  }

  async function createAction() {
    if (!client) {
      toast("Client Supabase non initialisé.", "err");
      return;
    }
    if (!currentUser) {
      toast("Clique sur Charger d’abord.", "err");
      return;
    }

    const description = $("newDesc").value.trim();
    const priority = $("newPriority").value;
    const status = $("newStatus").value;
    const due_date = fromDatetimeLocalValue($("newDue").value);
    const responsible_id = $("newAssignee").value.trim();

    if (!description) return toast("Description obligatoire.", "err");
    if (description.length > 500) return toast("Description > 500 caractères.", "err");
    if (!PRIORITIES.includes(priority)) return toast("Priorité invalide.", "err");
    if (!STATUSES.includes(status)) return toast("État invalide.", "err");
    if (!responsible_id) return toast("Responsable obligatoire.", "err");

    const payload = {
      description,
      priority,
      status,
      due_date,
      author_id: currentUser,
      responsible_id
    };

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
    $("editAssignee").value = item.responsible_id ?? "";
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
                <div class="item-title">
                  ${escapeHtml(a.description).slice(0, 80)}${a.description?.length > 80 ? "…" : ""}
                </div>
                <div class="meta">
                  <span class="${sClass}">${escapeHtml(statusLabel(a.status))}</span>
                  <span class="badge">priorité: <b>${escapeHtml(a.priority)}</b></span>
                  <span class="badge">échéance: <b>${escapeHtml(due)}</b></span>
                  <span class="badge">auteur: <b>${escapeHtml(a.author_id)}</b></span>
                  <span class="badge">responsable: <b>${escapeHtml(a.responsible_id)}</b></span>
                  <span class="badge">vu en tant que: <b>${escapeHtml(roleView)}</b></span>
                </div>
              </div>

              <div style="min-width:120px;">
                <button class="secondary" data-edit="${a.id}">Modifier</button>
              </div>
            </div>

            <div class="item-desc">${escapeHtml(a.description)}</div>
          </div>
        `;
      })
      .join("");

    list.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit");
        const item = cached.find((x) => x.id === id);
        if (item) openEdit(item);
      });
    });
  }

  // =============== EVENTS ===============
  function bindEvents() {
    $("btnConnect").addEventListener("click", async () => {
      localStorage.setItem("userId", $("userId").value.trim());

      if (!client && !initSupabase()) return;
      await loadActions();
    });

    $("btnClear").addEventListener("click", () => {
      localStorage.removeItem("userId");
      location.reload();
    });

    $("btnCreate").addEventListener("click", createAction);
    $("filterStatus").addEventListener("change", loadActions);
    $("sortBy").addEventListener("change", loadActions);

    $("newDesc").addEventListener("input", () => {
      $("counter").textContent = String($("newDesc").value.length);
    });

    $("btnSave").addEventListener("click", async (e) => {
      e.preventDefault();
      await saveEdit();
      $("editDialog").close();
    });

    $("btnDelete").addEventListener("click", deleteAction);
  }

  // =============== BOOT ===============
  window.addEventListener("DOMContentLoaded", () => {
    // Init client dès le chargement
    initSupabase();

    // Restore identifiant
    const uid = localStorage.getItem("userId");
    if (uid) $("userId").value = uid;

    bindEvents();
  });
})();