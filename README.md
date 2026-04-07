# 🏛️ AI Video Pipeline — Sejarah Kerajaan Indonesia

Pipeline otomatis untuk membuat video edukasi sejarah Indonesia bergaya **clay animation / chibi** dengan narasi AI, suara natural, Ken Burns animation, subtitle, thumbnail, dan distribusi ke Telegram — semuanya dari satu perintah.

---

## ✨ Fitur

| Fitur | Keterangan |
|-------|-----------|
| 🤖 Script AI | Groq AI (llama-3.3-70b) — narasi bahasa Indonesia dramatis |
| 🎙️ Voice | Microsoft Edge TTS `id-ID-ArdiNeural` — suara natural (bukan robot) |
| 🎨 Gambar | Leonardo AI (Lightning XL) — gaya chibi / clay animation |
| 🎬 Animasi | Ken Burns 8 pola — zoom in/out, pan kiri/kanan/atas/diagonal |
| 📲 Distribusi | Otomatis kirim thumbnail, video, caption ke Telegram |
| 📋 Social Media | Caption siap pakai untuk TikTok, YouTube Shorts, Instagram |
| 🗓️ Multi-bulan | Jadwal konten per bulan/tahun, bisa generate tema baru |

---

## 📋 Persyaratan

### Software
- **Node.js** v18+ → [nodejs.org](https://nodejs.org)
- **FFmpeg** v6+ → [ffmpeg.org](https://ffmpeg.org/download.html) atau via WinGet:
  ```powershell
  winget install Gyan.FFmpeg
  ```

### API Keys (wajib untuk fitur penuh)
| Key | Fungsi | Link |
|-----|--------|------|
| `GROQ_API_KEY` | Generate script narasi + jadwal konten | [console.groq.com](https://console.groq.com) |
| `LEONARDO_API_KEY` | Generate gambar AI | [app.leonardo.ai](https://app.leonardo.ai) |
| `TELEGRAM_BOT_TOKEN` | Kirim video ke Telegram | [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHAT_ID` | ID channel/group Telegram | [@userinfobot](https://t.me/userinfobot) |
| `KLING_ACCESS_KEY` *(opsional)* | Animasi gambar ke video | [klingai.com](https://klingai.com) |
| `KLING_SECRET_KEY` *(opsional)* | Pasangan Kling Access Key | — |

---

## 🚀 Setup Awal

### 1. Clone & Install

```powershell
git clone https://github.com/panda66-coding/n8n_tutorial.git
cd n8n_tutorial
npm install
```

### 2. Konfigurasi API Keys

Buka file `config/env_variables.txt` dan isi sesuai key milikmu:

```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxx
LEONARDO_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
TELEGRAM_BOT_TOKEN=123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TELEGRAM_CHAT_ID=123456789
KLING_ACCESS_KEY=xxxxxxxxxxxxxxxx   (opsional)
KLING_SECRET_KEY=xxxxxxxxxxxxxxxx   (opsional)
```

### 3. Set Path FFmpeg

Buka `run.ps1` cari baris `$ffmpegDir`, sesuaikan path FFmpeg-mu:

```powershell
$ffmpegDir = "C:\path\to\ffmpeg\bin"
```

> **Tips:** Jalankan `where.exe ffmpeg` di PowerShell untuk tahu lokasi FFmpeg.

---

## ▶️ Cara Menjalankan

### 🔥 Metode Utama — `run.ps1` (Direkomendasikan)

Script launcher utama yang mendukung input **hari**, **bulan**, dan **tahun**:

```powershell
# Build hari ini otomatis (berdasarkan tanggal + jadwal bulan ini)
.\run.ps1

# Build hari tertentu di bulan ini
.\run.ps1 -hari 5

# Build hari tertentu di bulan & tahun tertentu
.\run.ps1 -hari 5 -bulan 5 -tahun 2026

# Ganti jadwal ke bulan lain tanpa paksa hari
.\run.ps1 -bulan 5 -tahun 2026

# Lihat daftar semua topik bulan ini
.\run.ps1 -list

# Lihat daftar topik bulan tertentu
.\run.ps1 -list -bulan 5 -tahun 2026

# Build tanpa animasi Kling (lebih cepat)
.\run.ps1 -hari 5 -noMotion

# Build semua hari sekaligus
.\run.ps1 -semua
```

---

### 🧠 Generate Jadwal Konten Baru — `gen_content.ps1`

Buat jadwal konten untuk tema dan bulan/tahun baru menggunakan Groq AI:

```powershell
# Mode interaktif — ditanya satu per satu
.\gen_content.ps1

# Mode langsung — masukkan semua parameter
.\gen_content.ps1 -tema "Pahlawan Nasional Indonesia" -jumlahHari 30 -bulan 5 -tahun 2026

# Contoh tema lain:
.\gen_content.ps1 -tema "Ilmuwan Muslim Dunia" -jumlahHari 30 -bulan 6 -tahun 2026
.\gen_content.ps1 -tema "Dinosaurus dan Prasejarah" -jumlahHari 15 -bulan 7 -tahun 2026
.\gen_content.ps1 -tema "Keajaiban Alam Indonesia" -jumlahHari 30 -bulan 8 -tahun 2026
```

Output otomatis disimpan di `content/sejarah_kerajaan/<bulan>_<tahun>.json`

---

### ⚙️ Metode Manual — via PowerShell langsung

```powershell
# Set env vars dulu
$env:GROQ_API_KEY       = "gsk_xxx..."
$env:LEONARDO_API_KEY   = "xxx..."
$env:TELEGRAM_BOT_TOKEN = "xxx..."
$env:TELEGRAM_CHAT_ID   = "123456789"

# Opsional: set file jadwal tertentu
$env:JADWAL_FILE = "E:\n8n_tutorial\content\sejarah_kerajaan\april_2026.json"

# Jalankan
node run_sejarah.js --hari 5
node run_sejarah.js --list
node run_sejarah.js --semua
node run_sejarah.js --hari 5 --no-motion
node run_sejarah.js --hari 5 --long
```

---

## 📁 Struktur Workspace

```
n8n_tutorial/
├── run_sejarah.js          ← Engine utama pipeline video
├── run.ps1                 ← Launcher utama (pakai ini!)
├── gen_content.ps1         ← Generator jadwal konten baru
├── gen_content.js          ← Engine generator konten (Groq AI)
├── start_sejarah.ps1       ← Launcher legacy (masih bisa dipakai)
├── config/
│   └── env_variables.txt   ← API keys (jangan di-commit!)
├── content/
│   ├── sejarah_kerajaan_30hari.json       ← File legacy (fallback)
│   └── sejarah_kerajaan/
│       ├── april_2026.json                ← Jadwal April 2026
│       └── <bulan>_<tahun>.json           ← Jadwal bulan lainnya
├── output/sejarah/
│   └── hari_XX_judul.../
│       ├── judul.mp4
│       ├── script.json
│       ├── social_media.txt
│       ├── subtitle.srt
│       └── thumbnail.jpg
└── workflows/
    └── ai_video_pipeline.json             ← n8n workflow
```

---

## 📁 Struktur Output

Setiap hari menghasilkan folder di `output/sejarah/`:

```
output/sejarah/
└── hari_05_borobudur_candi_terbesar_di_dunia/
    ├── borobudur_candi_terbesar_di_dunia.mp4  ← Video final
    ├── script.json                             ← Script narasi lengkap
    ├── social_media.txt                        ← Caption siap upload
    ├── subtitle.srt                            ← Subtitle standar
    └── thumbnail.jpg                           ← Thumbnail 1024×576
```

---

## 🗓️ Jadwal Konten Bawaan (April 2026)

File: `content/sejarah_kerajaan/april_2026.json`

| Hari | Judul | Era |
|------|-------|-----|
| 1 | Kerajaan Majapahit — Kerajaan Terbesar Nusantara | Hindu-Buddha |
| 2 | Sumpah Palapa — Janji Gajah Mada yang Luar Biasa | Hindu-Buddha |
| 3 | Kerajaan Sriwijaya — Kerajaan Laut Paling Kuat | Hindu-Buddha |
| 4–30 | Jalankan `.\run.ps1 -list` untuk lihat semua | Berbagai era |

---

## ⚙️ Konfigurasi Lanjutan

### Ganti Voice TTS

Di `run_sejarah.js` fungsi `generateTTSEdge()`, ganti nama voice:

```javascript
// Pilihan voice Bahasa Indonesia Microsoft Neural:
'id-ID-ArdiNeural'    // Pria, natural, cocok narasi sejarah (default)
'id-ID-GadisNeural'   // Wanita, energik, cocok konten anak
```

### Ganti Model Leonardo AI

Di fungsi `leonardoGenerateImage()`, ganti `modelId`:

```javascript
modelId: 'aa77f04e-3eec-4034-9c07-d0f619684628', // Lightning XL — cepat (default)
modelId: 'ac614f96-1082-45bf-be9d-757f2d31c174', // DreamShaper v7 — lebih detail
modelId: '1e60896f-3c26-4296-8ecc-53e2afecc132', // Anime XL — chibi terbaik
```

### Tambah Kata Highlight di Subtitle

Di `run_sejarah.js` array `HIGHLIGHT_WORDS`:

```javascript
const HIGHLIGHT_WORDS = [
  'kerajaan', 'sultan', 'raja', // ...
  'kata_baru_mu',  // ← tambah kata penting di sini
];
```

---

## 🔧 Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `File jadwal tidak ditemukan` | Jalankan `.\gen_content.ps1 -bulan X -tahun YYYY` untuk generate |
| `Groq API rate limit (429)` | Tunggu ~1 menit — retry otomatis 5x dengan jeda 60 detik |
| `Leonardo API quota habis` | Cek dashboard [app.leonardo.ai](https://app.leonardo.ai) |
| `FFmpeg not found` | Update `$ffmpegDir` di `run.ps1` |
| `Edge TTS gagal` | Otomatis fallback ke Google TTS |
| `Video tidak terkirim Telegram` | Cek `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID` di `config/env_variables.txt` |
| `ETIMEDOUT kirim video` | Timeout 5 menit — koneksi mungkin lambat, coba ulang |

---

## 📦 Dependencies

```
msedge-tts    — Microsoft Neural TTS (gratis, tidak perlu API key)
```

Install semua dependency:

```powershell
npm install
```

---

## 📄 License

MIT — bebas digunakan dan dimodifikasi.
