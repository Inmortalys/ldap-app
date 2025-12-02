import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LdapService } from '../../services/ldap.service';
import { LdapUser } from '../../models/ldap.model';

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

  constructor(private ldapService: LdapService) { }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = null;

    this.ldapService.getUsers().subscribe({
      next: (response) => {
        if (response.success) {
          this.users = response.users;
          this.filteredUsers = this.users;
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

  filterUsers(): void {
    if (!this.searchTerm.trim()) {
      this.filteredUsers = this.users;
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredUsers = this.users.filter(user =>
      user.cn.toLowerCase().includes(term) ||
      user.uid.toLowerCase().includes(term) ||
      user.dn.toLowerCase().includes(term) ||
      (user.mail && user.mail.toLowerCase().includes(term))
    );
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
}
