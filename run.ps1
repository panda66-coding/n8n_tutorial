# ╔══════════════════════════════════════════════════════════════════╗
# ║  AI VIDEO PIPELINE — Universal Launcher                          ║
# ║  Jalankan dengan input hari, bulan, dan tahun                    ║
# ╠══════════════════════════════════════════════════════════════════╣
# ║  CARA PAKAI:                                                     ║
# ║  .\run.ps1                          → hari ini otomatis          ║
# ║  .\run.ps1 -hari 5                  → paksa hari ke-5            ║
# ║  .\run.ps1 -hari 5 -bulan 4 -tahun 2026                          ║
# ║  .\run.ps1 -bulan 5 -tahun 2026     → ganti jadwal bulan lain    ║
# ║  .\run.ps1 -list                    → lihat daftar 30 topik      ║
# ║  .\run.ps1 -semua                   → build semua hari           ║
# ║  .\run.ps1 -hari 5 -noMotion        → tanpa animasi Kling        ║
# ╚══════════════════════════════════════════════════════════════════╝

param(
    [int]$hari      = 0,
    [int]$bulan     = 0,
    [int]$tahun     = 0,
    [switch]$list,
    [switch]$semua,
    [switch]$noMotion,
    [switch]$motionAll,
    [switch]$long
)

Set-Location $PSScriptRoot

# ── Banner ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  🏛️  AI VIDEO PIPELINE — Sejarah Kerajaan Indonesia  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Resolve bulan & tahun (default = sekarang) ───────────────────────
$now   = Get-Date
$_bln  = if ($bulan -gt 0) { $bulan } else { $now.Month }
$_thn  = if ($tahun -gt 0) { $tahun } else { $now.Year }

$namaBulan = @{1='januari';2='februari';3='maret';4='april';5='mei';6='juni';
               7='juli';8='agustus';9='september';10='oktober';11='november';12='desember'}
$labelBulan = (Get-Culture).DateTimeFormat.GetMonthName($_bln)
$fileJadwal = "content\sejarah_kerajaan\$($namaBulan[$_bln])_$_thn.json"

Write-Host "📅  Bulan : $labelBulan $_thn" -ForegroundColor Yellow
Write-Host "📄  Jadwal: $fileJadwal" -ForegroundColor Yellow

# ── Cek file jadwal ada ─────────────────────────────────────────────
if (-not (Test-Path $fileJadwal)) {
    Write-Host ""
    Write-Host "❌  File jadwal tidak ditemukan: $fileJadwal" -ForegroundColor Red
    Write-Host "💡  Buat dulu dengan: .\gen_content.ps1 -tema 'Sejarah Kerajaan' -jumlahHari 30 -bulan $_bln -tahun $_thn" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# ── Set env JADWAL_FILE agar run_sejarah.js baca file yg benar ──────
$env:JADWAL_FILE = (Resolve-Path $fileJadwal).Path
Write-Host "✅  Jadwal file set: $env:JADWAL_FILE" -ForegroundColor Green

# ── Load environment variables dari config ───────────────────────────
Write-Host ""
Write-Host "⚙️  Loading API keys..." -ForegroundColor Yellow
Get-Content "config\env_variables.txt" | ForEach-Object {
    if ($_ -match '^([^#=\s]+)\s*=\s*(.+)$') {
        $name  = $matches[1].Trim()
        $value = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($name, $value)
        $preview = $value.Substring(0, [Math]::Min(8, $value.Length))
        Write-Host "  ✅ $name = $preview..." -ForegroundColor Green
    }
}

# ── Add FFmpeg to PATH ───────────────────────────────────────────────
$ffmpegDir = "C:\Users\User\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin"
if (Test-Path "$ffmpegDir\ffmpeg.exe") {
    $env:PATH = "$env:PATH;$ffmpegDir"
    Write-Host "  ✅ FFmpeg ditemukan" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  FFmpeg tidak ditemukan di: $ffmpegDir" -ForegroundColor Yellow
    Write-Host "      Pastikan FFmpeg sudah di PATH atau update path di run.ps1" -ForegroundColor Yellow
}

# ── Build argumen node ───────────────────────────────────────────────
$args_node = @()

if ($list)       { $args_node += "--list" }
elseif ($semua)  { $args_node += "--semua" }
else {
    if ($hari -gt 0) { $args_node += "--hari"; $args_node += $hari }
}

if ($noMotion)   { $args_node += "--no-motion" }
if ($motionAll)  { $args_node += "--motion-all" }
if ($long)       { $args_node += "--long" }

# ── Jalankan pipeline ────────────────────────────────────────────────
Write-Host ""
Write-Host "🚀  Menjalankan: node run_sejarah.js $($args_node -join ' ')" -ForegroundColor Cyan
Write-Host ""

if ($args_node.Count -gt 0) {
    node run_sejarah.js @args_node
} else {
    node run_sejarah.js
}

Write-Host ""
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅  Pipeline selesai!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Pipeline selesai dengan exit code: $LASTEXITCODE" -ForegroundColor Yellow
}
