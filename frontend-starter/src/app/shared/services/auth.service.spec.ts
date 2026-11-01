import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthService } from './auth.service';
import { AuthResponse } from '../models/auth-response.model';

describe('AuthService (Unit Tests)', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('1. login() envoie une requête POST /api/auth/login avec le bon corps et met à jour l’état', () => {
    const mockResponse: AuthResponse = {
      token: 'jwt-token-fake-12345',
      user: {
        id: 'user-001',
        name: 'Carlos Santana',
        email: 'carlos@example.com',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    };

    service.login('carlos@example.com', 'Demo1234!').subscribe((res) => {
      expect(res).toEqual(mockResponse);
      expect(service.token()).toBe('jwt-token-fake-12345');
      expect(service.currentUser()?.name).toBe('Carlos Santana');
    });

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'carlos@example.com',
      password: 'Demo1234!',
    });

    req.flush(mockResponse);
  });

  it('2. logout() vide le localStorage et réinitialise les Signals réactifs', () => {
    service.token.set('fake-token');
    service.currentUser.set({
      id: '1',
      name: 'Test',
      email: 't@t.com',
      createdAt: '',
    });

    service.logout();

    expect(service.token()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem('gpc_token')).toBeNull();
  });
});

