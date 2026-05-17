$dataDir = Join-Path $PSScriptRoot "..\data"
$tests = @(Get-ChildItem -LiteralPath $dataDir -Directory |
  Sort-Object Name |
  ForEach-Object {
    $folder = $_
    $files = Get-ChildItem -LiteralPath $folder.FullName -File |
      Where-Object { $_.Name -match '(?i)(\.jpe?g)+$' } |
      Sort-Object Name |
      ForEach-Object { $_.Name }

    if ($files.Count -gt 0) {
      @{
        id = $folder.Name
        title = $folder.Name
        folder = $folder.Name
        files = @($files)
      }
    }
  })

$json = @{ tests = @($tests) } | ConvertTo-Json -Depth 5
Set-Content -LiteralPath (Join-Path $dataDir "manifest.json") -Value $json -Encoding utf8
Write-Output "Manifest updated with $($tests.Count) test(s)."
