import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LdapUser, LdapConfig, PasswordPolicy, PasswordChangeRequest } from '../models/ldap.model';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class LdapService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    /**
     * Get users from LDAP
     * @param searchBase Optional search base to override default
     */
    getUsers(searchBase?: string): Observable<any> {
        let url = `${this.apiUrl}/ldap/users`;
        if (searchBase) {
            url += `?base=${encodeURIComponent(searchBase)}`;
        }
        return this.http.get<any>(url);
    }

    /**
     * Get specific user by DN
     */
    getUser(dn: string): Observable<any> {
        const encodedDn = encodeURIComponent(dn);
        return this.http.get<any>(`${this.apiUrl}/ldap/users/${encodedDn}`);
    }

    /**
     * Unlock a locked user account
     */
    unlockUser(dn: string, userId?: string): Observable<any> {
        const encodedDn = encodeURIComponent(dn);
        return this.http.post<any>(`${this.apiUrl}/ldap/users/${encodedDn}/unlock`, { userId });
    }

    /**
     * Get domain password policy
     */
    getPasswordPolicy(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/ldap/password-policy`);
    }

    /**
     * Change user password
     */
    changePassword(request: PasswordChangeRequest): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/ldap/change-password`, request);
    }

    /**
     * Test LDAP connection
     */
    testConnection(config: LdapConfig): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/ldap/test-connection`, config);
    }

    /**
     * Get current LDAP configuration
     */
    getConfig(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/ldap/config`);
    }

    /**
     * Save LDAP configuration
     */
    saveConfig(config: LdapConfig, userId?: string): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/ldap/config`, { ...config, userId });
    }
}
