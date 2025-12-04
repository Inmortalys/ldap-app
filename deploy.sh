#!/bin/bash

# Script de Despliegue para LDAP App en Linux
# Ejecuta este script desde la raíz del proyecto

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                                                       ║"
echo "║   LDAP App - Script de Despliegue a Producción       ║"
echo "║                      (Linux)                          ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar si estamos en el directorio correcto
if [ ! -d "frontend" ] || [ ! -d "backend" ]; then
    echo -e "${RED}[ERROR]${NC} Ejecuta este script desde la raíz del proyecto"
    exit 1
fi

echo -e "${GREEN}[1/6]${NC} Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR]${NC} Node.js no está instalado"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js $(node --version) instalado"

echo ""
echo -e "${GREEN}[2/6]${NC} Instalando dependencias del frontend..."
cd frontend
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR]${NC} Fallo al instalar dependencias del frontend"
    exit 1
fi
echo -e "${GREEN}✓${NC} Dependencias del frontend instaladas"

echo ""
echo -e "${GREEN}[3/6]${NC} Construyendo frontend para producción..."
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR]${NC} Fallo al construir el frontend"
    exit 1
fi
echo -e "${GREEN}✓${NC} Frontend construido exitosamente"

cd ..

echo ""
echo -e "${GREEN}[4/6]${NC} Instalando dependencias del backend..."
cd backend
npm install --production
if [ $? -ne 0 ]; then
    echo -e "${RED}[ERROR]${NC} Fallo al instalar dependencias del backend"
    exit 1
fi
echo -e "${GREEN}✓${NC} Dependencias del backend instaladas"

echo ""
echo -e "${GREEN}[5/6]${NC} Verificando archivo .env..."
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}[WARNING]${NC} No se encuentra archivo .env"
    echo "Copiando .env.example a .env..."
    cp .env.example .env
    echo ""
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║  IMPORTANTE: Edita backend/.env con tus valores      ║"
    echo "║  de producción antes de continuar                    ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo ""
fi
echo -e "${GREEN}✓${NC} Archivo .env encontrado"

cd ..

echo ""
echo -e "${GREEN}[6/6]${NC} Verificando PM2..."
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}[WARNING]${NC} PM2 no está instalado"
    echo "Instalando PM2 globalmente..."
    sudo npm install -g pm2
    echo -e "${GREEN}✓${NC} PM2 instalado"
else
    echo -e "${GREEN}✓${NC} PM2 ya está instalado ($(pm2 --version))"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                                                       ║"
echo "║   Construcción Completada Exitosamente               ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "Próximos pasos:"
echo ""
echo "1. Edita backend/.env con tus valores de producción:"
echo "   nano backend/.env"
echo ""
echo "2. Inicia la aplicación con PM2:"
echo "   cd backend"
echo "   pm2 start server.js --name ldap-app"
echo "   pm2 save"
echo ""
echo "3. Configura PM2 para inicio automático:"
echo "   pm2 startup"
echo "   (ejecuta el comando que PM2 te sugiere)"
echo ""
echo "4. Accede a http://localhost:3000 (o el puerto configurado)"
echo ""
echo "Para configuración con nginx y SSL, consulta:"
echo "  production-deployment-linux.md"
echo ""
