// tests/auth-router.test.mjs
//
// Teste pentru api/auth/[action].js, endpoint-ul unificat care a inlocuit
// api/auth-login.js, api/auth-signup.js, api/auth-me.js,
// api/auth-forgot-password.js si api/auth-reset-password.js (consolidare
// facuta ca sa scada numarul de Serverless Functions de pe planul Vercel
// Hobby, de la 13 la 9).
//
// Acopera doar cazurile care NU au nevoie de Supabase / Upstash Redis reale
// (fara acestea configurate in mediu, handler-ele ar esua cu 500 la orice
// pas care le atinge efectiv) - exact rutarea pe `action`, verificarile de
// metoda HTTP (cu acelasi header `Allow` ca fisierele vechi) si validarile
// de input care raspund inainte de orice apel extern. Comportamentul cu
// Supabase/Redis reale ramane acoperit manual / de account-portfolios.auth.test.mjs
// (acelasi tipar: teste live, cu BASE_URL, pentru partea care are nevoie de
// backend real).
//
// Rulare: node --test tests/auth-router.test.mjs

import assert from "node:assert/strict";
import test from "node:test";

import handler from "../api/auth/[action].js";

function makeReq({ method = "GET", action, headers = {}, body } = {}) {
  return {
    method,
    query: { action },
    headers,
    body,
  };
}

function makeRes() {
  const res = {
    statusCode: null,
    headers: {},
    jsonBody: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    json(payload) {
      this.jsonBody = payload;
      return this;
    },
  };
  return res;
}

// ---------------------------------------------------------------------------
// Rutare: actiune necunoscuta -> 404
// ---------------------------------------------------------------------------

test("actiune necunoscuta -> 404", async () => {
  const req = makeReq({ method: "GET", action: "does-not-exist" });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.jsonBody, { error: "Not found" });
});

test("actiune lipsa (undefined) -> 404", async () => {
  const req = makeReq({ method: "POST", action: undefined });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 404);
});

// ---------------------------------------------------------------------------
// login (POST) - metoda gresita pastreaza exact comportamentul vechi:
// 405 + header Allow: POST
// ---------------------------------------------------------------------------

test("login: GET in loc de POST -> 405, Allow: POST", async () => {
  const req = makeReq({ method: "GET", action: "login" });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
  assert.deepEqual(res.jsonBody, { error: "Method not allowed" });
});

test("login: email/parola lipsa -> 400", async () => {
  const req = makeReq({ method: "POST", action: "login", body: { email: "", password: "" } });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.jsonBody, { error: "Email si parola necesare" });
});

test("login: body JSON invalid (string neparsabil) -> 400", async () => {
  const req = makeReq({ method: "POST", action: "login", body: "{not json" });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.jsonBody, { error: "Invalid request body" });
});

// ---------------------------------------------------------------------------
// signup (POST)
// ---------------------------------------------------------------------------

test("signup: GET in loc de POST -> 405, Allow: POST", async () => {
  const req = makeReq({ method: "GET", action: "signup" });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
});

test("signup: email invalid -> 400", async () => {
  const req = makeReq({ method: "POST", action: "signup", body: { email: "not-an-email", password: "parola-lunga" } });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.jsonBody, { error: "Adresa de email invalida" });
});

test("signup: parola sub 8 caractere -> 400", async () => {
  const req = makeReq({ method: "POST", action: "signup", body: { email: "test@example.com", password: "scurt" } });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.jsonBody, { error: "Parola trebuie sa aiba minim 8 caractere" });
});

// ---------------------------------------------------------------------------
// me (GET) - fara token, getAccessInfo('') se opreste inainte de orice
// apel Supabase (vezi api/_lib/access.js: `if (!token) return { authenticated: false }`)
// ---------------------------------------------------------------------------

test("me: POST in loc de GET -> 405, Allow: GET", async () => {
  const req = makeReq({ method: "POST", action: "me" });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "GET");
});

test("me: fara header Authorization -> 401", async () => {
  const req = makeReq({ method: "GET", action: "me", headers: {} });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.jsonBody, { error: "Sesiune invalida sau expirata" });
});

test("me: header Authorization fara Bearer -> 401 (tokenul e tratat ca gol)", async () => {
  const req = makeReq({ method: "GET", action: "me", headers: { authorization: "Basic xyz" } });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 401);
});

// ---------------------------------------------------------------------------
// forgot-password (POST)
// ---------------------------------------------------------------------------

test("forgot-password: GET in loc de POST -> 405, Allow: POST", async () => {
  const req = makeReq({ method: "GET", action: "forgot-password" });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
});

test("forgot-password: email invalid -> 400", async () => {
  const req = makeReq({ method: "POST", action: "forgot-password", body: { email: "not-an-email" } });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.jsonBody, { error: "Adresa de email invalida" });
});

// ---------------------------------------------------------------------------
// reset-password (POST)
// ---------------------------------------------------------------------------

test("reset-password: GET in loc de POST -> 405, Allow: POST", async () => {
  const req = makeReq({ method: "GET", action: "reset-password" });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
});

test("reset-password: token lipsa -> 400", async () => {
  const req = makeReq({ method: "POST", action: "reset-password", body: { token: "", password: "parola-lunga" } });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.jsonBody, { error: "Link invalid sau expirat" });
});

test("reset-password: parola sub 8 caractere -> 400", async () => {
  const req = makeReq({ method: "POST", action: "reset-password", body: { token: "abc123", password: "scurt" } });
  const res = makeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.jsonBody, { error: "Parola trebuie sa aiba minim 8 caractere" });
});

// ---------------------------------------------------------------------------
// Sanitate generala: fiecare din cele 5 actiuni valide raspunde diferit de
// "Not found" (adica rutarea chiar ajunge la handler-ul dedicat, nu cade
// prin fallback-ul de 404) atunci cand e apelata cu metoda corecta.
// ---------------------------------------------------------------------------

test("nu exista regresie de rutare: fiecare actiune valida e distincta de 404", async () => {
  const cases = [
    { action: "login", method: "POST", body: { email: "", password: "" } },
    { action: "signup", method: "POST", body: { email: "bad", password: "x" } },
    { action: "me", method: "GET", headers: {} },
    { action: "forgot-password", method: "POST", body: { email: "bad" } },
    { action: "reset-password", method: "POST", body: { token: "", password: "x" } },
  ];

  for (const c of cases) {
    const req = makeReq(c);
    const res = makeRes();
    await handler(req, res);
    assert.notEqual(res.statusCode, 404, `actiunea "${c.action}" nu ar trebui sa cada pe 404`);
    assert.notEqual(res.jsonBody && res.jsonBody.error, "Not found", `actiunea "${c.action}" nu ar trebui sa raspunda cu "Not found"`);
  }
});
