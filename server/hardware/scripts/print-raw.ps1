<#
  Kirim data mentah (ESC/POS) ke printer Windows tanpa dialog cetak.

  Cara utama  : System.Printing.PrintQueue.AddJob() + JobStream (managed, cepat)
  Cara cadangan: winspool.drv lewat P/Invoke (RawPrinterHelper) bila cara utama gagal

  Parameter:
    -PrinterName  nama printer persis seperti di Control Panel
    -FilePath     berkas .bin berisi perintah mentah
#>
param(
  [Parameter(Mandatory = $true)][string]$PrinterName,
  [Parameter(Mandatory = $true)][string]$FilePath,
  [switch]$UseLegacy
)

$ErrorActionPreference = 'Stop'

function Send-JobStream {
  param([string]$Name, [byte[]]$Bytes)

  Add-Type -AssemblyName System.Printing
  $server = New-Object System.Printing.LocalPrintServer
  $queue = $server.GetPrintQueue($Name)
  if (-not $queue) { throw "Printer '$Name' tidak ditemukan." }

  $job = $queue.AddJob('KasirPintar')
  $stream = $null
  try {
    $stream = $job.JobStream
    $stream.Write($Bytes, 0, $Bytes.Length)
    $stream.Flush()
  } finally {
    if ($stream) { $stream.Close() }
  }
}

function Send-RawPrinterHelper {
  param([string]$Name, [byte[]]$Bytes)

  $source = @'
using System;
using System.Runtime.InteropServices;

public class KpRawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static void Send(string printerName, byte[] bytes)
    {
        IntPtr handle;
        if (!OpenPrinter(printerName.Normalize(), out handle, IntPtr.Zero))
            throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());

        try
        {
            DOCINFOA di = new DOCINFOA();
            di.pDocName = "KasirPintar";
            di.pDataType = "RAW";

            if (!StartDocPrinter(handle, 1, di)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            try
            {
                if (!StartPagePrinter(handle)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());

                IntPtr unmanaged = Marshal.AllocCoTaskMem(bytes.Length);
                Marshal.Copy(bytes, 0, unmanaged, bytes.Length);
                int written;
                bool ok = WritePrinter(handle, unmanaged, bytes.Length, out written);
                Marshal.FreeCoTaskMem(unmanaged);

                if (!ok) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
                EndPagePrinter(handle);
            }
            finally { EndDocPrinter(handle); }
        }
        finally { ClosePrinter(handle); }
    }
}
'@

  if (-not ('KpRawPrinter' -as [type])) {
    Add-Type -TypeDefinition $source -ErrorAction Stop
  }
  [KpRawPrinter]::Send($Name, $Bytes)
}

# ------------------------------- eksekusi -------------------------------

if (-not (Test-Path -LiteralPath $FilePath)) {
  Write-Output "ERROR: berkas tidak ditemukan: $FilePath"
  exit 1
}

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
if ($bytes.Length -eq 0) {
  Write-Output 'ERROR: data cetak kosong'
  exit 1
}

try {
  if ($UseLegacy) {
    Send-RawPrinterHelper -Name $PrinterName -Bytes $bytes
  } else {
    try {
      Send-JobStream -Name $PrinterName -Bytes $bytes
    } catch {
      Write-Output ("INFO: metode utama gagal (" + $_.Exception.Message + "), mencapai metode cadangan...")
      Send-RawPrinterHelper -Name $PrinterName -Bytes $bytes
    }
  }
  Write-Output 'OK'
} catch {
  Write-Output ("ERROR: " + $_.Exception.Message)
  exit 1
}
