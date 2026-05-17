$dataDir = Join-Path $PSScriptRoot "..\data"
$files = Get-ChildItem -LiteralPath $dataDir -File |
  Where-Object { $_.Name -match '(?i)(\.jpe?g)+$' } |
  Sort-Object Name |
  ForEach-Object { $_.Name }

$json = @{ files = $files } | ConvertTo-Json -Depth 3
Set-Content -LiteralPath (Join-Path $dataDir "manifest.json") -Value $json -Encoding utf8
Write-Output "Manifest updated with $($files.Count) JPEG files."
