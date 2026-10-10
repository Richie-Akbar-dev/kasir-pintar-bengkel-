@echo off
chcp 65001 >nul
title Instalasi Kasir Pintar Bengkel
cd /d "%~dp0"

echo.
echo   ============================================
echo    INSTALASI KASIR PINTAR BENGKEL
echo   ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [ERROR] Node.js belum terpasang.
  echo.
  echo   Silakan pasang Node.js versi 18 atau lebih baru:
  echo   https://nodejs.org  ^(pilih versi LTS^)
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODEVER=%%v
echo   Node.js terdeteksi: %NODEVER%

echo.
echo   [1/2] Mengunduh dependency...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo   [ERROR] npm install gagal. Periksa koneksi internet Anda.
  pause
  exit /b 1
)

echo.
echo   [2/2] Menyiapkan antarmuka & data awal...
call npm run build
if errorlevel 1 (
  echo   [ERROR] Build gagal.
  pause
  exit /b 1
)

call npm run seed

echo.
echo   ============================================
echo    INSTALASI SELESAI
echo   ============================================
echo.
echo   Akun bawaan:
echo     owner / owner123   ^(akses penuh^)
echo     kasir / kasir123   ^(transaksi saja^)
echo.
echo   Jalankan aplikasi dengan dobel-klik start.bat
echo.
pause
