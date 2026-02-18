function qs(id) {
  return document.getElementById(id);
}

const DEFAULT_API_BASE = "http://localhost:3001";

function getApiBase() {
  const fromStorage = localStorage.getItem("apiBase");
  const base = fromStorage ? String(fromStorage).trim() : DEFAULT_API_BASE;
  return base.replace(/\/$/, "");
}

function setOut(el, obj) {
  if (!el) return;
  el.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

function showToast(message, type = "info", durationMs = 3200) {
  const container = qs("toastContainer");
  if (!container || !message) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = String(message);
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, durationMs);
}

function toastSuccess(message) {
  showToast(message, "success");
}

function toastError(message) {
  showToast(message, "error", 4200);
}

function toastInfo(message) {
  showToast(message, "info");
}

function saveToken(token) {
  if (!token) return;
  localStorage.setItem("token", String(token).trim());
}

function loadToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  const normalized = String(token).trim();
  if (!normalized || normalized === "null" || normalized === "undefined") {
    return null;
  }

  return normalized;
}

function clearToken() {
  localStorage.removeItem("token");
}

function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );

    return JSON.parse(json);
  } catch {
    return null;
  }
}

function applyAuthGate() {
  const isLogged = !!loadToken();
  const authGate = qs("authGate");
  const appRoot = qs("appRoot");

  if (authGate) authGate.hidden = isLogged;
  if (appRoot) appRoot.hidden = !isLogged;

  if (document.body) {
    document.body.classList.toggle("auth-only", !isLogged);
  }
}

function two(n) {
  return String(n).padStart(2, "0");
}

function nowISO() {
  return new Date().toISOString();
}

let clockIntervalId = null;

function startClock() {
  const el = qs("clock");
  const elDate = qs("clockDate");
  if (!el || !elDate) return;

  function tick() {
    const d = new Date();
    el.textContent = `${two(d.getHours())}:${two(d.getMinutes())}`;
    elDate.textContent = d.toLocaleDateString("pt-BR");
  }

  tick();

  if (clockIntervalId) return;
  clockIntervalId = setInterval(tick, 1000);
}

function getGeo() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização não suportada"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        const msg =
          err.code === 1
            ? "PermissÃ£o de localizaÃ§Ã£o negada"
            : err.code === 2
              ? "LocalizaÃ§Ã£o indisponÃ­vel"
              : err.code === 3
                ? "Timeout ao obter localizaÃ§Ã£o"
                : "Erro ao obter localizaÃ§Ã£o";

        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

startClock();

function updateAuthUI() {
  const token = loadToken();
  const payload = token ? decodeJwtPayload(token) : null;
  const userLabel =
    payload && payload.name
      ? `${payload.name}${payload.role ? ` (${payload.role})` : ""}`
      : null;

  qs("authStatus").textContent = token
    ? userLabel
      ? `Logado: ${userLabel}`
      : "Logado (token salvo)"
    : "Deslogado";

  const isLogged = !!token;
  [
    "btnCreateUser",
    "btnToggleActive",
    "btnListUsers",
    "btnLoadAlerts",
    "btnMyEntries",
    "btnAllEntries",
    "btnEntriesByUser",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !isLogged;
  });
}

async function apiFetch(path, options = {}) {
  const base = getApiBase();
  const url = `${base}${path}`;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = loadToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = { error: "Resposta nÃ£o Ã© JSON" };
  }

  if (!res.ok) {
    const msg = data && data.error ? data.error : "Erro na requisiÃ§Ã£o";
    throw new Error(`${res.status} - ${msg}`);
  }

  return data;
}

function clearEntriesTable() {
  qs("entriesTable").querySelector("tbody").innerHTML = "";
  qs("entriesInfo").textContent = "-";
  setOut(qs("entriesOut"), "");
}

function fmtIsoToBr(iso) {
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

function renderEntries(entries) {
  const tbody = qs("entriesTable").querySelector("tbody");
  tbody.innerHTML = "";

  for (const e of entries) {
    const tr = document.createElement("tr");

    const userCol = e.name
      ? `${e.name} (${e.cpf}) [${e.user_id}]`
      : String(e.user_id);

    tr.innerHTML = `
      <td>${e.id}</td>
      <td>${userCol}</td>
      <td>${e.type}</td>
      <td>${fmtIsoToBr(e.occurred_at)}</td>
      <td>${e.latitude ?? "-"}</td>
      <td>${e.longitude ?? "-"}</td>
    `;

    tbody.appendChild(tr);
  }

  qs("entriesInfo").textContent = `Total: ${entries.length}`;
}

function renderUsersTable(users) {
  const table = qs("usersTable");
  if (!table) return;

  const tbody = table.querySelector("tbody");
  tbody.innerHTML = "";

  for (const user of users) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${user.id}</td>
      <td>${user.name || "-"}</td>
      <td>${user.cpf || "-"}</td>
      <td>${user.role || "-"}</td>
      <td>${Number(user.is_active) === 1 ? "Ativo" : "Inativo"}</td>
      <td>${user.created_at ? fmtIsoToBr(user.created_at) : "-"}</td>
    `;
    tbody.appendChild(tr);
  }

  const info = qs("usersInfo");
  if (info) info.textContent = `Total: ${users.length}`;
}

async function loadUsersTable() {
  const data = await apiFetch("/admin/users?limit=50&offset=0", {
    method: "GET",
  });
  const users = data.users || [];
  renderUsersTable(users);
  return users.length;
}

function buildPeriodQuery() {
  const fromVal = qs("fromDate").value;
  const toVal = qs("toDate").value;

  const params = new URLSearchParams();

  if (fromVal) params.set("from", new Date(fromVal).toISOString());
  if (toVal) params.set("to", new Date(toVal).toISOString());

  const q = params.toString();
  return q ? `?${q}` : "";
}

let currentViewId = "view-dashboard";
let journeyRefreshInFlight = false;

function getCurrentRoutePath() {
  const raw = (window.location.hash || "").replace(/^#/, "").trim();
  return raw || "/dashboard";
}

function navigateToRoute(routePath, { replace = false } = {}) {
  const nextHash = `#${routePath}`;
  if (window.location.hash === nextHash) return;
  if (replace) {
    window.history.replaceState(null, "", nextHash);
  } else {
    window.location.hash = nextHash;
  }
}

async function refreshJourneyStatus() {
  if (journeyRefreshInFlight) return;
  journeyRefreshInFlight = true;

  const statusEl = qs("journeyStatus");
  const btn = qs("btnClock");

  const token = loadToken();
  if (!token) {
    statusEl.textContent = "FaÃ§a login";
    btn.disabled = true;
    btn.textContent = "FaÃ§a login";
    journeyRefreshInFlight = false;
    return;
  }

  statusEl.textContent = "Consultando...";
  btn.disabled = true;
  btn.textContent = "Carregando...";

  try {
    const data = await apiFetch("/time/status", { method: "GET" });
    const inJourney = !!data.in_journey;

    statusEl.textContent = inJourney ? "Em jornada" : "Fora da jornada";
    btn.textContent = inJourney ? "Sair da jornada" : "Registrar entrada";
    btn.disabled = false;
  } catch (err) {
    statusEl.textContent = "Erro ao consultar";
    btn.textContent = "Erro";
    btn.disabled = true;
    setOut(qs("clockOut"), err.message);
  } finally {
    journeyRefreshInFlight = false;
  }
}

async function ensureLoggedForEntries() {
  if (!loadToken()) {
    setOut(qs("entriesOut"), "FaÃ§a login para consultar registros.");
    return false;
  }
  return true;
}

function clearAlertsTable() {
  qs("alertsTable").querySelector("tbody").innerHTML = "";
  qs("alertsInfo").textContent = "-";
  setOut(qs("alertsOut"), "");
}

function buildAlertsQuery() {
  const status = qs("alertStatus").value;
  const userId = qs("alertUserId").value.trim();
  const severity = qs("alertSeverity").value;
  const limit = qs("alertLimit").value.trim() || "20";
  const offset = qs("alertOffset").value.trim() || "0";

  const p = new URLSearchParams();
  if (status) p.set("status", status);
  if (userId) p.set("user_id", userId);
  if (severity) p.set("severity", severity);
  p.set("limit", limit);
  p.set("offset", offset);

  return `?${p.toString()}`;
}

function renderAlerts(alerts) {
  const tbody = qs("alertsTable").querySelector("tbody");
  tbody.innerHTML = "";

  for (const a of alerts) {
    const tr = document.createElement("tr");

    const userCol = a.user_name
      ? `${a.user_name} (${a.user_cpf}) [${a.user_id}]`
      : String(a.user_id);

    const created = fmtIsoToBr(a.created_at);
    const resolved = a.resolved_at ? fmtIsoToBr(a.resolved_at) : "-";

    tr.innerHTML = `
      <td>${a.id}</td>
      <td>${a.type}</td>
      <td>${a.severity}</td>
      <td>${userCol}</td>
      <td>${a.time_in_entry_id ?? "-"}</td>
      <td>${created}</td>
      <td>${(a.note || "-").toString()}</td>
      <td>${resolved}</td>
      <td>
        ${a.resolved_at ? "-" : `<button data-resolve="${a.id}">Resolver</button>`}
      </td>
    `;

    tbody.appendChild(tr);
  }
}

async function loadAlerts() {
  const out = qs("alertsOut");
  setOut(out, "Buscando...");

  if (!loadToken()) {
    setOut(out, "FaÃ§a login como ADMIN.");
    return;
  }

  try {
    const q = buildAlertsQuery();
    const data = await apiFetch(`/admin/alerts${q}`, { method: "GET" });

    renderAlerts(data.alerts || []);
    qs("alertsInfo").textContent =
      `Total: ${data.total} | Mostrando: ${(data.alerts || []).length}`;

    setOut(out, data);
  } catch (err) {
    setOut(out, err.message);
  }
}

function setActiveView(viewId, { syncRoute = true } = {}) {
  currentViewId = viewId;

  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  const view = document.getElementById(viewId);
  if (view) view.classList.add("active");

  document
    .querySelectorAll(".navItem")
    .forEach((b) => b.classList.remove("active"));
  const btn = document.querySelector(`.navItem[data-view="${viewId}"]`);
  if (btn) btn.classList.add("active");

  const titles = {
    "view-dashboard": ["Dashboard", "Visão geral do sistema"],
    "view-ponto": [
      "Bater ponto",
      "Registro de entrada/saí­da com geolocalização",
    ],
    "view-consultas": ["Consultas", "Registros por periodo"],
    "view-admin-users": [
      "Admin vê Usuários",
      "Cadastro e ativação/desativação",
    ],
    "view-admin-alerts": ["Admin vê Alertas", "Fila auditável e resolução"],
  };

  const [t, s] = titles[viewId] || ["Sistema", ""];
  qs("topTitle").textContent = t;
  qs("topSub").textContent = s;

  if (syncRoute && typeof window.viewIdToRoute === "function") {
    navigateToRoute(window.viewIdToRoute(viewId), { replace: true });
  }

  if (viewId === "view-ponto") {
    refreshJourneyStatus();
  }
}

async function loadActiveSO() {
  const out = qs("soOut");
  const select = qs("soSelect");

  setOut(out, "Carregando...");

  try {
    const data = await apiFetch("/service-orders/my/active", { method: "GET" });

    select.innerHTML = `<option value="">Autômatico</option>`;

    for (const so of data.service_orders || []) {
      const opt = document.createElement("option");
      opt.value = String(so.id);
      opt.textContent = `#${so.id} - ${so.title}`;
      select.appendChild(opt);
    }

    out.textContent = `OS ativas: ${(data.service_orders || []).length}`;
  } catch (err) {
    out.textContent = `OS: ${err.message}`;
  }
}

const btnLoadSO = document.getElementById("btnLoadSO");
if (btnLoadSO) btnLoadSO.addEventListener("click", loadActiveSO);

const appRoot = document.querySelector(".app");
const navBackdrop = qs("navBackdrop");
const btnMenu = qs("btnMenu");

function isMobileLayout() {
  return window.matchMedia("(max-width: 900px)").matches;
}

function closeNavMenu() {
  if (appRoot) appRoot.classList.remove("navOpen");
}

if (btnMenu) {
  btnMenu.addEventListener("click", () => {
    if (!appRoot || !isMobileLayout()) return;
    appRoot.classList.toggle("navOpen");
  });
}

if (navBackdrop) {
  navBackdrop.addEventListener("click", closeNavMenu);
}

window.addEventListener("resize", () => {
  if (!isMobileLayout()) closeNavMenu();
});

document.querySelectorAll(".navItem").forEach((btn) => {
  btn.addEventListener("click", () => setActiveView(btn.dataset.view));
});

window.addEventListener("hashchange", () => {
  if (typeof window.routeToViewId !== "function") return;
  const routePath = getCurrentRoutePath();
  const viewId = window.routeToViewId(routePath);
  setActiveView(viewId, { syncRoute: false });
});

async function refreshRoleUILegacy() {
  const pill = qs("pillAuth");
  const token = loadToken();

  if (!token) {
    pill.textContent = "Deslogado";
    document
      .querySelectorAll('.navItem[data-view^="view-admin"]')
      .forEach((b) => (b.disabled = true));
    return;
  }

  try {
    const me = await apiFetch("/me", { method: "GET" });
    const role = me.user.role;
    pill.textContent = `${me.user.name} - ${role}`;

    const isAdmin = role === "ADMIN";
    document
      .querySelectorAll('[data-view^="view-admin"]')
      .forEach((b) => (b.disabled = !isAdmin));
  } catch {
    pill.textContent = "SessÃ£o invÃ¡lida";
    document
      .querySelectorAll('[data-view^="view-admin"]')
      .forEach((b) => (b.disabled = true));
  }
}
function toIsoFromDatetimeLocal(val) {
  if (!val) return "";
  return new Date(val).toISOString();
}

function renderServiceOrdersTable(rows) {
  const tbody = qs("soTable").querySelector("tbody");
  tbody.innerHTML = "";

  for (const so of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
    <td>${so.id}</td>
    <td>${so.title}</td>
    <td>${so.status}</td>
    <td>${fmtIsoToBr(so.expected_start)}</td>
    <td>${so.expected_duration_hours}h</td>
    <td>${so.location_text || "-"}</td>
    <td>${so.created_by_name || so.created_by}</td>
    <td>
      ${so.status === "OPEN" ? `<button data-close-so="${so.id}">Encerrar</button>` : "-"}
    </td>
  `;
    tbody.appendChild(tr);
  }
}

async function listServiceOrders() {
  const out = qs("soAdminOut");
  setOut(out, "Buscando OS...");

  try {
    const data = await apiFetch("/admin/service-orders", { method: "GET" });
    const rows = data.service_orders || [];

    renderServiceOrdersTable(rows);
    // setOut(qs("soAdminJson"), data);
    setOut(out, `OK - ${rows.length} OS`);
    toastInfo(`${rows.length} OS carregadas`);
  } catch (err) {
    setOut(out, err.message);
    toastError(`Erro ao listar OS: ${err.message}`);
  }
}
qs("soTable").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-close-so]");
  if (!btn) return;

  const soId = btn.getAttribute("data-close-so");
  if (!confirm(`Encerrar OS #${soId}?`)) return;

  try {
    const data = await apiFetch(
      `/admin/service-orders/${encodeURIComponent(soId)}/close`,
      {
        method: "PATCH",
      },
    );

    // setOut(qs("soAdminJson"), data);
    setOut(qs("soAdminOut"), `OS #${soId} encerrada.`);
    await listServiceOrders();
    toastSuccess(`OS #${soId} encerrada`);
  } catch (err) {
    setOut(qs("soAdminOut"), err.message);
    toastError(`Erro ao encerrar OS: ${err.message}`);
  }
});

qs("btnCreateSO").addEventListener("click", async () => {
  const out = qs("soAdminOut");
  setOut(out, "Criando OS...");

  try {
    const title = qs("soTitle").value.trim();
    const description = qs("soDescription").value.trim();
    const location_text = qs("soLocation").value.trim();
    const expectedStartLocal = qs("soExpectedStart").value;
    const expected_duration_hours = Number(qs("soDurationHours").value);

    if (!title || title.length < 3) {
      setOut(out, "TÃ­tulo precisa ter no mÃ­nimo 3 caracteres.");
      toastError("Titulo precisa ter no minimo 3 caracteres");
      return;
    }
    if (!expectedStartLocal) {
      setOut(out, "Informe o inÃ­cio previsto.");
      toastError("Informe o inicio previsto");
      return;
    }
    if (
      !Number.isFinite(expected_duration_hours) ||
      expected_duration_hours <= 0
    ) {
      setOut(out, "DuraÃ§Ã£o invÃ¡lida.");
      toastError("Duracao invalida");
      return;
    }

    const payload = {
      title,
      description: description || undefined,
      location_text: location_text || undefined,
      expected_start: toIsoFromDatetimeLocal(expectedStartLocal),
      expected_duration_hours,
    };

    const data = await apiFetch("/admin/service-orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // setOut(qs("soAdminJson"), data);
    setOut(out, `OS criada (#${data.service_order?.id ?? "?"})`);

    await listServiceOrders();
    toastSuccess(`OS #${data.service_order?.id ?? "?"} criada`);
  } catch (err) {
    setOut(out, err.message);
    toastError(`Erro ao criar OS: ${err.message}`);
  }
});

qs("btnListSO").addEventListener("click", listServiceOrders);

const btnHealth = qs("btnHealth");
if (btnHealth) {
  btnHealth.addEventListener("click", async () => {
    const out = qs("healthOut");
    setOut(out, "Consultando...");
    try {
      const data = await apiFetch("/health", { method: "GET" });
      setOut(out, data);
      toastSuccess("API online");
    } catch (err) {
      setOut(out, err.message);
      toastError(`Falha no /health: ${err.message}`);
    }
  });
}

qs("btnLogin").addEventListener("click", async () => {
  const out = qs("loginOut");
  setOut(out, "Autenticando...");

  const cpf = qs("loginCpf").value.trim();
  const password = qs("loginPassword").value;

  try {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ cpf, password }),
    });

    saveToken(data.token);
    updateAuthUI();
    applyAuthGate();
    await refreshRoleUI();
    if (currentViewId === "view-ponto") {
      await refreshJourneyStatus();
    }
    setOut(out, data);
    toastSuccess("Login realizado com sucesso");
  } catch (err) {
    setOut(out, err.message);
    toastError(`Erro no login: ${err.message}`);
  }
});

["btnLogout", "btnTopLogout"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;

  el.addEventListener("click", () => {
    clearToken();
    updateAuthUI();
    applyAuthGate();
    if (currentViewId === "view-ponto") {
      refreshJourneyStatus();
    }
    setActiveView("view-dashboard");
    navigateToRoute("/dashboard", { replace: true });
    refreshRoleUI();
    toastInfo("Sessao encerrada");
  });
});

qs("btnCreateUser").addEventListener("click", async () => {
  const out = qs("adminOut");
  setOut(out, "Enviando...");

  const name = qs("newName").value.trim();
  const cpf = qs("newCpf").value.trim();
  const password = qs("newPassword").value;
  const role = qs("newRole").value;

  try {
    const data = await apiFetch("/admin/users", {
      method: "POST",
      body: JSON.stringify({ name, cpf, password, role }),
    });

    setOut(out, data);
    toastSuccess("Usuario cadastrado com sucesso");
  } catch (err) {
    setOut(out, err.message);
    toastError(`Erro ao cadastrar usuario: ${err.message}`);
  }
});

qs("btnGetGeo").addEventListener("click", async () => {
  const out = qs("geoOut");
  out.textContent = "LocalizaÃ§Ã£o: capturando...";
  try {
    const geo = await getGeo();
    out.textContent = `LocalizaÃ§Ã£o: ${geo.latitude.toFixed(6)}, ${geo.longitude.toFixed(6)} (Â±${Math.round(geo.accuracy)}m)`;
  } catch (err) {
    out.textContent = `LocalizaÃ§Ã£o: ${err.message}`;
  }
});
qs("btnClock").addEventListener("click", async () => {
  const out = qs("clockOut");
  setOut(out, "Processando...");

  try {
    let geo = { latitude: null, longitude: null };

    try {
      const g = await getGeo();
      geo = { latitude: g.latitude, longitude: g.longitude };
      qs("geoOut").textContent =
        `Localização: ${g.latitude.toFixed(6)}, ${g.longitude.toFixed(6)} (Â±${Math.round(g.accuracy)}m)`;
    } catch (geoErr) {
      qs("geoOut").textContent = `Localização: ${geoErr.message}`;
    }

    const statusData = await apiFetch("/time/status", { method: "GET" });
    const type = statusData.in_journey ? "OUT" : "IN";
    const soVal = qs("soSelect")?.value?.trim();
    const soId = soVal ? Number(soVal) : null;

    const payload = {
      type,
      occurred_at: nowISO(),
      latitude: geo.latitude,
      longitude: geo.longitude,
      service_order_id: soId,
    };

    const data = await apiFetch("/time/clock", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    setOut(out, data);
    await refreshJourneyStatus();
    toastSuccess(`Ponto registrado (${type})`);
  } catch (err) {
    setOut(out, err.message);
    toastError(`Erro ao bater ponto: ${err.message}`);
  }
});

qs("btnRefreshStatus").addEventListener("click", refreshJourneyStatus);

qs("btnMyEntries").addEventListener("click", async () => {
  if (!(await ensureLoggedForEntries())) return;

  setOut(qs("entriesOut"), "Buscando...");
  try {
    const q = buildPeriodQuery();
    const data = await apiFetch(`/entries${q}`, { method: "GET" });
    renderEntries(data.entries || []);
    setOut(qs("entriesOut"), data);
  } catch (err) {
    setOut(qs("entriesOut"), err.message);
  }
});

qs("btnEntriesByUser").addEventListener("click", async () => {
  if (!(await ensureLoggedForEntries())) return;

  const userId = qs("filterUserId").value.trim();
  if (!userId) {
    setOut(qs("entriesOut"), "Informe um user_id.");
    return;
  }

  setOut(qs("entriesOut"), "Buscando...");

  try {
    const base = new URLSearchParams();
    base.set("user_id", userId);

    const fromVal = qs("fromDate").value;
    const toVal = qs("toDate").value;
    if (fromVal) base.set("from", new Date(fromVal).toISOString());
    if (toVal) base.set("to", new Date(toVal).toISOString());

    const data = await apiFetch(`/entries?${base.toString()}`, {
      method: "GET",
    });

    renderEntries(data.entries || []);
    setOut(qs("entriesOut"), data);
  } catch (err) {
    setOut(qs("entriesOut"), err.message);
  }
});

qs("btnAllEntries").addEventListener("click", async () => {
  if (!(await ensureLoggedForEntries())) return;

  setOut(qs("entriesOut"), "Buscando...");
  try {
    const q = buildPeriodQuery();
    const data = await apiFetch(`/entries/all${q}`, { method: "GET" });
    renderEntries(data.entries || []);
    setOut(qs("entriesOut"), data);
  } catch (err) {
    setOut(qs("entriesOut"), err.message);
  }
});

qs("btnToggleActive").addEventListener("click", async () => {
  const out = qs("toggleOut");
  setOut(out, "Enviando...");

  const userId = qs("toggleUserId").value.trim();
  if (!userId) {
    setOut(out, "Informe um ID de usuÃ¡rio.");
    toastError("Informe um ID de usuario");
    return;
  }

  const is_active = qs("toggleActive").value === "true";

  try {
    const data = await apiFetch(
      `/admin/users/${encodeURIComponent(userId)}/active`,
      {
        method: "PATCH",
        body: JSON.stringify({ is_active }),
      },
    );

    setOut(out, data);
    toastSuccess(is_active ? "Usuario ativado" : "Usuario desativado");
    await loadUsersTable();
  } catch (err) {
    setOut(out, err.message);
    toastError(`Erro ao alterar usuario: ${err.message}`);
  }
});

qs("btnListUsers").addEventListener("click", async () => {
  try {
    const total = await loadUsersTable();
    toastInfo(`${total} usuarios carregados`);
  } catch (err) {
    toastError(`Erro ao listar usuarios: ${err.message}`);
  }
});

qs("btnLoadAlerts").addEventListener("click", loadAlerts);
qs("btnClearAlerts").addEventListener("click", clearAlertsTable);

qs("alertsTable").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-resolve]");
  if (!btn) return;

  const alertId = btn.getAttribute("data-resolve");
  const note = prompt("Descreva a resoluÃ§Ã£o (obrigatÃ³rio):");
  if (!note || note.trim().length < 3) {
    toastError("Resolucao deve ter ao menos 3 caracteres");
    return;
  }

  try {
    const data = await apiFetch(
      `/admin/alerts/${encodeURIComponent(alertId)}/resolve`,
      {
        method: "PATCH",
        body: JSON.stringify({ resolution_note: note.trim() }),
      },
    );

    setOut(qs("alertsOut"), data);
    await loadAlerts();
    toastSuccess(`Alerta #${alertId} resolvido`);
  } catch (err) {
    setOut(qs("alertsOut"), err.message);
    toastError(`Erro ao resolver alerta: ${err.message}`);
  }
});

qs("btnAssignSO").addEventListener("click", async () => {
  const out = qs("soAdminOut");
  setOut(out, "Atribuindo OS...");

  try {
    const soId = Number(qs("assignSoId").value);
    const userId = Number(qs("assignUserId").value);

    if (!Number.isFinite(soId) || soId <= 0) {
      setOut(out, "Informe um OS ID vÃ¡lido.");
      toastError("Informe um OS ID valido");
      return;
    }
    if (!Number.isFinite(userId) || userId <= 0) {
      setOut(out, "Informe um user_id vÃ¡lido.");
      toastError("Informe um user_id valido");
      return;
    }

    const data = await apiFetch(
      `/admin/service-orders/${encodeURIComponent(soId)}/assign`,
      {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      },
    );

    // setOut(qs("soAdminJson"), data);
    setOut(out, `OK - OS #${soId} atribuída ao user_id ${userId}`);
    toastSuccess(`OS #${soId} atribuida com sucesso`);
  } catch (err) {
    setOut(out, err.message);
    toastError(`Erro ao atribuir OS: ${err.message}`);
  }
});

// Mantem estado de login mesmo quando /me falhar.
async function refreshRoleUI() {
  const pill = qs("pillAuth");
  const token = loadToken();

  if (!token) {
    pill.textContent = "Deslogado";
    document
      .querySelectorAll('[data-view^="view-admin"]')
      .forEach((b) => (b.disabled = true));
    return;
  }

  try {
    const me = await apiFetch("/me", { method: "GET" });
    const role = me.user.role;
    pill.textContent = `${me.user.name} - ${role}`;

    const isAdmin = role === "ADMIN";
    document
      .querySelectorAll('[data-view^="view-admin"]')
      .forEach((b) => (b.disabled = !isAdmin));
  } catch {
    pill.textContent = "Sessão inválida";
    document
      .querySelectorAll('[data-view^="view-admin"]')
      .forEach((b) => (b.disabled = true));
  }
}

qs("btnClearEntries").addEventListener("click", clearEntriesTable);

updateAuthUI();
applyAuthGate();
if (typeof window.routeToViewId === "function") {
  const routePath = getCurrentRoutePath();
  const viewId = window.routeToViewId(routePath);
  setActiveView(viewId, { syncRoute: false });
  navigateToRoute(window.viewIdToRoute(viewId), { replace: true });
} else {
  setActiveView("view-dashboard");
}
refreshRoleUI();
startClock();
