$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Python = "C:\Users\lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$MediaPython = Join-Path $Root "tools\MediaCrawler\.venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $MediaPython)) {
    $MediaPython = $Python
}

Push-Location $Root
try {
    & $Python scripts\export_mediacrawler_keywords.py
    & $Python scripts\clean_text.py
    & $Python scripts\label_rules.py
    & $Python scripts\clean_comments.py
    & $Python scripts\label_comments.py
    & $Python scripts\make_stats.py
    & $MediaPython scripts\word_freq.py
    & $MediaPython scripts\make_figures.py
    & $Python scripts\validate_schema.py
    & $Python scripts\smoke_test_pipeline.py
}
finally {
    Pop-Location
}
