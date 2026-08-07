/**
 * POST /api/waitlist — enregistrement d'une inscription à la liste d'attente.
 *
 * Avant, le formulaire faisait `localStorage.setItem(...)` : l'email restait dans le
 * navigateur du visiteur et n'arrivait jamais nulle part. Chaque inscription était perdue.
 *
 * Ici, on essaie plusieurs destinations dans l'ordre, et on s'arrête à la première
 * qui est configurée. Aucune n'est obligatoire : sans configuration, l'inscription
 * part quand même dans les logs Vercel (récupérables), donc rien n'est jamais perdu.
 *
 *   1. WAITLIST_WEBHOOK_URL  → POST JSON (Zapier, Make, n8n, Google Apps Script, Airtable…)
 *   2. RESEND_API_KEY + WAITLIST_NOTIFY_EMAIL → email de notification via Resend
 *   3. logs Vercel (toujours actif, en dernier recours)
 *
 * Variables d'environnement à définir dans Vercel → Settings → Environment Variables.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const CITIES = new Set([
  'Rennes', 'Brest', 'Lorient', 'Vannes', 'Saint-Malo', 'Quimper',
  'Autre ville en Bretagne'
]);

// Anti-abus basique, en mémoire. Suffisant pour une landing page : ça absorbe
// le bourrinage d'une même IP sans dépendre d'un store externe. L'instance
// serverless étant éphémère, la fenêtre se réinitialise d'elle-même.
const hits = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip) {
  const now = Date.now();
  const bucket = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  bucket.push(now);
  hits.set(ip, bucket);
  if (hits.size > 500) hits.clear(); // garde-fou mémoire
  return bucket.length > MAX_PER_WINDOW;
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return null; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'too_many_requests' });
  }

  const body = await readJson(req);
  if (!body) return res.status(400).json({ error: 'invalid_json' });

  // Pot de miel : rempli = bot. On répond 200 pour ne pas lui indiquer qu'il est détecté.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return res.status(200).json({ ok: true, stored: 'discarded' });
  }

  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  const city = CITIES.has(body.city) ? body.city : 'Non précisée';

  const entry = {
    email,
    city,
    ref: typeof body.ref === 'string' ? body.ref.slice(0, 300) : null,
    ua: String(req.headers['user-agent'] || '').slice(0, 300),
    country: req.headers['x-vercel-ip-country'] || null,
    at: new Date().toISOString()
  };

  // 1) Webhook générique
  const webhook = process.env.WAITLIST_WEBHOOK_URL;
  if (webhook) {
    try {
      const r = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
        signal: AbortSignal.timeout(8000)
      });
      if (r.ok) return res.status(200).json({ ok: true, stored: 'webhook' });
      console.error('[waitlist] webhook a répondu', r.status);
    } catch (err) {
      console.error('[waitlist] webhook injoignable:', err.message);
    }
  }

  // 2) Notification email via Resend
  const resendKey = process.env.RESEND_API_KEY;
  const notify = process.env.WAITLIST_NOTIFY_EMAIL;
  if (resendKey && notify) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.WAITLIST_FROM_EMAIL || 'Predizh <onboarding@resend.dev>',
          to: [notify],
          subject: `Predizh — nouvelle inscription (${entry.city})`,
          text: `Email : ${entry.email}\nVille : ${entry.city}\nDate  : ${entry.at}\nPays  : ${entry.country || '—'}\nRef   : ${entry.ref || '—'}`
        }),
        signal: AbortSignal.timeout(8000)
      });
      if (r.ok) return res.status(200).json({ ok: true, stored: 'email' });
      console.error('[waitlist] Resend a répondu', r.status, await r.text());
    } catch (err) {
      console.error('[waitlist] Resend injoignable:', err.message);
    }
  }

  // 3) Dernier recours : logs Vercel. Filtrable sur "WAITLIST_SIGNUP".
  console.log('WAITLIST_SIGNUP ' + JSON.stringify(entry));
  return res.status(200).json({ ok: true, stored: 'logs' });
};
