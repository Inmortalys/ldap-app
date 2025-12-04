@echo off
REM Script de Despliegue Rápido para LDAP App
REM Ejecuta este script desde la raíz del proyecto
echo.
echo ╔═══════════════════════════════════════════════════════╗
echo ║                                                       ║
echo ║   LDAP App - Script de Despliegue a Producción       ║
echo ║                                                       ║
echo ╚═══════════════════════════════════════════════════════╝
echo.

REM Verificar si estamos en el directorio correcto
if not exist "frontend" (
    echo [ERROR] No se encuentra la carpeta 'frontend'
    echo Por favor, ejecuta este script desde la raíz del proyecto
    pause
    exit /b 1
)

if not exist "backend" (
    echo [ERROR] No se encuentra la carpeta 'backend'
    echo Por favor, ejecuta este script desde la raíz del proyecto
    pause
    exit /b 1
)

echo [1/6] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no está instalado
    pause
    exit /b 1
)
echo ✓ Node.js instalado

echo.
echo [2/6] Instalando dependencias del frontend...
cd frontend
call npm install
if errorlevel 1 (
    echo [ERROR] Fallo al instalar dependencias del frontend
    cd ..
    pause
    exit /b 1
)
echo ✓ Dependencias del frontend instaladas

echo.
echo [3/6] Construyendo frontend para producción...
call npm run build
if errorlevel 1 (
    echo [ERROR] Fallo al construir el frontend
    cd ..
    pause
    exit /b 1
)
echo ✓ Frontend construido exitosamente

cd ..

echo.
echo [4/6] Instalando dependencias del backend...
cd backend
call npm install --production
if errorlevel 1 (
    echo [ERROR] Fallo al instalar dependencias del backend
    cd ..
    pause
    exit /b 1
)
echo ✓ Dependencias del backend instaladas

echo.
echo [5/6] Verificando archivo .env...
if not exist ".env" (
    echo [WARNING] No se encuentra archivo .env
    echo Copiando .env.example a .env...
    copy .env.example .env
    echo.
    echo ╔═══════════════════════════════════════════════════════╗
    echo ║  IMPORTANTE: Edita backend/.env con tus valores      ║
    echo ║  de producción antes de continuar                    ║
    echo ╚═══════════════════════════════════════════════════════╝
    echo.
    pause
)
echo ✓ Archivo .env encontrado

cd ..

echo.
echo [6/6] Verificando PM2...
pm2 --version >nul 2>&1
if errorlevel 1 (
    echo [WARNING] PM2 no está instalado
    echo Instalando PM2 globalmente...
    call npm install -g pm2
    call npm install -g pm2-windows-startup
    echo ✓ PM2 instalado
    echo.
    echo Para configurar PM2 para inicio automático, ejecuta:
    echo   pm2-startup install
    echo.
) else (
    echo ✓ PM2 ya está instalado
)

echo.
echo ╔═══════════════════════════════════════════════════════╗
echo ║                                                       ║
echo ║   Construcción Completada Exitosamente               ║
echo ║                                                       ║
echo ╚═══════════════════════════════════════════════════════╝
echo.
echo Próximos pasos:
echo.
echo 1. Edita backend/.env con tus valores de producción
echo 2. Ejecuta: cd backend
echo 3. Ejecuta: pm2 start server.js --name ldap-app
echo 4. Ejecuta: pm2 save
echo 5. Accede a http://localhost:3000 (o el puerto configurado)
echo.
echo Para más información, consulta production-deployment.md
echo.
pause
