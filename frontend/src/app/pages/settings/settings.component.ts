import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LdapService } from '../../services/ldap.service';
import { LdapConfig } from '../../models/ldap.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  config: LdapConfig = {
    server: '',
    port: 389,
    baseDN: '',
    adminDN: '',
    adminPassword: '',
    searchBase: ''
  };

  // Local storage key for custom search bases
  private readonly SEARCH_BASES_KEY = 'ldap_custom_search_bases';

  customSearchBases: string[] = [];
  newSearchBase = '';

  loading = false;
  error: string | null = null;
  success: string | null = null;

  constructor(private ldapService: LdapService) { }

  ngOnInit(): void {
    this.loadConfig();
    this.loadCustomSearchBases();
  }

  loadConfig(): void {
    this.loading = true;
    this.error = null;

    this.ldapService.getConfig().subscribe({
      next: (response) => {
        if (response.success && response.config) {
          this.config = {
            ...this.config,
            ...response.config
          };

          // Add default search base to custom list if not present
          if (this.config.searchBase && !this.customSearchBases.includes(this.config.searchBase)) {
            this.customSearchBases.unshift(this.config.searchBase);
            this.saveCustomSearchBases();
          }
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading config:', err);
        this.error = 'Error al cargar la configuración del servidor';
        this.loading = false;
      }
    });
  }

  loadCustomSearchBases(): void {
    const saved = localStorage.getItem(this.SEARCH_BASES_KEY);
    if (saved) {
      try {
        this.customSearchBases = JSON.parse(saved);
      } catch (e) {
        this.customSearchBases = [];
      }
    }
  }

  saveCustomSearchBases(): void {
    localStorage.setItem(this.SEARCH_BASES_KEY, JSON.stringify(this.customSearchBases));
  }

  addSearchBase(): void {
    if (!this.newSearchBase) return;

    if (this.customSearchBases.includes(this.newSearchBase)) {
      this.error = 'Esta ruta de búsqueda ya existe';
      return;
    }

    this.customSearchBases.push(this.newSearchBase);
    this.saveCustomSearchBases();
    this.newSearchBase = '';
    this.success = 'Ruta de búsqueda añadida correctamente';
    setTimeout(() => this.success = null, 3000);
  }

  removeSearchBase(base: string): void {
    this.customSearchBases = this.customSearchBases.filter(b => b !== base);
    this.saveCustomSearchBases();
  }

  clearMessages(): void {
    this.error = null;
    this.success = null;
  }
}
