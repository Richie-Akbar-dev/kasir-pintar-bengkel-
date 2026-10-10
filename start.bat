@echo off
chcp 65001 >nul
title Kasir Pintar Bengkel - Server
cd /d "%~dp0"

echo.
echo   ============================================
echo    KASIR PINTAR BENGKEL
echo   ============================================
echo.

REM --- Cek Node.js ---
where node >nul 2>nul
if errorlevel 1 (
  echo   [ERROR] Node.js belum terpasang.
  echo   Silakan pasang Node.js dari https://nodejs.org
  echo.
  pause
  exit /b 1
)

REM --- Instalasi pertama kali ---
if not exist "node_modules\" (
  echo   Folder node_modules belum ada, menjalankan instalasi...
  call install.bat
)

REM --- Build antarmuka bila belum ada ---
if not exist "dist\index.html" (
  echo   Menyiapkan antarmuka aplikasi...
  call npm run build
)

echo.
echo   Server berjalan di http://localhost:3001
echo   Tekan CTRL+C pada jendela ini untuk menghentikan aplikasi.
echo.

REM --- Buka browser ---
start "" http://localhost:3001

set NODE_ENV=production
node server\index.js

echo.
echo   Aplikasi dihentikan.
pause
