// api/admin/[name].js
// Endpoint unificat pentru rutele de administrare: downloads, ideas, reports, subscriptions.
// Consolidat intr-un singur Serverless Function (ruta dinamica [name]) ca sa
// respecte limita de 12 functii de pe planul Hobby. Comportamentul fiecarei
// rute (metode acceptate, verificarea requireAdmin, coduri 401/403/405,
// validarile de rol/abonament) ramane neschimbat fata de fisierele separate
// pe care le inlocuieste (downloads.js, ideas.js, reports.js, subscriptions.js).
//
// handleDownloads citeste acum evidenta din Supabase (public.report_downloads,
// vezi supabase/migrations/202607230001_report_downloads.sql), nu din vechiul
// jurnal Redis (api/_lib/store.js - lasat neschimbat, datele vechi raman acolo,
// pur si simplu nu mai sunt citite de aceasta ruta).
//
// Rutele portfolios / portfolio-positions / portfolio-transactions /
// portfolio-dividends / portfolio-performance / fx-rates (adaugate pentru
// mutarea portofoliilor US/EU in Cabinet) urmeaza acelasi tipar CRUD ca
// handleIdeas: GET listeaza tot (inclusiv nepublicat, pentru admin), POST
// creeaza, PATCH actualizeaza dupa id, DELETE sterge dupa id (query sau body).
// Toate folosesc access.client (legat de tokenul admin-ului) - nu service_role -
// astfel incat politicile *_admin_all din
// supabase/migrations/202607290001_member_portfolios.sql raman ultimul strat
// de control, nu doar requireAdmin() din cod.

import { requireAdmin } from '../_lib/require-admin.js';
import { getSupabaseAdmin } from '../_lib/supabase.js';
import { listSubscribersForAdmin } from '../_lib/newsletter.js';

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

const REPORT_LANGS = ['ro', 'en', 'ru', 'uk', 'pl'];
const VALID_STATUS = ['inactive', 'active', 'cancelled', 'past_due'];
const VALID_ROLE = ['free', 'member', 'admin'];

export default async function handler(req, res) {
  const { name } = req.query;

  if (name === 'downloads') return handleDownloads(req, res);
  if (name === 'ideas') return handleIdeas(req, res);
  if (name === 'reports') return handleReports(req, res);
  if (name === 'subscriptions') return handleSubscriptions(req, res);
  if (name === 'newsletter') return handleNewsletter(req, res);
  if (name === 'portfolios') return handleCrudTable(req, res, {
    table: 'portfolios',
    requiredFields: ['code', 'name', 'base_currency'],
    validate: (body) => {
      if (!['US', 'EU'].includes(body.code)) return 'code trebuie sa fie US sau EU';
      if (!['GBP', 'EUR', 'USD'].includes(body.base_currency)) return 'base_currency invalida';
      return null;
    },
    order: { column: 'code', ascending: true }
  });
  if (name === 'portfolio-positions') return handleCrudTable(req, res, {
    table: 'portfolio_positions',
    requiredFields: ['portfolio_id', 'ticker', 'name', 'instrument_currency'],
    validate: (body) => {
      if (!['GBP', 'EUR', 'USD', 'CHF'].includes(body.instrument_currency)) return 'instrument_currency invalida';
      return null;
    },
    order: { column: 'sort_order', ascending: true }
  });
  if (name === 'portfolio-transactions') return handleCrudTable(req, res, {
    table: 'portfolio_transactions',
    requiredFields: ['portfolio_id', 'type', 'amount', 'currency'],
    validate: (body) => {
      if (!['BUY', 'SELL', 'FEE', 'DEPOSIT', 'WITHDRAWAL'].includes(body.type)) return 'type invalid';
      if (!['GBP', 'EUR', 'USD', 'CHF'].includes(body.currency)) return 'currency invalida';
      return null;
    },
    order: { column: 'executed_at', ascending: false }
  });
  if (name === 'portfolio-dividends') return handleCrudTable(req, res, {
    table: 'portfolio_dividends',
    requiredFields: ['portfolio_id', 'ticker', 'amount', 'currency', 'pay_date'],
    validate: (body) => {
      if (!['GBP', 'EUR', 'USD', 'CHF'].includes(body.currency)) return 'currency invalida';
      return null;
    },
    order: { column: 'pay_date', ascending: false }
  });
  if (name === 'portfolio-performance') return handleCrudTable(req, res, {
    table: 'portfolio_performance_history',
    requiredFields: ['portfolio_id', 'as_of_date', 'nav_value', 'capital_contributed', 'currency'],
    validate: (body) => {
      if (!['GBP', 'EUR', 'USD'].includes(body.currency)) return 'currency invalida';
      return null;
    },
    order: { column: 'as_of_date', ascending: true }
  });
  if (name === 'fx-rates') return handleCrudTable(req, res, {
    table: 'fx_rates',
    requiredFields: ['base_currency', 'quote_currency', 'rate'],
    validate: (body) => {
      if (!['GBP', 'EUR', 'USD', 'CHF'].includes(body.base_currency)) return 'base_currency invalida';
      if (!['GBP', 'EUR', 'USD', 'CHF'].includes(body.quote_currency)) return 'quote_currency invalida';
      return null;
    },
    order: { column: 'as_of_date', ascending: false }
  });

  return res.status(404).json({ error: 'Not found' });
}

// Handler CRUD generic, folosit de toate rutele noi legate de portofolii -
// evita 6 copii aproape identice ale tiparului deja folosit de handleIdeas.
// Fiecare tabela isi ramane complet izolata (RLS pe tabela reala din Postgres,
// nu doar filtrare in cod); acest handler doar evita duplicarea codului de
// rutare/validare de baza.
async function handleCrudTable(req, res, opts) {
  const access = await requireAdmin(req, res);
  if (!access) return;

  try {
    if (req.method === 'GET') {
      let query = access.client.from(opts.table).select('*');
      if (req.query.portfolio_id) query = query.eq('portfolio_id', req.query.portfolio_id);
      query = query.order(opts.order.column, { ascending: opts.order.ascending });
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, rows: data || [] });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid request body' });
      }
    }
    body = body || {};

    if (req.method === 'POST') {
      const missing = opts.requiredFields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
      if (missing.length) {
        return res.status(400).json({ error: 'Campuri obligatorii lipsa: ' + missing.join(', ') });
      }
      const validationError = opts.validate ? opts.validate(body) : null;
      if (validationError) return res.status(400).json({ error: validationError });

      const insertBody = { ...body };
      delete insertBody.id;
      const { data, error } = await access.client.from(opts.table).insert(insertBody).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, row: data });
    }

    if (req.method === 'PATCH') {
      const { id, ...patch } = body;
      if (!id) return res.status(400).json({ error: 'ID lipsa' });
      if (opts.validate) {
        const validationError = opts.validate({ ...patch });
        if (validationError && Object.keys(patch).some((k) => opts.requiredFields.includes(k))) {
          return res.status(400).json({ error: validationError });
        }
      }
      if ('updated_at' in patch || opts.table === 'portfolios' || opts.table === 'portfolio_positions') {
        patch.updated_at = new Date().toISOString();
      }
      const { data, error } = await access.client.from(opts.table).update(patch).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, row: data });
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query.id === 'string' ? req.query.id : body.id;
      if (!id) return res.status(400).json({ error: 'ID lipsa' });
      const { error } = await access.client.from(opts.table).delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}

async function handleDownloads(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const access = await requireAdmin(req, res);
  if (!access) return;

  try {
    // Citire prin clientul cu tokenul admin-ului (RLS activ) - vizibilitatea
    // randurilor e garantata de policy-ul report_downloads_admin_select,
    // care foloseste public.is_admin(). count:'exact' da totalul real din
    // tabel, distinct de limita de 1000 randuri returnate efectiv.
    const { data, error, count } = await access.client
      .from('report_downloads')
      .select('id, user_id, member_id, lang, downloaded_at, reports(title, report_date)', { count: 'exact' })
      .order('downloaded_at', { ascending: false })
      .limit(1000);

    if (error) return res.status(500).json({ error: error.message });

    const rows = data || [];

    // Emailul nu poate fi obtinut prin embedding pe access.client, pentru ca
    // policy-urile actuale pe public.profiles permit fiecarui cont sa-si
    // vada doar propriul rand (profiles_select_own) - nu exista o policy
    // "admin vede toate profilurile". Facem deci o cautare separata, doar
    // pentru afisare, cu clientul cu service role (ruta e deja gardata de
    // requireAdmin mai sus).
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    let emailByUserId = {};
    if (userIds.length) {
      const admin = getSupabaseAdmin();
      const { data: profs, error: profErr } = await admin
        .from('profiles')
        .select('id, email')
        .in('id', userIds);
      if (!profErr && profs) {
        profs.forEach((p) => { emailByUserId[p.id] = p.email; });
      }
    }

    const downloads = rows.map((r) => ({
      email: r.user_id ? (emailByUserId[r.user_id] || null) : null,
      memberId: r.member_id,
      reportTitle: r.reports ? r.reports.title : null,
      reportDate: r.reports ? r.reports.report_date : null,
      lang: r.lang,
      downloadedAt: r.downloaded_at
    }));

    return res.status(200).json({
      success: true,
      downloads,
      total: typeof count === 'number' ? count : downloads.length
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}

async function handleIdeas(req, res) {
  const access = await requireAdmin(req, res);
  if (!access) return;

  try {
    if (req.method === 'GET') {
      const { data, error } = await access.client
        .from('trading_ideas')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, ideas: data || [] });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid request body' });
      }
    }
    body = body || {};

    if (req.method === 'POST') {
      const { ticker, side, entry, stop_loss, take_profit, risk_text, note, published } = body;
      if (!ticker || !side || !entry || !stop_loss || !take_profit) {
        return res.status(400).json({ error: 'Campuri obligatorii lipsa (ticker, side, entry, stop_loss, take_profit)' });
      }
      if (side !== 'BUY' && side !== 'SELL') {
        return res.status(400).json({ error: 'side trebuie sa fie BUY sau SELL' });
      }
      const { data, error } = await access.client
        .from('trading_ideas')
        .insert({
          ticker,
          side,
          entry,
          stop_loss,
          take_profit,
          risk_text: risk_text || null,
          note: note || null,
          published: !!published
        })
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, idea: data });
    }

    if (req.method === 'PATCH') {
      const { id, ...patch } = body;
      if (!id) return res.status(400).json({ error: 'ID lipsa' });
      patch.updated_at = new Date().toISOString();
      const { data, error } = await access.client
        .from('trading_ideas')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, idea: data });
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query.id === 'string' ? req.query.id : body.id;
      if (!id) return res.status(400).json({ error: 'ID lipsa' });
      const { error } = await access.client.from('trading_ideas').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}

async function handleReports(req, res) {
  const access = await requireAdmin(req, res);
  if (!access) return;

  try {
    if (req.method === 'GET') {
      const { data, error } = await access.client
        .from('reports')
        .select('*')
        .order('report_date', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, reports: data || [] });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid request body' });
      }
    }
    body = body || {};

    if (req.method === 'POST') {
      const { title, report_date, lang, fileBase64, fileName, published } = body;
      if (!title || !report_date || !lang || !fileBase64 || !fileName) {
        return res.status(400).json({ error: 'Campuri obligatorii lipsa (title, report_date, lang, fileBase64, fileName)' });
      }
      if (!REPORT_LANGS.includes(lang)) {
        return res.status(400).json({ error: 'Limba necunoscuta' });
      }

      const admin = getSupabaseAdmin();
      const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${report_date}/${lang}/${Date.now()}-${safeName}`;

      let buffer;
      try {
        buffer = Buffer.from(fileBase64, 'base64');
      } catch (e) {
        return res.status(400).json({ error: 'Fisier invalid (base64)' });
      }

      const { error: uploadErr } = await admin
        .storage
        .from('reports-private')
        .upload(filePath, buffer, { contentType: 'application/pdf', upsert: false });
      if (uploadErr) {
        return res.status(500).json({ error: 'Upload esuat: ' + uploadErr.message });
      }

      const { data, error } = await access.client
        .from('reports')
        .insert({ title, report_date, lang, file_path: filePath, published: !!published })
        .select()
        .single();
      if (error) {
        await admin.storage.from('reports-private').remove([filePath]);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, report: data });
    }

    if (req.method === 'PATCH') {
      const { id, ...patch } = body;
      if (!id) return res.status(400).json({ error: 'ID lipsa' });
      delete patch.file_path;
      delete patch.fileBase64;
      delete patch.fileName;
      patch.updated_at = new Date().toISOString();
      const { data, error } = await access.client
        .from('reports')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, report: data });
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query.id === 'string' ? req.query.id : body.id;
      if (!id) return res.status(400).json({ error: 'ID lipsa' });

      const { data: existing } = await access.client.from('reports').select('file_path').eq('id', id).maybeSingle();
      const { error } = await access.client.from('reports').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });

      if (existing && existing.file_path) {
        const admin = getSupabaseAdmin();
        await admin.storage.from('reports-private').remove([existing.file_path]);
      }
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}

async function handleSubscriptions(req, res) {
  const access = await requireAdmin(req, res);
  if (!access) return;

  // De aici incolo folosim exclusiv clientul cu service role (bypass RLS),
  // niciodata access.client (tokenul admin-ului): policy-ul profiles_select_own
  // permite fiecarui cont sa vada/modifice doar propriul rand din profiles, deci
  // access.client nu poate lista sau actualiza alti utilizatori. Accesul la
  // aceasta ruta e deja garantat exclusiv pentru admini de requireAdmin mai sus,
  // deci folosirea service role e sigura si necesara pentru operatiunile
  // administrative de mai jos (nu e expusa niciodata catre client).
  const admin = getSupabaseAdmin();

  try {
    if (req.method === 'GET') {
      const { data: profiles, error: pErr } = await admin
        .from('profiles')
        .select('id, email, member_id, role, created_at')
        .order('created_at', { ascending: false });
      if (pErr) {
        // Jurnalizare controlata, doar campurile de diagnostic ale erorii
        // Postgres/PostgREST - niciodata tokenul, cheia, headerele, obiectul
        // client sau date personale (email etc.) si niciodata raspunsul
        // brut nefiltrat.
        console.error('[admin/subscriptions] eroare citire profiles:', {
          message: pErr.message,
          code: pErr.code,
          details: pErr.details,
          hint: pErr.hint,
          status: pErr.status
        });
        return res.status(500).json({ error: pErr.message });
      }

      const { data: subs, error: sErr } = await admin
        .from('subscriptions')
        .select('user_id, status, expires_at, provider_customer_id');
      if (sErr) {
        console.error('[admin/subscriptions] eroare citire subscriptions:', {
          message: sErr.message,
          code: sErr.code,
          details: sErr.details,
          hint: sErr.hint,
          status: sErr.status
        });
        return res.status(500).json({ error: sErr.message });
      }

      const subsByUser = {};
      (subs || []).forEach((s) => {
        subsByUser[s.user_id] = s;
      });

      const users = (profiles || []).map((p) => ({ ...p, subscription: subsByUser[p.id] || null }));
      return res.status(200).json({ success: true, users });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid request body' });
      }
    }
    body = body || {};

    if (req.method === 'PATCH') {
      const { userId, status, expiresAt, role } = body;
      if (!userId) return res.status(400).json({ error: 'ID utilizator lipsa' });

      if (status !== undefined && !VALID_STATUS.includes(status)) {
        return res.status(400).json({ error: 'Status invalid' });
      }
      if (role !== undefined && !VALID_ROLE.includes(role)) {
        return res.status(400).json({ error: 'Rol invalid' });
      }

      if (status !== undefined || expiresAt !== undefined) {
        const patch = { updated_at: new Date().toISOString() };
        if (status !== undefined) patch.status = status;
        if (expiresAt !== undefined) patch.expires_at = expiresAt;
        const { error } = await admin.from('subscriptions').update(patch).eq('user_id', userId);
        if (error) return res.status(500).json({ error: error.message });
      }

      if (role !== undefined) {
        const { error } = await admin
          .from('profiles')
          .update({ role, updated_at: new Date().toISOString() })
          .eq('id', userId);
        if (error) return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}

// Rubrica "Abonati" - lista PERMANENTA de abonati la notificari prin email
// (rapoarte/update-uri), distincta de abonamentul premium (handleSubscriptions
// de mai sus, rolurile free/member/admin). Doar citire (GET) - niciun admin nu
// poate modifica manual acest tabel din aplicatie. Foloseste exclusiv
// getSupabaseAdmin() (service_role, vezi api/_lib/newsletter.js) pentru ca
// public.newsletter_subscribers nu acorda niciun privilegiu SQL sau RLS
// rolului authenticated - access.client (tokenul admin-ului) nu ar putea citi
// nimic din acest tabel. requireAdmin() ramane insa singura poarta care
// decide DACA cererea are voie sa ajunga aici.
async function handleNewsletter(req, res) {
  const access = await requireAdmin(req, res);
  if (!access) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const subscribers = await listSubscribersForAdmin();
    return res.status(200).json({ success: true, subscribers });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
