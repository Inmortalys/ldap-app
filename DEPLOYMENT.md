# Despliegue Rápido a Producción

## Opción Sencilla (Recomendada)

### 1. Ejecutar el script de despliegue

```powershell
cd C:\Users\Usuario\Documents\PROYECTOS\apps\ldap-app
.\deploy.bat
```

Este script automáticamente:
- ✅ Instala las dependencias
- ✅ Construye el frontend para producción
- ✅ Verifica PM2

### 2. Configurar variables de producción

Edita `backend\.env` con tus valores reales:

```bash
# Cambiar a producción
NODE_ENV=production

# Configurar JWT (IMPORTANTE: cambiar esta clave)
JWT_SECRET=clave-super-segura-y-aleatoria-cambiar-ahora

# Credenciales admin (usar formato UPN funciona mejor)
LDAP_ADMIN_DN=jgvadmin2@odecgandia.es
LDAP_ADMIN_PASSWORD=tu-contraseña-real
```

### 3. Iniciar la aplicación

```powershell
cd backend
pm2 start server.js --name ldap-app
pm2 save
```

### 4. Acceder a la aplicación

Abre el navegador en: `http://localhost:3000`

---

## Configuración Adicional

### Iniciar automáticamente con Windows

```powershell
pm2-startup install
```

### Ver logs

```powershell
pm2 logs ldap-app
```

### Reiniciar

```powershell
pm2 restart ldap-app
```

### Detener

```powershell
pm2 stop ldap-app
```

---

## Documentación Completa

Para configuración avanzada (IIS, SSL, etc.), consulta:
- [production-deployment.md](file:///C:/Users/Usuario/.gemini/antigravity/brain/28a2afbd-d01f-4acf-8b01-6475481ed753/production-deployment.md) - Guía completa de despliegue
