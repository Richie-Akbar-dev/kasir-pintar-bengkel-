@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Build Aplikasi Desktop - Kasir Pintar Bengkel
cd /d "%~dp0"

set "LOG=%~dp0build-log.txt"
set "APP=%~dp0src-tauri\resources\app"
set "PATH=%USERPROFILE%\.cargo\bin;%ProgramFiles%\nodejs;%PATH%"

echo   ============================================
echo    BUILD APLIKASI DESKTOP - KASIR PINTAR BENGKEL
echo   ============================================
echo.
echo   Skrip ini akan:
echo     [1/8] Memeriksa hak administrator
echo     [2/8] Memeriksa / memasang Node.js
echo     [3/8] Memeriksa / memasang Rust
echo     [4/8] Memeriksa / memasang MSVC Build Tools
echo     [5/8] Memasang perpustakaan aplikasi
echo     [6/8] Membangun tampilan aplikasi
echo     [7/8] Menyiapkan paket aplikasi (node.exe + server)
echo     [8/8] Merakit installer (.exe)
echo.
echo   Log proses disimpan di: build-log.txt
echo   (kirim berkas ini ke pengembang bila proses gagal)
echo.

echo ===== Build dimulai %date% %time% ===== > "%LOG%"

REM ============================================================
REM [1/8] Hak administrator
REM ============================================================
call :log "=== [1/8] Memeriksa hak administrator ==="
net session >nul 2>&1
if errorlevel 1 (
  echo   [PERINGATAN] CMD ini BUKAN "Run as administrator".
  echo.
  echo   Jika MSVC Build Tools belum terpasang, proses akan gagal.
  echo   Disarankan: tutup CMD ini, klik kanan shortcut CMD,
  echo   pilih "Run as administrator", lalu jalankan ulang skrip ini.
  echo.
  choice /c YN /m "Tetap lanjut tanpa hak administrator"
  if errorlevel 2 exit /b 1
) else (
  echo   [OK] Berjalan dengan hak administrator.
)

REM ============================================================
REM [2/8] Node.js
REM ============================================================
call :log "=== [2/8] Memeriksa Node.js ==="
where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js belum terpasang. Mencoba memasang lewat winget...
  winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements >> "%LOG%" 2>&1
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
  where node >nul 2>nul
  if errorlevel 1 (
    call :log "[GAGAL] Node.js tidak ditemukan dan gagal dipasang otomatis."
    echo   [GAGAL] Node.js belum terpasang.
    echo   Silakan pasang manual dari https://nodejs.org ^(pilih LTS^),
    echo   tutup CMD ini, buka lagi, lalu jalankan ulang skrip.
    pause
    exit /b 1
  )
)
for /f "tokens=*" %%v in ('node -v') do set "NODEVER=%%v"
call :log "Node.js terdeteksi: %NODEVER%"
echo   [OK] Node.js %NODEVER%

REM ============================================================
REM [3/8] Rust
REM ============================================================
call :log "=== [3/8] Memeriksa Rust ==="
where cargo >nul 2>nul
if errorlevel 1 (
  echo   Rust belum terpasang. Mengunduh rustup ^(±200 MB^)...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://win.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe' -OutFile '%TEMP%\rustup-init.exe'" >> "%LOG%" 2>&1
  if not exist "%TEMP%\rustup-init.exe" (
    call :log "[GAGAL] Gagal mengunduh rustup-init.exe"
    echo   [GAGAL] Gagal mengunduh Rust. Periksa koneksi internet.
    pause
    exit /b 1
  )
  echo   Memasang Rust ^(±5 menit, layar akan menampilkan banyak teks^)...
  "%TEMP%\rustup-init.exe" -y --default-host x86_64-pc-windows-msvc --profile minimal >> "%LOG%" 2>&1
  set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
  where cargo >nul 2>nul
  if errorlevel 1 (
    call :log "[GAGAL] Rust tidak ditemukan setelah instalasi"
    echo   [GAGAL] Rust gagal dipasang. Lihat build-log.txt
    pause
    exit /b 1
  )
)
for /f "tokens=*" %%v in ('cargo --version') do call :log "%%v"
echo   [OK] Rust terpasang.

REM ============================================================
REM [4/8] MSVC Build Tools
REM ============================================================
call :log "=== [4/8] Memeriksa MSVC Build Tools ==="
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
set "VSDIR="
if exist "%VSWHERE%" (
  for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VSDIR=%%i"
)
if defined VSDIR (
  call :log "MSVC ditemukan di: %VSDIR%"
  echo   [OK] MSVC Build Tools sudah terpasang.
) else (
  echo   MSVC Build Tools belum terpasang.
  echo   Mengunduh installer ^(±2 GB, proses ini yang paling lama^)...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://aka.ms/vs/17/release/vs_BuildTools.exe' -OutFile '%TEMP%\vs_BuildTools.exe'" >> "%LOG%" 2>&1
  if not exist "%TEMP%\vs_BuildTools.exe" (
    call :log "[GAGAL] Gagal mengunduh vs_BuildTools.exe"
    echo   [GAGAL] Gagal mengunduh Build Tools. Periksa koneksi internet.
    pause
    exit /b 1
  )
  echo   Memasang MSVC Build Tools ^(15-45 menit^)... jangan tutup jendela ini.
  "%TEMP%\vs_BuildTools.exe" --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended --passive --wait --norestart >> "%LOG%" 2>&1
  set "VSDIR="
  if exist "%VSWHERE%" (
    for /f "usebackq tokens=*" %%i in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "VSDIR=%%i"
  )
  if not defined VSDIR (
    call :log "[GAGAL] MSVC tidak ditemukan setelah instalasi"
    echo   [GAGAL] MSVC Build Tools gagal dipasang. Lihat build-log.txt
    pause
    exit /b 1
  )
)
REM Aktifkan lingkungan MSVC untuk sesi ini (agar link.exe ditemukan)
if exist "%VSDIR%\VC\Auxiliary\Build\vcvars64.bat" (
  call "%VSDIR%\VC\Auxiliary\Build\vcvars64.bat" >> "%LOG%" 2>&1
  set "PATH=%USERPROFILE%\.cargo\bin;%ProgramFiles%\nodejs;%PATH%"
)

REM ============================================================
REM [5/8] Perpustakaan aplikasi
REM ============================================================
call :log "=== [5/8] npm install ==="
echo   Memasang perpustakaan aplikasi ^(1-3 menit^)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "npm install --no-audit --no-fund 2>&1 | Tee-Object -FilePath '%LOG%' -Append; exit $LASTEXITCODE"
if errorlevel 1 (
  call :log "[GAGAL] npm install"
  echo   [GAGAL] npm install. Lihat build-log.txt
  pause
  exit /b 1
)
echo   [OK] Perpustakaan terpasang.

REM ============================================================
REM [6/8] Tampilan aplikasi
REM ============================================================
call :log "=== [6/8] npm run build ==="
powershell -NoProfile -ExecutionPolicy Bypass -Command "npm run build 2>&1 | Tee-Object -FilePath '%LOG%' -Append; exit $LASTEXITCODE"
if errorlevel 1 (
  call :log "[GAGAL] npm run build"
  echo   [GAGAL] Build tampilan gagal. Lihat build-log.txt
  pause
  exit /b 1
)
echo   [OK] Tampilan selesai dibangun.

REM ============================================================
REM [7/8] Paket aplikasi (node.exe + server + tampilan)
REM ============================================================
call :log "=== [7/8] Menyiapkan paket aplikasi ==="
echo   Menyiapkan paket aplikasi...
rmdir /s /q "%APP%" 2>nul
mkdir "%APP%" 2>nul
xcopy /e /i /y server "%APP%\server" >nul
xcopy /e /i /y dist "%APP%\dist" >nul
copy /y package.json "%APP%\" >nul
copy /y package-lock.json "%APP%\" >nul

REM Unduh node.exe Windows x64 dari npm (dibundel agar aplikasi berdiri sendiri)
set "NODEFETCH=%TEMP%\kasir-nodefetch"
rmdir /s /q "%NODEFETCH%" 2>nul
mkdir "%NODEFETCH%" 2>nul
pushd "%NODEFETCH%"
call npm pack node-win-x64 --silent >> "%LOG%" 2>&1
for %%f in (node-win-x64-*.tgz) do tar -xzf "%%f"
if not exist "package\bin\node.exe" (
  popd
  call :log "[GAGAL] node.exe gagal diunduh dari npm"
  echo   [GAGAL] node.exe gagal diunduh. Periksa internet, lihat build-log.txt
  pause
  exit /b 1
)
copy /y "package\bin\node.exe" "%APP%\node.exe" >nul
popd
call :log "node.exe berhasil dibundel"

REM Perpustakaan runtime (hanya yang produksi)
pushd "%APP%"
call npm install --omit=dev --no-audit --no-fund >> "%LOG%" 2>&1
popd
echo   [OK] Paket aplikasi siap.

REM ============================================================
REM [8/8] Merakit installer (.exe)
REM ============================================================
call :log "=== [8/8] npx tauri build ==="
echo   Merakit installer... ^(10-30 menit, layar akan penuh teks^)
powershell -NoProfile -ExecutionPolicy Bypass -Command "npx --yes @tauri-apps/cli@2 build --config '%~dp0src-tauri\tauri.bundle.json' 2>&1 | Tee-Object -FilePath '%LOG%' -Append; exit $LASTEXITCODE"
if errorlevel 1 (
  call :log "[GAGAL] tauri build"
  echo   [GAGAL] Perakitan gagal. Lihat build-log.txt
  pause
  exit /b 1
)

REM Salin hasil ke folder Keluaran agar mudah disalin ke flashdisk
mkdir "%~dp0Keluaran" 2>nul
copy /y "%~dp0src-tauri\target\release\bundle\nsis\*.exe" "%~dp0Keluaran\" >nul

echo.
echo   ============================================
echo    BUILD SELESAI
echo   ============================================
echo.
echo   Installer ada di folder:
echo     %~dp0Keluaran\
echo.
echo   !!! PENTING !!!
echo   Salin berkas installer itu ke FLASHDISK sekarang juga.
echo   Jangan simpan hanya di PC warnet — banyak warnet yang
echo   menghapus semua perubahan saat restart (Deep Freeze).
echo.
echo   Bila nanti muncul peringatan SmartScreen di laptop rumah:
echo   klik "Info selengkapnya" -^> "Tetap jalankan".
echo.
echo   Bila proses tadi gagal: kirim berkas build-log.txt ke pengembang.
echo.
call :log "=== Build SELESAI %date% %time% ==="
dir "%~dp0Keluaran\*.exe"
pause
exit /b 0

:log
echo   %~1
>> "%LOG%" echo %date% %time% %~1
goto :eof
