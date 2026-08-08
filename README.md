# ChristLab Team — Console d'administration (web)

Dashboard web **statique** (HTML/CSS/JS, **sans build**) qui consomme l'API `/api/admin/*`
du backend ChristLab (Railway). Connexion par compte **administrateur** (JWT).

Fichiers : `index.html`, `styles.css`, `app.js`. Rien à installer.

---

## Modules

Connexion admin, puis menu : **Tableau de bord, Utilisateurs** (suspendre/réactiver),
**Administrateurs, Pistes, Artistes, Pépites, Publicités, Paiements, Dividendes, Réglages,
Règles métier, Journal d'audit**. Le rendu est générique (tableaux / cartes de stats) et
s'adapte aux données renvoyées par l'API.

Actions d'écriture disponibles à ce jour : **Pistes** (créer / éditer / supprimer),
**Artistes** (créer / éditer + voir les chants), **Pépites** (créer / éditer / supprimer),
**Administrateurs** (créer / éditer), **Utilisateurs** (éditer / suspendre),
**Règles métier** (éditer). Restent à faire : **Publicités**, **Paiements**.

Chaque tableau dispose d'un champ **Filtrer…** (recherche instantanée côté navigateur).

### Notes sur le catalogue (Pistes / Artistes)

- La **liste** des pistes vient de la route publique `GET /api/tracks?lang=fr` : le backend
  n'expose pas de `GET /api/admin/tracks` (seulement `POST` / `PUT` / `DELETE`).
  Le paramètre **`lang=fr` est obligatoire** — sans lui le backend traduit `genre` et
  `heartStates` selon la langue du navigateur, et une simple édition réécrirait en base des
  valeurs traduites au lieu des valeurs canoniques (françaises).
- L'**artiste d'une piste se choisit dans une liste déroulante** alimentée par `/api/admin/artists`.
  Le formulaire envoie `artistId` **et** `artist` (façade texte du contrat ALN-002) pour qu'ils
  restent cohérents. Un artiste doit donc exister avant qu'on lui rattache une piste.
- L'édition d'une piste est un **remplacement complet** (`PUT` = `TrackCreateRequest`) : tous
  les champs sont renvoyés, y compris vides. Les listes fermées (genre, type, langue, continent,
  états du cœur) sont des menus alignés sur l'app Android.
- Le backend **ne propose pas de suppression d'artiste** : on le passe en statut `SUSPENDED`
  ou `ARCHIVED` via l'édition.

---

## ⚠️ 1. CORS (indispensable pour que le dashboard fonctionne)

Le backend n'autorise, **en production**, que les origines listées dans la variable de
config **`cors.allowedHosts`** (en HTTPS). Tant que l'URL du dashboard n'y est pas, le
navigateur **bloquera** tous les appels.

Deux façons de faire :
- **A. Héberger le dashboard** (voir §2) puis ajouter son URL (sans `https://`) à
  `cors.allowedHosts` côté **Railway** (variables du service backend), séparées par des
  virgules. Ex. : `cors.allowedHosts = admin.christlab.com, christlab-admin.up.railway.app`.
- **B. Le servir depuis le backend** (même origine → pas de CORS). Demande une petite
  modif du backend (service statique Ktor). Je peux la faire si tu veux.

> Test purement local (`file://` / `localhost`) : bloqué par le CORS de prod. Pour bricoler
> en local, on peut temporairement pointer un backend en mode dev (`?base=http://localhost:PORT`
> dans l'URL) qui autorise `anyHost()`.

## 2. Héberger le dashboard (obtenir une URL HTTPS)

Au choix, sans code :
- **Netlify** (le plus simple) : glisser-déposer le dossier `christlab-admin` sur
  app.netlify.com → URL HTTPS immédiate.
- **Railway** : nouveau service « static » pointant ce dossier.
- **GitHub Pages** : si le dépôt est public (Settings → Pages).

Puis reporter l'URL dans `cors.allowedHosts` (§1).

## 3. Compte administrateur

Il faut se connecter avec un compte ayant un **rôle admin** (`SUPER_ADMIN` ou
`DELEGATED_ADMIN`) côté backend. Le **premier** SUPER_ADMIN doit exister en base
(bootstrap côté backend) ; ensuite, il peut créer les autres admins depuis la console.
→ Utilise l'e-mail / mot de passe de ton compte admin existant.

## 4. Configuration

- Backend visé par défaut : `https://christlab-backend-production.up.railway.app`
  (défini en haut de `app.js`, `DEFAULT_BASE`).
- Surcharge possible : `?base=https://autre-backend` dans l'URL, ou
  `localStorage.setItem('cl_admin_base', 'https://...')`.

## 5. Prochaines étapes

- Actions d'écriture restantes : **Publicités**, **Paiements**.
- Pagination / filtres serveur sur les grandes listes (le filtre actuel est côté navigateur).
- Téléversement des fichiers audio et pochettes (aujourd'hui : on saisit une URL).
- Gestion fine des rôles & permissions (SUPER_ADMIN vs DELEGATED_ADMIN).
- Éventuel : servir le dashboard depuis le backend (même origine, zéro CORS).
