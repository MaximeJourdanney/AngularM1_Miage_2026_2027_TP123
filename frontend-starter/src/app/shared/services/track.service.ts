import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Page } from '../models/page.model';
import { Track } from '../models/track.model';

/**
 * Service gérant l'ensemble des opérations HTTP sur les backing tracks.
 * Communique avec l'API Express sous /api/tracks.
 */
@Injectable({ providedIn: 'root' })
export class TrackService {
  private readonly http = inject(HttpClient);

  /**
   * Récupère la liste paginée des morceaux de l'utilisateur connecté.
   * Transmet page et limit sous forme de query params HTTP.
   */
  list(page = 1, limit = 5): Observable<Page<Track>> {
    return this.http.get<Page<Track>>('/api/tracks', {
      params: { page, limit },
    });
  }

  /**
   * Téléversement simple sans suivi d'événements de progression.
   */
  upload(file: File, title: string): Observable<Track> {
    const body = new FormData();
    body.append('audio', file);
    body.append('title', title);
    return this.http.post<Track>('/api/tracks', body);
  }

  /**
   * Téléversement avec suivi de progression en temps réel (Mission 6).
   * L'option `reportProgress: true` et `observe: 'events'` permet de recevoir
   * les événements HttpEventType.UploadProgress et HttpEventType.Response.
   */
  uploadWithProgress(file: File, title: string): Observable<HttpEvent<Track>> {
    const body = new FormData();
    body.append('audio', file);
    body.append('title', title);
    return this.http.post<Track>('/api/tracks', body, {
      reportProgress: true,
      observe: 'events',
    });
  }

  /**
   * Récupère le flux binaire de l'audio via son identifiant pour lecture sécurisée.
   */
  audio(id: string): Observable<Blob> {
    return this.http.get(`/api/tracks/${id}/audio`, {
      responseType: 'blob',
    });
  }

  /**
   * Supprime une piste appartenant à l'utilisateur (Mission 5).
   * Appelle DELETE /api/tracks/:id.
   */
  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/api/tracks/${id}`);
  }
}
