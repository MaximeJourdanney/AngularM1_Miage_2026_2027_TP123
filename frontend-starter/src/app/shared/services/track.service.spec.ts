import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TrackService } from './track.service';
import { Page } from '../models/page.model';
import { Track } from '../models/track.model';

describe('TrackService (Unit Tests)', () => {
  let service: TrackService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TrackService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(TrackService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('3. list() transmet correctement les paramètres de pagination "page" et "limit"', () => {
    const mockPage: Page<Track> = {
      items: [
        {
          id: 'track-1',
          title: 'Little Wing',
          originalName: 'little_wing.mp3',
          mimeType: 'audio/mpeg',
          size: 4096000,
          createdAt: '2026-03-01T12:00:00.000Z',
        },
      ],
      page: 2,
      limit: 5,
      total: 10,
      pages: 2,
    };

    service.list(2, 5).subscribe((page) => {
      expect(page.items.length).toBe(1);
      expect(page.page).toBe(2);
      expect(page.items[0].title).toBe('Little Wing');
    });

    const req = httpMock.expectOne((request) => {
      return (
        request.url === '/api/tracks' &&
        request.params.get('page') === '2' &&
        request.params.get('limit') === '5'
      );
    });

    expect(req.request.method).toBe('GET');
    req.flush(mockPage);
  });

  it('4. delete() envoie une requête DELETE vers /api/tracks/:id', () => {
    service.delete('track-to-remove-99').subscribe((res) => {
      expect(res.message).toBe('Supprimé');
    });

    const req = httpMock.expectOne('/api/tracks/track-to-remove-99');
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Supprimé' });
  });
});

