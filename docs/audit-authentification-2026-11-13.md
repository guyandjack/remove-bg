# Audit de sécurité — authentification utilisateur

**Date :** 13 novembre 2026

**Périmètre :** connexion par mot de passe, émission et renouvellement des jetons, persistance frontend, contrôle des routes authentifiées et déconnexion.
**Méthode :** revue statique du code source. Aucun secret, paramètre d'environnement effectif, proxy TLS, base de données de production ou test de navigateur n'a été consulté. Les conclusions conditionnelles au déploiement sont explicitement indiquées.

> **État de remédiation :** les constats ci-dessous décrivent l'état audité initial. Les correctifs P0, P1 et P2 ont été appliqués dans la branche de travail après cet audit ; leur synthèse et les prérequis de déploiement figurent à la fin du document.

## Synthèse

Le serveur possède de bonnes bases : validation serveur Zod, mots de passe vérifiés avec `bcrypt`, JWT signés en `RS256`, refresh tokens persistés sous forme hachée, cookie de refresh `HttpOnly` et rotation des refresh tokens. Ces protections ne suffisent toutefois pas à protéger la session contre une injection JavaScript : l'access token est retourné au JavaScript, stocké dans `localStorage`, puis envoyé dans un header `Authorization`.

Le risque principal est donc le vol durable de session via XSS. Le script malveillant peut lire l'access token, appeler le point de refresh avec le cookie `HttpOnly` du navigateur, puis lire le nouvel access token renvoyé dans la réponse. Le cookie `HttpOnly` n'isole pas réellement la session dans cette architecture.

Deux défauts de cycle de vie aggravent la situation : le logout ne récupère pas correctement l'utilisateur à révoquer et, si le frontend est bien servi depuis `wizpix.ch` alors que l'API est sur `api.wizpix.ch` (configuration CORS présente), le client de logout ne transporte ni ne peut effacer le cookie de refresh. Une reconnexion silencieuse après logout est alors possible.

**Décision recommandée :** ne pas corriger uniquement `localStorage`. Migrer vers une authentification entièrement fondée sur des cookies `HttpOnly`, avec protection CSRF, révocation atomique et une initialisation de session via `GET /api/auth/me`.

## Workflow observé

```text
FormLogin (react-hook-form + regex)
  POST /api/login  [withCredentials]
    checkLoginDataUser (Zod)
      login controller
        bcrypt.compare + données de compte
        access JWT -> corps JSON
        refresh JWT -> cookie tokenRefresh HttpOnly
  sessionSignal + localStorage["session"] <- contient l'access JWT
  Axios -> Authorization: Bearer <access JWT>
  401 -> POST /api/auth/refresh [cookie refresh]
       -> nouveau refresh cookie + access JWT JSON/localStorage
  POST /api/logout [Authorization, mais pas withCredentials par défaut]
```

Principaux emplacements revus :

- Formulaire : `src/components/form/formLogin.tsx`.
- État et persistance client : `src/stores/session.ts`, `src/utils/axiosConfig.ts`, `src/utils/request/isAuthentified.ts`.
- Route, validation et contrôleur : `backend/routes/login.route.ts`, `backend/middelware/chekDataAuth/checkLoginDataUser.ts`, `backend/controleur/loginDataUser.controler.ts`.
- Refresh/logout : `backend/controleur/refreshAuth.controler.ts`, `backend/middelware/checkRefreshToken/checkRefreshToken.ts`, `backend/controleur/logOut.controler.ts`.
- Configuration HTTP : `backend/app.ts`, `backend/function/createToken.ts`.

Le même modèle d'émission de jetons est aussi utilisé après validation Stripe et après inscription OTP. La migration doit donc couvrir ces parcours, pas seulement le formulaire de login.

## Constats détaillés

| ID | Gravité | Constat et impact | Éléments observés |
| --- | --- | --- | --- |
| AUTH-01 | Haute | L'access token est exposé au JavaScript et persisté dans `localStorage`. Toute XSS sur l'origine frontend peut le lire et l'exfiltrer. Le refresh cookie ne compense pas ce risque : le point de refresh renvoie un nouvel access token dans le JSON, lisible par le script XSS. L'attaquant peut donc prolonger l'accès. | `loginDataUser.controler.ts:165-191`, `refreshAuth.controler.ts:38-49`, `session.ts:97-154`, `axiosConfig.ts:25-57, 153-170`. |
| AUTH-02 | Haute sous déploiement multi-origine | La déconnexion peut laisser une session réutilisable. Le client appelle `api.post("/api/logout")` sans `withCredentials`; pour un frontend et une API d'origines distinctes, le navigateur n'envoie pas le refresh cookie et n'accepte pas de manière fiable le `Set-Cookie` de suppression. En plus, le contrôleur traite `req.payload` comme une chaîne alors que `verifyAuth` y place `{ email }` : la révocation DB échoue et l'erreur est volontairement ignorée. Une requête ultérieure peut refaire un refresh. | `logout.ts:29-40`, `axiosConfig.ts:110-115`, `verifyAuth.ts:54`, `logOut.controler.ts:14-26`. La configuration CORS autorise explicitement `https://wizpix.ch` et `https://api.wizpix.ch` dans `app.ts:73-106`. |
| AUTH-03 | Moyenne | Le refresh token est en `SameSite=None` en production, sans défense CSRF applicative observée (contrôle `Origin`/`Referer` ou token CSRF). CORS ne bloque pas une requête cross-site qui modifie l'état ; il empêche seulement généralement de lire sa réponse. Un site tiers peut notamment provoquer un refresh/une rotation non souhaitée et, via un formulaire, une login-CSRF si les cookies tiers sont admis. | `createToken.ts:286-298`, `authRefresh.route.ts:7`, absence de middleware CSRF/contrôle d'origine dans `app.ts`. |
| AUTH-04 | Moyenne | La rotation du refresh token n'est pas atomique. Deux requêtes qui valident le même refresh avant sa révocation peuvent chacune créer un nouveau refresh token valide. Le résultat de `revokeRefreshToken` n'est pas contrôlé. Cela réduit l'intérêt de la rotation contre la réutilisation d'un token volé. | `checkRefreshToken.ts:23-44`, `refreshAuth.controler.ts:27-45`, `queriesSQL.ts:1025-1035`. |
| AUTH-05 | Moyenne | La limitation est globale à `/api/` : 100 requêtes/IP/15 min. Elle n'est ni dédiée à la connexion, ni liée au compte ciblé, ni adaptée au credential stuffing. Elle peut être trop permissive pour le brute force et permet aussi un déni de service sur l'ensemble de l'API depuis une même IP. Si l'application est derrière un reverse proxy, `trust proxy` doit être configuré et vérifié, sinon la clé IP peut être erronée. | `app.ts:191-196`; aucune configuration `trust proxy` ni limite spécifique à `/api/login` relevée. |
| AUTH-06 | Moyenne-basse | L'absence d'utilisateur évite le coût de `bcrypt.compare`, contrairement à un mot de passe faux pour un compte existant. Les messages sont génériques, ce qui est bien, mais cette différence de temps peut aider une énumération statistique d'adresses. | `loginDataUser.controler.ts:78-117`. |
| AUTH-07 | Moyenne-basse | Les cookies de refresh ne sont pas restreints par `Path` et la configuration de secours pour tout environnement autre que `production` les crée avec `secure: false`. Un mauvais `NODE_ENV` peut donc dégrader silencieusement la protection de transport. | `createToken.ts:279-317`. |
| AUTH-08 | Basse | Les JWT d'accès ne portent pas de `sub` immuable, `iss`, `aud` ni type explicite. Le flux actuel exige des champs supplémentaires pour un refresh, ce qui évite l'acceptation directe d'un access token comme refresh, mais le cloisonnement reste fragile lors des évolutions. Les access tokens déjà émis ne peuvent pas être révoqués avant leur expiration. | `createToken.ts:181-193, 212-274`, `verifyAuth.ts:31-55`. |
| AUTH-09 | Basse / qualité de sécurité | Le frontend utilise bien `react-hook-form`, mais la validation est une aide UX contournable. La validation Zod serveur est présente et fait autorité, ce qui est correct. En revanche la règle de complexité est imposée aussi à la connexion : un compte historique dont le mot de passe ne respecte plus cette politique ne pourra pas se connecter. Les champs n'explicitent pas `autocomplete="username"` et `autocomplete="current-password"`. | `formLogin.tsx:75-88, 229-306`, `checkLoginDataUser.ts:6-52`. |
| AUTH-10 | Basse / assurance | Aucun test automatisé spécifique au login, aux attributs de cookie, au refresh concurrent, au logout ou au CSRF n'a été trouvé dans `backend/tests`. Une régression sur ces comportements sensibles serait difficile à détecter. | `backend/tests/run.ts:10-15` enregistre uniquement des tests hors authentification. |

## Points positifs confirmés

- La validation backend est faite avant le contrôleur avec Zod et les données validées sont séparées dans `req.userValidated`.
- Les mots de passe sont comparés avec `bcryptjs`; les changements/réinitialisations utilisent un coût de hachage de 12.
- Le JWT est vérifié avec une liste d'algorithmes explicite (`RS256`), ce qui évite l'acceptation d'algorithmes non attendus.
- Le refresh token est `HttpOnly` et enregistré côté base avec un hachage, un `jti`, une date d'expiration et un état de révocation.
- Les messages affichés par le formulaire de connexion sont génériques pour les erreurs 401 et 429 ; l'email n'est pas explicitement révélé au navigateur.
- CORS utilise une liste d'origines explicite, avec `credentials: true`, plutôt qu'un joker incompatible avec les credentials.
- Helmet, `cookie-parser`, compression et journalisation structurée sont configurés au niveau Express.

## Plan correctif priorisé

### P0 — corriger avant le prochain déploiement

1. **Rendre le logout fiable.** Lire `const email = req.payload?.email`, révoquer les refresh tokens attendus et ne pas ignorer l'échec de révocation sans alerte exploitable. Tester la révocation en base. Tant que l'architecture actuelle existe, appeler le logout avec `withCredentials: true`.
2. **Créer un limiteur spécifique à la connexion.** Utiliser une limite basse et progressive par couple IP + identifiant normalisé, tout en conservant une limite IP globale. Renvoyer une réponse générique et `429`, journaliser l'événement sans mot de passe. Vérifier `app.set("trust proxy", n)` selon la topologie réelle du proxy, et jamais par défaut aveugle.
3. **Réduire l'énumération temporelle.** Exécuter `bcrypt.compare` contre un hash factice de coût identique lorsque l'email n'existe pas. Mesurer la latence plutôt que promettre une égalité parfaite.
4. **Passer les cookies en mode sûr par défaut hors développement local.** Échouer au démarrage si les variables de production attendues sont absentes ou si l'application est configurée pour HTTPS avec `secure: false`. Définir explicitement `Path`, `Secure`, `HttpOnly`, `SameSite` et une durée cohérente à la création comme à la suppression.

### P1 — migration vers une session sans token accessible à JavaScript

1. **Choisir un contrat de session cookie-only.** Émettre un access token très court et un refresh token depuis des cookies `HttpOnly; Secure`; ne jamais retourner `token` dans le JSON. Sur les sous-domaines `wizpix.ch` / `api.wizpix.ch`, préférer des cookies host-only sur l'API et vérifier en recette que `SameSite=Strict` fonctionne : ces origines sont distinctes mais du même *site*. Si les origines réelles sont cross-site, `SameSite=None; Secure` impose une protection CSRF renforcée.
2. **Adapter l'API.** `verifyAuth` doit lire le cookie d'accès, puis les clients Axios/Fetch doivent être créés avec `withCredentials: true` / `credentials: "include"`, sans header `Authorization`. Limiter le chemin des cookies : par exemple access sur `/api`, refresh sur `/api/auth`; la route de logout doit alors être dans le chemin qui reçoit le refresh, ou révoquer la session côté serveur de façon explicite.
3. **Protéger toutes les écritures contre CSRF.** Ajouter un middleware commun sur les méthodes non sûres, qui vérifie strictement `Origin` (et `Referer` en repli contrôlé) contre la liste de frontends. Ajouter un jeton CSRF synchronizer ou double-submit pour les scénarios `SameSite=None`. Appliquer cette règle à login, refresh, logout, changement de mot de passe, paiement et actions métier ; CORS seul n'est pas une défense CSRF.
4. **Retirer intégralement la persistance client de session.** Supprimer `token` de `SessionData`, `setSessionFromApiResponse`, `initSessionFromLocalStorage`, `readAccessToken`, `persistNewAccessToken` et toutes les lectures de `localStorage["session"]`. Les composants `RemoveBG`, `ImageConverter`, dashboard et `SessionExpiryWarning` doivent utiliser l'état applicatif non sensible et non le token pour décider du flux.
5. **Initialiser la session depuis le serveur.** Au démarrage, appeler `/api/auth/me`; l'API répond avec le profil/plan non sensible, jamais avec un JWT. Les gardes de route attendent cette phase de bootstrap plutôt que de rediriger selon l'absence d'un token local. Pour l'avertissement d'expiration, fournir au besoin une valeur d'expiration non secrète dans la réponse de session, pas le JWT à décoder.
6. **Couvrir les autres émetteurs.** Modifier aussi `signUpOtpUser.controler.ts` et `stripeFinalize.controller.ts`; aujourd'hui ils créent eux aussi un access token dans la réponse et alimentent `setSessionFromApiResponse`.

### P2 — consolider le modèle de refresh et de révocation

1. **Rendre la rotation atomique.** Dans une transaction, verrouiller/consommer le refresh courant avec une mise à jour conditionnelle (`jti`, utilisateur, non révoqué, non expiré), vérifier qu'une seule ligne est modifiée, créer le suivant, puis lier les deux. Une seconde utilisation du même token doit échouer ; selon la politique retenue, elle peut révoquer la famille de session et générer un signal de compromission.
2. **Utiliser un sujet stable et une typologie de jetons.** Placer l'identifiant utilisateur dans `sub`, définir `iss`, `aud`, `typ` (`access`, `refresh`, `password_reset`) et vérifier chaque claim au point d'usage. Conserver une clé de signature ou au minimum une audience distincte pour les usages particulièrement sensibles.
3. **Prévoir la révocation des access tokens.** Avec une durée courte, l'exposition résiduelle est limitée. Pour les actions critiques, vérifier une version de session/utilisateur côté serveur ou utiliser une session opaque référencée en base/Redis.
4. **Conserver les traces utiles.** Les IP et user-agents sont déjà conservés pour les refresh tokens ; ajouter une purge planifiée confirmée, un affichage de sessions actives et une possibilité de révoquer un appareil. Ne jamais journaliser le mot de passe, le JWT ni le cookie.

### P3 — défenses complémentaires

- Déployer une CSP restrictive sur l'origine qui sert réellement le frontend (nonce/hash pour les scripts nécessaires), pas seulement sur l'API Express.
- Mettre en place une authentification multifacteur, idéalement WebAuthn/passkeys, pour les comptes à risque et les actions sensibles.
- Ajouter une détection de credential stuffing et une CAPTCHA adaptative après échecs répétés ; éviter la CAPTCHA systématique qui dégrade inutilement l'UX.
- Ajouter explicitement `autocomplete="username"` et `autocomplete="current-password"` au formulaire, puis déplacer la mise à niveau de politique de mot de passe vers un écran de changement après authentification au lieu de la bloquer à la connexion.

## Critères d'acceptation et tests à ajouter

| Scénario | Résultat attendu |
| --- | --- |
| Login réussi | Réponse JSON sans JWT ; `Set-Cookie` porte les attributs attendus ; aucun token dans `localStorage`, `sessionStorage` ou l'état sérialisé. |
| XSS simulée | Un script exécuté dans le frontend ne peut pas lire les cookies ni obtenir un JWT dans une réponse d'authentification. |
| Bootstrap et garde de route | `/api/auth/me` établit l'état utilisateur ; une absence de session mène au login après ce contrôle, sans lecture de token local. |
| Échec login | Même statut, même message public et temps de réponse comparable pour email inconnu et mot de passe erroné. |
| Limitation | Le seuil dédié renvoie `429`; les succès peuvent être traités selon la politique choisie ; la clé client derrière proxy est vérifiée par test d'intégration. |
| CSRF | Un `POST` depuis une origine non autorisée, sans jeton CSRF valide si requis, est rejeté avant le contrôleur. Les origines attendues passent. |
| Rotation concurrente | Deux refresh avec le même cookie : une seule réponse réussit et un seul descendant reste valide. |
| Logout cross-origin | Sur le couple frontend/API réel, le cookie est supprimé avec les mêmes `Path`/`Domain`/`SameSite`, le refresh correspondant est révoqué et un refresh ultérieur répond `401`. |
| Réinitialisation/changement de mot de passe | Les sessions prévues sont révoquées selon la politique, et les access tokens obsolètes ne permettent plus une action sensible. |
| Régression E2E | Inscription OTP, login, finalisation Stripe, refresh, upload authentifié, session expirée et logout sont couverts dans un navigateur réel. |

## Conclusion

La validation du formulaire et Zod côté backend existent, mais la persistance d'un bearer token dans `localStorage` annule une part essentielle du bénéfice du cookie `HttpOnly`. La priorité est de traiter AUTH-01 et AUTH-02, puis de faire évoluer l'ensemble des flux d'émission vers le même contrat cookie-only avec CSRF et tests E2E. Une simple substitution de `localStorage` par un cookie sans traiter CSRF, les gardes de route, la rotation et le logout déplacerait le risque sans fiabiliser le système.

## Remédiation appliquée après audit

- **P0 :** limite dédiée de 10 échecs par 15 minutes pour login (clé IP normalisée + empreinte de l'email), comparaison `bcrypt` factice pour les emails inconnus, configuration explicite du nombre de proxies de confiance et correction de la révocation au logout.
- **P1 :** access et refresh tokens uniquement en cookies `HttpOnly`; aucune réponse JSON ni persistance `localStorage` ne contient un JWT. Les cookies sont `Secure` hors développement local, `SameSite=Strict`, host-only et limités respectivement à `/api` et `/api/auth`. Le frontend initialise la session avec `GET /api/auth/me` et transporte les cookies avec `withCredentials` / `credentials: include`.
- **P1 :** protection CSRF par liste d'origines de confiance appliquée à toutes les écritures, y compris login et refresh. Les webhooks Stripe/Replicate signés sont explicitement exclus de ce contrôle d'origine.
- **P2 :** claims `sub`, `sid`, `typ`, `iss` et `aud` vérifiés ; access token lié à une ligne de refresh active, hash du refresh comparé, et rotation atomique dans une transaction SQL. La révocation d'un refresh invalide donc immédiatement l'access token lié.
- **Tests :** tests Vitest ajoutés pour les attributs des cookies et le contrôle CSRF, en complément du build frontend/backend et du runner backend existant.

### Pré-requis de déploiement

1. Déployer frontend et backend ensemble : les anciens JWT et refresh cookies ne satisfont pas les nouveaux claims et les utilisateurs devront se reconnecter.
2. Configurer `TRUST_PROXY_HOPS` avec le nombre exact de reverse proxies devant Express. Laisser `0` si Express est directement exposé.
3. Si une origine frontend supplémentaire est nécessaire, l'ajouter explicitement à `ALLOWED_ORIGINS` (liste séparée par des virgules, URLs absolues). Ne pas employer de joker.
4. Vérifier en préproduction le couple HTTPS réel frontend/API, les attributs `Set-Cookie`, la déconnexion et les webhooks. Les cookies stricts supposent que frontend et API restent sur le même site registrable (`wizpix.ch`).
