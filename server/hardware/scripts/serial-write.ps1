<#
  Kirim data mentah ke port serial (COM).
  Dipakai untuk printer thermal serial, pole display, dan perangkat sejenis.

  Contoh:
    powershell -File serial-write.ps1 -Port COM3 -Baud 9600 -FilePath data.bin
#>
param(
  [Parameter(Mandatory = $true)][string]$Port,
  [Parameter(Mandatory = $true)][string]$FilePath,
  [int]$Baud = 9600
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $FilePath)) {
  Write-Output "ERROR: berkas tidak ditemukan: $FilePath"
  exit 1
}

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
$sp = $null
try {
  $sp = New-Object System.IO.Ports.SerialPort $Port, $Baud, 'None', 8, 'One'
  $sp.WriteTimeout = 5000
  $sp.Open()
  $sp.Write($bytes, 0, $bytes.Length)
  Write-Output 'OK'
} catch {
  Write-Output ("ERROR: " + $_.Exception.Message)
  exit 1
} finally {
  if ($sp -and $sp.IsOpen) { $sp.Close() }
}
