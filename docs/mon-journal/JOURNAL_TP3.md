# Journal de bord personnel — TP3

Ce document regroupe mes notes de développement pour le TP3, les explications des fonctionnalités ajoutées (suppression, suivi de progression d'upload, tests automatisés) et les fiches de révision pour la soutenance orale.

---

## Mission 5 — Suppression d’une piste

### 1. Objectif de la mission :
Permettre la suppression d'une piste audio via l'endpoint sécurisé `DELETE /api/tracks/:id`. La suppression doit demander une confirmation explicite, afficher un état de chargement pour éviter les doubles clics, notifier l'utilisateur par un composant Toast / SnackBar, mettre à jour la page (avec recul d'une page si la page courante devient vide) et gérer les cas d'erreur (404 si la piste a déjà été supprimée).

---

### 2. Architecture et flux de suppression

```text
[Utilisateur clique sur 🗑️]
      │ 1. Boîte de dialogue de confirmation : window.confirm(...)
      ▼
[TracksPageComponent] (tracks-page.ts)
      │ 2. Active this.deletingId.set(track.id) (désactive le bouton immédiatement)
      │ 3. Si le morceau était en cours d'écoute, stoppe le player et révoque l'ObjectURL
      │ 4. Appelle this.service.delete(track.id).subscribe(...)
      ▼
[TrackService] (track.service.ts)
      │ 5. Déclenche this.http.delete('/api/tracks/' + id)
      ▼
[authInterceptor] (auth.interceptor.ts)
      │ 6. Injecte l'en-tête Authorization: Bearer <token>
      ▼
[API Express Backend] (backend/src/app.js)
      │ 7. Le middleware auth vérifie la validité du token JWT et extrait req.auth.sub
      │ 8. Recherche et suppression atomique en base :
      │    Track.findOneAndDelete({ _id: id, ownerId: req.auth.sub })
      │ 9. Supprime le fichier audio physique sur le disque serveur (fsPromises.unlink)
      │ 10. Renvoie 200 { message: "Piste supprimée" } ou 404 { message: "Piste inconnue" }
      ▼
[TracksPageComponent] (.subscribe({ next }))
      │ 11. Réinitialise deletingId.set(null)
      │ 12. Affiche un Toast vert : "Le morceau ... a été supprimé"
      │ 13. Si tracks.length === 1 et page > 1, this.page.set(page - 1)
      │ 14. Déclenche this.load() pour recharger la liste synchronisée avec le serveur
```

---

### 3. Pourquoi le Guard et l’interface ne suffisent pas à sécuriser la suppression ?
* **Rôle du Guard Angular (`authGuard`) :** Il s'exécute uniquement dans le navigateur du client. Il interdit simplement l'accès visuel à la route `/tracks` si l'utilisateur n'a pas de token.
* **Vulnérabilité côté client :** Un utilisateur ou un attaquant peut ouvrir un terminal, Postman ou la console de son navigateur et émettre directement une requête HTTP :
  ```bash
  curl -X DELETE http://localhost:3000/api/tracks/id_d_un_autre_utilisateur
  ```
* **Seul le backend assure la sécurité :** Le serveur Express vérifie l'authenticité de la signature cryptographique du JWT et applique le filtre MongoDB `{ _id: req.params.id, ownerId: req.auth.sub }`. Même si un utilisateur malveillant devine l'identifiant d'une piste appartenant à quelqu'un d'autre, la requête sera rejetée avec un code 404/403.

---

## Mission 6 — Progression de l’upload

### 1. Suivi d’événements HTTP en temps réel

* **Fonctionnement dans `TrackService` :**
  ```typescript
  uploadWithProgress(file: File, title: string) {
    const body = new FormData();
    body.append('audio', file);
    body.append('title', title);
    return this.http.post<Track>('/api/tracks', body, {
      reportProgress: true, // Demande à XMLHttpRequest d'émettre les événements progress
      observe: 'events',    // Permet de recevoir le flux complet des HttpEvent
    });
  }
  ```

* **Traitement dans `TracksPageComponent` :**
  * `HttpEventType.UploadProgress` : Le navigateur informe du nombre d'octets transférés (`event.loaded`) par rapport à la taille totale (`event.total`). Le composant calcule le pourcentage :
    $$\text{percent} = \text{Math.round}\left(\frac{100 \times \text{event.loaded}}{\text{event.total}}\right)$$
  * Ce pourcentage alimente le Signal `uploadProgress()`, qui anime instantanément la largeur de la barre de progression (`[style.width.%]="uploadProgress()"`).
  * `HttpEventType.Response` : Signal de fin émis par le backend. On fixe la barre à 100%, on passe le statut à `success`, on vide le formulaire et on recharge la page 1.

---

### 2. Pourquoi un upload avec progression ne se traite pas comme une requête HTTP classique ?
* **Requête classique (`observe: 'body'`) :** L'Observable n'émet **qu'une seule et unique valeur finale** lorsque la réponse du serveur est totalement reçue et parsée en JSON. Il est impossible de savoir où en est le transfert pendant qu'il a lieu.
* **Requête avec progression (`observe: 'events'` et `reportProgress: true`) :** L'Observable devient un **flux continu d'événements multiples** :
  1. Événement `Sent` (la requête a quitté le client) ;
  2. Multiples événements `UploadProgress` successifs émis au fur et à mesure que les paquets TCP sont émis ;
  3. Événement `ResponseHeader` ;
  4. Événement final `Response` contenant le corps de réponse JSON.
* Le code doit donc utiliser des conditions (`if (event.type === HttpEventType.UploadProgress)`) pour distinguer les étapes intermédiaires de la réponse finale.

---

## Mission 7 — Tests automatisés

Pour exécuter les tests :
```bash
npm test
```

### 1. Rapport des tests exécutés (Vitest)
6 tests unitaires automatisés ont été écrits et validés avec succès :

| Fichier de test | Test exécuté | Résultat |
|---|---|---|
| `auth.service.spec.ts` | `login()` émet `POST /api/auth/login` avec le bon corps JSON et met à jour `token` et `currentUser` | ✅ Succès (21 ms) |
| `auth.service.spec.ts` | `logout()` nettoie le `localStorage` et remet à zéro les Signals | ✅ Succès |
| `track.service.spec.ts` | `list(2, 5)` transmet les paramètres HTTP `page=2` et `limit=5` dans l'URL | ✅ Succès (17 ms) |
| `track.service.spec.ts` | `delete(id)` émet une requête `DELETE /api/tracks/:id` | ✅ Succès |
| `auth.interceptor.spec.ts` | Ajoute l'en-tête `Authorization: Bearer <token>` si un token est présent | ✅ Succès (18 ms) |
| `auth.interceptor.spec.ts` | N'ajoute pas d'en-tête `Authorization` si le token est null (routes publiques) | ✅ Succès |

**Bilan :** 6 passed (100%), temps d'exécution total : 1.39s.

---

## Questions pour la restitution orale

### 1. Pourquoi la suppression passe-t-elle par un service ?
* Pour respecter le principe de responsabilité unique (SRP) et la séparation des couches :
  * Le **composant** ne gère que l'affichage graphique, les interactions de l'utilisateur (clics, confirmation) et les états visuels (chargement, notifications).
  * Le **service** encapsule la logique réseau, les URL de l'API et la configuration de `HttpClient`. Cela permet de réutiliser cette logique partout et de tester le composant ou le service indépendamment en mockant les requêtes.

### 2. Comment le backend protège-t-il la suppression ?
* Le middleware `auth` décode le token JWT et injecte l'identifiant de l'utilisateur (`req.auth.sub`).
* La requête Mongoose utilise un filtre combiné : `Track.findOneAndDelete({ _id: req.params.id, ownerId: req.auth.sub })`.
* Si un utilisateur tente de supprimer une piste qui ne lui appartient pas, MongoDB ne trouve aucun document correspondant et le serveur renvoie une erreur 404 sans toucher aux données.

### 3. Comment Angular calcule-t-il le pourcentage d’upload ?
* En activant `reportProgress: true` et `observe: 'events'` sur la requête POST.
* Le navigateur déclenche l'événement `UploadProgress` qui fournit `event.loaded` (octets déjà transférés) et `event.total` (taille totale du fichier). Le ratio $\frac{event.loaded}{event.total} \times 100$ donne le pourcentage exact en temps réel.

### 4. Pourquoi les tests HTTP n’ont-ils pas besoin de MongoDB ni d’un serveur en fonctionnement ?
* Grâce au module `provideHttpClientTesting()` et à `HttpTestingController` :
* Au lieu d'ouvrir une vraie connexion réseau vers `http://localhost:3000`, Angular intercepte les requêtes en mémoire.
* Le test vérifie que la requête générée a la bonne URL, la bonne méthode et les bons paramètres, puis simule une réponse immédiate avec `req.flush(mockData)`. Les tests sont donc déterministes, ultra-rapides (< 100 ms) et indépendants de l'environnement extérieur.

### 5. Que vérifie un test d’intercepteur ou de guard ?
* **Test d'intercepteur :** Vérifie que pour toute requête sortante, l'en-tête `Authorization: Bearer <token>` est correctement injecté si le token existe, et absent sinon.
* **Test de guard :** Vérifie que la fonction `authGuard` autorise la navigation si un token est présent, ou bloque la route et redirige l'utilisateur vers `/login` dans le cas contraire.

### 6. Quelle différence existe-t-il entre un test unitaire et un test d’intégration ?
* **Test unitaire :** Isole une brique élémentaire unique (une fonction, un service ou une méthode de composant) en remplaçant toutes ses dépendances par des doublons (mocks / stubs). But : vérifier la logique interne isolée.
* **Test d'intégration :** Teste la collaboration entre plusieurs composants réels (ex : un composant connecté à son vrai service, avec le routeur et les intercepteurs) pour vérifier qu'ils fonctionnent correctement ensemble dans un scénario réaliste.
