import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, throwError, catchError } from 'rxjs';
import { User, TokenResponse, RoleName } from '../models';
import { Router } from '@angular/router';

const API_URL = 'http://localhost:8000/api';
const TOKEN_KEY = 'stability_token';
const USER_KEY = 'stability_user';
const ROLES_KEY = 'stability_roles';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);

  currentUser$ = this.currentUserSubject.asObservable();
  token$ = this.tokenSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedToken && savedUser) {
      try {
        this.tokenSubject.next(savedToken);
        this.currentUserSubject.next(JSON.parse(savedUser));
      } catch { /* ignore */ }
    }
  }

  get token(): string | null { return this.tokenSubject.value; }
  get currentUser(): User | null { return this.currentUserSubject.value; }
  get roles(): RoleName[] {
    const raw = localStorage.getItem(ROLES_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  login(username: string, password: string): Observable<TokenResponse> {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    return this.http.post<TokenResponse>(`${API_URL}/auth/login`, formData).pipe(
      tap(res => this.handleLoginSuccess(res))
    );
  }

  private handleLoginSuccess(res: TokenResponse) {
    localStorage.setItem(TOKEN_KEY, res.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    const roles = res.user.roles.map(r => r.role.name as RoleName);
    localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
    this.tokenSubject.next(res.access_token);
    this.currentUserSubject.next(res.user);
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLES_KEY);
    this.tokenSubject.next(null);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return !!this.tokenSubject.value;
  }

  hasRole(role: RoleName | RoleName[]): boolean {
    const userRoles = this.roles;
    if (Array.isArray(role)) {
      return role.some(r => userRoles.includes(r));
    }
    return userRoles.includes(role);
  }

  registerDefaultUsers() {
    return this.http.post(`${API_URL}/auth/init-default-users`, {}).pipe(
      catchError(err => {
        if (err.status === 401) return throwError(() => err);
        return throwError(() => err);
      })
    );
  }

  getUsersByRole(role: RoleName): Observable<User[]> {
    return this.http.get<User[]>(`${API_URL}/auth/users/by-role/${role}`);
  }

  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${API_URL}/auth/users`);
  }
}
