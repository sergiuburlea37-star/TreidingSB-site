var ADMIN_TOKEN_KEY = "tsb_session_token";

function adminSetMessage(text, type) {
  var el = document.getElementById("adminMessage");
  el.textContent = text || "";
  el.classList.remove("is-error", "is-success");
  if (type) el.classList.add(type === "error" ? "is-error" : "is-success");
}

function adminSetFormMessage(elId, text, type) {
  var el = document.getElementById(elId);
  if (!el) return;
  el.textContent = text || "";
  el.classList.remove("is-error", "is-success");
  if (type) el.classList.add(type === "error" ? "is-error" : "is-success");
}

function adminAuthHeaders(token) {
  return { Authorization: "Bearer " + token, "Content-Type": "application/json" };
}

function adminGetToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

/* ==================== Descărcări (evidență Supabase) ====================
   O înregistrare = un URL semnat generat cu succes de server, nu neapărat un
   PDF descărcat efectiv de browser - de-aia etichetăm valoarea ca "descărcări
   inițiate", nu "descărcări confirmate". */

function adminRenderTable(downloads, total) {
  var tableBox = document.getElementById("adminTableBox");
  var body = document.getElementById("adminTableBody");
  var summary = document.getElementById("adminSummary");
  tableBox.hidden = false;

  var count = typeof total === "number" ? total : downloads.length;

  if (!downloads.length) {
    summary.textContent = "Nicio descărcare inițiată încă.";
    body.innerHTML = "";
    return;
  }

  var summaryText = count + " descărcări inițiate.";
  if (downloads.length < count) {
    summaryText += " (se afișează cele mai recente " + downloads.length + ")";
  }
  summary.textContent = summaryText;

  body.innerHTML = downloads.map(function (d) {
    var date = d.downloadedAt ? new Date(d.downloadedAt).toLocaleString("ro-RO") : "-";
    var report = d.reportTitle || d.reportDate || "-";
    return "<tr><td>" + (d.email || "-") + "</td><td>" + (d.memberId || "-") + "</td><td>" + date + "</td><td>" + report + "</td><td>" + (d.lang || "-").toUpperCase() + "</td></tr>";
  }).join("");
}

function adminLoadDownloads(token) {
  fetch("/api/admin/downloads", { headers: { Authorization: "Bearer " + token } })
    .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
    .then(function (res) {
      if (res.ok && res.data && res.data.success) {
        adminRenderTable(res.data.downloads || [], res.data.total);
      } else if (res.status === 403) {
        adminSetMessage("Acest cont nu are drepturi de administrator.", "error");
        localStorage.removeItem(ADMIN_TOKEN_KEY);
      } else {
        adminSetMessage("Sesiune invalidă. Te rugăm să te autentifici din nou.", "error");
        localStorage.removeItem(ADMIN_TOKEN_KEY);
      }
    })
    .catch(function () {
      adminSetMessage("A apărut o eroare de rețea. Încearcă din nou.", "error");
    });
}

/* ==================== Idei de tranzacționare ==================== */

var ideaEditingId = null;

function adminRenderIdeas(ideas) {
  var body = document.getElementById("ideasTableBody");
  if (!ideas.length) {
    body.innerHTML = "<tr><td colspan=\"7\" class=\"admin-empty\">Nicio idee încă.</td></tr>";
    return;
  }
  body.innerHTML = ideas.map(function (idea) {
    return "<tr>" +
      "<td>" + (idea.ticker || "-") + "</td>" +
      "<td>" + (idea.side || "-") + "</td>" +
      "<td>" + (idea.entry || "-") + "</td>" +
      "<td>" + (idea.stop_loss || "-") + "</td>" +
      "<td>" + (idea.take_profit || "-") + "</td>" +
      "<td>" + (idea.published ? "Da" : "Nu") + "</td>" +
      "<td class=\"admin-row-actions\">" +
        "<button type=\"button\" class=\"admin-btn small outline\" data-edit-idea=\"" + idea.id + "\">Editează</button>" +
        "<button type=\"button\" class=\"admin-btn small outline\" data-delete-idea=\"" + idea.id + "\">Șterge</button>" +
      "</td>" +
    "</tr>";
  }).join("");

  Array.prototype.forEach.call(body.querySelectorAll("[data-edit-idea]"), function (btn) {
    btn.addEventListener("click", function () {
      var idea = ideas.filter(function (i) { return String(i.id) === btn.getAttribute("data-edit-idea"); })[0];
      if (idea) adminFillIdeaForm(idea);
    });
  });
  Array.prototype.forEach.call(body.querySelectorAll("[data-delete-idea]"), function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-delete-idea");
      if (!window.confirm("Ștergi definitiv această idee?")) return;
      adminDeleteIdea(id);
    });
  });
}

function adminFillIdeaForm(idea) {
  ideaEditingId = idea.id;
  document.getElementById("ideaId").value = idea.id;
  document.getElementById("ideaTicker").value = idea.ticker || "";
  document.getElementById("ideaSide").value = idea.side || "BUY";
  document.getElementById("ideaEntry").value = idea.entry || "";
  document.getElementById("ideaSl").value = idea.stop_loss || "";
  document.getElementById("ideaTp").value = idea.take_profit || "";
  document.getElementById("ideaRisk").value = idea.risk_text || "";
  document.getElementById("ideaNote").value = idea.note || "";
  document.getElementById("ideaPublished").checked = !!idea.published;
  document.getElementById("ideaFormTitle").textContent = "Editează idee";
  document.getElementById("ideaSubmitButton").textContent = "Salvează modificările";
  document.getElementById("ideaCancelEdit").hidden = false;
}

function adminResetIdeaForm() {
  ideaEditingId = null;
  document.getElementById("ideaForm").reset();
  document.getElementById("ideaId").value = "";
  document.getElementById("ideaFormTitle").textContent = "Idee nouă";
  document.getElementById("ideaSubmitButton").textContent = "Salvează idea";
  document.getElementById("ideaCancelEdit").hidden = true;
}

function adminLoadIdeas(token) {
  fetch("/api/admin/ideas", { headers: { Authorization: "Bearer " + token } })
    .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
    .then(function (res) {
      if (res.ok && res.data && res.data.success) {
        adminRenderIdeas(res.data.ideas || []);
      } else {
        adminSetFormMessage("ideaFormMessage", (res.data && res.data.error) || "Nu am putut încărca ideile.", "error");
      }
    })
    .catch(function () {
      adminSetFormMessage("ideaFormMessage", "A apărut o eroare de rețea.", "error");
    });
}

function adminDeleteIdea(id) {
  var token = adminGetToken();
  if (!token) return;
  fetch("/api/admin/ideas?id=" + encodeURIComponent(id), { method: "DELETE", headers: adminAuthHeaders(token) })
    .then(function (r) { return r.json(); })
    .then(function () { adminLoadIdeas(token); })
    .catch(function () { adminSetFormMessage("ideaFormMessage", "Ștergerea a eșuat.", "error"); });
}

function adminInitIdeasForm() {
  var form = document.getElementById("ideaForm");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var token = adminGetToken();
    if (!token) return;

    var payload = {
      ticker: document.getElementById("ideaTicker").value.trim(),
      side: document.getElementById("ideaSide").value,
      entry: document.getElementById("ideaEntry").value.trim(),
      stop_loss: document.getElementById("ideaSl").value.trim(),
      take_profit: document.getElementById("ideaTp").value.trim(),
      risk_text: document.getElementById("ideaRisk").value.trim(),
      note: document.getElementById("ideaNote").value.trim(),
      published: document.getElementById("ideaPublished").checked
    };

    var isEdit = !!ideaEditingId;
    if (isEdit) payload.id = ideaEditingId;

    fetch("/api/admin/ideas", {
      method: isEdit ? "PATCH" : "POST",
      headers: adminAuthHeaders(token),
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        if (res.ok && res.data && res.data.success) {
          adminSetFormMessage("ideaFormMessage", "Salvat.", "success");
          adminResetIdeaForm();
          adminLoadIdeas(token);
        } else {
          adminSetFormMessage("ideaFormMessage", (res.data && res.data.error) || "Salvarea a eșuat.", "error");
        }
      })
      .catch(function () {
        adminSetFormMessage("ideaFormMessage", "A apărut o eroare de rețea.", "error");
      });
  });

  document.getElementById("ideaCancelEdit").addEventListener("click", adminResetIdeaForm);
}

/* ==================== Rapoarte ==================== */

function adminRenderReports(reports) {
  var body = document.getElementById("reportsTableBody");
  if (!reports.length) {
    body.innerHTML = "<tr><td colspan=\"5\" class=\"admin-empty\">Niciun raport încă.</td></tr>";
    return;
  }
  body.innerHTML = reports.map(function (r) {
    return "<tr>" +
      "<td>" + (r.title || "-") + "</td>" +
      "<td>" + (r.report_date || "-") + "</td>" +
      "<td>" + (r.lang || "-").toUpperCase() + "</td>" +
      "<td>" + (r.published ? "Da" : "Nu") + "</td>" +
      "<td class=\"admin-row-actions\">" +
        "<button type=\"button\" class=\"admin-btn small outline\" data-toggle-report=\"" + r.id + "\" data-published=\"" + (r.published ? "1" : "0") + "\">" + (r.published ? "Dezactivează" : "Publică") + "</button>" +
        "<button type=\"button\" class=\"admin-btn small outline\" data-delete-report=\"" + r.id + "\">Șterge</button>" +
      "</td>" +
    "</tr>";
  }).join("");

  Array.prototype.forEach.call(body.querySelectorAll("[data-toggle-report]"), function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-toggle-report");
      var nowPublished = btn.getAttribute("data-published") === "1";
      adminToggleReportPublished(id, !nowPublished);
    });
  });
  Array.prototype.forEach.call(body.querySelectorAll("[data-delete-report]"), function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-delete-report");
      if (!window.confirm("Ștergi definitiv acest raport (inclusiv fișierul PDF)?")) return;
      adminDeleteReport(id);
    });
  });
}

function adminLoadReports(token) {
  fetch("/api/admin/reports", { headers: { Authorization: "Bearer " + token } })
    .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
    .then(function (res) {
      if (res.ok && res.data && res.data.success) {
        adminRenderReports(res.data.reports || []);
      } else {
        adminSetFormMessage("reportFormMessage", (res.data && res.data.error) || "Nu am putut încărca rapoartele.", "error");
      }
    })
    .catch(function () {
      adminSetFormMessage("reportFormMessage", "A apărut o eroare de rețea.", "error");
    });
}

function adminToggleReportPublished(id, published) {
  var token = adminGetToken();
  if (!token) return;
  fetch("/api/admin/reports", {
    method: "PATCH",
    headers: adminAuthHeaders(token),
    body: JSON.stringify({ id: id, published: published })
  })
    .then(function (r) { return r.json(); })
    .then(function () { adminLoadReports(token); })
    .catch(function () { adminSetFormMessage("reportFormMessage", "Actualizarea a eșuat.", "error"); });
}

function adminDeleteReport(id) {
  var token = adminGetToken();
  if (!token) return;
  fetch("/api/admin/reports?id=" + encodeURIComponent(id), { method: "DELETE", headers: adminAuthHeaders(token) })
    .then(function (r) { return r.json(); })
    .then(function () { adminLoadReports(token); })
    .catch(function () { adminSetFormMessage("reportFormMessage", "Ștergerea a eșuat.", "error"); });
}

function adminFileToBase64(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      var result = String(reader.result || "");
      var commaIndex = result.indexOf(",");
      resolve(commaIndex > -1 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = function () { reject(new Error("Nu am putut citi fișierul")); };
    reader.readAsDataURL(file);
  });
}

function adminInitReportsForm() {
  var form = document.getElementById("reportForm");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var token = adminGetToken();
    if (!token) return;

    var fileInput = document.getElementById("reportFile");
    var file = fileInput.files && fileInput.files[0];
    if (!file) {
      adminSetFormMessage("reportFormMessage", "Alege un fișier PDF.", "error");
      return;
    }

    var button = document.getElementById("reportSubmitButton");
    button.disabled = true;
    adminSetFormMessage("reportFormMessage", "Se încarcă...", null);

    adminFileToBase64(file).then(function (base64) {
      var payload = {
        title: document.getElementById("reportTitle").value.trim(),
        report_date: document.getElementById("reportDate").value,
        lang: document.getElementById("reportLang").value,
        published: document.getElementById("reportPublished").checked,
        fileBase64: base64,
        fileName: file.name
      };

      return fetch("/api/admin/reports", {
        method: "POST",
        headers: adminAuthHeaders(token),
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); });
    }).then(function (res) {
      if (res.ok && res.data && res.data.success) {
        adminSetFormMessage("reportFormMessage", "Raport încărcat.", "success");
        form.reset();
        adminLoadReports(token);
      } else {
        adminSetFormMessage("reportFormMessage", (res.data && res.data.error) || "Încărcarea a eșuat.", "error");
      }
    }).catch(function () {
      adminSetFormMessage("reportFormMessage", "A apărut o eroare de rețea.", "error");
    }).finally(function () {
      button.disabled = false;
    });
  });
}

/* ==================== Abonamente ==================== */

var SUB_STATUS_OPTIONS = ["inactive", "active", "cancelled", "past_due"];
var SUB_ROLE_OPTIONS = ["free", "member", "admin"];

function adminRenderSubs(users) {
  var body = document.getElementById("subsTableBody");
  if (!users.length) {
    body.innerHTML = "<tr><td colspan=\"6\" class=\"admin-empty\">Niciun utilizator încă.</td></tr>";
    return;
  }
  body.innerHTML = users.map(function (u) {
    var sub = u.subscription || {};
    var roleOptions = SUB_ROLE_OPTIONS.map(function (r) {
      return "<option value=\"" + r + "\"" + (u.role === r ? " selected" : "") + ">" + r + "</option>";
    }).join("");
    var statusOptions = SUB_STATUS_OPTIONS.map(function (s) {
      return "<option value=\"" + s + "\"" + (sub.status === s ? " selected" : "") + ">" + s + "</option>";
    }).join("");
    var expiresVal = sub.expires_at ? String(sub.expires_at).slice(0, 10) : "";

    return "<tr data-user-row=\"" + u.id + "\">" +
      "<td>" + (u.email || "-") + "</td>" +
      "<td>" + (u.member_id || "-") + "</td>" +
      "<td><select class=\"admin-inline-select\" data-role>" + roleOptions + "</select></td>" +
      "<td><select class=\"admin-inline-select\" data-status>" + statusOptions + "</select></td>" +
      "<td><input type=\"date\" class=\"admin-inline-input\" data-expires value=\"" + expiresVal + "\"></td>" +
      "<td><button type=\"button\" class=\"admin-btn small\" data-save-user=\"" + u.id + "\">Salvează</button></td>" +
    "</tr>";
  }).join("");

  Array.prototype.forEach.call(body.querySelectorAll("[data-save-user]"), function (btn) {
    btn.addEventListener("click", function () {
      var userId = btn.getAttribute("data-save-user");
      var row = body.querySelector("[data-user-row=\"" + userId + "\"]");
      if (!row) return;
      var role = row.querySelector("[data-role]").value;
      var status = row.querySelector("[data-status]").value;
      var expiresInput = row.querySelector("[data-expires]").value;
      var expiresAt = expiresInput ? new Date(expiresInput + "T23:59:59Z").toISOString() : null;
      adminSaveSub(userId, role, status, expiresAt);
    });
  });
}

function adminLoadSubs(token) {
  fetch("/api/admin/subscriptions", { headers: { Authorization: "Bearer " + token } })
    .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
    .then(function (res) {
      if (res.ok && res.data && res.data.success) {
        adminRenderSubs(res.data.users || []);
      }
    })
    .catch(function () {});
}

function adminSaveSub(userId, role, status, expiresAt) {
  var token = adminGetToken();
  if (!token) return;
  fetch("/api/admin/subscriptions", {
    method: "PATCH",
    headers: adminAuthHeaders(token),
    body: JSON.stringify({ userId: userId, role: role, status: status, expiresAt: expiresAt })
  })
    .then(function (r) { return r.json(); })
    .then(function () { adminLoadSubs(token); })
    .catch(function () {});
}

/* ==================== Abonati (notificari email) ====================
   Lista PERMANENTA de abonati la notificari prin email (rapoarte/update-uri),
   distincta de "Abonamente" (rolul premium free/member/admin) de mai sus -
   citita read-only din public.newsletter_subscribers prin
   /api/admin/newsletter. Nu se afiseaza niciodata hash-ul tokenului de
   dezabonare, doar coloanele necesare unei liste de vizualizare. */

function adminRenderNewsletter(subscribers) {
  var body = document.getElementById("newsletterTableBody");
  if (!subscribers.length) {
    body.innerHTML = "<tr><td colspan=\"5\" class=\"admin-empty\">Niciun abonat încă.</td></tr>";
    return;
  }
  body.innerHTML = subscribers.map(function (s) {
    var subscribedAt = s.subscribed_at ? new Date(s.subscribed_at).toLocaleString("ro-RO") : "-";
    var unsubscribedAt = s.unsubscribed_at ? new Date(s.unsubscribed_at).toLocaleString("ro-RO") : "-";
    return "<tr>" +
      "<td>" + (s.email || "-") + "</td>" +
      "<td>" + (s.lang || "-").toUpperCase() + "</td>" +
      "<td>" + (s.status || "-") + "</td>" +
      "<td>" + subscribedAt + "</td>" +
      "<td>" + unsubscribedAt + "</td>" +
    "</tr>";
  }).join("");
}

function adminLoadNewsletter(token) {
  fetch("/api/admin/newsletter", { headers: { Authorization: "Bearer " + token } })
    .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, status: r.status, data: data }; }); })
    .then(function (res) {
      if (res.ok && res.data && res.data.success) {
        adminRenderNewsletter(res.data.subscribers || []);
      } else if (res.status === 403) {
        adminSetMessage("Acest cont nu are drepturi de administrator.", "error");
        localStorage.removeItem(ADMIN_TOKEN_KEY);
      }
    })
    .catch(function () {});
}

/* ==================== Panou + taburi ==================== */


/* ==================== Portofolii (US/EU) ====================
   Sectiune generica de CRUD, reutilizata pentru cele 6 sub-resurse noi
   (portfolios, portfolio-positions, portfolio-transactions,
   portfolio-dividends, portfolio-performance, fx-rates), toate expuse prin
   acelasi api/admin/[name].js (handleCrudTable) - vezi acel fisier pt. detalii.
   Evita 6 copii aproape identice ale tiparului deja folosit mai sus pentru
   Idei/Rapoarte. */

var ADMIN_PORTFOLIO_ID_BY_CODE = {};

function adminLoadPortfolioIdMap(token, cb) {
  fetch("/api/admin/portfolios", { headers: { Authorization: "Bearer " + token } })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      ADMIN_PORTFOLIO_ID_BY_CODE = {};
      if (data && data.success) {
        (data.rows || []).forEach(function (p) { ADMIN_PORTFOLIO_ID_BY_CODE[p.code] = p.id; });
      }
      if (cb) cb();
    })
    .catch(function () { if (cb) cb(); });
}

function adminCodeForPortfolioId(id) {
  var codes = Object.keys(ADMIN_PORTFOLIO_ID_BY_CODE);
  for (var i = 0; i < codes.length; i++) {
    if (ADMIN_PORTFOLIO_ID_BY_CODE[codes[i]] === id) return codes[i];
  }
  return null;
}

function adminMakeCrudSection(opts) {
  var editingId = null;

  function readForm() {
    var payload = {};
    opts.fields.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (!el) return;
      var v;
      if (f.type === "checkbox") v = el.checked;
      else if (f.type === "number") v = el.value === "" ? null : Number(el.value);
      else v = el.value;
      payload[f.key] = v;
    });
    if (opts.portfolioCodeFieldId) {
      var codeEl = document.getElementById(opts.portfolioCodeFieldId);
      payload.portfolio_id = codeEl ? (ADMIN_PORTFOLIO_ID_BY_CODE[codeEl.value] || null) : null;
    }
    return payload;
  }

  function fillForm(row) {
    editingId = row.id;
    opts.fields.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (!el) return;
      var v = row[f.key];
      if (f.type === "checkbox") el.checked = !!v;
      else el.value = (v === null || v === undefined) ? "" : v;
    });
    if (opts.portfolioCodeFieldId && row.portfolio_id) {
      var code = adminCodeForPortfolioId(row.portfolio_id);
      var codeEl = document.getElementById(opts.portfolioCodeFieldId);
      if (code && codeEl) codeEl.value = code;
    }
    if (opts.idFieldId) {
      var idEl = document.getElementById(opts.idFieldId);
      if (idEl) idEl.value = row.id;
    }
    if (opts.cancelBtnId) {
      var cancelEl = document.getElementById(opts.cancelBtnId);
      if (cancelEl) cancelEl.hidden = false;
    }
  }

  function resetForm() {
    editingId = null;
    var form = document.getElementById(opts.formId);
    if (form) form.reset();
    if (opts.idFieldId) {
      var idEl = document.getElementById(opts.idFieldId);
      if (idEl) idEl.value = "";
    }
    if (opts.cancelBtnId) {
      var cancelEl = document.getElementById(opts.cancelBtnId);
      if (cancelEl) cancelEl.hidden = true;
    }
  }

  function render(rows) {
    var body = document.getElementById(opts.tableBodyId);
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = "<tr><td colspan=\"" + (opts.columns.length + 1) + "\" class=\"admin-empty\">Nicio înregistrare încă.</td></tr>";
      return;
    }
    body.innerHTML = rows.map(function (row) {
      var cells = opts.columns.map(function (c) {
        var val = row[c.key];
        if (c.key === "portfolio_id") val = adminCodeForPortfolioId(val) || "-";
        else if (c.format) val = c.format(val);
        return "<td>" + (val === null || val === undefined || val === "" ? "-" : val) + "</td>";
      }).join("");
      var actions = "<button type=\"button\" class=\"admin-btn small outline\" data-delete-row=\"" + row.id + "\">Șterge</button>";
      if (opts.allowEdit !== false) {
        actions = "<button type=\"button\" class=\"admin-btn small outline\" data-edit-row=\"" + row.id + "\">Editează</button>" + actions;
      }
      return "<tr>" + cells + "<td class=\"admin-row-actions\">" + actions + "</td></tr>";
    }).join("");

    if (opts.allowEdit !== false) {
      Array.prototype.forEach.call(body.querySelectorAll("[data-edit-row]"), function (btn) {
        btn.addEventListener("click", function () {
          var row = rows.filter(function (r) { return String(r.id) === btn.getAttribute("data-edit-row"); })[0];
          if (row) fillForm(row);
        });
      });
    }
    Array.prototype.forEach.call(body.querySelectorAll("[data-delete-row]"), function (btn) {
      btn.addEventListener("click", function () {
        if (!window.confirm("Ștergi definitiv această înregistrare?")) return;
        var token = adminGetToken();
        if (!token) return;
        fetch("/api/admin/" + opts.apiName + "?id=" + encodeURIComponent(btn.getAttribute("data-delete-row")), {
          method: "DELETE", headers: adminAuthHeaders(token)
        })
          .then(function (r) { return r.json(); })
          .then(function () { load(token); })
          .catch(function () { adminSetFormMessage(opts.formMessageId, "Ștergerea a eșuat.", "error"); });
      });
    });
  }

  function load(token) {
    fetch("/api/admin/" + opts.apiName, { headers: { Authorization: "Bearer " + token } })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        if (res.ok && res.data && res.data.success) render(res.data.rows || []);
        else adminSetFormMessage(opts.formMessageId, (res.data && res.data.error) || "Nu am putut încărca datele.", "error");
      })
      .catch(function () { adminSetFormMessage(opts.formMessageId, "A apărut o eroare de rețea.", "error"); });
  }

  function init() {
    var form = document.getElementById(opts.formId);
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var token = adminGetToken();
      if (!token) return;
      var payload = readForm();
      var isEdit = !!editingId;
      if (isEdit) payload.id = editingId;
      fetch("/api/admin/" + opts.apiName, {
        method: isEdit ? "PATCH" : "POST",
        headers: adminAuthHeaders(token),
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (res) {
          if (res.ok && res.data && res.data.success) {
            adminSetFormMessage(opts.formMessageId, "Salvat.", "success");
            resetForm();
            load(token);
          } else {
            adminSetFormMessage(opts.formMessageId, (res.data && res.data.error) || "Salvarea a eșuat.", "error");
          }
        })
        .catch(function () { adminSetFormMessage(opts.formMessageId, "A apărut o eroare de rețea.", "error"); });
    });
    if (opts.cancelBtnId) {
      var cancelEl = document.getElementById(opts.cancelBtnId);
      if (cancelEl) cancelEl.addEventListener("click", resetForm);
    }
  }

  return { load: load, init: init };
}

var adminPortfoliosSection = adminMakeCrudSection({
  apiName: "portfolios", formId: "portfolioForm", idFieldId: "portfolioId", cancelBtnId: "portfolioCancelEdit",
  formMessageId: "portfolioFormMessage", tableBodyId: "portfoliosTableBody",
  fields: [
    { id: "portfolioCode", key: "code" }, { id: "portfolioName", key: "name" },
    { id: "portfolioBaseCurrency", key: "base_currency" }, { id: "portfolioFoundedDate", key: "founded_date" },
    { id: "portfolioInitialCapital", key: "initial_capital", type: "number" },
    { id: "portfolioTargetReturn", key: "target_return_text" }, { id: "portfolioRiskLevel", key: "risk_level" },
    { id: "portfolioPublished", key: "published", type: "checkbox" }, { id: "portfolioDescription", key: "description" }
  ],
  columns: [
    { key: "code", label: "Cod" }, { key: "name" }, { key: "base_currency" },
    { key: "initial_capital" }, { key: "published", format: function (v) { return v ? "Da" : "Nu"; } }
  ]
});

var adminPositionsSection = adminMakeCrudSection({
  apiName: "portfolio-positions", formId: "positionForm", idFieldId: "positionId", cancelBtnId: "positionCancelEdit",
  formMessageId: "positionFormMessage", tableBodyId: "positionsTableBody", portfolioCodeFieldId: "positionPortfolioCode",
  fields: [
    { id: "positionTicker", key: "ticker" }, { id: "positionName", key: "name" },
    { id: "positionCategory", key: "category" }, { id: "positionSector", key: "sector_or_market" },
    { id: "positionCurrency", key: "instrument_currency" }, { id: "positionQuantity", key: "quantity", type: "number" },
    { id: "positionAvgPrice", key: "avg_price", type: "number" }, { id: "positionCurrentPrice", key: "current_price", type: "number" },
    { id: "positionRiskLevel", key: "risk_level" }, { id: "positionGroupLabel", key: "group_label" },
    { id: "positionSortOrder", key: "sort_order", type: "number" }, { id: "positionActive", key: "active", type: "checkbox" },
    // Etapa 4 (EODHD Live Delayed): mapare pret automat, per pozitie. Nicio
    // ruta noua nu e necesara - handleCrudTable din api/admin/[name].js
    // accepta orice camp existent pe portfolio_positions (vezi migrarea
    // 202608140001_add_provider_symbol_mapping.sql).
    { id: "positionProviderSymbol", key: "provider_symbol" },
    { id: "positionProviderMultiplier", key: "provider_price_multiplier", type: "number" }
  ],
  columns: [
    { key: "portfolio_id", label: "Portofoliu" }, { key: "ticker" }, { key: "quantity" },
    { key: "avg_price" }, { key: "current_price" }, { key: "provider_symbol", label: "Cod EODHD" },
    { key: "active", format: function (v) { return v ? "Da" : "Nu"; } }
  ]
});

var adminTransactionsSection = adminMakeCrudSection({
  apiName: "portfolio-transactions", formId: "transactionForm", idFieldId: "transactionId",
  formMessageId: "transactionFormMessage", tableBodyId: "transactionsTableBody", portfolioCodeFieldId: "transactionPortfolioCode",
  fields: [
    { id: "transactionType", key: "type" }, { id: "transactionTicker", key: "ticker" },
    { id: "transactionQuantity", key: "quantity", type: "number" }, { id: "transactionPrice", key: "price", type: "number" },
    { id: "transactionAmount", key: "amount", type: "number" }, { id: "transactionFee", key: "fee_amount", type: "number" },
    { id: "transactionCurrency", key: "currency" }, { id: "transactionExecutedAt", key: "executed_at" },
    { id: "transactionNote", key: "note" }
  ],
  columns: [
    { key: "portfolio_id", label: "Portofoliu" }, { key: "type" }, { key: "ticker" }, { key: "amount" }, { key: "executed_at" }
  ]
});

var adminDividendsSection = adminMakeCrudSection({
  apiName: "portfolio-dividends", formId: "dividendForm", idFieldId: "dividendId",
  formMessageId: "dividendFormMessage", tableBodyId: "dividendsTableBody", portfolioCodeFieldId: "dividendPortfolioCode",
  fields: [
    { id: "dividendTicker", key: "ticker" }, { id: "dividendAmount", key: "amount", type: "number" },
    { id: "dividendCurrency", key: "currency" }, { id: "dividendExDate", key: "ex_date" },
    { id: "dividendPayDate", key: "pay_date" }, { id: "dividendNote", key: "note" }
  ],
  columns: [{ key: "portfolio_id", label: "Portofoliu" }, { key: "ticker" }, { key: "amount" }, { key: "pay_date" }]
});

var adminPerformanceSection = adminMakeCrudSection({
  apiName: "portfolio-performance", formId: "performanceForm", idFieldId: "performanceId",
  formMessageId: "performanceFormMessage", tableBodyId: "performanceTableBody", portfolioCodeFieldId: "performancePortfolioCode",
  fields: [
    { id: "performanceAsOfDate", key: "as_of_date" }, { id: "performanceNav", key: "nav_value", type: "number" },
    { id: "performanceCapital", key: "capital_contributed", type: "number" },
    { id: "performanceReturnPct", key: "cumulative_return_pct", type: "number" }, { id: "performanceCurrency", key: "currency" }
  ],
  columns: [
    { key: "portfolio_id", label: "Portofoliu" }, { key: "as_of_date" }, { key: "nav_value" },
    { key: "capital_contributed" }, { key: "cumulative_return_pct" }
  ]
});

var adminFxRatesSection = adminMakeCrudSection({
  apiName: "fx-rates", formId: "fxRateForm", formMessageId: "fxRateFormMessage", tableBodyId: "fxRatesTableBody",
  allowEdit: false,
  fields: [
    { id: "fxBaseCurrency", key: "base_currency" }, { id: "fxQuoteCurrency", key: "quote_currency" },
    { id: "fxRateValue", key: "rate", type: "number" }, { id: "fxAsOfDate", key: "as_of_date" }
  ],
  columns: [{ key: "base_currency", label: "Din" }, { key: "quote_currency", label: "In" }, { key: "rate" }, { key: "as_of_date" }]
});

function adminLoadPortfolios(token) {
  adminLoadPortfolioIdMap(token, function () {
    adminPortfoliosSection.load(token);
    adminPositionsSection.load(token);
    adminTransactionsSection.load(token);
    adminDividendsSection.load(token);
    adminPerformanceSection.load(token);
    adminFxRatesSection.load(token);
  });
}

function adminInitPortfoliosForms() {
  adminPortfoliosSection.init();
  adminPositionsSection.init();
  adminTransactionsSection.init();
  adminDividendsSection.init();
  adminPerformanceSection.init();
  adminFxRatesSection.init();
}

function adminShowPanel(token) {
  var loginBox = document.getElementById("adminLoginBox");
  var tabs = document.getElementById("adminTabs");
  loginBox.hidden = true;
  tabs.hidden = false;
  adminLoadDownloads(token);
}

function adminSwitchTab(name) {
  var token = adminGetToken();
  Array.prototype.forEach.call(document.querySelectorAll(".admin-tab"), function (btn) {
    btn.classList.toggle("is-active", btn.getAttribute("data-tab") === name);
  });
  Array.prototype.forEach.call(document.querySelectorAll(".admin-panel"), function (panel) {
    panel.classList.remove("is-active");
  });
  var panel = document.getElementById("adminPanel" + name.charAt(0).toUpperCase() + name.slice(1));
  if (panel) panel.classList.add("is-active");

  if (!token) return;
  if (name === "downloads") adminLoadDownloads(token);
  else if (name === "ideas") adminLoadIdeas(token);
  else if (name === "reports") adminLoadReports(token);
  else if (name === "subs") adminLoadSubs(token);
  else if (name === "newsletter") adminLoadNewsletter(token);
  else if (name === "portfolios") adminLoadPortfolios(token);
}

function adminInitTabs() {
  Array.prototype.forEach.call(document.querySelectorAll(".admin-tab"), function (btn) {
    btn.addEventListener("click", function () {
      adminSwitchTab(btn.getAttribute("data-tab"));
    });
  });
}

document.getElementById("adminLoginForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var email = document.getElementById("adminEmail").value.trim();
  var password = document.getElementById("adminPassword").value;
  var button = document.getElementById("adminLoginButton");
  if (!email || !password) {
    adminSetMessage("Completează emailul și parola.", "error");
    return;
  }
  button.disabled = true;
  adminSetMessage("", null);
  fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email, password: password })
  })
    .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
    .then(function (res) {
      if (res.ok && res.data && res.data.success) {
        localStorage.setItem(ADMIN_TOKEN_KEY, res.data.token);
        adminShowPanel(res.data.token);
      } else {
        adminSetMessage("Email sau parolă incorectă.", "error");
      }
    })
    .catch(function () {
      adminSetMessage("A apărut o eroare. Încearcă din nou.", "error");
    })
    .finally(function () {
      button.disabled = false;
    });
});

adminInitTabs();
adminInitIdeasForm();
adminInitReportsForm();
adminInitPortfoliosForms();

(function initAdmin() {
  var token = null;
  try { token = localStorage.getItem(ADMIN_TOKEN_KEY); } catch (e) { /* ignore */ }
  if (token) adminShowPanel(token);
})();
