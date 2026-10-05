# Cupertino for Zotero v1.7.0 packager
# Right-click this file and choose "Run with PowerShell"
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$root = $PSScriptRoot
$src = Join-Path $root "Cupertino-Zotero"
$xpi = Join-Path $root "cupertino-theme@zotero.local.xpi"
if (Test-Path $xpi) { Remove-Item $xpi -Force }
$zip = [System.IO.Compression.ZipFile]::Open($xpi, [System.IO.Compression.ZipArchiveMode]::Create)
foreach ($f in @('manifest.json','bootstrap.js','style.css','icons/icon-48.png','icons/icon-96.png')) {
	[System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $src $f.Replace('/', [IO.Path]::DirectorySeparatorChar)), $f, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
}
$zip.Dispose()
Write-Host ("Done: " + $xpi + " (" + (Get-Item $xpi).Length + " bytes)")
Write-Host "Now install it in Zotero: Tools - Plugins - gear - Install Plugin From File"
Read-Host "Press Enter to close"
