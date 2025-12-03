import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface LoginResponse {
    success: boolean;
    token?: string;
    user?: {
        dn: string;
        cn: string;
        sAMAccountName: string;
        mail: string;
    };
    error?: string;
}

export interface CurrentUser {
    dn: string;
    cn: string;
    sAMAccountName: string;
    mail: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = environment.apiUrl;
    private tokenKey = 'ldap_auth_token';
    private userKey = 'ldap_current_user';

    private currentUserSubject = new BehaviorSubject<CurrentUser | null>(this.getCurrentUser());
    public currentUser$ = this.currentUserSubject.asObservable();

    constructor(private http: HttpClient) { }

    /**
     * Login with LDAP credentials
     */
    login(username: string, password: string): Observable<LoginResponse> {
        return this.http.post<LoginResponse>(`${this.apiUrl}/ldap/login`, {
            username,
            password
        }).pipe(
            tap(response => {
                if (response.success && response.token && response.user) {
                    this.setToken(response.token);
                    this.setCurrentUser(response.user);
                    this.currentUserSubject.next(response.user);
                }
            })
        );
    }

    /**
     * Logout and clear session
     */
    logout(): void {
        localStorage.removeItem(this.tokenKey);
        localStorage.removeItem(this.userKey);
        this.currentUserSubject.next(null);
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        const token = this.getToken();
        if (!token) {
            return false;
        }

        // Check if token is expired (basic check)
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiry = payload.exp * 1000; // Convert to milliseconds
            return Date.now() < expiry;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get stored token
     */
    getToken(): string | null {
        return localStorage.getItem(this.tokenKey);
    }

    /**
     * Set token in localStorage
     */
    private setToken(token: string): void {
        localStorage.setItem(this.tokenKey, token);
    }

    /**
     * Get current user from localStorage
     */
    getCurrentUser(): CurrentUser | null {
        const userJson = localStorage.getItem(this.userKey);
        if (userJson) {
            try {
                return JSON.parse(userJson);
            } catch (error) {
                return null;
            }
        }
        return null;
    }

    /**
     * Set current user in localStorage
     */
    private setCurrentUser(user: CurrentUser): void {
        localStorage.setItem(this.userKey, JSON.stringify(user));
    }

    /**
     * Verify token with backend
     */
    verifyToken(): Observable<any> {
        return this.http.get(`${this.apiUrl}/ldap/verify-token`);
    }
}
