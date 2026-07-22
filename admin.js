var ADMIN_TOKEN_KEY = "tsb_session_token";

function adminSetMessage(text, type) {
  var el = document.getElementById("adminMessage");
  el.textContent = text || "";
  el.classList.remove("is-error", "is-success");
  if (type) el.classList.add(type === "error" ? "is-error" : "is-success");
}

function adminRenderTable(downloads) {
  var loginBox = document.getElementById("adminLoginBox");
  var tableBox = document.getElementById("adminTableBox");
  var body = document.getElementById("adminTableBody");
  var summary = document.getElementById("adminSummary");
  loginBox.hidden = true;
  tableBox.hidden = false;

if (!downloads.length) {
  summary.textContent = "Nicio descarcare inregistrata inca.";
  body.innerHTML = "";
  return;
}

summary.textContent = downloads.length + " descarcari inregistrate.";
  body.innerHTML = downloads.map(function (d) {
    var date = d.timestamp ? new Date(d.timestamp).toLocaleString("ro-RO") : "-";
    return "<tr><td>" + (d.email || "-") + "</td><td>" + (d.memberId || "-") + "</td><td>" + date + "</td><td>" + (d.reportDate || "-") + "</td><td>" + (d.lang || "-").toUpperCase() + "</td></tr>";
  }).join("");
}

function adminLoadDownloads(token) {
  fetch("/api/admin/downloads", { headers: { Authorization: "Bearer " + token } })
  .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
  .then(function (res) {
    if (res.ok && res.data && res.data.success) {
      adminRenderTable(res.data.downloads || []);
    } else if (res.status === 403) {
      adminSetMessage("Acest cont nu are drepturi de administrator.", "error");
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    } else {
      adminSetMessage("Sesiune invalida. Te rugam sa te autentifici din nou.", "error");
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  })
  .catch(function () {
    adminSetMessage("A aparut o eroare de retea. Incearca din nou.", "error");
  });
}

document.getElementById("adminLoginForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var email = document.getElementById("adminEmail").value.trim();
  var password = document.getElementById("adminPassword").value;
  var button = document.getElementById("adminLoginButton");
  if (!email || !password) {
    adminSetMessage("Completeaza emailul si parola.", "error");
    return;
  }
  button.disabled = true;
  adminSetMessage("", null);
  fetch("/api/auth-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: password })
  })
  .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
  .then(function (res) {
    if (res.ok && res.data && res.data.success) {
      localStorage.setItem(ADMIN_TOKEN_KEY, res.data.token);
      adminLoadDownloads(res.data.token);
    } else {
      adminSetMessage("Email sau parola incorecta.", "error");
    }
  })
  .catch(function () {
    adminSetMessage("A aparut o eroare. Incearca din nou.", "error");
  })
  .finally(function () {
    button.disabled = false;
  });
});

(function initAdmin() {
  var token = null;
  try { token = localStorage.getItem(ADMIN_TOKEN_KEY); } catch (e) { }
  if (token) adminLoadDownloads(token);
})();
