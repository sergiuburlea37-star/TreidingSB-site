// api/admin/reports.js
// CRUD pentru rapoarte, doar pentru admin. La creare, PDF-ul e incarcat direct
// in bucket-ul privat Supabase Storage "reports-private" (nu mai ajunge
// niciodata intr-un loc public) - clientul trimite fisierul ca base64 in body.
// GET    -> toate rapoartele (inclusiv nepublicate)
// POST   -> { title, report_date, lang, fileBase64, fileName, published } - creeaza raport + urca fisierul
// PATCH  -> { id, ...campuri de modificat, fara file_path }
// DELETE -> ?id=... sau { id } in body - sterge si randul si fisierul din storage

import { requireAdmin } from '../_lib/require-admin.js';
import { getSupabaseAdmin } from '../_lib/supabase.js';

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

const REPORT_LANGS = ['ro', 'en', 'ru', 'uk', 'pl'];

export default async function handler(req, res) {
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
