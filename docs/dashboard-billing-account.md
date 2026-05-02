# Dashboard — Billing & Account

Objectif: gérer **3 actions séparées** depuis le dashboard (session authentifiée), sans actions critiques via email.

## État affiché dans le dashboard

Le front charge l’état via:

- `GET /api/account/billing-account` (auth requis)

Réponse (structure simplifiée):

- `subscription.subscription_status` (`active|canceling|...`)
- `subscription.plan_access_until_date` (si `canceling`)
- `marketing.marketing_consent` (bool)
- `account.account_deletion_requested` (bool)

## Actions (dashboard only)

### 1) Préférences marketing

- UI: bouton Activer/Désactiver
- API: `POST /api/marketing/consent` (auth requis)
- Effets:
  - met à jour uniquement `User.marketing_consent` + `marketing_consent_updated_at`
  - envoie un email de confirmation (best-effort) si la valeur change

### 2) Annulation de l’abonnement

- UI: bouton + modal de confirmation
- API: `POST /api/subscription/cancel` (auth requis)
- Règle métier Stripe:
  - positionne `cancel_at_period_end=true`
  - récupère `current_period_end` depuis Stripe
- BDD:
  - `Subscription.status = 'canceling'`
  - `stripe_cancel_at_period_end = 1`
  - `current_period_end`, `plan_access_until`
  - accès maintenu jusqu’à `plan_access_until`
- Email: confirmation (best-effort)

### 3) Suppression du compte

- UI: bouton danger + double confirmation (taper `SUPPRIMER`)
- API: `POST /api/account/deletion-request` (auth requis)
- Effets backend (ordre important):
  - `account_deletion_requested=1` + timestamp
  - `marketing_consent=false`
  - annule l’abonnement Stripe immédiatement si présent
  - met l’abonnement local en `canceled` + coupe la fenêtre d’accès
  - révoque tous les refresh tokens
  - envoie un email de confirmation (best-effort)
  - anonymise `User.email/password_hash` pour bloquer immédiatement les appels basés sur l’email du JWT

## Sécurité

- Aucune action sensible par email.
- Le backend reste la source de vérité pour statuts/dates Stripe.
- Les endpoints exigent `verifyAuth`.

