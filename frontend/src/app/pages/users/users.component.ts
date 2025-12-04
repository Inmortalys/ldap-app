import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LdapService } from '../../services/ldap.service';
import { LdapUser, PasswordPolicy, PasswordValidation } from '../../models/ldap.model';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit {
  users: LdapUser[] = [];
  filteredUsers: LdapUser[] = [];
  loading = false;
  error: string | null = null;
  searchTerm = '';
  statusFilter: string = 'all'; // 'all', 'active', 'locked', 'disabled'

  // Search Base selection
  searchBases: string[] = [];
  selectedSearchBase: string = '';
  private readonly SEARCH_BASES_KEY = 'ldap_custom_search_bases';

  // Password change modal
  showPasswordModal = false;
  selectedUser: LdapUser | null = null;
  newPassword = '';
  confirmPassword = '';
  passwordPolicy: PasswordPolicy | null = null;
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
  changingPassword = false;

  // Reset link generation
  generatingResetLink = false;
  resetLinkSuccess: string | null = null;

  constructor(private ldapService: LdapService) { }

  ngOnInit(): void {
    this.loadSearchBases();
    this.loadUsers();
    this.loadPasswordPolicy();
  }

  loadSearchBases(): void {
    // Load custom bases from local storage
    const saved = localStorage.getItem(this.SEARCH_BASES_KEY);
    if (saved) {
      try {
        this.searchBases = JSON.parse(saved);
      } catch (e) {
        this.searchBases = [];
      }
    }

    // Load default config to get the search bases
    this.ldapService.getConfig().subscribe({
      next: (response) => {
        if (response.success && response.config) {
          // Use searchBases array if available (new feature)
          if (response.config.searchBases && Array.isArray(response.config.searchBases)) {
            response.config.searchBases.forEach((base: string) => {
              if (base && !this.searchBases.includes(base)) {
                this.searchBases.push(base);
              }
            });
          } else if (response.config.searchBase) {
            // Fallback to single searchBase for backward compatibility
            const defaultBase = response.config.searchBase;
            if (!this.searchBases.includes(defaultBase)) {
              this.searchBases.unshift(defaultBase);
            }
          }

          // Set selected base to first available if not set
          if (!this.selectedSearchBase && this.searchBases.length > 0) {
            this.selectedSearchBase = this.searchBases[0];
          }
        }
      }
    });
  }

  loadUsers(): void {
    this.loading = true;
    this.error = null;

    // Pass selected search base if it's not empty
    const searchBase = this.selectedSearchBase || undefined;

    this.ldapService.getUsers(searchBase).subscribe({
      next: (response) => {
        if (response.success) {
          this.users = response.users;
          this.filteredUsers = this.users;
          this.filterUsers(); // Re-apply filters
          console.log(`Loaded ${this.users.length} users from LDAP`);
        } else {
          this.error = response.error || 'Failed to load users';
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading users:', err);
        this.error = err.error?.error || 'Failed to connect to LDAP server';
        this.loading = false;
      }
    });
  }

  onSearchBaseChange(): void {
    this.loadUsers();
  }

  loadPasswordPolicy(): void {
    this.ldapService.getPasswordPolicy().subscribe({
      next: (response) => {
        if (response.success) {
          this.passwordPolicy = response.policy;
          console.log('Password policy loaded:', this.passwordPolicy);
        }
      },
      error: (err) => {
        console.error('Error loading password policy:', err);
      }
    });
  }

  filterUsers(): void {
    let filtered = this.users;

    // Apply status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(user => {
        if (this.statusFilter === 'active') {
          return !user.isLocked && !user.isDisabled;
        } else if (this.statusFilter === 'locked') {
          return user.isLocked;
        } else if (this.statusFilter === 'disabled') {
          return user.isDisabled;
        }
        return true;
      });
    }

    // Apply search term filter
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.cn.toLowerCase().includes(term) ||
        user.sAMAccountName.toLowerCase().includes(term) ||
        user.dn.toLowerCase().includes(term) ||
        (user.mail && user.mail.toLowerCase().includes(term))
      );
    }

    this.filteredUsers = filtered;
  }

  setStatusFilter(status: string): void {
    this.statusFilter = status;
    this.filterUsers();
  }

  unlockUser(user: LdapUser): void {
    if (!confirm(`¿Estás seguro de que quieres desbloquear al usuario ${user.cn}?`)) {
      return;
    }

    this.ldapService.unlockUser(user.dn).subscribe({
      next: (response) => {
        if (response.success) {
          alert(`Usuario ${user.cn} desbloqueado correctamente`);
          this.loadUsers(); // Reload to get updated status
        } else {
          alert(`Error: ${response.error}`);
        }
      },
      error: (err) => {
        console.error('Error unlocking user:', err);
        alert(`Error al desbloquear usuario: ${err.error?.error || 'Error desconocido'}`);
      }
    });
  }

  openChangePasswordModal(user: LdapUser): void {
    this.selectedUser = user;
    this.newPassword = '';
    this.confirmPassword = '';
    this.showPasswordModal = true;
    this.validatePassword();
  }

  closePasswordModal(): void {
    this.showPasswordModal = false;
    this.selectedUser = null;
    this.newPassword = '';
    this.confirmPassword = '';
  }

  validatePassword(): void {
    if (!this.selectedUser) return;

    const password = this.newPassword;
    const username = this.selectedUser.sAMAccountName;

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

  submitPasswordChange(): void {
    if (!this.selectedUser) return;

    // Validate passwords match
    if (this.newPassword !== this.confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }

    // Validate password requirements
    if (!this.passwordValidation.valid) {
      alert('La contraseña no cumple con los requisitos de seguridad');
      return;
    }

    this.changingPassword = true;

    this.ldapService.changePassword({
      userDN: this.selectedUser.dn,
      newPassword: this.newPassword
    }).subscribe({
      next: (response) => {
        this.changingPassword = false;
        if (response.success) {
          alert(`Contraseña cambiada correctamente para ${this.selectedUser!.cn}`);
          this.closePasswordModal();
          this.loadUsers();
        } else {
          alert(`Error: ${response.error}`);
        }
      },
      error: (err) => {
        this.changingPassword = false;
        console.error('Error changing password:', err);
        alert(`Error al cambiar contraseña: ${err.error?.error || 'Error desconocido'}`);
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

  getExpiryClass(user: LdapUser): string {
    if (!user.daysUntilExpiry) return '';

    if (user.daysUntilExpiry < 0) return 'expired';
    if (user.daysUntilExpiry < 7) return 'expiring-soon';
    if (user.daysUntilExpiry < 30) return 'expiring-warning';
    return '';
  }

  getExpiryText(user: LdapUser): string {
    if (!user.daysUntilExpiry) return 'N/A';

    if (user.daysUntilExpiry < 0) {
      return `Caducada hace ${Math.abs(user.daysUntilExpiry)} días`;
    }

    return `${user.daysUntilExpiry} días`;
  }

  formatDate(date: Date | null | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-ES');
  }

  formatExpiryDate(user: LdapUser): string {
    if (!user.pwdExpiryDate) return 'Nunca';
    return new Date(user.pwdExpiryDate).toLocaleDateString('es-ES');
  }

  /**
   * Generate a password reset link for a user
   */
  generateResetLink(user: LdapUser): void {
    if (this.generatingResetLink) return;

    this.generatingResetLink = true;
    this.error = null;
    this.resetLinkSuccess = null;

    this.ldapService.generateResetToken(user.dn).subscribe({
      next: (response) => {
        this.generatingResetLink = false;

        if (response.success && response.resetUrl) {
          // Copy to clipboard
          navigator.clipboard.writeText(response.resetUrl).then(() => {
            const expiresAt = new Date(response.expiresAt);
            const expiresIn = Math.round((expiresAt.getTime() - new Date().getTime()) / (1000 * 60)); // minutes

            this.resetLinkSuccess = `Enlace copiado al portapapeles. Válido por ${expiresIn} minutos.`;

            // Clear success message after 5 seconds
            setTimeout(() => {
              this.resetLinkSuccess = null;
            }, 5000);
          }).catch(err => {
            console.error('Error copying to clipboard:', err);
            this.error = 'Enlace generado pero no se pudo copiar al portapapeles';
          });
        } else {
          this.error = response.error || 'Error al generar el enlace';
        }
      },
      error: (err) => {
        this.generatingResetLink = false;
        console.error('Error generating reset link:', err);
        this.error = err.error?.error || 'Error al generar el enlace de cambio de contraseña';
      }
    });
  }
}
