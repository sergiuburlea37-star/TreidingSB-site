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

import { requireAdmin } from '../_lib/require-admin.js';
import { getSupabaseAdmin } from '../_lib/supabase.js';

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

  return res.status(404).json({ error: 'Not found' });
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

  try {
    if (req.method === 'GET') {
      const { data: profiles, error: pErr } = await access.client
        .from('profiles')
        .select('id, email, member_id, role, created_at')
        .order('created_at', { ascending: false });
      if (pErr) return res.status(500).json({ error: pErr.message });

      const { data: subs, error: sErr } = await access.client
        .from('subscriptions')
        .select('user_id, status, expires_at, provider_customer_id');
      if (sErr) return res.status(500).json({ error: sErr.message });

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
        const { error } = await access.client.from('subscriptions').update(patch).eq('user_id', userId);
        if (error) return res.status(500).json({ error: error.message });
      }

      if (role !== undefined) {
        const admin = getSupabaseAdmin();
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
