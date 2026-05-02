# SaaS cancellation / consent / deletion (backend)

Objectif: découpler 3 statuts indépendants:

- `subscription_status` (stocké dans `Subscription.status`)
- `marketing_consent` (stocké dans `User.marketing_consent`)
- `account_deletion_requested` (stocké dans `User.account_deletion_requested`)

## Règle métier clé (Stripe)

Quand le client clique “Annuler mon abonnement”, l’abonnement Stripe n’est **pas** supprimé immédiatement:

- on appelle Stripe pour positionner `cancel_at_period_end=true`
- on récupère `current_period_end` depuis Stripe
- on met à jour la BDD en local pour permettre l’accès jusqu’à la fin de période

## Endpoints

### `POST /api/subscription/cancel`

Auth: requis (Bearer token, middleware `verifyAuth`).

Comportement:

- charge l’utilisateur authentifié (via email décodé du JWT)
- charge l’abonnement actif (`Subscription.is_active=TRUE`)
- refuse si l’utilisateur n’a pas de `stripe_subscription_id`
- appelle Stripe: `subscriptions.update(id, { cancel_at_period_end: true })`
- met à jour la BDD:
  - `Subscription.status = 'canceling'`
  - `Subscription.stripe_cancel_at_period_end = 1`
  - `Subscription.current_period_end = <Stripe.current_period_end>`
  - `Subscription.plan_access_until = <Stripe.current_period_end>`
  - `Subscription.period_end = <Stripe.current_period_end>` (pour garder les quotas en phase)
  - `Subscription.cancel_at = <Stripe.current_period_end>`
- déclenche un email transactionnel (best-effort) contenant:
  - date claire de fin d’accès (`plan_access_until`)
  - crédits restants
  - liens marketing (token signé)
  - lien “Demander la suppression de mon compte”

Réponse JSON (exemple):

```json
{
  "success": true,
  "subscription_status": "canceling",
  "plan_access_until": "YYYY-MM-DD",
  "message": "Votre abonnement est annulé. Vous conservez l’accès jusqu’au ..."
}
```

### `POST /api/marketing/consent`

Auth: requis.

Body:

```json
{ "marketing_consent": true }
```

Comportement:

- met à jour uniquement `User.marketing_consent`
- enregistre aussi `User.marketing_consent_updated_at`
- ne touche ni à l’abonnement, ni à la suppression de compte
- optionnel: envoie un email de confirmation (best-effort) uniquement si la valeur change

Note: les actions marketing se font uniquement via session authentifiée (dashboard). Les emails servent de confirmation/tracabilité.

### `POST /api/account/deletion-request`

Auth: requis.

Comportement:

- pose `User.account_deletion_requested = 1`
- enregistre `User.account_deletion_requested_at`
- ne supprime pas immédiatement les données (un process séparé doit gérer l’anonymisation / purge en respectant les obligations légales)

Note: la demande de suppression se fait uniquement via session authentifiée (dashboard). Les emails servent de confirmation/tracabilité.

## Logique d’accès premium

Pour les abonnements Stripe, `getActiveUsageBillingPeriod()` refuse l’accès premium si:

- `Subscription.status` n’est pas `active` ou `canceling`, **ou**
- `plan_access_until` (fallback `current_period_end` / `period_end`) est dans le passé

Le contrôle des crédits reste fait au niveau des fonctionnalités consommatrices de crédits via `remaining_in_period`.

## Webhooks Stripe (synchronisation)

Dans `POST /api/stripe/webhook`:

- `invoice.paid` + `invoice.payment_succeeded`
  - synchronisent `period_start`, `period_end`, `current_period_end`, `plan_access_until`
- `customer.subscription.updated`
  - synchronise `status` (incluant `canceling` si `cancel_at_period_end=true`)
  - synchronise `stripe_cancel_at_period_end`
  - synchronise `current_period_end` et `plan_access_until`
- `customer.subscription.deleted`
  - met `status='canceled'`, `is_active=NULL`
  - pose aussi `current_period_end` / `plan_access_until` (si fournis)

## Variables d’environnement

Stripe:

- `STRIPE_MODE` (`production` pour prod)
- `STRIPE_SECRET_KEY_TEST`
- `STRIPE_SECRET_KEY_PROD`
- `STRIPE_WEBHOOK_SECRET`

Email SMTP (déjà utilisé par d’autres emails du projet):

- `MAILBOX_DEV_ADDRESS` / `MAILBOX_DEV_PASSWORD`
- `MAILBOX_PROD_ADDRESS` / `MAILBOX_PROD_PASSWORD`
- `MAILBOX_PROD_HOST` / `MAILBOX_PROD_PORT` (prod)
- `MAIL_SENDER_NAME` (optionnel)

URLs publiques:

- `DOMAIN_URL_DEV` / `DOMAIN_URL_PROD` (utilisé pour construire les liens dans l’email)
- `BASE_URL_DEV` / `BASE_URL_PROD` (recommandé: base URL du backend public, utilisée pour construire les liens API dans les emails)
- `API_PUBLIC_BASE_URL` (optionnel: override si tu veux forcer une URL API différente; sinon le backend utilise `BASE_URL_*` puis tente de déduire l’URL depuis la requête)

Tokens email:

- aucun token d’action n’est utilisé pour les actions sensibles (par design)
