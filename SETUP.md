# 🚀 Pasos para Ejecutar la Aplicación LDAP

## ✅ Estado Actual

- ✅ **Backend**: Funcionando en `http://localhost:3000`
- ⏳ **PocketBase**: Necesita configuración
- ⏳ **Frontend**: Listo para iniciar

---

## 📋 Próximos Pasos

### 1️⃣ Descargar y Configurar PocketBase

#### Opción A: Descarga Manual
1. Ve a https://pocketbase.io/docs/
2. Descarga la versión para Windows
3. Extrae el archivo `pocketbase.exe` en la carpeta `pocketbase/`

#### Opción B: Descarga Directa
```powershell
# Desde la raíz del proyecto
cd pocketbase
# Descarga desde: https://github.com/pocketbase/pocketbase/releases/latest
```

### 2️⃣ Iniciar PocketBase

```powershell
cd pocketbase
./pocketbase serve
```

**Primera vez:**
1. Accede a `http://127.0.0.1:8090/_/`
2. Crea una cuenta de administrador
3. Ve a **Collections** → **Import collections**
4. Importa el archivo `pb_schema.json` que está en la carpeta `pocketbase/`

Esto creará las colecciones:
- `ldap_config` - Configuración del servidor LDAP
- `audit_logs` - Registro de auditoría

### 3️⃣ Iniciar Frontend Angular

**Terminal nueva:**
```powershell
cd frontend
ng serve
```

El frontend estará disponible en `http://localhost:4200`

---

## 🔧 Configurar LDAP

1. Abre `http://localhost:4200` en tu navegador
2. Haz clic en **⚙️ Configuración** en el sidebar
3. Completa el formulario:

   ```
   Servidor: ldap://tu-servidor-ldap.com
   Puerto: 389 (o 636 para LDAPS)
   Base DN: dc=ejemplo,dc=com
   Admin DN: cn=admin,dc=ejemplo,dc=com
   Contraseña: tu-contraseña-admin
   Search Base: ou=users,dc=ejemplo,dc=com (opcional)
   ```

4. Haz clic en **🔍 Probar Conexión**
5. Si la conexión es exitosa, haz clic en **💾 Guardar Configuración**

---

## 📊 Usar la Aplicación

### Ver Usuarios
1. Haz clic en **👥 Usuarios** en el sidebar
2. Verás la lista de todos los usuarios LDAP
3. Usa la barra de búsqueda para filtrar

### Desbloquear Usuario
1. Identifica usuarios con estado **🔒 Bloqueado**
2. Haz clic en **🔓 Desbloquear**
3. Confirma la acción

### Indicadores de Caducidad
- 🔴 **Rojo**: Caducada o < 7 días
- 🟡 **Amarillo**: 7-30 días
- ⚪ **Normal**: > 30 días

---

## 🐛 Solución de Problemas

### Backend no inicia
```powershell
# Verifica que las dependencias estén instaladas
cd backend
npm install
npm start
```

### Frontend no inicia
```powershell
# Instala Angular CLI si no lo tienes
npm install -g @angular/cli

cd frontend
npm install
ng serve
```

### Error "No LDAP configuration found"
- Asegúrate de que PocketBase esté ejecutándose
- Configura LDAP desde la página de Configuración

### Error de conexión LDAP
- Verifica que el servidor LDAP esté accesible
- Comprueba las credenciales
- Revisa el puerto (389 para LDAP, 636 para LDAPS)

---

## 📝 Resumen de Puertos

| Servicio | Puerto | URL |
|----------|--------|-----|
| Backend | 3000 | http://localhost:3000 |
| Frontend | 4200 | http://localhost:4200 |
| PocketBase | 8090 | http://127.0.0.1:8090 |

---

## 🔒 Seguridad

- ✅ Las credenciales LDAP se almacenan **cifradas** en PocketBase
- ✅ La carpeta `pb_data/` está en `.gitignore` (no se sube al Git)
- ✅ El archivo `.env` está en `.gitignore`
- ✅ Las contraseñas nunca se envían al frontend

---

## 📚 Documentación Adicional

- [README.md](file:///c:/Users/jgimeno/Documents/OCA/ldap-app/README.md) - Documentación completa
- [Walkthrough](file:///C:/Users/jgimeno/.gemini/antigravity/brain/4ac8571a-cb5b-4e18-941d-9dca0fcdb932/walkthrough.md) - Detalles técnicos de la implementación

---

## ✨ Características Implementadas

- ✅ Listado de usuarios LDAP
- ✅ Búsqueda y filtrado
- ✅ Indicadores de caducidad de contraseña
- ✅ Desbloqueo de usuarios
- ✅ Configuración LDAP desde interfaz web
- ✅ Prueba de conexión
- ✅ Almacenamiento seguro en PocketBase
- ✅ Diseño moderno con gradientes
- ✅ Responsive design
- ✅ Compatible con Active Directory y OpenLDAP
