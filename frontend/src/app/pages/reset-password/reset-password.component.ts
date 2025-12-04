import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LdapService } from '../../services/ldap.service';
import { PasswordValidation } from '../../models/ldap.model';

@Component({
    selector: 'app-reset-password',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './reset-password.component.html',
    styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {
    token: string = '';
    tokenValid: boolean | null = null;
    tokenError: string | null = null;
    userDN: string = '';
    expiresAt: Date | null = null;

    // Password change form
    newPassword: string = '';
    confirmPassword: string = '';

    // Password validation
    passwordValidation: PasswordValidation = {
        valid: false,
        errors: [],
        requirements: {
            minLength: false,
            hasUppercase: false,
            hasLowercase: false,
            hasNumber: false,
            hasSpecial: false,
            notContainsUsername: false
        }
    };

    // State
    validating: boolean = false;
    resetting: boolean = false;
    error: string | null = null;
    success: boolean = false;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private ldapService: LdapService
    ) { }

    ngOnInit(): void {
        // Get token from query parameters
        this.route.queryParams.subscribe(params => {
            this.token = params['token'];
            if (this.token) {
                this.validateToken();
            } else {
                this.tokenValid = false;
                this.tokenError = 'No se proporcionó un token válido';
            }
        });
    }

    validateToken(): void {
        this.validating = true;
        this.error = null;

        this.ldapService.validateResetToken(this.token).subscribe({
            next: (response) => {
                this.validating = false;
                if (response.success && response.valid) {
                    this.tokenValid = true;
                    this.userDN = response.userDN;
                    this.expiresAt = new Date(response.expiresAt);
                } else {
                    this.tokenValid = false;
                    this.tokenError = response.error || 'Token inválido';
                }
            },
            error: (err) => {
                this.validating = false;
                this.tokenValid = false;
                this.tokenError = err.error?.error || 'Error al validar el token';
            }
        });
    }

    validatePassword(): void {
        const password = this.newPassword;
        // Extract username from DN for validation if possible, or skip username check
        const username = this.userDN ? this.userDN.split(',')[0].split('=')[1] : '';

        this.passwordValidation = {
            valid: true,
            errors: [],
            requirements: {
                minLength: false,
                hasUppercase: false,
                hasLowercase: false,
                hasNumber: false,
                hasSpecial: false,
                notContainsUsername: false
            }
        };

        // Check minimum length
        if (password.length >= 12) {
            this.passwordValidation.requirements.minLength = true;
        } else {
            this.passwordValidation.valid = false;
            this.passwordValidation.errors.push('Mínimo 12 caracteres');
        }

        // Check for uppercase
        if (/[A-Z]/.test(password)) {
            this.passwordValidation.requirements.hasUppercase = true;
        } else {
            this.passwordValidation.valid = false;
            this.passwordValidation.errors.push('Al menos una mayúscula');
        }

        // Check for lowercase
        if (/[a-z]/.test(password)) {
            this.passwordValidation.requirements.hasLowercase = true;
        } else {
            this.passwordValidation.valid = false;
            this.passwordValidation.errors.push('Al menos una minúscula');
        }

        // Check for number
        if (/[0-9]/.test(password)) {
            this.passwordValidation.requirements.hasNumber = true;
        } else {
            this.passwordValidation.valid = false;
            this.passwordValidation.errors.push('Al menos un número');
        }

        // Check for special character
        if (/[^A-Za-z0-9]/.test(password)) {
            this.passwordValidation.requirements.hasSpecial = true;
        } else {
            this.passwordValidation.valid = false;
            this.passwordValidation.errors.push('Al menos un carácter especial');
        }

        // Check if password contains username
        if (username && password.toLowerCase().includes(username.toLowerCase())) {
            this.passwordValidation.valid = false;
            this.passwordValidation.errors.push('No puede contener el nombre de usuario');
        } else {
            this.passwordValidation.requirements.notContainsUsername = true;
        }
    }

    submitPasswordReset(): void {
        if (!this.passwordValidation.valid) {
            this.error = 'La contraseña no cumple con los requisitos de seguridad';
            return;
        }

        if (this.newPassword !== this.confirmPassword) {
            this.error = 'Las contraseñas no coinciden';
            return;
        }

        this.resetting = true;
        this.error = null;

        this.ldapService.resetPasswordWithToken({
            token: this.token,
            newPassword: this.newPassword
        }).subscribe({
            next: (response) => {
                this.resetting = false;
                if (response.success) {
                    this.success = true;
                    // Redirect to login after 3 seconds
                    setTimeout(() => {
                        this.router.navigate(['/login']);
                    }, 3000);
                } else {
                    this.error = response.error || 'Error al cambiar la contraseña';
                }
            },
            error: (err) => {
                this.resetting = false;
                this.error = err.error?.error || 'Error al cambiar la contraseña';
            }
        });
    }

    getPasswordStrength(): number {
        const requirements = this.passwordValidation.requirements;
        let strength = 0;
        if (requirements.minLength) strength++;
        if (requirements.hasUppercase) strength++;
        if (requirements.hasLowercase) strength++;
        if (requirements.hasNumber) strength++;
        if (requirements.hasSpecial) strength++;
        if (requirements.notContainsUsername) strength++;
        return (strength / 6) * 100;
    }

    getPasswordStrengthClass(): string {
        const strength = this.getPasswordStrength();
        if (strength < 50) return 'weak';
        if (strength < 83) return 'medium';
        return 'strong';
    }

    getTimeRemaining(): string {
        if (!this.expiresAt) return '';

        const now = new Date();
        const diff = this.expiresAt.getTime() - now.getTime();

        if (diff <= 0) return 'Expirado';

        const minutes = Math.floor(diff / (1000 * 60));
        if (minutes < 60) {
            return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
        }

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }
}
