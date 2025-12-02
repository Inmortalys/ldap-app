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

  loading = false;
  testing = false;
  saving = false;
  error: string | null = null;
  success: string | null = null;
  testResult: string | null = null;

  constructor(private ldapService: LdapService) { }

  ngOnInit(): void {
    this.loadConfig();
  }

  loadConfig(): void {
    this.loading = true;
    this.error = null;

    this.ldapService.getConfig().subscribe({
      next: (response) => {
        if (response.success && response.config) {
          this.config = {
            ...this.config,
            ...response.config,
            adminPassword: '' // Don't load password for security
          };
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading config:', err);
        // If no config exists yet, that's okay
        if (err.status !== 404) {
          this.error = 'Error al cargar la configuración';
        }
        this.loading = false;
      }
    });
  }

  testConnection(): void {
    this.testing = true;
    this.testResult = null;
    this.error = null;

    if (!this.validateForm()) {
      this.testing = false;
      return;
    }

    this.ldapService.testConnection(this.config).subscribe({
      next: (response) => {
        if (response.success) {
          this.testResult = '✅ Conexión exitosa al servidor LDAP';
        } else {
          this.testResult = `❌ ${response.error}`;
        }
        this.testing = false;
      },
      error: (err) => {
        console.error('Connection test failed:', err);
        this.testResult = `❌ Error: ${err.error?.error || 'No se pudo conectar al servidor LDAP'}`;
        this.testing = false;
      }
    });
  }

  saveConfig(): void {
    if (!this.validateForm()) {
      return;
    }

    if (!this.config.adminPassword) {
      this.error = 'Debes introducir la contraseña del administrador LDAP';
      return;
    }

    this.saving = true;
    this.error = null;
    this.success = null;

    this.ldapService.saveConfig(this.config).subscribe({
      next: (response) => {
        if (response.success) {
          this.success = '✅ Configuración guardada correctamente';
          // Clear password field after saving
          this.config.adminPassword = '';
        } else {
          this.error = response.error || 'Error al guardar la configuración';
        }
        this.saving = false;
      },
      error: (err) => {
        console.error('Error saving config:', err);
        this.error = `Error: ${err.error?.error || 'No se pudo guardar la configuración'}`;
        this.saving = false;
      }
    });
  }

  validateForm(): boolean {
    if (!this.config.server || !this.config.port || !this.config.baseDN || !this.config.adminDN) {
      this.error = 'Por favor, completa todos los campos obligatorios';
      return false;
    }

    if (this.config.port < 1 || this.config.port > 65535) {
      this.error = 'El puerto debe estar entre 1 y 65535';
      return false;
    }

    return true;
  }

  clearMessages(): void {
    this.error = null;
    this.success = null;
    this.testResult = null;
  }
}
