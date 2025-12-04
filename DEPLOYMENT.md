# Despliegue Rápido a Producción (Linux)

## Opción Sencilla (Recomendada)

### 1. Subir aplicación al servidor

```bash
# Desde tu máquina local (PowerShell o CMD)
scp -r C:\Users\Usuario\Documents\PROYECTOS\apps\ldap-app usuario@tu-servidor:/var/www/

# Luego conectarte al servidor
ssh usuario@tu-servidor
```

### 2. Ejecutar el script de despliegue

```bash
cd /var/www/ldap-app
chmod +x deploy.sh
./deploy.sh
```

Este script automáticamente:
- ✅ Instala las dependencias
- ✅ Construye el frontend para producción
- ✅ Verifica PM2

### 3. Configurar variables de producción

Edita `backend/.env` con tus valores reales:

```bash
nano backend/.env
```

Cambia estos valores:

```bash
# Cambiar a producción
NODE_ENV=production

# Configurar JWT (IMPORTANTE: cambiar esta clave)
JWT_SECRET=clave-super-segura-y-aleatoria-cambiar-ahora

# URL del frontend (tu dominio)
FRONTEND_URL=https://tu-dominio.com

# Credenciales admin (usar formato UPN funciona mejor)
LDAP_ADMIN_DN=jgvadmin2@odecgandia.es
LDAP_ADMIN_PASSWORD=tu-contraseña-real
```

### 4. Iniciar la aplicación

```bash
cd backend
pm2 start server.js --name ldap-app
pm2 save
pm2 startup
# Ejecuta el comando que PM2 te sugiere
```

### 5. Configurar nginx (Recomendado)

```bash
# Crear configuración de nginx
sudo nano /etc/nginx/sites-available/ldap-app
```

Agrega:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Habilitar y reiniciar:

```bash
sudo ln -s /etc/nginx/sites-available/ldap-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. Configurar SSL (Recomendado)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

### 7. Acceder a la aplicación

Abre el navegador en: `https://tu-dominio.com`

---

## Comandos Útiles

### Ver logs

```bash
pm2 logs ldap-app
```

### Reiniciar

```bash
pm2 restart ldap-app
```

### Ver estado

```bash
pm2 status
sudo systemctl status nginx
```

### Detener

```bash
pm2 stop ldap-app
```

---

## Documentación Completa

Para configuración avanzada (systemd, backup, monitoreo, etc.), consulta la guía completa.
