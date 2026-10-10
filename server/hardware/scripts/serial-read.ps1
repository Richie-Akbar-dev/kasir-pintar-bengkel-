<#
  Baca satu baris dari port serial (COM).
  Dipakai untuk membaca berat dari timbangan digital.

  Contoh:
    powershell -File serial-read.ps1 -Port COM4 -Baud 9600 -TimeoutMs 2500
#>
param(
  [Parameter(Mandatory = $true)][string]$Port,
  [int]$Baud = 9600,
  [int]$TimeoutMs = 2500
)

$ErrorActionPreference = 'Stop'

$sp = $null
try {
  $sp = New-Object System.IO.Ports.SerialPort $Port, $Baud, 'None', 8, 'One'
  $sp.ReadTimeout = $TimeoutMs
  $sp.Open()

  $buffer = ''
  $deadline = (Get-Date).AddMilliseconds($TimeoutMs)
  while ((Get-Date) -lt $deadline) {
    try {
      $chunk = $sp.ReadExisting()
      if ($chunk) { $buffer += $chunk }
      if ($buffer -match "`r|`n") { break }
      Start-Sleep -Milliseconds 60
    } catch [System.TimeoutException] {
      break
    }
  }

  $line = ($buffer -split "`r|`n" | Where-Object { $_.Trim() -ne '' } | Select-Object -Last 1)
  if (-not $line) { $line = '' }
  @{ raw = $buffer; line = $line.Trim() } | ConvertTo-Json -Compress
} catch {
  Write-Output ("ERROR: " + $_.Exception.Message)
  exit 1
} finally {
  if ($sp -and $sp.IsOpen) { $sp.Close() }
}
