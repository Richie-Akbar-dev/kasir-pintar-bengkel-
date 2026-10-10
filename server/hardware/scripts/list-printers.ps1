# Daftar nama printer yang terpasang di Windows.
# Output: JSON array of string.
$ErrorActionPreference = 'Stop'

function Get-PrinterNamesModern {
  $names = @()
  $printers = Get-Printer -ErrorAction Stop
  foreach ($p in $printers) { $names += $p.Name }
  return $names
}

function Get-PrinterNamesWmi {
  $names = @()
  $wmi = Get-WmiObject -Class Win32_Printer -ErrorAction Stop
  foreach ($p in $wmi) { if ($p.Name) { $names += $p.Name } }
  return $names
}

$result = @()
try {
  $result = Get-PrinterNamesModern
} catch {
  try {
    $result = Get-PrinterNamesWmi
  } catch {
    Write-Output '[]'
    exit 0
  }
}

if ($null -eq $result) { $result = @() }
$result | ConvertTo-Json -Compress
