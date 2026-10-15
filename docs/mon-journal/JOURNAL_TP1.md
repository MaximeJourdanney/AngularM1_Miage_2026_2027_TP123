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
