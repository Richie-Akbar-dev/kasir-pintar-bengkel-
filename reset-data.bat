@echo off
chcp 65001 >nul
title Reset Data Kasir Pintar Bengkel
cd /d "%~dp0"

echo.
echo   PERINGATAN
echo   Semua data transaksi, sparepart, pelanggan, dan pengaturan
echo   akan dikembalikan ke data contoh bawaan.
echo.
echo   Data lama Anda tetap disimpan di folder data\backups
echo.
set /p KONFIRMASI=Ketik YA lalu Enter untuk melanjutkan: 

if /i not "%KONFIRMASI%"=="YA" (
  echo   Dibatalkan.
  pause
  exit /b 0
)

call npm run reset
echo.
pause
