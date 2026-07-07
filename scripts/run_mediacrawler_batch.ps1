param(
    [ValidateSet("wb", "xhs", "zhihu")]
    [string]$Platform = "wb",

    [int]$StartIndex = 0,

    [int]$Limit = 3,

    [int]$MaxNotes = 20,

    [switch]$GetComment,

    [int]$MaxCommentsPerPost = 20,

    [int]$MaxConcurrency = 1,

    [double]$SleepSec = 2,

    [string]$LoginType = "qrcode"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path -Parent $PSScriptRoot
$MediaCrawler = Join-Path $Root "tools\MediaCrawler"
$OutDir = Join-Path $Root "data\raw\mediacrawler"

if ($Platform -eq "wb") {
    $KeywordFile = Join-Path $Root "config\mediacrawler_keywords\weibo_p0.txt"
} elseif ($Platform -eq "xhs") {
    $KeywordFile = Join-Path $Root "config\mediacrawler_keywords\xhs_p1.txt"
} else {
    $KeywordFile = Join-Path $Root "config\mediacrawler_keywords\zhihu_p1.txt"
}

$Keywords = @(Get-Content -LiteralPath $KeywordFile -Encoding UTF8 | Where-Object { $_.Trim() })
$Selected = $Keywords | Select-Object -Skip $StartIndex -First $Limit

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Push-Location $MediaCrawler
try {
    $env:NO_PROXY = "localhost,127.0.0.1"
    $env:no_proxy = "localhost,127.0.0.1"
    $env:PYTHONUTF8 = "1"
    $env:PYTHONIOENCODING = "utf-8"
    Remove-Item Env:SSL_CERT_DIR -ErrorAction SilentlyContinue

    foreach ($Keyword in $Selected) {
        Write-Host "=== crawling $Platform keyword: $Keyword ==="
        uv run main.py `
            --platform $Platform `
            --lt $LoginType `
            --type search `
            --keywords $Keyword `
            --crawler_max_notes_count $MaxNotes `
            --save_data_option csv `
            --save_data_path "..\..\data\raw\mediacrawler" `
            --get_comment $GetComment.IsPresent `
            --max_comments_count_singlenotes $MaxCommentsPerPost `
            --max_concurrency_num $MaxConcurrency `
            --crawler_max_sleep_sec $SleepSec `
            --headless false
    }
}
finally {
    Pop-Location
}
