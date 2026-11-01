# Journal de bord personnel — TP2

Ce document regroupe mes notes de conception, les explications simples des mécanismes mis en œuvre et les réponses aux questions théoriques du TP2.

---

## Mission 2 — Bibliothèque paginée

### 1. Objectif de la mission :
Afficher la liste des morceaux audio appartenant à l'utilisateur sous forme de pagination pilotée par le serveur via l'endpoint `GET /api/tracks?page=...&limit=5`. L'état local est entièrement géré par des Signals Angular.

---

### 2. Architecture et flux de pagination

```text
[Bouton Préc / Suiv ou Initialisation]
      │
      ▼
[TracksPageComponent] (tracks-page.ts)
      │ 1. Met à jour le Signal this.page.set(page)
      │ 2. Active le Signal this.loading.set(true)
      │ 3. Appelle this.service.list(this.page(), 5).subscribe(...)
      ▼
[TrackService] (track.service.ts)
      │ 4. Déclenche this.http.get<Page<Track>>('/api/tracks', { params: { page, limit: 5 } })
      ▼
[authInterceptor] (auth.interceptor.ts)
      │ 5. Ajoute l'en-tête Authorization: Bearer <token>
      ▼
[API Express / MongoDB Atlas] (backend/src/app.js)
      │ 6. Parallélise la recherche et le décompte :
      │    Promise.all([
      │      Track.find({ ownerId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      │      Track.countDocuments({ ownerId })
      │    ])
      ▼
[Réponse JSON HTTP 200]
      │ { items: Track[], page: 1, limit: 5, total: 12, pages: 3 }
      ▼
[TracksPageComponent] (.subscribe({ next }))
      │ 7. Met à jour les Signals :
      │    this.tracks.set(response.items);
      │    this.pages.set(response.pages);
      │    this.total.set(response.total);
      │    this.loading.set(false);
      ▼
[Vue HTML] (tracks-page.html)
      │ 8. Rendu réactif avec @if (loading()), @for (track of tracks()), @empty si vide
      │ 9. Boutons Précédent / Suivant désactivés aux bornes (page === 1 et page === pages)
```

---

### 3. Pourquoi une pagination serveur plutôt qu'un découpage côté client ?
* **Économie de bande passante et de mémoire :** Si un utilisateur possède 5 000 morceaux, charger l'intégralité du catalogue dans le navigateur consommerait plusieurs mégaoctets de données JSON et ralentirait l'application.
* **Rapidité de rendu :** Angular n'a à manipuler dans le DOM que 5 composants / éléments graphiques à la fois au lieu de milliers.
* **Scalabilité de la base de données :** MongoDB utilise l'indexation, `skip()` et `limit()` pour ne renvoyer que le strict nécessaire.

---

## Mission 3 — Analyse, amélioration de l’upload et lecture audio

### 1. Localisation des étapes clés dans le code

| Étape | Fichier | Méthode / Emplacement |
|---|---|---|
| Choix et validation du fichier | `tracks-page.ts` | `choose(event: Event)` |
| Construction du `FormData` | `track.service.ts` | `upload(file: File, title: string)` |
| Requête HTTP multipart d'upload | `track.service.ts` | `this.http.post<Track>('/api/tracks', body)` |
| Récupération binaire du `Blob` | `track.service.ts` | `this.http.get('/api/tracks/:id/audio', { responseType: 'blob' })` |
| Création de l'`ObjectURL` | `tracks-page.ts` | `URL.createObjectURL(blob)` dans `play(track)` |
| Affectation au lecteur audio | `tracks-page.html` | `<audio [src]="audioUrl()" controls autoplay>` |
| Révocation de l'ancienne URL | `tracks-page.ts` | `URL.revokeObjectURL(previousUrl)` dans `play()` et `ngOnDestroy()` |

---

### 2. Sécurité : Pourquoi `<audio src="...">` directement ne fonctionne pas avec une API protégée ?
* Une balise `<audio src="http://localhost:3000/api/tracks/123/audio">` standard délègue la requête de streaming directement au moteur multimédia natif du navigateur.
* **Le problème :** Cette requête multimédia directe du navigateur **ne passe pas par `HttpClient` d'Angular**, et ne bénéficie donc pas de notre `authInterceptor`. Elle part sans l'en-tête `Authorization: Bearer <token>`.
* **La conséquence :** Le backend Express renvoie immédiatement un statut `401 Unauthorized`.
* **La solution mise en œuvre :**
  1. Angular effectue une requête authentifiée via `HttpClient` avec `{ responseType: 'blob' }`. L'intercepteur injecte le JWT.
  2. Angular reçoit les octets binaires sous forme d'un objet JavaScript `Blob`.
  3. On crée un pointeur interne au navigateur via `URL.createObjectURL(blob)` (ex: `blob:http://localhost:4200/9b1deb4d...`).
  4. On assigne ce lien local sécurisé à la balise `<audio [src]="audioUrl()">`.

---

### 3. Contrôles frontend vs Contrôles backend

* **Ce qui est vérifié côté Frontend (`choose` dans `tracks-page.ts`) :**
  * Taille du fichier inférieure ou égale à 25 Mo (`file.size <= 25 * 1024 * 1024`).
  * Type MIME débutant par `audio/` ou format audio reconnu (MP3, WAV, OGG, M4A, FLAC).
  * Présence effective d'un fichier sélectionné.
* **Ce qui est vérifié côté Backend (`backend/src/app.js` avec Multer) :**
  * Limite stricte de taille `limits: { fileSize: 25 * 1024 * 1024 }` (Multer renvoie 400 MulterError si dépassé).
  * Filtre strict `fileFilter` comparant le type MIME à un ensemble de formats autorisés.
  * Vérification de l'authentification et de la propriété de la piste.
* **Pourquoi la validation frontend ne remplace JAMAIS le backend ?**
  * La validation côté client offre un retour utilisateur immédiat (meilleure ergonomie, évite d'envoyer 25 Mo inutilement sur le réseau).
  * Cependant, **le frontend ne peut pas garantir la sécurité**. N'importe quel client malveillant peut contourner Angular en utilisant un outil comme Postman, `curl` ou en modifiant le code dans les DevTools pour envoyer un fichier exécutable malveillant ou de 2 Go. Seul le backend est garant de l'intégrité du serveur.

---

### 4. Réponses aux questions : Mémoire, Buffering et Streaming audio

#### Q1 : Le backend envoie-t-il le fichier entier en mémoire ou peut-il l’envoyer progressivement depuis le disque ?
* **Réponse :** Dans `backend/src/app.js`, la route `GET /api/tracks/:id/audio` utilise `res.sendFile(audioPath)`.
* En interne, Express et la bibliothèque sous-jacente `send` créent un flux de lecture Node.js (`fs.createReadStream`). Le fichier est lu **progressivement par petits morceaux (chunks)** depuis le disque dur et transmis au fur et à mesure sur la socket réseau. Le serveur ne charge donc pas les 25 Mo en mémoire RAM d'un seul coup.

#### Q2 : Avec `HttpClient` et `responseType: "blob"`, à quel moment le composant reçoit-il généralement le fichier ?
* **Réponse :** Par défaut, un appel `HttpClient.get(..., { responseType: 'blob' })` attend que **l'intégralité du corps de la réponse HTTP soit téléchargée** avant d'instancier l'objet `Blob` et d'émettre la valeur dans l'Observable. Le composant Angular ne reçoit donc le Blob qu'une fois le téléchargement 100% achevé.

#### Q3 : Si la bibliothèque contient 100 morceaux, les 100 fichiers audio sont-ils chargés en mémoire dès l'affichage de la liste ? Justifier la réponse à partir du code.
* **Réponse :** **Non, absolument pas.**
* **Justification :** L'appel initial `TrackService.list(page, 5)` ne récupère que des métadonnées JSON (titre, nom original, taille, id). La méthode `TrackService.audio(id)` n'est déclenchée que lorsque l'utilisateur clique explicitement sur le bouton `▶ Écouter` d'une carte (`play(track)`). Aucun fichier audio n'est donc chargé à l'affichage de la liste. De plus, la pagination limite la liste à 5 morceaux par page.

#### Q4 : Quelle différence y aurait-il avec 100 éléments `<audio>` utilisant directement une URL HTTP ?
* **Réponse :** Si une page contenait 100 éléments `<audio src="...">`, le navigateur tenterait d'ouvrir 100 connexions réseau ou d'effectuer des pré-chargements de métadonnées audio (`preload="auto"` ou `"metadata"`). Cela entraînerait une saturation des requêtes réseau, une consommation inutile de bande passante et de mémoire tampon (buffer), et ici des erreurs `401 Unauthorized` immédiates car le token JWT ne serait pas transmis.

#### Q5 : Pourquoi l'URL créée par `URL.createObjectURL` doit-elle être révoquée ?
* **Réponse :** À chaque appel de `URL.createObjectURL(blob)`, le navigateur garde en mémoire vive une référence interne vers les octets du `Blob` tant que le document est actif. Le ramasse-miettes (Garbage Collector) ne peut pas libérer cette mémoire.
* Si l'utilisateur écoute successivement plusieurs dizaines de morceaux sans révocation, la mémoire RAM du navigateur enfle indéfiniment (**fuite de mémoire**).
* Appeler `URL.revokeObjectURL(url)` (dans `play()` pour l'ancien morceau et dans `ngOnDestroy()` à la fermeture du composant) permet d'indiquer au navigateur que la ressource peut être immédiatement libérée de la mémoire.

