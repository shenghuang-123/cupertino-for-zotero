Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile("$PSScriptRoot\cupertino-icon-1024.png")
foreach ($s in 512, 192, 96, 48) {
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.DrawImage($src, 0, 0, $s, $s)
  $g.Dispose()
  $bmp.Save("$PSScriptRoot\cupertino-icon-$s.png", [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
$src.Dispose()
Write-Host "Exported 512 / 192 / 96 / 48 from cupertino-icon-1024.png"
