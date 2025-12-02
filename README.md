# 🔐 LDAP Management Application

Aplicación Angular para gestionar usuarios LDAP con funcionalidades de solo lectura (listado, monitoreo de caducidad de contraseñas) y desbloqueo de cuentas. Utiliza PocketBase para almacenamiento de configuración y autenticación, con un backend Node.js para interfaz con servidores LDAP.

## 📋 Características

- ✅ **Listar usuarios LDAP** desde una ruta configurada
- ✅ **Mostrar cuándo caduca la contraseña** de cada usuario (con indicadores de color)
- ✅ **Desbloquear usuarios** bloqueados
- ✅ **Búsqueda y filtrado** de usuarios
- ✅ **Configuración LDAP** desde interfaz web
- ✅ **Auditoría** de acciones realizadas
- ✅ **Diseño moderno** con gradientes y animaciones

## 🏗️ Arquitectura

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Angular   │─────▶│  Node.js    │─────▶│    LDAP     │
│  (Frontend) │      │  (Backend)  │      │   Server    │
└─────────────┘      └──────┬──────┘      └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │ PocketBase  │
                     │   (Config)  │
                     └─────────────┘
```

## 📦 Requisitos Previos

- **Node.js** v18 o superior
- **npm** v9 o superior
- **Angular CLI** v17 o superior
- **PocketBase** v0.21 o superior
- Acceso a un servidor LDAP (Active Directory, OpenLDAP, etc.)

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone <tu-repositorio>
cd ldap-app
```

### 2. Configurar Backend

```bash
cd backend
npm install
cp .env.example .env
```

Edita `.env` y configura:
```env
PORT=3000
POCKETBASE_URL=https://pocketbase.tailsoca.duckdns.org
```

### 3. Configurar Frontend

```bash
cd ../frontend
npm install
```

### 4. Configurar PocketBase

1. Descarga PocketBase desde [pocketbase.io](https://pocketbase.io/docs/)
2. Extrae el ejecutable en la carpeta `pocketbase/`
3. Inicia PocketBase:

```bash
cd pocketbase
./pocketbase serve
```

4. Accede a `https://pocketbase.tailsoca.duckdns.org/_/` y crea una cuenta de administrador
5. Importa el schema desde `pb_schema.json` o crea manualmente las colecciones:

#### Colección: `ldap_config`
- `server` (text) - URL del servidor LDAP
- `port` (number) - Puerto LDAP
- `baseDN` (text) - Base DN
- `adminDN` (text) - DN del administrador
- `adminPassword` (text) - Contraseña del administrador
- `searchBase` (text, opcional) - Base de búsqueda específica

#### Colección: `audit_logs`
- `user` (relation) - Usuario que realizó la acción
- `action` (text) - Tipo de acción
- `target` (text) - DN objetivo
- `details` (json) - Detalles adicionales
- `timestamp` (date) - Fecha y hora

## ▶️ Ejecución

### Iniciar PocketBase (Terminal 1)

```bash
cd pocketbase
./pocketbase serve
```

### Iniciar Backend (Terminal 2)

```bash
cd backend
npm start
```

El backend estará disponible en `http://localhost:3000`

### Iniciar Frontend (Terminal 3)

```bash
cd frontend
ng serve
```

El frontend estará disponible en `http://localhost:4200`

## 🔧 Configuración LDAP

1. Accede a `http://localhost:4200`
2. Navega a **Configuración** (⚙️)
3. Completa el formulario con los datos de tu servidor LDAP:
   - **Servidor**: `ldap://tu-servidor.com` o `ldaps://tu-servidor.com`
   - **Puerto**: `389` (LDAP) o `636` (LDAPS)
   - **Base DN**: `dc=ejemplo,dc=com`
   - **Admin DN**: `cn=admin,dc=ejemplo,dc=com`
   - **Contraseña**: Contraseña del administrador LDAP
   - **Search Base** (opcional): `ou=users,dc=ejemplo,dc=com`
4. Haz clic en **🔍 Probar Conexión** para verificar
5. Si la conexión es exitosa, haz clic en **💾 Guardar Configuración**

## 📖 Uso

### Listar Usuarios

1. Navega a **Usuarios** (👥)
2. La aplicación mostrará todos los usuarios del servidor LDAP
3. Usa la barra de búsqueda para filtrar usuarios

### Desbloquear Usuario

1. En la lista de usuarios, identifica usuarios con estado **🔒 Bloqueado**
2. Haz clic en el botón **🔓 Desbloquear**
3. Confirma la acción

### Indicadores de Caducidad de Contraseña

- 🔴 **Rojo**: Contraseña caducada o caduca en menos de 7 días
- 🟡 **Amarillo**: Contraseña caduca en 7-30 días
- ⚪ **Normal**: Contraseña caduca en más de 30 días

## 🔒 Seguridad

- ✅ Las credenciales LDAP se almacenan **cifradas** en PocketBase
- ✅ La base de datos de PocketBase (`pb_data/`) está en `.gitignore`
- ✅ Las contraseñas **nunca** se envían al frontend
- ✅ Todas las acciones se registran en `audit_logs`

## 🛠️ Desarrollo

### Estructura del Proyecto

```
ldap-app/
├── backend/              # API Node.js/Express
│   ├── services/        # Servicios LDAP y PocketBase
│   ├── routes/          # Rutas de la API
│   └── server.js        # Servidor principal
├── frontend/            # Aplicación Angular
│   ├── src/
│   │   ├── app/
│   │   │   ├── models/      # Interfaces TypeScript
│   │   │   ├── services/    # Servicios Angular
│   │   │   └── pages/       # Componentes de páginas
│   │   └── environments/    # Configuración de entornos
├── pocketbase/          # Instancia de PocketBase
│   └── pb_schema.json   # Schema de colecciones
└── README.md
```

### Comandos Útiles

```bash
# Backend - Modo desarrollo con auto-reload
cd backend
npm run dev

# Frontend - Compilar para producción
cd frontend
ng build --configuration production

# Ver logs de PocketBase
cd pocketbase
./pocketbase serve --dev
```

## 🐛 Solución de Problemas

### Error: "No LDAP configuration found"
- Asegúrate de haber configurado LDAP desde la página de Configuración
- Verifica que PocketBase esté ejecutándose

### Error: "LDAP connection failed"
- Verifica que el servidor LDAP esté accesible
- Comprueba que las credenciales sean correctas
- Revisa el puerto (389 para LDAP, 636 para LDAPS)

### Error: "Failed to fetch users"
- Verifica que el `baseDN` o `searchBase` sean correctos
- Comprueba que el usuario administrador tenga permisos de lectura

## 📝 Notas

- La aplicación soporta tanto **Active Directory** como **OpenLDAP**
- Los atributos de caducidad de contraseña varían según el tipo de servidor LDAP
- La función de desbloqueo modifica el atributo `lockoutTime` en LDAP

## 📄 Licencia

MIT

## 👨‍💻 Autor

Desarrollado para OCA