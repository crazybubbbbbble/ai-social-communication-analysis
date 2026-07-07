param(
    [ValidateSet("wb", "xhs", "zhihu")]
    [string]$Platform = "wb",

    [int]$MaxNotes = 3,

    [string]$LoginType = "qrcode"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path -Parent $PSScriptRoot
$MediaCrawler = Join-Path $Root "tools\MediaCrawler"
$OutDir = Join-Path $Root "data\raw\mediacrawler"

if ($Platform -eq "wb") {
    $KeywordFile = Join-Path $Root "config\mediacrawler_keywords\weibo_p0_comma.txt"
} elseif ($Platform -eq "xhs") {
    $KeywordFile = Join-Path $Root "config\mediacrawler_keywords\xhs_p1_comma.txt"
} else {
    $KeywordFile = Join-Path $Root "config\mediacrawler_keywords\zhihu_p1_comma.txt"
}

$KeywordCsv = Get-Content -LiteralPath $KeywordFile -Raw -Encoding UTF8
$FirstKeyword = ($KeywordCsv -split ",")[0]

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Push-Location $MediaCrawler
try {
    $env:NO_PROXY = "localhost,127.0.0.1"
    $env:no_proxy = "localhost,127.0.0.1"
    $env:PYTHONUTF8 = "1"
    $env:PYTHONIOENCODING = "utf-8"
    uv run main.py `
        --platform $Platform `
        --lt $LoginType `
        --type search `
        --keywords $FirstKeyword `
        --crawler_max_notes_count $MaxNotes `
        --save_data_option csv `
        --save_data_path "..\..\data\raw\mediacrawler" `
        --get_comment false `
        --headless false
}
finally {
    Pop-Location
}
