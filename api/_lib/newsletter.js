// api/_lib/newsletter.js
// Acces exclusiv server-side (service_role) la public.newsletter_subscribers
// - lista PERMANENTA de abonati la notificari prin email (rapoarte/update-uri).
// Distinct complet de abonamentul PREMIUM (public.subscriptions / rolurile
// free-member-admin) - acest modul nu atinge niciodata acele tabele.
//
// Tokenul de dezabonare este generat criptografic (crypto.randomBytes) si
// NICIODATA salvat in clar - doar hash-ul SHA-256 e persistat, exact ca
// tokenul de resetare parola din api/_lib/store.js. La fiecare email trimis
// unui abonat se emite un token NOU (rotatie) - vechiul link de dezabonare
// din emailurile anterioare devine astfel invalid, comportament asteptat si
// afisat corect de pagina de dezabonare ("link invalid sau expirat").

import crypto from 'crypto';
import { getSupabaseAdmin } from './supabase.js';

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function newRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

// Creeaza abonatul daca nu exista, sau il reactiveaza daca era dezabonat, si
// in ambele cazuri (plus cazul deja-activ) emite un token nou de dezabonare.
// Best-effort din perspectiva apelantului: orice eroare (Supabase indisponibil,
// configurare lipsa etc.) trebuie prinsa de apelant si NU trebuie sa opreasca
// trimiterea efectiva a emailului - vezi api/send-email.js.
export async function upsertSubscriberAndIssueToken({ email, lang }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('Email invalid pentru abonare.');

  const safeLang = ['ro', 'en', 'ru', 'uk', 'pl'].includes(lang) ? lang : 'ro';
  const rawToken = newRawToken();
  const tokenHash = hashToken(rawToken);
  const now = new Date().toISOString();

  const supabase = getSupabaseAdmin();

  const { data: existing, error: selectError } = await supabase
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing) {
    const { error: updateError } = await supabase
      .from('newsletter_subscribers')
      .update({
        lang: safeLang,
        status: 'active',
        unsubscribe_token_hash: tokenHash,
        unsubscribed_at: null,
        updated_at: now
      })
      .eq('id', existing.id);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email: normalizedEmail,
        lang: safeLang,
        status: 'active',
        unsubscribe_token_hash: tokenHash,
        subscribed_at: now,
        updated_at: now
      });
    if (insertError) throw insertError;
  }

  return rawToken;
}

// Marcheaza abonatul ca dezabonat pe baza hash-ului tokenului primit de la
// client. Returneaza true doar daca a fost gasit un abonat ACTIV cu acest
// hash (un token deja consumat sau niciodata emis intoarce false, fara nicio
// distinctie suplimentara vizibila catre client intre cele doua cazuri).
export async function markUnsubscribedByTokenHash(tokenHash) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: now, updated_at: now })
    .eq('unsubscribe_token_hash', tokenHash)
    .eq('status', 'active')
    .select('id');

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

export function hashUnsubscribeToken(rawToken) {
  return hashToken(rawToken);
}

// Format asteptat: token hex de 64 caractere (crypto.randomBytes(32)). Orice
// alta valoare e respinsa direct, fara sa mai atinga baza de date.
export function isValidTokenFormat(rawToken) {
  return typeof rawToken === 'string' && /^[a-f0-9]{64}$/.test(rawToken);
}

// Pentru rubrica "Abonati" din panoul de admin - doar coloanele necesare,
// NICIODATA unsubscribe_token_hash. Apelantul (api/admin/[name].js) trebuie
// sa fi validat deja sesiunea de admin prin requireAdmin() inainte de a
// apela aceasta functie.
export async function listSubscribersForAdmin() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('newsletter_subscribers')
    .select('email, lang, status, subscribed_at, unsubscribed_at')
    .order('subscribed_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
