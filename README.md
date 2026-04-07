# 🏛️ Sejarah Kerajaan Indonesia — Auto Video Pipeline

Pipeline otomatis untuk membuat video edukasi sejarah Indonesia bergaya **clay animation / chibi** dengan narasi AI, suara natural, subtitle word-by-word highlight, Ken Burns animation, dan distribusi ke Telegram — semuanya dari satu perintah.

---

## ✨ Fitur

| Fitur | Keterangan |
|-------|-----------|
| 🤖 Script AI | Groq AI (llama-3.3-70b) — narasi bahasa Indonesia untuk anak-anak |
| 🎙️ Voice | Microsoft Edge TTS `id-ID-ArdiNeural` — suara natural (bukan robot) |
| 🎨 Gambar | Leonardo AI (Lightning XL) — gaya chibi / clay animation |
| 🎬 Animasi | Ken Burns 8 pola — zoom in/out, pan kiri/kanan/atas/diagonal |
| 📝 Subtitle | Word-by-word ASS + highlight kata penting (kuning, lebih besar) |
| 📲 Distribusi | Otomatis kirim thumbnail, video, caption ke Telegram |
| 📋 Social Media | Caption siap pakai untuk TikTok, YouTube Shorts, Instagram |

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
| `GROQ_API_KEY` | Generate script narasi | [console.groq.com](https://console.groq.com) |
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

Buka `run_sejarah.js` baris 24-25, sesuaikan path FFmpeg-mu:

```javascript
const FFMPEG  = 'C:/path/to/ffmpeg.exe';
const FFPROBE = 'C:/path/to/ffprobe.exe';
```

> **Tips:** Jalankan `where.exe ffmpeg` di PowerShell untuk tahu lokasi FFmpeg.

---

## ▶️ Cara Menjalankan

### Metode 1 — Script PowerShell (Paling Mudah)

Double-click atau jalankan:

```powershell
.\start_sejarah.ps1
```

Script ini otomatis membaca `config/env_variables.txt` dan menjalankan pipeline untuk hari yang tepat berdasarkan tanggal hari ini.

---

### Metode 2 — Manual via PowerShell (Pilih Hari)

**Set environment variables dulu:**

```powershell
$env:GROQ_API_KEY       = "gsk_xxx..."
$env:LEONARDO_API_KEY   = "xxx..."
$env:TELEGRAM_BOT_TOKEN = "xxx..."
$env:TELEGRAM_CHAT_ID   = "123456789"
```

**Kemudian jalankan salah satu perintah:**

```powershell
# Generate hari tertentu — contoh hari ke-5
node run_sejarah.js --hari 5

# Generate hari ini otomatis (berdasarkan tanggal)
node run_sejarah.js

# Lihat daftar semua 30 judul
node run_sejarah.js --list

# Skip animasi Kling (lebih cepat, pakai Ken Burns saja)
node run_sejarah.js --hari 5 --no-motion

# Animasi semua scene dengan Kling AI
node run_sejarah.js --hari 5 --motion-all

# Mode panjang: 15 scene, durasi 3-5 menit
node run_sejarah.js --hari 5 --long

# Generate semua 30 hari sekaligus (butuh waktu lama)
node run_sejarah.js --semua
```

---

### Metode 3 — start_sejarah.ps1 + Pilih Hari Tertentu

Edit file `start_sejarah.ps1`, ubah baris perintah node di bagian bawah:

```powershell
# Contoh: paksa hari ke-7 tanpa animasi Kling
node run_sejarah.js --hari 7 --no-motion
```

Lalu simpan dan double-click `start_sejarah.ps1`.

---

## 📁 Struktur Output

Setiap hari menghasilkan folder di `output/sejarah/`:

```
output/sejarah/
└── hari_05_kerajaan_xyz/
    ├── kerajaan_xyz.mp4      ← Video final (subtitle sudah ter-burn)
    ├── script.json           ← Script narasi lengkap dari Groq AI
    ├── social_media.txt      ← Caption siap upload TikTok/YT/IG
    ├── subtitle.ass          ← Subtitle word-by-word (untuk edit manual)
    ├── subtitle.srt          ← Subtitle standar (backup)
    └── thumbnail.jpg         ← Thumbnail 1024×576
```

---

## 🗓️ Jadwal 30 Hari

Lihat semua judul dengan:
```powershell
node run_sejarah.js --list
```

| Hari | Judul | Era |
|------|-------|-----|
| 1 | Kerajaan Majapahit — Kerajaan Terbesar Nusantara | Hindu-Buddha |
| 2 | Sumpah Palapa — Janji Gajah Mada yang Luar Biasa | Hindu-Buddha |
| 3 | Kerajaan Sriwijaya — Kerajaan Laut Paling Kuat | Hindu-Buddha |
| 4–30 | Jalankan `--list` untuk lihat semua | Berbagai era |

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
| `curl: no URL specified` | Gunakan `curl.exe` bukan `curl` (sudah di-fix otomatis) |
| `Groq API rate limit` | Tunggu 1 menit, jalankan ulang |
| `Leonardo API quota habis` | Cek dashboard [app.leonardo.ai](https://app.leonardo.ai) |
| `FFmpeg not found` | Sesuaikan path FFmpeg di baris 24-25 `run_sejarah.js` |
| `Edge TTS gagal` | Otomatis fallback ke Google TTS |
| `Video tidak terkirim Telegram` | Cek `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID` |
| `ETIMEDOUT kirim video` | Timeout di-set 5 menit, koneksi mungkin lambat |

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
