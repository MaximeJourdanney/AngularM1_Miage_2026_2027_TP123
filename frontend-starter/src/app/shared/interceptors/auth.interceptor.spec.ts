import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('authInterceptor (Unit Tests)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('5. Ajoute l’en-tête Authorization: Bearer <token> lorsqu’un token existe', () => {
    authService.token.set('fake-valid-jwt-token-777');

    http.get('/api/users/me').subscribe();

    const req = httpMock.expectOne('/api/users/me');
    expect(req.request.headers.has('Authorization')).toBe(true);
    expect(req.request.headers.get('Authorization')).toBe('Bearer fake-valid-jwt-token-777');
    req.flush({});
  });

  it('6. N’ajoute PAS d’en-tête Authorization lorsque le token est nul', () => {
    authService.token.set(null);

    http.get('/api/health').subscribe();

    const req = httpMock.expectOne('/api/health');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ status: 'ok' });
  });
});
