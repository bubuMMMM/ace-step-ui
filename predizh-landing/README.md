# Predizh — landing page

Version améliorée de la landing page déployée sur `predizh-landing.vercel.app`.

> ⚠️ Ce dossier n'a **aucun lien** avec le reste du dépôt (ACE-Step UI). Il a été
> placé ici pour que le source ne soit pas perdu. Déplace-le dans son propre dépôt
> quand tu veux.

## Structure

```
index.html            page complète (CSS + JS inline, aucune dépendance)
api/waitlist.js       fonction serverless qui enregistre les inscriptions
og.png                image de partage social 1200×630
favicon.svg           favicon
apple-touch-icon.png  icône iOS 180×180
robots.txt            indexation
sitemap.xml           sitemap
site.webmanifest      manifeste PWA
vercel.json           en-têtes de sécurité + cache
```

## Configurer la collecte des emails

Avant, le formulaire faisait `localStorage.setItem(...)` : **chaque inscription
était perdue**, elle restait dans le navigateur du visiteur. Elle passe maintenant
par `POST /api/waitlist`.

La fonction essaie trois destinations dans l'ordre et s'arrête à la première
configurée. **Aucune n'est obligatoire** — sans configuration, les inscriptions
partent dans les logs Vercel, donc rien n'est jamais perdu.

Dans Vercel → *Settings* → *Environment Variables* :

### Option 1 — webhook (recommandé, marche avec tout)

| Variable | Valeur |
|---|---|
| `WAITLIST_WEBHOOK_URL` | l'URL de ton webhook |

Compatible Zapier, Make, n8n, Airtable, ou un Google Sheet via Apps Script.
La fonction envoie un `POST` JSON :

```json
{ "email":"…", "city":"Rennes", "ref":"…", "ua":"…", "country":"FR", "at":"2026-08-07T…" }
```

### Option 2 — notification par email (Resend)

| Variable | Valeur |
|---|---|
| `RESEND_API_KEY` | ta clé API Resend |
| `WAITLIST_NOTIFY_EMAIL` | l'adresse qui reçoit les inscriptions |
| `WAITLIST_FROM_EMAIL` | *(optionnel)* expéditeur vérifié |

### Option 3 — rien à faire

Les inscriptions sont écrites dans les logs Vercel, préfixées `WAITLIST_SIGNUP`.
Pour les récupérer : Vercel → *Logs*, filtre sur `WAITLIST_SIGNUP`.
Dépannage seulement — les logs sont purgés au bout de quelques jours.

## À personnaliser

- `contact@predizh.fr` apparaît dans le pied de page, la FAQ, le bloc partenaires
  et le `<noscript>`. Remplace-le par une vraie adresse.
- Les URLs absolues (`https://predizh-landing.vercel.app`) sont dans `<link rel=canonical>`,
  les balises Open Graph, le JSON-LD, `robots.txt` et `sitemap.xml`. À mettre à jour
  le jour où tu branches un domaine.
- Le formulaire ne mentionne pas de politique de confidentialité. Pour être en règle
  RGPD, ajoute une page dédiée et lie-la depuis la case de consentement.

## Développement

Aucun build. Sers le dossier :

```bash
python3 -m http.server 8099    # ou : npx serve .
```

`/api/waitlist` ne répond qu'une fois déployé sur Vercel (ou via `vercel dev`).
