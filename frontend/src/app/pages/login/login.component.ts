import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

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
        private authService: AuthService,
        private router: Router
    ) { }

    onSubmit(): void {
        if (!this.username || !this.password) {
            this.error = 'Por favor, introduce usuario y contraseña';
            return;
        }

        this.loading = true;
        this.error = '';

        this.authService.login(this.username, this.password).subscribe({
            next: (response: any) => {
                this.loading = false;
                if (response.success && response.token) {
                    // Token is already stored by AuthService tap operator

                    // Redirect to dashboard/users
                    this.router.navigate(['/users']);
                } else {
                    this.error = 'Error en el inicio de sesión';
                }
            },
            error: (err: any) => {
                this.loading = false;
                console.error('Login error:', err);
                this.error = err.error?.error || 'Credenciales incorrectas o error de conexión';
            }
        });
    }
}
