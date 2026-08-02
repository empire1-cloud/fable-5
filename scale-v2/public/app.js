const loginView = document.querySelector("#login-view");
const controlView = document.querySelector("#control-view");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const engineGrid = document.querySelector("#engine-grid");
const engineDetail = document.querySelector("#engine-detail");
const tenantName = document.querySelector("#tenant-name");
const logout = document.querySelector("#logout");

let token = sessionStorage.getItem("fable5_token");
let blueprint = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.reason || data.error || `Request failed: ${response.status}`);
  return data;
}

function list(title, items) {
  return `<div><h4>${title}</h4><ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul></div>`;
}

function renderDetail(engine) {
  engineDetail.innerHTML = `
    <div class="detail-head">
      <div class="number">${engine.id}</div>
      <div><p class="eyebrow">${engine.layer.replaceAll("-", " ").toUpperCase()}</p><h2>${engine.name}</h2><p class="muted">${engine.description}</p></div>
    </div>
    <div class="detail-columns">
      ${list("INPUTS", engine.inputs)}
      ${list("OUTPUTS", engine.outputs)}
      ${list("KPIs", engine.kpis)}
      ${list("ACCEPTED RECEIPTS", engine.receipts)}
      ${list("ESCALATION CONDITIONS", engine.escalations)}
      ${list("CONNECTED ENGINES", engine.connected.map((id) => `${id} · ${blueprint.engines.find((e) => e.id === id)?.name ?? ""}`))}
    </div>
    <div class="gate"><b>NEXT MAY PROCEED WHEN →</b> ${engine.gate}</div>`;
  document.querySelectorAll(".engine-card").forEach((card) => card.classList.toggle("active", card.dataset.id === engine.id));
}

function renderBlueprint(data) {
  blueprint = data;
  tenantName.textContent = data.tenant.name;
  engineGrid.innerHTML = data.engines.map((engine) => `
    <button class="engine-card ${engine.layer === "substrate" ? "substrate" : ""}" data-id="${engine.id}">
      <span class="number">${engine.id}</span>
      <h3>${engine.name}</h3>
      <p>${engine.description}</p>
    </button>`).join("");
  engineGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".engine-card");
    if (!card) return;
    renderDetail(data.engines.find((engine) => engine.id === card.dataset.id));
  });
  renderDetail(data.engines.find((engine) => engine.id === "07"));
}

async function openControlPlane() {
  try {
    const data = await api("/api/system/blueprint");
    loginView.classList.add("hidden");
    controlView.classList.remove("hidden");
    renderBlueprint(data);
  } catch {
    token = null;
    sessionStorage.removeItem("fable5_token");
    loginView.classList.remove("hidden");
    controlView.classList.add("hidden");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  try {
    const result = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.querySelector("#email").value,
        password: document.querySelector("#password").value
      })
    });
    token = result.token;
    sessionStorage.setItem("fable5_token", token);
    await openControlPlane();
  } catch (error) {
    loginError.textContent = `REFUSED — ${error.message}`;
  }
});

logout.addEventListener("click", () => {
  sessionStorage.removeItem("fable5_token");
  location.reload();
});

if (token) openControlPlane();
