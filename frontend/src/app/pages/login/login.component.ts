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
    error: string | null = null;

    constructor(
        private authService: AuthService,
        private router: Router
    ) {
        // Redirect if already logged in
        if (this.authService.isAuthenticated()) {
            this.router.navigate(['/users']);
        }
    }

    onSubmit(): void {
        if (!this.username || !this.password) {
            this.error = 'Por favor ingrese usuario y contraseña';
            return;
        }

        this.loading = true;
        this.error = null;

        this.authService.login(this.username, this.password).subscribe({
            next: (response) => {
                if (response.success) {
                    console.log('Login successful');
                    this.router.navigate(['/users']);
                } else {
                    this.error = response.error || 'Error de autenticación';
                    this.loading = false;
                }
            },
            error: (err) => {
                console.error('Login error:', err);
                this.error = err.error?.error || 'Error al conectar con el servidor';
                this.loading = false;
            }
        });
    }
}
