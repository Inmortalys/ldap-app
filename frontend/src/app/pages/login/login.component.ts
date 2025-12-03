import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LdapService } from '../../services/ldap.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css']
})
export class LoginComponent {
    username = '';
    password = '';
    loading = false;
    error = '';

    constructor(
        private ldapService: LdapService,
        private router: Router
    ) { }

    onSubmit(): void {
        if (!this.username || !this.password) {
            this.error = 'Por favor, introduce usuario y contraseña';
            return;
        }

        this.loading = true;
        this.error = '';

        this.ldapService.login(this.username, this.password).subscribe({
            next: (response) => {
                this.loading = false;
                if (response.success && response.token) {
                    // Store token and user info
                    localStorage.setItem('token', response.token);
                    localStorage.setItem('user', JSON.stringify(response.user));

                    // Redirect to dashboard/users
                    this.router.navigate(['/users']);
                } else {
                    this.error = 'Error en el inicio de sesión';
                }
            },
            error: (err) => {
                this.loading = false;
                console.error('Login error:', err);
                this.error = err.error?.error || 'Credenciales incorrectas o error de conexión';
            }
        });
    }
}
