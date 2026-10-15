# Rapport d'usage de l'IA — TP1

## Mission 0 — Cartographier l’application

### 1. Objectif
Comprendre l'architecture globale de l'application Angular 22 standalone et de son backend Express/Mongoose sans modifier le code : repérer le composant racine, la configuration des routes, l'enregistrement de `HttpClient`, les modèles/services/pages, le mécanisme d'interception JWT, le schéma annoté du flux lors d'une connexion et la distinction entre routes publiques et protégées.

### 2. Prompt principal
> "Faisons toute la mission 0 et on note tout dans mon journal de bord et le rapport IA" (précédé de la demande d'analyse de l'architecture, identification des composants racines, routes, services, interceptors et contrat d'API).

### 3. Plan proposé par l'agent
1. Localiser le composant racine (`AppComponent`) et la configuration du routage (`routes.ts`).
2. Identifier l'enregistrement de `HttpClient` et de son intercepteur d'authentification (`authInterceptor`).
3. Inventorier les modèles TypeScript (`User`, `AuthResponse`, `Track`, `Page`), les services (`AuthService`, `TrackService`) et les composants pages.
4. Tracer et annoter le diagramme séquentiel complet d'une connexion (du clic utilisateur jusqu'à la base MongoDB Atlas et le retour avec token JWT).
5. Classifier les routes de `API_CONTRACT.md` en routes publiques et protégées.

### 4. Vérifications réalisées par le binôme
- Vérification visuelle du fichier `src/main.ts` et des fonctions de bootstrap standalone Angular.
- Examen du fichier `src/app/routes.ts` et vérification de la présence de `authGuard`.
- Examen du mécanisme d'interception dans `src/app/shared/interceptors/auth.interceptor.ts`.
- Vérification de la configuration du proxy dans `proxy.conf.json` pointant vers `http://localhost:3000`.
- Comparaison entre les routes déclarées dans `docs/technique/API_CONTRACT.md` et les implémentations Express dans `backend/src/app.js`.

### 5. Erreurs ou propositions rejetées
- **Rejet du déplacement des fichiers officiels :** L'agent a suggéré au départ de ranger tous les fichiers de `docs/` dans des sous-dossiers. Après analyse des consignes (`VOUS DEVEZ METTRE A JOUR LE FICHIER RAPPORT_IA_MODELE.md`), cette proposition a été ajustée pour préserver l'emplacement exact attendu par les enseignants et les scripts de notation, tout en créant un dossier dédié `docs/mon-journal/` pour les notes personnelles.

### 6. Fichiers effectivement modifiés / consultés
* **Fichiers consultés (lecture seule) :**
  * `frontend-starter/src/main.ts`
  * `frontend-starter/src/app/routes.ts`
  * `frontend-starter/src/app/components/app/app.ts` & `app.html`
  * `frontend-starter/src/app/components/login-page/login-page.ts` & `login-page.html`
  * `frontend-starter/src/app/shared/services/auth.service.ts`
  * `frontend-starter/src/app/shared/interceptors/auth.interceptor.ts`
  * `frontend-starter/src/app/shared/guards/auth.guard.ts`
  * `frontend-starter/src/app/shared/models/*.ts`
  * `backend/src/app.js`
  * `docs/technique/API_CONTRACT.md`
* **Fichiers créés / mis à jour :**
  * `docs/mon-journal/JOURNAL_TP1.md` (journal personnel de révision)
  * `docs/RAPPORT_IA_MODELE.md` (présent rapport)

### 7. Preuve de fonctionnement
* Application frontend lancée et accessible sur `http://localhost:4200`.
* Backend Express connecté à MongoDB Atlas et accessible sur `http://localhost:3000/api/health` renvoyant `{ "status": "ok" }`.
* Cartographie complète validée et consignée dans `docs/mon-journal/JOURNAL_TP1.md`.

### 8. Ce que chaque membre du binôme sait maintenant expliquer sans l'agent
* **Démarrage Angular 22 :** Savoir expliquer comment `bootstrapApplication(AppComponent, ...)` initialise l'application sans `AppModule` et comment `provideHttpClient(withInterceptors([authInterceptor]))` fournit le client HTTP avec injection de dépendances moderne.
* **Fonctionnement de l'intercepteur HTTP :** Savoir expliquer que chaque requête HTTP émise par Angular passe par `authInterceptor`, qui lit le Signal `token()`, clone la requête pour y greffer le header HTTP `Authorization: Bearer <token>`, puis la transmet au backend.
* **Trajet complet d'une connexion :** Savoir détailler le flux de bout en bout : Composant (`LoginPageComponent`) -> Service (`AuthService.login`) -> `HttpClient` -> `proxy.conf.json` -> Backend Express (`/api/auth/login`) -> Requête MongoDB (`User.findOne`) -> Hash bcrypt -> Signature JWT -> Réponse HTTP -> Stockage `localStorage` + Signal -> Redirection via `Router`.
* **Sécurité :** Savoir pourquoi les mots de passe et les secrets JWT ne doivent jamais transiter dans les logs, le code source frontend ou le dépôt Git.
