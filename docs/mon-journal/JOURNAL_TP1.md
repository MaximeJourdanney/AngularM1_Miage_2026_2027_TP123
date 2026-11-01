# Journal de bord personnel — TP1

Ce document regroupe mes notes pas à pas, les explications simples de chaque étape et les réponses aux questions du TP1.

---

## Mission 0 — Cartographier l’application

### Objectif de la mission :
Comprendre comment l'application est structurée sans modifier le code : identifier les composants racines, les routes, l'injection de `HttpClient`, les modèles, les services et le fonctionnement du jeton JWT.

---

### 1. Composant racine et configuration des routes

* **Composant racine :** `AppComponent`
  * **Emplacement :** `frontend-starter/src/app/components/app/app.ts` (`app.html`, `app.css`).
  * **Démarrage :** Initialisé dans `frontend-starter/src/main.ts` via la fonction `bootstrapApplication(AppComponent, ...)`.
  * **Rôle :** Affiche la barre d'en-tête de l'application (titre + navigation) et contient la balise `<router-outlet />`, le point d'insertion dynamique où s'affichent les pages selon la route courante.

* **Configuration des routes :**
  * **Emplacement :** `frontend-starter/src/app/routes.ts`.
  * **Table des routes :**
    * `''` : redirection automatique vers `/tracks`.
    * `/login` : charge `LoginPageComponent`.
    * `/register` : charge `RegisterPageComponent`.
    * `/profile` : charge `ProfilePageComponent` (protégé par `canActivate: [authGuard]`).
    * `/tracks` : charge `TracksPageComponent` (protégé par `canActivate: [authGuard]`).
    * `'**'` : route wildcard redirigeant vers `/tracks`.
  * **Protection :** `authGuard` vérifie si `authService.token()` existe dans le signal / `localStorage`. S'il n'y a pas de jeton, l'utilisateur est redirigé vers `/login`.

---

### 2. Enregistrement de `HttpClient` et mécanisme JWT

* **Enregistrement de `HttpClient` :**
  * **Emplacement :** `frontend-starter/src/main.ts`.
  * **Code :**
    ```typescript
    provideHttpClient(withInterceptors([authInterceptor]))
    ```
  * **Explication :** Enregistre `HttpClient` au niveau racine de l'application (standalone) et lui associe l'intercepteur `authInterceptor` pour toutes les requêtes sortantes.

* **Mécanisme d'ajout du JWT :**
  * **Emplacement :** `frontend-starter/src/app/shared/interceptors/auth.interceptor.ts`.
  * **Fonctionnement :**
    1. L'intercepteur injecte `AuthService` et lit le token réactif `auth.token()`.
    2. Si le token est présent, il clone la requête HTTP et lui ajoute l'en-tête :
       ```http
       Authorization: Bearer <token>
       ```
    3. Si aucun token n'est stocké (ex: requête `/login` ou `/register`), la requête est envoyée telle quelle sans modification.

---

### 3. Modèles, Services et Pages

* **Modèles (`frontend-starter/src/app/shared/models/`) :**
  * `user.model.ts` : `User` (`id`, `name`, `email`, `createdAt`).
  * `auth-response.model.ts` : `AuthResponse` (`token`, `user`).
  * `track.model.ts` : `Track` (`id`, `title`, `originalName`, `mimeType`, `size`, `createdAt`).
  * `page.model.ts` : `Page<T>` (`items`, `page`, `limit`, `total`, `pages`).

* **Services (`frontend-starter/src/app/shared/services/`) :**
  * `auth.service.ts` : Gère l'authentification (`login`, `register`, `logout`), le chargement et la mise à jour du profil (`profile`, `update`), et maintient l'état réactif via des Signals (`currentUser`, `token`) synchronisés avec le `localStorage`.
  * `track.service.ts` : Gère la liste paginée des morceaux de guitare (`list`), l'upload multipart audio (`upload`) et la génération de l'URL de streaming (`streamUrl`).

* **Pages / Vues (`frontend-starter/src/app/components/`) :**
  * `login-page/` : Formulaire réactif de connexion (`email`, `password`).
  * `register-page/` : Formulaire réactif d'inscription (`name`, `email`, `password`).
  * `profile-page/` : Consultation des informations du profil et mise à jour du nom.
  * `tracks-page/` : Liste paginée des pistes audio et zone d'upload de fichiers audio.

---

### 4. Schéma annoté du flux lors d'un clic sur « Se connecter »

```text
[Utilisateur]
     │ 1. Saisie des identifiants et clic sur "Se connecter"
     ▼
[LoginPageComponent] (login-page.ts)
     │ 2. Lit les valeurs du formulaire réactif (email, password)
     │ 3. Appelle this.auth.login(email, password).subscribe(...)
     ▼
[AuthService] (auth.service.ts)
     │ 4. Déclenche this.http.post<AuthResponse>('/api/auth/login', { email, password })
     ▼
[HttpClient + authInterceptor] (auth.interceptor.ts)
     │ 5. L'intercepteur vérifie si un token existe (ici null -> requête inchangée)
     ▼
[Proxy Angular] (proxy.conf.json)
     │ 6. Réécrit et redirige /api/* vers http://localhost:3000/api/*
     ▼
[Serveur Express Backend] (backend/src/app.js)
     │ 7. Le middleware express.json() parse le corps de la requête
     │ 8. Recherche de l'utilisateur dans MongoDB Atlas : User.findOne({ email }).select('+passwordHash')
     │ 9. Vérification du hash du mot de passe avec bcrypt (user.verifyPassword)
     │ 10. Génération du token JWT signé (avec clé secrète JWT_SECRET, expiration 2h)
     ▼
[Réponse HTTP 200]
     │ Corps : { token: "eyJhbGciOi...", user: { id: "...", name: "Demo", email: "demo@example.com" } }
     ▼
[AuthService] (auth.service.ts via .pipe(tap(...)))
     │ 11. Sauvegarde du token dans localStorage.setItem('gpc_token', token)
     │ 12. Met à jour les Signals : token.set(token) et currentUser.set(user)
     ▼
[LoginPageComponent] (.subscribe({ next }))
     │ 13. Log en console : "[LoginPage] Connexion réussie"
     │ 14. Redirection automatique : router.navigateByUrl('/tracks')
```

---

### 5. Distinction des routes de l'API (Contrat HTTP)

* **Routes Publiques (accessibles sans JWT) :**
  * `GET /api/health` : Contrôle de santé du serveur (`{ "status": "ok" }`).
  * `POST /api/auth/register` : Création de compte (`{ name, email, password }` -> `201 { token, user }`).
  * `POST /api/auth/login` : Connexion (`{ email, password }` -> `200 { token, user }`).

* **Routes Protégées (en-tête `Authorization: Bearer <token>` requis) :**
  * `GET /api/users/me` : Récupération des informations de l'utilisateur connecté.
  * `PUT /api/users/me` : Modification du nom (`{ name }`).
  * `GET /api/tracks?page=1&limit=5` : Récupération paginée des pistes appartenant à l'utilisateur.
  * `POST /api/tracks` : Upload multipart d'un morceau audio (`audio` + `title`).
  * `GET /api/tracks/:id/audio` : Streaming binaire du fichier audio.
  * `DELETE /api/tracks/:id` : Suppression d'une piste.


---

## Mission 1 — Inscription, Connexion et Profil

### Objectif de la mission :
Implémenter complètement la gestion des utilisateurs : formulaires réactifs avec validation côté client, persistance de session JWT sans fuite dans les logs, synchronisation d'état avec les Signals, déconnexion avec nettoyage local, chargement automatique du profil (`/api/users/me`), modification du nom et interception des erreurs HTTP 401 pour déconnexion automatique.

---

### 1. Implémentations réalisées

1. **Service d'authentification (`frontend-starter/src/app/shared/services/auth.service.ts`) :**
   * Gestion de deux Signals : `currentUser` (données de l'utilisateur) et `token` (jeton JWT).
   * Persistance synchrone dans `localStorage` (`gpc_token` et `gpc_user`) pour préserver la session au rafraîchissement du navigateur.
   * Méthodes `login()`, `register()`, `profile()`, `update()` et `logout()`.

2. **Intercepteur HTTP (`frontend-starter/src/app/shared/interceptors/auth.interceptor.ts`) :**
   * Injection transparente du header `Authorization: Bearer <token>` sur chaque requête protégée.
   * Détection des erreurs HTTP `401 Unauthorized` (token expiré ou corrompu) : appel immédiat de `auth.logout()` et redirection automatique vers `/login`.

3. **Composant racine & Navigation (`frontend-starter/src/app/components/app/`) :**
   * Navigation dynamique basée sur le Signal `auth.token()` : affichage de « Backing tracks », « Profil » et du bouton « Déconnexion » pour les utilisateurs authentifiés ; « Connexion » et « Inscription » pour les visiteurs.
   * Nettoyage de l'état local et redirection propre lors du clic sur « Déconnexion ».

4. **Page de Profil (`frontend-starter/src/app/components/profile-page/`) :**
   * Chargement automatique dès l'accès à la page via `ngOnInit()` appelant `this.auth.profile()`.
   * Formulaire réactif pré-rempli permettant la mise à jour du nom d'artiste via `PUT /api/users/me`.
   * Affichage de messages de succès et de messages d'erreur compréhensibles.

5. **Formulaires réactifs Inscription & Connexion (`login-page/` et `register-page/`) :**
   * Validation en temps réel : email au format valide, mot de passe requis d'au moins 8 caractères pour l'inscription, nom requis.
   * Désactivation des boutons d'envoi si le formulaire est invalide ou pendant le chargement (`loading()`).

---

### 2. Réponses aux questions théoriques du TP1

#### Q1 : Quelle est la différence entre un Signal et le `localStorage` ?
* **Signal Angular :**
  * C'est une primitive de réactivité en **mémoire vive (RAM)** propre à l'application Angular.
  * Il avertit automatiquement les vues et les composants dès que sa valeur change afin de mettre à jour le DOM sans recharger la page.
  * **Volatilité :** dès que la page est rechargée (F5) ou fermée, l'état du Signal est remis à zéro.
* **`localStorage` :**
  * C'est une API de stockage **persistant sur le disque** fournie par le navigateur web.
  * Les données (uniquement sous forme de chaînes de caractères texte) subsistent après un rechargement de la page et après la fermeture du navigateur.
  * **Absence de réactivité native :** modifier le `localStorage` ne met pas automatiquement à jour l'interface graphique d'Angular.
* **Complémentarité :** Nous utilisons `localStorage` pour sauvegarder le token JWT entre deux sessions, et un `Signal` pour que les composants Angular réagissent instantanément à la présence ou l'absence d'un utilisateur connecté.

---

#### Q2 : Où s'effectue la tâche « mise à jour du profil utilisateur », dans quels fichiers côté front et côté back ?
* **Côté Frontend :**
  1. `frontend-starter/src/app/components/profile-page/profile-page.html` : L'utilisateur modifie son nom dans l'input et soumet le formulaire.
  2. `frontend-starter/src/app/components/profile-page/profile-page.ts` : La méthode `save()` lit la valeur du `FormGroup` et appelle le service.
  3. `frontend-starter/src/app/shared/services/auth.service.ts` : La méthode `update(name)` déclenche `this.http.put<User>('/api/users/me', { name })`.
  4. `frontend-starter/src/app/shared/interceptors/auth.interceptor.ts` : Ajoute l'en-tête `Authorization: Bearer <token>`.
* **Côté Backend :**
  1. `backend/src/app.js` (Route `PUT /api/users/me`) :
     * Le middleware `requireAuth` vérifie le jeton JWT et extrait l'identifiant de l'utilisateur (`req.userId`).
     * Récupère le nouveau champ `name` du corps de requête `req.body`.
     * Exécute la mise à jour MongoDB : `User.findByIdAndUpdate(req.userId, { name }, { new: true })`.
     * Renvoie le document utilisateur mis à jour au format JSON (statut 200).

---

#### Q3 : Quel modèle utilisez-vous dans votre assistant IA ? Comment savoir combien vous avez consommé de tokens ? Qui peut vous conseiller sur le meilleur modèle ?
* **Modèle utilisé :** Nous utilisons **Gemini 3.8 Flash** (modèle multimodal rapide et efficace pour le développement de code et l'analyse documentaire).
* **Consommation de tokens :**
  * La consommation est consultable dans la console développeur / tableau de bord de l'API (Google AI Studio ou Google Cloud Vertex AI), ou directement dans l'interface de l'IDE / plugin indiquant les métriques d'usage par requête et par session (tokens d'entrée + tokens de sortie).
* **Conseil pour le meilleur modèle :**
  * La documentation officielle (ex: Google AI documentation, benchmarks LMSYS Chatbot Arena) fournit les critères de latence, de coût et de capacité de raisonnement.
  * Pour des tâches simples et itératives de développement web : les modèles rapides dits *Flash* ou *Mini* sont optimaux. Pour de la conception d'architectures complexes ou des preuves formelles : les modèles dits *Pro* ou *Reasoning* sont recommandés.

---

#### Q4 : Quelles sont les différentes routes du backend utilisées dans ce TP1 ?
1. `POST /api/auth/register` : Inscription d'un nouvel utilisateur.
2. `POST /api/auth/login` : Authentification et délivrance du JWT.
3. `GET /api/users/me` : Lecture des informations du profil connecté.
4. `PUT /api/users/me` : Modification du nom du profil connecté.
5. `GET /api/health` : Contrôle de santé du serveur.
