# Standardisation globale des codes erreurs backend

## Objectif

Mettre en place une convention globale de codes erreurs sur tous les middlewares et controllers backend afin de faciliter :

- le debug ;
- l’identification rapide de la source d’une erreur ;
- la recherche dans les logs ;
- le support frontend/backend.

Chaque erreur backend doit :

- générer un log avec la fonction `logger` existante ;
- inclure un code erreur standardisé ;
- retourner ce code au frontend lorsqu’une réponse utilisateur existe.

---

# Format obligatoire

Format :

```txt
[type]_[nomFichier]_err[numero]
```

Exemples :

```txt
ctrl_billingStatus_err1
ctrl_billingStatus_err2
mw_auth_err1
```

## Règles

### type

Valeurs autorisées :

- `ctrl` → controller
- `mw` → middleware

---

### nomFichier

Récupérer le nom du fichier sans extension.

Supprimer :

```txt
.controller.ts
.controler.ts
.middleware.ts
.middelware.ts
.ts
```

Exemple :

```txt
billingStatus.controler.ts
```

devient :

```txt
billingStatus
```

---

### numero

Le numéro doit :

- suivre l’ordre d’apparition des erreurs dans le fichier ;
- utiliser le format :

```txt
err1
err2
err3
```

La numérotation recommence à `err1` pour chaque fichier.

---

# Log backend obligatoire

Utiliser EXCLUSIVEMENT la fonction `logger` existante.

Ne jamais créer une autre abstraction de log.

Exemple :

```ts
logger.error({
    code:"ctrl_billingStatus_err1",
    message:"Contexte clair",
    error
})
```

---

# Format des réponses frontend

Exemple erreur serveur :

```ts
res.status(500).json({
    message:"Une erreur serveur est survenue",
    code:"ctrl_billingStatus_err1"
})
```

Exemple erreur métier :

```ts
res.status(401).json({
    message:"Non autorisé",
    code:"mw_auth_err2"
})
```

---

# Règle `code` (obligatoire)

- La réponse frontend doit utiliser uniquement la propriété `code`.
- Ne pas renvoyer `errorCode`.
- Si une réponse contient déjà `code` et `errorCode` avec la même valeur, conserver uniquement `code`.

# Sécurité

Ne jamais exposer au frontend :

- stack trace
- erreur SQL
- secrets
- tokens
- variables d’environnement
- détails internes backend

Le frontend ne doit recevoir que :

- un message utilisateur ;
- un code erreur.

---

# Contraintes importantes (obligatoires)

Parcourir chaque middleware et controller.

Vérifier systématiquement :

## 1. Tous les try/catch

Exemple :

```ts
try {

}
catch(error){

}
```

---

## 2. Tous les throw

Exemple :

```ts
throw new Error()
```

---

## 3. Tous les res.status()

Exemple :

```ts
res.status(500)
res.status(401)
res.status(403)
res.status(404)
```

---

## 4. Toutes les branches conditionnelles d'erreur

Exemples :

```ts
if (...) return res(...)

if (...) throw ...

if(!data)

if(!user)

if(!token)

if(!session)
```

et tous les cas similaires.

---

## 5. Toutes les erreurs async

Exemples :

```ts
await service()

await Promise.all()

await stripe....

await database....
```

---

## 6. Toutes les promesses susceptibles d’échouer

Identifier tous les appels externes :

- API
- Stripe
- base de données
- stockage
- services tiers
- IA
- fichiers
- upload
- téléchargement

---

# Règles de modification

## Ne pas :

- modifier la logique métier ;
- modifier les flux applicatifs ;
- déplacer du code ;
- refactoriser des fichiers ;
- changer les signatures ;
- renommer des variables ;
- créer une nouvelle architecture ;
- ajouter de nouveaux middlewares ;
- ajouter des helpers ;
- ajouter un nouveau système de log.

---

# Interdictions

Interdit de :

- doubler les logs existants ;
- créer plusieurs logs pour une même erreur ;
- modifier le comportement actuel.

---

# Cas particuliers

### Si un logger existe déjà :

Ajouter uniquement le code erreur.

Exemple :

Avant :

```ts
logger.error(error)
```

Après :

```ts
logger.error({
   code:"ctrl_auth_err2",
   error
})
```

---

### Si une erreur frontend existe sans log :

Ajouter le log.

---

### Si un log existe sans réponse frontend :

Conserver uniquement le log avec le code.

---

### Si aucune gestion d’erreur n’existe :

Ne rien inventer inutilement.

Ne pas créer artificiellement des blocs try/catch.

---

# Vérification finale obligatoire

Après modifications, fournir :

## 1.

Liste des fichiers modifiés

---

## 2.

Nombre de codes erreur ajoutés par fichier

Exemple :

```txt
auth.controller.ts : 4
billing.controller.ts : 6
upload.middleware.ts : 2
```

---

## 3.

Zones ambiguës ou non modifiées

---

## 4.

Anomalies détectées

Exemple :

- double gestion erreur
- erreur non traitée
- logger incohérent
- code mort
- branche inaccessible
