# Stripe — Plan change (Upgrade / Downgrade)

Objectif: permettre le changement de plan **sans supprimer/recréer** l’abonnement Stripe, avec un comportement fiable.

## API

### `POST /api/subscription/change-plan`

Auth requis (`verifyAuth`).

Body:

```json
{ "plan_code": "pro" }
```

Règles:

- Upgrade (`target.price > current.price`)
  - Stripe: `subscriptions.update(..., proration_behavior="create_prorations", payment_behavior="pending_if_incomplete")`
  - BDD: enregistre un changement en attente sur `Subscription.pending_*`
  - Activation du nouveau plan en base **uniquement via webhook** (`customer.subscription.updated`)
- Downgrade (`target.price < current.price`)
  - Stripe: création d’un `Subscription Schedule` depuis l’abonnement existant
  - Phase 1: plan actuel jusqu’à `current_period_end`
  - Phase 2: nouveau plan à partir de `current_period_end` (pas de proration)
  - BDD: enregistre `pending_*` + `stripe_schedule_id`

## Webhooks (source de vérité)

Dans `POST /api/stripe/webhook` → `customer.subscription.updated`:

- synchronise `status`, `cancel_at_period_end`, `current_period_end`, `plan_access_until`
- si le `price.id` Stripe correspond à un `Plan.stripe_price_id`:
  - met à jour `Subscription.plan_id`
  - purge `pending_*` et `stripe_schedule_id`

## Crédits

- Les crédits restent basés sur le ledger `CreditUsage` (usage dans la période).
- Quand `plan_id` change (appliqué par webhook), le quota devient celui du nouveau plan et le restant est calculé via:
  - `remaining_in_period = newPlan.daily_credit_quota - creditsUsedThisPeriod`
- Downgrade: aucun changement immédiat tant que la phase 2 n’est pas effective.

## Variables d’environnement

- Stripe: `STRIPE_SECRET_KEY_TEST/PROD`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MODE`

