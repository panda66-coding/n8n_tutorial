# ╔══════════════════════════════════════════════════════════════════╗
# ║  GEN CONTENT — Generate jadwal konten AI otomatis               ║
# ║  Input: tema, jumlah hari, bulan, tahun                         ║
# ╠══════════════════════════════════════════════════════════════════╣
# ║  CARA PAKAI:                                                     ║
# ║  .\gen_content.ps1                                               ║
# ║    → mode interaktif, ditanya satu per satu                      ║
# ║                                                                  ║
# ║  .\gen_content.ps1 -tema "Pahlawan Nasional" -jumlahHari 30 -bulan 5 -tahun 2026
# ║    → langsung generate tanpa tanya                               ║
# ║                                                                  ║
# ║  .\gen_content.ps1 -tema "Ilmuwan Islam" -jumlahHari 15 -bulan 6 -tahun 2026
# ║                                                                  ║
# ║  OUTPUT: content/sejarah_kerajaan/mei_2026.json                  ║
# ╚══════════════════════════════════════════════════════════════════╝

param(
    [string]$tema       = "",
    [int]$jumlahHari    = 0,
    [int]$bulan         = 0,
    [int]$tahun         = 0
)

Set-Location $PSScriptRoot

# ── Banner ───────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║  🧠  GEN CONTENT — Buat Jadwal Konten AI            ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""

# ── Input interaktif jika parameter kosong ───────────────────────────
if (-not $tema) {
    Write-Host "📝  Masukkan tema konten (contoh: Sejarah Kerajaan Indonesia):" -ForegroundColor Cyan
    $tema = Read-Host "   Tema"
    if (-not $tema) { Write-Host "❌  Tema tidak boleh kosong!" -ForegroundColor Red; exit 1 }
}

if ($jumlahHari -le 0) {
    Write-Host "📅  Berapa hari konten yang dibutuhkan? (contoh: 30):" -ForegroundColor Cyan
    $input = Read-Host "   Jumlah hari"
    $jumlahHari = [int]$input
    if ($jumlahHari -le 0) { Write-Host "❌  Jumlah hari tidak valid!" -ForegroundColor Red; exit 1 }
}

$now = Get-Date
if ($bulan -le 0) {
    Write-Host "📅  Bulan berapa? (1-12, default=$($now.Month)):" -ForegroundColor Cyan
    $input = Read-Host "   Bulan"
    $bulan = if ($input -match '^\d+$') { [int]$input } else { $now.Month }
}

if ($tahun -le 0) {
    Write-Host "📅  Tahun berapa? (default=$($now.Year)):" -ForegroundColor Cyan
    $input = Read-Host "   Tahun"
    $tahun = if ($input -match '^\d+$') { [int]$input } else { $now.Year }
}

# ── Validasi ─────────────────────────────────────────────────────────
if ($bulan -lt 1 -or $bulan -gt 12) { Write-Host "❌  Bulan harus 1-12!" -ForegroundColor Red; exit 1 }
if ($tahun -lt 2024) { Write-Host "❌  Tahun tidak valid!" -ForegroundColor Red; exit 1 }

$namaBulan = @{1='januari';2='februari';3='maret';4='april';5='mei';6='juni';
               7='juli';8='agustus';9='september';10='oktober';11='november';12='desember'}
$labelBulan = (Get-Culture).DateTimeFormat.GetMonthName($bulan)
$fileOutput = "content\sejarah_kerajaan\$($namaBulan[$bulan])_$tahun.json"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host "  🎯  Tema       : $tema" -ForegroundColor White
Write-Host "  📅  Periode    : $labelBulan $tahun" -ForegroundColor White
Write-Host "  🔢  Jumlah Hari: $jumlahHari hari" -ForegroundColor White
Write-Host "  💾  Output     : $fileOutput" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host ""

# ── Cek kalau file sudah ada ─────────────────────────────────────────
if (Test-Path $fileOutput) {
    Write-Host "⚠️   File sudah ada: $fileOutput" -ForegroundColor Yellow
    $confirm = Read-Host "   Timpa? (y/N)"
    if ($confirm -ne 'y' -and $confirm -ne 'Y') {
        Write-Host "❌  Dibatalkan." -ForegroundColor Red; exit 0
    }
}

# ── Load API key Groq ─────────────────────────────────────────────────
Get-Content "config\env_variables.txt" | ForEach-Object {
    if ($_ -match '^([^#=\s]+)\s*=\s*(.+)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}
$groqKey = $env:GROQ_API_KEY
if (-not $groqKey) {
    Write-Host "❌  GROQ_API_KEY tidak ditemukan di config/env_variables.txt!" -ForegroundColor Red
    exit 1
}

# ── Generate via Node.js ──────────────────────────────────────────────
Write-Host "🤖  Menghubungi Groq AI untuk generate $jumlahHari topik..." -ForegroundColor Cyan
Write-Host ""

$env:GROQ_API_KEY = $groqKey
node gen_content.js --tema "$tema" --hari $jumlahHari --bulan $bulan --tahun $tahun --output "$fileOutput"

if ($LASTEXITCODE -eq 0 -and (Test-Path $fileOutput)) {
    Write-Host ""
    Write-Host "✅  Jadwal konten berhasil dibuat!" -ForegroundColor Green
    Write-Host "📄  File: $fileOutput" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "▶️   Cara pakai selanjutnya:" -ForegroundColor Yellow
    Write-Host "    .\run.ps1 -bulan $bulan -tahun $tahun           → build hari ini otomatis" -ForegroundColor White
    Write-Host "    .\run.ps1 -hari 1 -bulan $bulan -tahun $tahun   → build hari ke-1" -ForegroundColor White
    Write-Host "    .\run.ps1 -list -bulan $bulan -tahun $tahun     → lihat daftar topik" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌  Gagal generate konten! Cek error di atas." -ForegroundColor Red
    exit 1
}
