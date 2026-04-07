# ╔══════════════════════════════════════════════════════════════╗
# ║  SEJARAH KERAJAAN INDONESIA — Daily Auto Launcher            ║
# ║  Jalankan setiap hari untuk generate video otomatis          ║
# ╠══════════════════════════════════════════════════════════════╣
# ║  CARA PAKAI:                                                 ║
# ║  .\start_sejarah.ps1              → hari ini otomatis        ║
# ║  .\start_sejarah.ps1 --hari 5     → paksa hari ke-5          ║
# ║  .\start_sejarah.ps1 --list       → lihat daftar 30 hari     ║
# ║  .\start_sejarah.ps1 --no-motion  → tanpa animasi            ║
# ╚══════════════════════════════════════════════════════════════╝

param(
    [string]$hari = "",
    [switch]$list,
    [switch]$semua,
    [switch]$noMotion,
    [switch]$motionAll
)

Set-Location "E:\tutorial_n8n"
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🏛️  SEJARAH KERAJAAN INDONESIA                  ║" -ForegroundColor Cyan
Write-Host "║  30 Hari Konten Edukasi Anak Otomatis            ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Load environment variables
Write-Host "⚙️  Loading environment variables..." -ForegroundColor Yellow
Get-Content "config\env_variables.txt" | ForEach-Object {
    if ($_ -match '^([^#=\s]+)\s*=\s*(.+)$') {
        $name  = $matches[1].Trim()
        $value = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($name, $value)
        $env_var = $value.Substring(0, [Math]::Min(8, $value.Length))
        Write-Host "  ✅ $name = $env_var..." -ForegroundColor Green
    }
}

# Add FFmpeg to PATH
$ffmpegDir = "C:\Users\User\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin"
$env:PATH = "$env:PATH;$ffmpegDir"

# Cek dependencies
Write-Host ""
Write-Host "🔍 Cek dependencies..." -ForegroundColor Yellow

$nodeOk = $null; try { $nodeOk = (node --version 2>&1).ToString() } catch {}
$ffmpegOk = Test-Path "$ffmpegDir\ffmpeg.exe"
$pythonOk = $null; try { $pythonOk = (python --version 2>&1).ToString() } catch {}

Write-Host "  Node.js  : $(if ($nodeOk) { '✅ ' + $nodeOk } else { '❌ Tidak ditemukan' })" -ForegroundColor $(if ($nodeOk) { 'Green' } else { 'Red' })
Write-Host "  FFmpeg   : $(if ($ffmpegOk) { '✅ Ada' } else { '❌ Tidak ditemukan' })" -ForegroundColor $(if ($ffmpegOk) { 'Green' } else { 'Red' })
Write-Host "  Python   : $(if ($pythonOk) { '✅ ' + $pythonOk } else { '❌ Tidak ditemukan' })" -ForegroundColor $(if ($pythonOk) { 'Green' } else { 'Red' })

if (-not $nodeOk -or -not $ffmpegOk) {
    Write-Host ""
    Write-Host "❌ Dependency tidak lengkap! Periksa instalasi." -ForegroundColor Red
    exit 1
}

# Cek API keys
Write-Host ""
Write-Host "🔑 Status API Keys:" -ForegroundColor Yellow
Write-Host "  Groq AI    : $(if ($env:GROQ_API_KEY) { '✅ Ada' } else { '❌ Tidak ada!' })" -ForegroundColor $(if ($env:GROQ_API_KEY) { 'Green' } else { 'Red' })
Write-Host "  Leonardo   : $(if ($env:LEONARDO_API_KEY) { '✅ Ada' } else { '⚠️  Tidak ada (pakai picsum)' })" -ForegroundColor $(if ($env:LEONARDO_API_KEY) { 'Green' } else { 'Yellow' })
Write-Host "  Kling AI   : $(if ($env:KLING_ACCESS_KEY) { '✅ Ada (motion)' } else { '⚠️  Tidak ada (gambar static)' })" -ForegroundColor $(if ($env:KLING_ACCESS_KEY) { 'Green' } else { 'Yellow' })
Write-Host "  Telegram   : $(if ($env:TELEGRAM_BOT_TOKEN) { '✅ Ada' } else { '⚠️  Tidak ada (skip kirim)' })" -ForegroundColor $(if ($env:TELEGRAM_BOT_TOKEN) { 'Green' } else { 'Yellow' })
Write-Host ""

# Build argumen
$args_node = @()

if ($list) {
    $args_node += "--list"
} elseif ($semua) {
    $args_node += "--semua"
} elseif ($hari -ne "") {
    $args_node += "--hari"
    $args_node += $hari
}

if ($noMotion)   { $args_node += "--no-motion" }
if ($motionAll)  { $args_node += "--motion-all" }

# Tampilkan mode
$today = Get-Date -Format "dd MMMM yyyy"
Write-Host "📅 Tanggal  : $today" -ForegroundColor Cyan
if ($list) {
    Write-Host "📋 Mode     : Tampilkan daftar 30 hari" -ForegroundColor Cyan
} elseif ($semua) {
    Write-Host "🚀 Mode     : Generate SEMUA 30 hari" -ForegroundColor Magenta
} elseif ($hari -ne "") {
    Write-Host "🎯 Mode     : Paksa hari ke-$hari" -ForegroundColor Cyan
} else {
    Write-Host "📅 Mode     : Otomatis (hari berikutnya)" -ForegroundColor Cyan
}
Write-Host "🎬 Motion   : $(if ($noMotion) { 'Dimatikan' } elseif ($motionAll) { 'Semua scene' } else { 'Key scenes (1,5,10)' })" -ForegroundColor Cyan
Write-Host ""

# Konfirmasi sebelum jalan (kecuali mode list)
if (-not $list) {
    $confirm = Read-Host "▶️  Mulai generate video? (Y/n)"
    if ($confirm -eq 'n' -or $confirm -eq 'N') {
        Write-Host "Dibatalkan." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "🚀 Menjalankan pipeline..." -ForegroundColor Green
Write-Host ""

# Jalankan
$startTime = Get-Date
node run_sejarah.js @args_node
$endTime = Get-Date
$duration = ($endTime - $startTime).ToString("mm\:ss")

Write-Host ""
Write-Host "⏱️  Total waktu: $duration" -ForegroundColor Cyan
Write-Host ""
