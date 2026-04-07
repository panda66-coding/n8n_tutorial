/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AI VIDEO PIPELINE v2                                        ║
 * ║  Kids Education · Clay Animation · Auto-Script dari AI       ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  FITUR BARU v2:                                              ║
 * ║  ✅ Groq AI → script otomatis gratis (ganti OpenAI)         ║
 * ║  ✅ Leonardo Motion SVD → gambar jadi animasi bergerak       ║
 * ║  ✅ Prompt Leonardo difix → keyword-based, lebih cocok       ║
 * ║  ✅ ElevenLabs: cek & fallback ke Edge TTS jika blocked     ║
 * ║  ✅ Telegram notifikasi otomatis                             ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * CARA PAKAI:
 *   node run_pipeline_v2.js                    → topik otomatis (Groq)
 *   node run_pipeline_v2.js "Harimau Sumatera" → topik manual
 *   node run_pipeline_v2.js --no-motion         → skip semua motion (hemat kredit)
 *   node run_pipeline_v2.js                    → motion scene 1,5,10 saja (~75 kredit)
 *   node run_pipeline_v2.js --motion-all        → motion SEMUA scene (~250 kredit)
 *
 * ENV yang diperlukan (set di env_variables.txt atau powershell):
 *   GROQ_API_KEY         → dari console.groq.com (GRATIS)
 *   LEONARDO_API_KEY     → sudah ada
 *   TELEGRAM_BOT_TOKEN   → sudah ada
 *   TELEGRAM_CHAT_ID     → sudah ada
 *   ELEVENLABS_API_KEY   → opsional (fallback ke Edge TTS jika error)
 *   OPENAI_API_KEY       → opsional (backup script AI)
 */

const { execSync } = require('child_process');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── PATHS ──────────────────────────────────────────────────────
const FFMPEG  = 'C:/Users/User/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe';
const FFPROBE = 'C:/Users/User/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffprobe.exe';
const FONT_BOLD = 'C\\:/Windows/Fonts/arialbd.ttf';
const FONT_NRM  = 'C\\:/Windows/Fonts/arial.ttf';
const BASE_DIR  = 'E:/tutorial_n8n/output';

// ── API KEYS ───────────────────────────────────────────────────
const GROQ_KEY       = process.env.GROQ_API_KEY          || '';
const OPENAI_KEY     = process.env.OPENAI_API_KEY        || '';
const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY    || '';
const LEONARDO_KEY   = process.env.LEONARDO_API_KEY      || '';
const KLING_ACCESS   = process.env.KLING_ACCESS_KEY      || '';
const KLING_SECRET   = process.env.KLING_SECRET_KEY      || '';
const TG_TOKEN       = process.env.TELEGRAM_BOT_TOKEN    || '';
const TG_CHAT_ID     = process.env.TELEGRAM_CHAT_ID      || '';

// ── FLAGS ──────────────────────────────────────────────────────
const USE_MOTION   = !process.argv.includes('--no-motion');  // aktifkan motion
const MOTION_ALL   = process.argv.includes('--motion-all');  // motion semua scene
const CUSTOM_TOPIC = process.argv.slice(2).find(a => !a.startsWith('--')) || '';

// ── HELPERS ───────────────────────────────────────────────────
function log(msg)  { console.log(msg); }
function warn(msg) { console.warn('  ⚠️  ' + msg); }
function err(msg)  { console.error('  ❌ ' + msg); }
function ok(msg)   { console.log('  ✅ ' + msg); }
function info(msg) { console.log('  ℹ️  ' + msg); }
function step(n, t){ log(`\n${'━'.repeat(50)}\nSTEP ${n} ${t}\n${'━'.repeat(50)}`); }

function sleep(ms) { execSync(`ping -n ${Math.ceil(ms/1000)+1} 127.0.0.1 > nul`, { shell:'cmd.exe', timeout: ms+5000 }); }

function slugify(s) {
  return s.toLowerCase()
    .replace(/[àáâã]/g,'a').replace(/[èéêë]/g,'e').replace(/[ìíîï]/g,'i')
    .replace(/[òóôõ]/g,'o').replace(/[ùúûü]/g,'u')
    .replace(/[^a-z0-9\s_]/g,'').replace(/\s+/g,'_').replace(/_+/g,'_').trim().substring(0,40);
}

function fmtDate(d) {
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  return { dd, mm, yyyy };
}

function getAudioDuration(filePath) {
  try {
    const out = execSync(
      `"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
      { encoding:'utf8', timeout:8000 }
    );
    return Math.round(parseFloat(out.trim()) * 10) / 10;
  } catch(e) { return 0; }
}

function downloadFile(url, destPath) {
  try {
    execSync(`curl -s -L -o "${destPath}" "${url}"`, { timeout:60000, shell:'cmd.exe' });
    return fs.existsSync(destPath) && fs.statSync(destPath).size > 2000;
  } catch(e) { return false; }
}

function httpsPost(hostname, path, headers, bodyStr) {
  return new Promise((resolve, reject) => {
    const bodyBuf = Buffer.from(bodyStr, 'utf8');
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': bodyBuf.length, ...headers }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'GET', headers }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function escTxt(t) {
  // Bersihkan karakter khusus FFmpeg drawtext
  // JANGAN potong teks di sini — biarkan wrapTxt yang atur
  return (t || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\u2019")     // apostrop → right single quote (aman di drawtext)
    .replace(/:/g, '\\:')
    .replace(/[\[\]]/g, '')
    .replace(/,/g, ' ')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/[^\x20-\x7E\u00C0-\u024F\u0100-\u017E]/g, '') // hapus emoji/char aneh
    .trim()
    .substring(0, 160);          // batas 160 karakter (cukup untuk 3 baris font 20)
}

// wrapTxt v2: dynamic font size + lebih cerdas
// Kembalikan { lines[], fontSize } sudah disesuaikan agar tidak overflow
function wrapTxt(t, videoW) {
  // Koefisien lebar karakter per font size (Arial Bold lebih lebar dari regular)
  // Dikalibrasi untuk layar 576px: font32=0.65, font28=0.63, font24=0.60, font20=0.57
  const FONT_CONFIGS = [
    { size: 32, coef: 0.65 },
    { size: 28, coef: 0.63 },
    { size: 24, coef: 0.60 },
    { size: 20, coef: 0.57 },
  ];
  // Padding kiri+kanan 24px total
  const usableW = videoW - 24;

  for (const { size, coef } of FONT_CONFIGS) {
    const charsPerLine = Math.floor(usableW / (size * coef));
    const words = t.split(' ');
    const lines = [];
    let cur = '';

    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (test.length <= charsPerLine) {
        cur = test;
      } else {
        if (cur) lines.push(cur);
        // Kata terlalu panjang → potong dengan tanda hubung
        if (w.length > charsPerLine) {
          cur = w.substring(0, charsPerLine - 1) + '-';
        } else {
          cur = w;
        }
      }
    }
    if (cur) lines.push(cur);

    // Maks 3 baris
    if (lines.length <= 3) {
      return { lines: lines.slice(0, 3), fontSize: size };
    }
  }

  // Fallback font 20, paksa 3 baris
  const coef = 0.57;
  const size = 20;
  const charsPerLine = Math.floor((videoW - 24) / (size * coef));
  const words2 = t.split(' ');
  const lines2 = [];
  let cur2 = '';
  for (const w of words2) {
    const test = cur2 ? cur2 + ' ' + w : w;
    if (test.length <= charsPerLine) {
      cur2 = test;
    } else {
      if (cur2) lines2.push(cur2);
      if (lines2.length >= 3) break;
      cur2 = w;
    }
  }
  if (lines2.length < 3 && cur2) lines2.push(cur2);
  // Potong ke maks 3 baris, tambahkan '...' di baris terakhir jika ada sisa
  const result = lines2.slice(0, 3);
  if (result.length === 3 && words2.join(' ').length > result.join(' ').length + 5) {
    const last = result[2];
    if (last.length + 3 <= charsPerLine) result[2] = last + '...';
  }
  return { lines: result, fontSize: size };
}

// ══════════════════════════════════════════════════════════════
//  STEP 0-A: GENERATE SCRIPT DENGAN GROQ AI (GRATIS)
// ══════════════════════════════════════════════════════════════
async function generateScriptWithGroq(topic) {
  if (!GROQ_KEY || GROQ_KEY.length < 10) return null;
  info('Menggunakan Groq AI (llama-3.3-70b) untuk generate script...');

  const systemPrompt = `Kamu adalah penulis konten video edukasi anak Indonesia yang kreatif dan menyenangkan.
Buat script video pendek format JSON untuk anak usia 4-10 tahun.
Bahasa: Indonesia yang mudah dipahami anak-anak.
Gaya: Antusias, lucu, menggemaskan, penuh semangat.
Format output: JSON SAJA, tidak ada teks lain.`;

  const userPrompt = `Buat script video berjudul "${topic || 'Fakta Seru Hewan'}" dengan format JSON berikut:

{
  "topic": "judul lengkap",
  "hook": "kalimat pembuka menarik max 15 kata",
  "genre": "animals/nature/science/history",
  "hashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5","#tag6"],
  "scenes": [
    {
      "n": 1,
      "dur": 14,
      "emo": "excited",
      "narration": "WAJIB 35-45 kata. Contoh panjang yang benar: Halo teman-teman! Tahukah kalian bahwa harimau Sumatera adalah harimau terkecil di dunia namun paling gesit? Tubuhnya yang kuat dan loreng indah menjadikannya raja hutan sejati. Harimau ini hanya ada di pulau Sumatera Indonesia lho!",
      "label": "JUDUL SINGKAT CAPS MAX 28 KARAKTER",
      "keywords": ["english_keyword1","english_keyword2","english_keyword3"],
      "visual": "deskripsi gambar max 12 kata: subjek + warna + latar"
    }
  ]
}

RULES WAJIB — BACA BAIK-BAIK:
1. Buat TEPAT 10 scene
2. narration WAJIB 35-45 kata per scene (hitung kata sebelum menulis!)
3. Narasi harus panjang, antusias, penuh fakta menarik untuk anak-anak
4. visual: MAX 12 kata, spesifik (nama hewan + warna + latar)
5. keywords: 3-4 kata BAHASA INGGRIS untuk image prompt AI
6. emo: pilih dari excited/curious/wow/amazed/funny
7. Output JSON SAJA, TANPA markdown, TANPA penjelasan, TANPA kodeblock`;

  try {
    const res = await httpsPost('api.groq.com', '/openai/v1/chat/completions',
      { 'Authorization': `Bearer ${GROQ_KEY}` },
      JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 4000,
        temperature: 0.8
      })
    );

    if (res.status !== 200) {
      warn(`Groq error ${res.status}: ${JSON.stringify(res.body).substring(0,100)}`);
      return null;
    }

    const content = res.body.choices?.[0]?.message?.content || '';
    // Bersihkan markdown jika ada
    const cleaned = content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    const script  = JSON.parse(cleaned);

    // Validasi
    if (!script.scenes || script.scenes.length < 5) {
      warn('Script dari Groq kurang lengkap (< 5 scene)');
      return null;
    }

    ok(`Script dari Groq: "${script.topic}" (${script.scenes.length} scene)`);
    return script;
  } catch(e) {
    warn(`Groq gagal: ${e.message.substring(0,100)}`);
    return null;
  }
}

// ── Backup: OpenAI (jika Groq tidak ada) ──────────────────────
async function generateScriptWithOpenAI(topic) {
  if (!OPENAI_KEY || OPENAI_KEY.length < 10) return null;
  info('Mencoba OpenAI sebagai backup script...');
  try {
    const res = await httpsPost('api.openai.com', '/v1/chat/completions',
      { 'Authorization': `Bearer ${OPENAI_KEY}` },
      JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: `Buat script video edukasi anak untuk topik "${topic || 'hewan'}" dalam format JSON. 10 scene, setiap scene punya: n, dur(12-15), emo, narration(35-45 kata bahasa Indonesia), label(caps max 30 char), keywords(array 3 kata), visual(max 15 kata). Juga sertakan: topic, hook, genre, hashtags. JSON saja, tanpa markdown.` }
        ],
        max_tokens: 3000, temperature: 0.8
      })
    );
    if (res.status !== 200) { warn(`OpenAI error ${res.status}`); return null; }
    const content = res.body.choices?.[0]?.message?.content || '';
    const cleaned = content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    const script  = JSON.parse(cleaned);
    if (script.scenes?.length >= 5) { ok(`Script dari OpenAI: "${script.topic}"`); return script; }
    return null;
  } catch(e) { warn(`OpenAI gagal: ${e.message.substring(0,80)}`); return null; }
}

// ══════════════════════════════════════════════════════════════
//  STEP 1: TTS — ElevenLabs (jika aktif) atau Edge TTS
// ══════════════════════════════════════════════════════════════

// ── ELEVENLABS VOICE ID TERBAIK UNTUK INDONESIA ───────────────────────────
// Gunakan voice yang support eleven_multilingual_v2
// Pilih salah satu dengan cara komentar/hapus yang tidak diinginkan:
const EL_VOICES = {
  adam:    'pNInz6obpgDQGcFmaJgB',  // Adam  — hangat, natural (default)
  rachel:  '21m00Tcm4TlvDq8ikWAM',  // Rachel — bersih, profesional
  sam:     'yoZ06aMxZJJ28mfd3POQ',  // Sam   — ramah, energik
  bella:   'EXAVITQu4vr4xnSDxMaL',  // Bella  — ceria, cocok konten anak
  elli:    'MF3mGyEYCl7XYWbV9V6O',  // Elli   — muda, ekspresif
};
// Aktifkan voice yang diinginkan di sini:
const EL_VOICE_SELECTED = EL_VOICES.rachel; // ← GANTI sesuai preferensi

// Cek apakah ElevenLabs aktif (tidak blocked)
async function checkElevenLabs() {
  if (!ELEVENLABS_KEY || ELEVENLABS_KEY.length < 10) {
    warn('ELEVENLABS_API_KEY belum diset di env. Tambahkan di config/env_variables.txt');
    return { ok: false, reason: 'no_key' };
  }
  try {
    // Coba endpoint user/subscription (lebih informatif)
    const res = await httpsGet('api.elevenlabs.io', '/v1/user/subscription', { 'xi-api-key': ELEVENLABS_KEY });
    if (res.status === 200) {
      const plan   = res.body?.tier || 'free';
      const remain = res.body?.character_count !== undefined
        ? `${res.body.character_limit - res.body.character_count} karakter tersisa`
        : '';
      ok(`ElevenLabs OK! Plan: ${plan}. ${remain}`);
      return { ok: true, plan, remain };
    }
    if (res.status === 401) return { ok: false, reason: 'API key salah atau expired (401)' };
    if (res.status === 403) return { ok: false, reason: 'Akun blocked/unusual activity (403)' };
    const msg = typeof res.body === 'object' ? (res.body?.detail?.message || res.body?.detail?.status || '') : String(res.body).substring(0,80);
    if (msg.includes('unusual_activity') || msg.includes('disabled')) {
      return { ok: false, reason: `Akun ditandai unusual_activity — login ke elevenlabs.io dan verifikasi akun` };
    }
    return { ok: false, reason: `HTTP ${res.status}: ${msg}` };
  } catch(e) { return { ok: false, reason: `Koneksi gagal: ${e.message.substring(0,80)}` }; }
}

// Generate TTS dengan ElevenLabs — dilengkapi retry 2x
async function generateTTSElevenLabs(text, destPath, voiceId) {
  voiceId = voiceId || EL_VOICE_SELECTED;
  const MAX_RETRY = 2;

  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    const result = await _elevenlabsTTSOnce(text, destPath, voiceId);
    if (result.ok) return result;
    if (attempt < MAX_RETRY) {
      warn(`ElevenLabs attempt ${attempt} gagal: ${result.reason} → retry...`);
      sleep(3000);
    } else {
      // Coba voice fallback (Rachel) jika voice utama error
      if (voiceId !== EL_VOICES.rachel) {
        warn(`Coba fallback voice Rachel...`);
        const fallback = await _elevenlabsTTSOnce(text, destPath, EL_VOICES.rachel);
        if (fallback.ok) return fallback;
      }
      return result;
    }
  }
}

async function _elevenlabsTTSOnce(text, destPath, voiceId) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.55,          // sedikit lebih tinggi → lebih konsisten
        similarity_boost: 0.80,   // mirip suara asli voice
        style: 0.25,              // sedikit ekspresif tapi tidak berlebihan
        use_speaker_boost: true   // aktifkan speaker boost untuk kualitas
      }
    });
    const bodyBuf = Buffer.from(body, 'utf8');
    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path:     `/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      method:   'POST',
      headers: {
        'xi-api-key':     ELEVENLABS_KEY,
        'Content-Type':   'application/json',
        'Accept':         'audio/mpeg',
        'Content-Length': bodyBuf.length
      }
    }, (res) => {
      if (res.statusCode !== 200) {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          let reason = `HTTP ${res.statusCode}`;
          try {
            const parsed = JSON.parse(d);
            reason += ': ' + (parsed?.detail?.message || parsed?.detail?.status || JSON.stringify(parsed).substring(0,80));
          } catch(e) { reason += ': ' + d.substring(0,80); }
          resolve({ ok: false, reason });
        });
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (buf.length < 1000) {
          resolve({ ok: false, reason: `Response terlalu kecil (${buf.length} bytes) — kemungkinan bukan audio` });
          return;
        }
        // Verifikasi magic bytes MP3 (ID3 atau 0xFF 0xFB)
        const isMP3 = (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) || (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0);
        if (!isMP3) {
          resolve({ ok: false, reason: 'Response bukan file MP3 valid' });
          return;
        }
        fs.writeFileSync(destPath, buf);
        resolve({ ok: true });
      });
    });
    req.on('error', e => resolve({ ok: false, reason: `Network error: ${e.message}` }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ ok: false, reason: 'Timeout 30 detik' }); });
    req.write(bodyBuf);
    req.end();
  });
}

function generateTTSEdge(text, destPath) {
  const PYTHON  = 'C:/Users/user/AppData/Local/Programs/Python/Python312/python.exe';
  const txtFile = destPath.replace('.mp3', '_tmp.txt');
  fs.writeFileSync(txtFile, text, 'utf8');
  try {
    execSync(
      `"${PYTHON}" -m edge_tts --voice "id-ID-ArdiNeural" --file "${txtFile}" --write-media "${destPath}"`,
      { stdio:'pipe', timeout:90000, shell:'cmd.exe' }
    );
    try { fs.unlinkSync(txtFile); } catch(e) {}
    return fs.existsSync(destPath) && fs.statSync(destPath).size > 500;
  } catch(e) {
    try { fs.unlinkSync(txtFile); } catch(ex) {}
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
//  STEP 2-A: GENERATE GAMBAR (Leonardo — prompt difix)
// ══════════════════════════════════════════════════════════════

/**
 * PROMPT STRATEGY v2 (fix dari versi lama):
 * - Model: Leonardo Anime XL (e71a1c2f) — lebih cocok untuk clay/chibi kids
 * - Prompt: keyword-based pendek (bukan kalimat panjang)
 * - Style: presetStyle "ILLUSTRATION" + alchemy: true untuk kualitas lebih baik
 * - Negative prompt: lebih spesifik
 *
 * Format prompt baru:
 * "[subject], clay plasticine, 3D chibi, [keywords], bright colors, kids cartoon, 9:16 portrait"
 */
function buildLeonardoPrompt(scene) {
  const keywords = (scene.keywords || []).slice(0, 4).join(', ');
  const visual   = scene.visual || '';
  // Ambil bagian pertama visual (sebelum koma pertama) sebagai subjek utama
  const subject  = visual.split(/[,.]/).filter(Boolean)[0]?.trim() || visual.substring(0, 50);

  // Style keywords yang terbukti menghasilkan gambar lucu/ekspresif untuk anak
  // Kunci: "cute", "adorable", "funny expression", "big eyes", "kawaii", "pastel"
  return [
    subject,
    keywords,
    'cute adorable funny expression',
    'big sparkly eyes',
    'kawaii chibi style',
    'clay plasticine 3D render',
    'pastel bright colors',
    'kids cartoon illustration',
    'soft rounded shapes',
    'cheerful happy mood',
    'studio lighting white background',
    'portrait 9:16 vertical'
  ].filter(Boolean).join(', ').substring(0, 480);
}

const NEGATIVE_PROMPT = [
  'realistic, photography, photorealistic,',
  'dark, scary, horror, violent, aggressive,',
  'sad, angry, threatening,',
  'bad anatomy, deformed, distorted, blurry, low quality, ugly,',
  'text, watermark, logo, nsfw, adult content,',
  'stiff, rigid, lifeless, boring,',
  'monochrome, grayscale, muted colors, dark colors'
].join(' ');

// Leonardo generate → return { imageId, imageUrl }
async function leonardoGenerateImage(scene) {
  if (!LEONARDO_KEY || LEONARDO_KEY.length < 10) return null;
  const prompt = buildLeonardoPrompt(scene);
  log(`     Prompt: ${prompt.substring(0,70)}...`);

  const body = JSON.stringify({
    prompt,
    negative_prompt: NEGATIVE_PROMPT,
    // Leonardo Vision XL — mendukung illustration style, bagus untuk kids clay
    // Lightning XL: aa77f04e-3eec-4034-9c07-d0f619684628 (faster)
    // Vision XL: 5c232a9e-9061-4777-980a-ddc8e65647c6 (lebih detail)
    // Diffusion XL: b24e16ff-06e3-43eb-8d33-4416c2d75876 (v1, terbukti bekerja)
    modelId: 'aa77f04e-3eec-4034-9c07-d0f619684628',  // Lightning XL
    width: 576, height: 1024,
    num_images: 1,
    guidance_scale: 7,
    num_inference_steps: 30,
    presetStyle: 'ILLUSTRATION',
    alchemy: true,
    public: false,
    photoReal: false
  });

  try {
    const tmpBody = `${BASE_DIR}/_tmp_body.json`;
    fs.writeFileSync(tmpBody, body, 'utf8');
    const genOut = execSync(
      `curl -s -X POST -H "Authorization: Bearer ${LEONARDO_KEY}" -H "Content-Type: application/json" -d @"${tmpBody}" "https://cloud.leonardo.ai/api/rest/v1/generations"`,
      { encoding:'utf8', timeout:30000, shell:'cmd.exe' }
    );
    try { fs.unlinkSync(tmpBody); } catch(e) {}
    const genRes = JSON.parse(genOut);
    if (!genRes.sdGenerationJob?.generationId) {
      warn(`Leonardo gen error: ${JSON.stringify(genRes).substring(0,100)}`);
      return null;
    }

    const genId = genRes.sdGenerationJob.generationId;
    log(`     Gen ID: ${genId.substring(0,16)}... | polling...`);

    // Poll max 90 detik
    for (let p = 0; p < 18; p++) {
      sleep(5000);
      const pollOut = execSync(
        `curl -s -H "Authorization: Bearer ${LEONARDO_KEY}" "https://cloud.leonardo.ai/api/rest/v1/generations/${genId}"`,
        { encoding:'utf8', timeout:15000, shell:'cmd.exe' }
      );
      const pollRes = JSON.parse(pollOut);
      const imgs    = pollRes.generations_by_pk?.generated_images || [];
      if (imgs.length > 0 && imgs[0].url) {
        log(`     Selesai (poll ${p+1}): imageId=${imgs[0].id?.substring(0,16)}...`);
        return { imageId: imgs[0].id, imageUrl: imgs[0].url };
      }
    }
    warn(`Scene ${scene.n} polling timeout (90s)`);
    return null;
  } catch(e) {
    warn(`Scene ${scene.n} Leonardo exception: ${e.message.substring(0,100)}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
//  STEP 2-B: LEONARDO MOTION SVD (gambar → animasi 4 detik)
// ══════════════════════════════════════════════════════════════
/**
 * Leonardo Motion mengubah 1 gambar jadi video pendek ~3-4 detik.
 * Kita akan:
 * 1. Generate gambar dulu (leonardoGenerateImage)
 * 2. Kirim imageId ke /generations-motion-svd
 * 3. Poll hasilnya → download sebagai video clip .mp4
 * 4. Gunakan video clip ini sebagai input FFmpeg (bukan loop image)
 *
 * Credit cost: ~25 kredit per motion (kita punya 150 sub + 10 API)
 * Untuk 10 scene = ~250 kredit → butuh subscription atau hemat
 * STRATEGI: Aktifkan hanya untuk scene 1 (hook) dan 5 (tengah) jika kredit terbatas
 */
async function leonardoMotion(imageId, sceneNum, motionStrength = 5) {
  if (!imageId || !LEONARDO_KEY) return null;
  info(`  Motion Scene ${sceneNum}: imageId=${imageId.substring(0,16)}...`);

  try {
    const body = JSON.stringify({
      imageId,
      motionStrength,  // 1-10, makin tinggi makin bergerak banyak
      isPublic: false
    });
    const tmpBody = `${BASE_DIR}/_tmp_motion.json`;
    fs.writeFileSync(tmpBody, body, 'utf8');
    const genOut = execSync(
      `curl -s -X POST -H "Authorization: Bearer ${LEONARDO_KEY}" -H "Content-Type: application/json" -d @"${tmpBody}" "https://cloud.leonardo.ai/api/rest/v1/generations-motion-svd"`,
      { encoding:'utf8', timeout:30000, shell:'cmd.exe' }
    );
    try { fs.unlinkSync(tmpBody); } catch(e) {}
    const genRes = JSON.parse(genOut);

    if (!genRes.motionSvdGenerationJob?.generationId) {
      warn(`Motion gen error: ${JSON.stringify(genRes).substring(0,120)}`);
      return null;
    }

    const genId = genRes.motionSvdGenerationJob.generationId;
    log(`     Motion Gen ID: ${genId.substring(0,16)}... | polling...`);

    // Poll max 2 menit (24 × 5 detik)
    for (let p = 0; p < 24; p++) {
      sleep(5000);
      const pollOut = execSync(
        `curl -s -H "Authorization: Bearer ${LEONARDO_KEY}" "https://cloud.leonardo.ai/api/rest/v1/generations/${genId}"`,
        { encoding:'utf8', timeout:15000, shell:'cmd.exe' }
      );
      const pollRes = JSON.parse(pollOut);
      const imgs    = pollRes.generations_by_pk?.generated_images || [];
      // Motion menghasilkan motionMP4URL
      if (imgs.length > 0 && imgs[0].motionMP4URL) {
        log(`     Motion selesai (poll ${p+1}): video URL tersedia`);
        return imgs[0].motionMP4URL;
      }
      // Cek juga url biasa untuk status
      if (pollRes.generations_by_pk?.status === 'FAILED') {
        warn(`Motion FAILED untuk scene ${sceneNum}`);
        return null;
      }
    }
    warn(`Motion polling timeout untuk scene ${sceneNum}`);
    return null;
  } catch(e) {
    warn(`Motion exception scene ${sceneNum}: ${e.message.substring(0,100)}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
//  STEP 2-C: KLING AI — Image-to-Video (LEBIH BAGUS dari Leonardo)
// ══════════════════════════════════════════════════════════════
/**
 * Kling AI mengubah 1 gambar jadi video animasi ~5 detik yang sangat realistis.
 * Jauh lebih halus & hidup dibanding Leonardo Motion SVD.
 * 
 * Pricing: ~0.14 kredit per detik → 5 detik = ~0.7 kredit per scene
 * Model: kling-v1-6 (terbaru, paling bagus)
 * Mode: std (standard) atau pro (lebih bagus, 2x harga)
 *
 * Auth: JWT HS256 dari Access Key + Secret Key
 */
function generateKlingJWT() {
  const crypto = require('crypto');
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now     = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: KLING_ACCESS, exp: now + 1800, nbf: now - 5 })).toString('base64url');
  const sig     = crypto.createHmac('sha256', KLING_SECRET).update(header + '.' + payload).digest('base64url');
  return header + '.' + payload + '.' + sig;
}

async function klingImageToVideo(imgFilePath, prompt, sceneNum) {
  if (!KLING_ACCESS || !KLING_SECRET) return null;

  info(`  Kling motion scene ${sceneNum}: mengirim gambar...`);
  try {
    const imgBuf = fs.readFileSync(imgFilePath);
    if (imgBuf.length < 5000) { warn(`Kling: gambar terlalu kecil (${imgBuf.length} bytes)`); return null; }

    const b64   = imgBuf.toString('base64');
    const token = generateKlingJWT();

    const body = JSON.stringify({
      model_name : 'kling-v1-6',
      prompt     : prompt.substring(0, 500),
      image      : b64,
      duration   : '5',
      cfg_scale  : 0.5,
      mode       : 'std'
    });

    // Kirim request generate
    const genRes = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.klingai.com',
        path    : '/v1/videos/image2video',
        method  : 'POST',
        headers : {
          'Authorization': 'Bearer ' + token,
          'Content-Type' : 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
          catch(e) { resolve({ status: res.statusCode, body: d }); }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    if (genRes.body?.code !== 0 || !genRes.body?.data?.task_id) {
      warn(`Kling gen error scene ${sceneNum}: code=${genRes.body?.code} msg=${genRes.body?.message}`);
      return null;
    }

    const taskId = genRes.body.data.task_id;
    log(`     Kling task: ${taskId} | polling...`);

    // Poll max 3 menit (36 × 5 detik)
    for (let p = 0; p < 36; p++) {
      sleep(5000);
      const freshToken = generateKlingJWT(); // token baru tiap poll
      const pollRes = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'api.klingai.com',
          path    : `/v1/videos/image2video/${taskId}`,
          method  : 'GET',
          headers : { 'Authorization': 'Bearer ' + freshToken, 'Content-Type': 'application/json' }
        }, (res) => {
          let d = ''; res.on('data', c => d += c);
          res.on('end', () => {
            try { resolve(JSON.parse(d)); }
            catch(e) { resolve({}); }
          });
        });
        req.on('error', reject);
        req.end();
      });

      const status   = pollRes.data?.task_status;
      const videoUrl = pollRes.data?.task_result?.videos?.[0]?.url;

      if (status === 'succeed' && videoUrl) {
        log(`     Kling selesai (poll ${p+1}): video URL tersedia ✅`);
        return videoUrl;
      }
      if (status === 'failed') {
        warn(`Kling task FAILED scene ${sceneNum}: ${pollRes.data?.task_status_msg || ''}`);
        return null;
      }
      // status: 'processing' atau 'submitted' → lanjut polling
    }
    warn(`Kling polling timeout scene ${sceneNum} (3 menit)`);
    return null;
  } catch(e) {
    warn(`Kling exception scene ${sceneNum}: ${e.message.substring(0,100)}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
//  TELEGRAM HELPERS
// ══════════════════════════════════════════════════════════════
function tgSendMessage(token, chatId, text) {
  if (!token || token === 'SKIP' || !chatId || chatId === 'SKIP') return false;
  const tmpFile = `${BASE_DIR}/_tg_msg.json`.replace(/\//g,'\\');
  const buf = Buffer.from(JSON.stringify({ chat_id: chatId, parse_mode: 'HTML', text }), 'utf8');
  fs.writeFileSync(tmpFile, buf);
  try {
    const cmd = `powershell -NoProfile -Command `
      + `"[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; `
      + `$b = [System.IO.File]::ReadAllText('${tmpFile}', [System.Text.Encoding]::UTF8); `
      + `$r = Invoke-RestMethod -Uri 'https://api.telegram.org/bot${token}/sendMessage' -Method POST -ContentType 'application/json; charset=utf-8' -Body $b; `
      + `Write-Output 'OK'"`;
    execSync(cmd, { encoding:'utf8', timeout:15000 });
    try { fs.unlinkSync(tmpFile); } catch(e) {}
    return true;
  } catch(e) {
    try { fs.unlinkSync(tmpFile); } catch(ex) {}
    return false;
  }
}

function tgUploadFile(token, chatId, filePath, fieldName, caption) {
  if (!token || token === 'SKIP') return false;
  const winPath   = filePath.replace(/\//g,'\\');
  const tmpScript = `${BASE_DIR}/_tg_upload.ps1`.replace(/\//g,'\\');
  const ps = [
    `Add-Type -AssemblyName System.Net.Http`,
    `$client  = New-Object System.Net.Http.HttpClient`,
    `$content = New-Object System.Net.Http.MultipartFormDataContent`,
    `$chatPart = New-Object System.Net.Http.StringContent('${chatId}')`,
    `$content.Add($chatPart, 'chat_id')`,
    `$fileBytes = [System.IO.File]::ReadAllBytes('${winPath}')`,
    `$fileContent = New-Object System.Net.Http.ByteArrayContent(,$fileBytes)`,
    `$fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('application/octet-stream')`,
    `$content.Add($fileContent, '${fieldName}', '${winPath.split('\\').pop()}')`,
    caption ? `$capPart = New-Object System.Net.Http.StringContent('${caption.replace(/'/g,"''")}'); $content.Add($capPart, 'caption')` : '',
    `$resp = $client.PostAsync('https://api.telegram.org/bot${token}/send${fieldName === 'video' ? 'Video' : 'Document'}', $content).Result`,
    `$body = $resp.Content.ReadAsStringAsync().Result`,
    `Write-Output $body`,
  ].filter(Boolean).join('\r\n');
  fs.writeFileSync(tmpScript, ps, 'utf8');
  try {
    const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpScript}"`,
      { encoding:'utf8', timeout:180000 });
    try { fs.unlinkSync(tmpScript); } catch(e) {}
    try { return JSON.parse(out.trim()).ok === true; }
    catch(e) { return out.includes('"ok":true'); }
  } catch(e) {
    try { fs.unlinkSync(tmpScript); } catch(ex) {}
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
//  MAIN PIPELINE (async karena pakai httpsPost/Get)
// ══════════════════════════════════════════════════════════════
async function main() {
  const now = new Date();
  const { dd, mm, yyyy } = fmtDate(now);

  log('');
  log('╔══════════════════════════════════════════════════╗');
  log('║   AI VIDEO PIPELINE v2 — Kids Edition            ║');
  log('║   Groq + Leonardo + Kling AI + Clay Art          ║');
  log('╚══════════════════════════════════════════════════╝');
  log('');
  info(`Groq key  : ${GROQ_KEY      ? '✅ ada' : '❌ tidak ada'}`);
  info(`Leonardo  : ${LEONARDO_KEY  ? '✅ ada' : '❌ tidak ada'}`);
  info(`Kling AI  : ${KLING_ACCESS  ? '✅ ada (motion utama)' : '— tidak ada (fallback Leonardo)'}`);
  info(`ElevenLabs: ${ELEVENLABS_KEY ? `✅ ada (voice: ${Object.keys(EL_VOICES).find(k => EL_VOICES[k] === EL_VOICE_SELECTED) || 'custom'})` : '—  skip (pakai Edge TTS)'}`);
  info(`Telegram  : ${TG_TOKEN && TG_TOKEN !== 'SKIP' ? '✅ aktif' : '— skip'}`);
  info(`Motion    : ${USE_MOTION ? (MOTION_ALL ? '✅ semua scene (--motion-all)' : '✅ key scenes 1,5,10') : '— dimatikan (--no-motion)'}`);
  info(`Topik     : ${CUSTOM_TOPIC || '(auto dari Groq)'}`);
  log('');

  // ── 0. Generate / load SCRIPT ─────────────────────────────
  step('0/5', '📝  Generate script dari AI...');

  let SCRIPT = null;

  // Coba Groq dulu (gratis)
  if (GROQ_KEY && GROQ_KEY.length > 10) {
    SCRIPT = await generateScriptWithGroq(CUSTOM_TOPIC || 'Fakta Seru Hewan');
  }
  // Fallback OpenAI
  if (!SCRIPT && OPENAI_KEY && OPENAI_KEY.length > 10) {
    SCRIPT = await generateScriptWithOpenAI(CUSTOM_TOPIC || 'Fakta Seru Hewan');
  }
  // Fallback hardcoded jika tidak ada AI
  if (!SCRIPT) {
    warn('Tidak ada AI script tersedia. Menggunakan script fallback hardcoded.');
    SCRIPT = FALLBACK_SCRIPT;
    // Update topik jika ada custom topic
    if (CUSTOM_TOPIC) SCRIPT = { ...SCRIPT, topic: CUSTOM_TOPIC };
  }

  // Generate folder name dari topik + tanggal
  const slug = SCRIPT.folder_name || slugify(SCRIPT.topic) + `_${dd}_${mm}_${yyyy}`;
  SCRIPT.folder_name = slug;
  SCRIPT.pipeline_id = `video_${yyyy}${mm}${dd}_${Date.now().toString().slice(-4)}`;

  const BUNDLE    = `${BASE_DIR}/${slug}`;
  const TMP_AUDIO = `${BUNDLE}/_tmp_audio`;
  const TMP_CLIPS = `${BUNDLE}/_tmp_clips`;
  const TMP_IMG   = `${BUNDLE}/_tmp_images`;
  const TMP_MOTION= `${BUNDLE}/_tmp_motion`;

  fs.mkdirSync(TMP_AUDIO,  { recursive: true });
  fs.mkdirSync(TMP_CLIPS,  { recursive: true });
  fs.mkdirSync(TMP_IMG,    { recursive: true });
  if (USE_MOTION) fs.mkdirSync(TMP_MOTION, { recursive: true });

  log('');
  log(`  📁 Folder: ${slug}`);
  log(`  📋 Topik : ${SCRIPT.topic}`);
  log(`  🎬 Scenes: ${SCRIPT.scenes.length}`);

  // ── 1. TTS per scene ──────────────────────────────────────
  step('1/5', '🎙️  Generate audio per scene...');

  // Cek ElevenLabs
  let useTTS = 'edge';
  if (ELEVENLABS_KEY && ELEVENLABS_KEY.length > 10) {
    info('Cek ElevenLabs...');
    const elCheck = await checkElevenLabs();
    if (elCheck.ok) {
      useTTS = 'elevenlabs';
      ok('ElevenLabs aktif! Menggunakan suara premium multilingual v2');
    } else {
      warn(`ElevenLabs tidak bisa dipakai: ${elCheck.reason}`);
      info('Fallback ke Edge TTS (id-ID-ArdiNeural)');
    }
  } else {
    info('ElevenLabs tidak dikonfigurasi. Pakai Edge TTS.');
  }

  const scenesAudio = [];
  let totalAudioSec = 0;

  for (const s of SCRIPT.scenes) {
    const audioFile = `${TMP_AUDIO}/scene${s.n}.mp3`;
    let audioOk = false, duration = 0;

    if (useTTS === 'elevenlabs') {
      // Gunakan EL_VOICE_SELECTED yang sudah didefinisikan di atas (bisa diganti)
      const result = await generateTTSElevenLabs(s.narration, audioFile, EL_VOICE_SELECTED);
      if (result.ok) {
        audioOk = true;
        duration = getAudioDuration(audioFile);
        ok(`Scene ${String(s.n).padStart(2,' ')} [ElevenLabs]: ${duration}s`);
      } else {
        warn(`ElevenLabs scene ${s.n}: ${result.reason} → fallback Edge TTS`);
        audioOk = generateTTSEdge(s.narration, audioFile);
        if (audioOk) duration = getAudioDuration(audioFile);
      }
    } else {
      audioOk = generateTTSEdge(s.narration, audioFile);
      if (audioOk) {
        duration = getAudioDuration(audioFile);
        ok(`Scene ${String(s.n).padStart(2,' ')} [Edge TTS]: ${duration}s`);
      } else {
        err(`TTS scene ${s.n} gagal`);
      }
    }

    if (!duration) duration = s.narration.split(' ').length * 0.42;
    duration = Math.max(12, Math.ceil(duration + 0.8));
    totalAudioSec += duration;
    scenesAudio.push({ ...s, audioFile, audioOk, duration });
  }

  const totalMin = Math.floor(totalAudioSec / 60);
  const totalSec2 = totalAudioSec % 60;
  log(`\n  📊 Total audio: ${totalAudioSec}s = ${totalMin}m${String(totalSec2).padStart(2,'0')}s\n`);

  // ── 2. Gambar + Motion per scene ──────────────────────────
  step('2/5', '🎨  Generate gambar & motion per scene...');

  const hasKling   = KLING_ACCESS && KLING_SECRET && KLING_ACCESS.length > 5;
  const hasLeonardo = LEONARDO_KEY && LEONARDO_KEY.length > 10;

  if (hasKling)    info(`Kling AI: ✅ siap (image-to-video terbaik)`);
  else             info(`Kling AI: — tidak ada key`);
  if (hasLeonardo) info(`Leonardo: ✅ siap (gambar static + fallback motion)`);
  else             info(`Leonardo: — tidak ada key, pakai Picsum`);

  const scenesImages = [];

  for (const s of scenesAudio) {
    const imgFile    = `${TMP_IMG}/scene${s.n}.jpg`;
    const motionFile = `${TMP_MOTION}/scene${s.n}_motion.mp4`;
    let imgOk = false, imageId = null, motionOk = false;

    log(`\n  Scene ${s.n}/${SCRIPT.scenes.length}: ${(s.visual || s.keywords?.join(', ') || '').substring(0,55)}...`);

    // Generate gambar Leonardo
    if (hasLeonardo) {
      const imgResult = await leonardoGenerateImage(s);
      if (imgResult) {
        imgOk   = downloadFile(imgResult.imageUrl, imgFile);
        imageId = imgResult.imageId;
        if (imgOk) ok(`Scene ${s.n}: Gambar OK (${Math.round(fs.statSync(imgFile).size/1024)}KB)`);
      }
    }

    // Fallback picsum
    if (!imgOk) {
      const seed    = `${slugify(SCRIPT.topic)}_${s.emo}_${s.n}_${yyyy}`;
      const fallUrl = `https://picsum.photos/seed/${encodeURIComponent(seed)}/576/1024`;
      imgOk = downloadFile(fallUrl, imgFile);
      if (imgOk) ok(`Scene ${s.n}: Picsum fallback OK`);
    }

    // ── MOTION: Kling AI (prioritas utama) → fallback Leonardo Motion ──
    if (USE_MOTION && imgOk) {
      // Tentukan scene mana yang dapat motion
      const keyScenes = [1, 5, SCRIPT.scenes.length]; // hook, tengah, penutup
      const doMotion  = MOTION_ALL || keyScenes.includes(s.n);

      if (doMotion) {
        let motionUrl = null;

        // 1️⃣ Coba Kling AI dulu (lebih bagus)
        if (hasKling) {
          const motionPrompt = buildLeonardoPrompt(s).replace(/portrait 9:16 vertical/g, '').trim();
          motionUrl = await klingImageToVideo(imgFile, motionPrompt, s.n);
          if (motionUrl) {
            motionOk = downloadFile(motionUrl, motionFile);
            if (motionOk) ok(`Scene ${s.n}: Kling motion OK! 🎬✨`);
            else warn(`Scene ${s.n}: Kling download gagal`);
          }
        }

        // 2️⃣ Fallback ke Leonardo Motion jika Kling gagal/tidak ada
        if (!motionOk && hasLeonardo && imageId) {
          info(`  Fallback ke Leonardo Motion scene ${s.n}...`);
          motionUrl = await leonardoMotion(imageId, s.n, 5);
          if (motionUrl) {
            motionOk = downloadFile(motionUrl, motionFile);
            if (motionOk) ok(`Scene ${s.n}: Leonardo motion OK! 🎬`);
            else warn(`Scene ${s.n}: Leonardo motion download gagal`);
          }
        }

        if (!motionOk) info(`Scene ${s.n}: pakai gambar static`);
      }
    }

    // Jeda antar request
    if (s.n < SCRIPT.scenes.length) sleep(3000);

    scenesImages.push({ ...s, imgFile, imgOk, motionFile, motionOk });
  }
  log('');

  // ── 3. Render clips + concat ──────────────────────────────
  step('3/5', '🎬  Render video clips (FFmpeg)...');

  const clipPaths    = [];
  const renderErrors = [];

  for (let i = 0; i < scenesImages.length; i++) {
    const s       = scenesImages[i];
    const clipOut = `${TMP_CLIPS}/clip${String(i+1).padStart(2,'0')}.mp4`;
    const audSrc  = s.audioOk && fs.existsSync(s.audioFile) ? s.audioFile : null;
    const durSec  = s.duration;
    const isHook  = i === 0;

    // ── Text overlay ──────────────────────────────────────
    // Lebar video 576px. wrapTxt v2 auto-pilih font size agar pas.
    const narEsc  = escTxt(s.narration);
    const hookEsc = escTxt(SCRIPT.hook);
    const VIDEO_W = 576;

    // Scene pertama (hook): tampilkan hook besar di atas + narasi kecil di bawah
    // Scene lainnya: narasi saja di bagian bawah
    const { lines: narLines, fontSize: narFontSize } = wrapTxt(narEsc, VIDEO_W);
    const { lines: hookLines, fontSize: hookFontSize } = wrapTxt(hookEsc, VIDEO_W);

    // Ukuran font hook selalu lebih besar (min 28, max 42)
    const hookSz = Math.min(42, Math.max(28, hookFontSize + 8));
    // Ukuran font narasi (hasil wrapTxt, min 20 max 30)
    const narSz  = Math.min(30, Math.max(20, narFontSize));

    let textFilters = [];

    if (isHook) {
      // ── Scene 1: hook di tengah-atas + baris pertama narasi di bawah ──
      const bgH = 60 + hookLines.length * (hookSz + 8) + 20;
      textFilters.push(`drawbox=x=0:y=30:w=${VIDEO_W}:h=${bgH}:color=black@0.70:t=fill`);
      hookLines.forEach((ln, idx) => {
        const y = 48 + idx * (hookSz + 6);
        textFilters.push(`drawtext=text='${ln}':fontsize=${hookSz}:fontcolor=white:borderw=3:bordercolor=black@0.85:x=(w-text_w)/2:y=${y}:fontfile='${FONT_BOLD}'`);
      });
      // Narasi baris-1 di bawah hook sebagai subtitle kecil
      if (narLines[0]) {
        const subSz = Math.min(24, narSz - 4);
        const subY  = 48 + hookLines.length * (hookSz + 6) + 10;
        textFilters.push(`drawtext=text='${narLines[0]}':fontsize=${subSz}:fontcolor=#FFFACD:borderw=2:bordercolor=black@0.7:x=(w-text_w)/2:y=${subY}:fontfile='${FONT_NRM}'`);
      }
    } else {
      // ── Scene lain: semua baris narasi di bagian bawah ──
      const lineH   = narSz + 8;
      const totalH  = 20 + narLines.length * lineH + 16;
      const bgY     = VIDEO_W * (1024 / 576) - totalH - 20; // kira-kira bawah (video 576x1024)
      // Gunakan koordinat absolut yang aman
      const bgYabs  = 1024 - totalH - 18;
      textFilters.push(`drawbox=x=0:y=${bgYabs}:w=${VIDEO_W}:h=${totalH + 20}:color=black@0.68:t=fill`);
      narLines.forEach((ln, idx) => {
        const y = bgYabs + 14 + idx * lineH;
        const color = idx === 0 ? 'white' : (idx === 1 ? '#FFFACD' : '#FFF0AA');
        const bw    = idx === 0 ? 3 : 2;
        const font  = idx === 0 ? FONT_BOLD : FONT_NRM;
        const sz    = idx === 0 ? narSz : narSz - 2;
        textFilters.push(`drawtext=text='${ln}':fontsize=${sz}:fontcolor=${color}:borderw=${bw}:bordercolor=black@0.8:x=(w-text_w)/2:y=${y}:fontfile='${font}'`);
      });
    }

    // Badge scene di pojok kanan atas
    textFilters.push(`drawbox=x=w-72:y=8:w=64:h=34:color=black@0.65:t=fill`);
    textFilters.push(`drawtext=text='${i+1}/${SCRIPT.scenes.length}':fontsize=20:fontcolor=white:borderw=1:bordercolor=black:x=w-60:y=14:fontfile='${FONT_NRM}'`);

    let cmd = '';
    const mapAud = audSrc ? `-map 0:v -map 1:a -c:a aac -b:a 128k` : `-map 0:v -an`;

    // Jika ada motion video → pakai sebagai input video, loop sampai durasi audio
    if (s.motionOk && fs.existsSync(s.motionFile)) {
      info(`Scene ${i+1}: Pakai motion video (loop)...`);
      const vFilters = [
        `scale=576:1024:force_original_aspect_ratio=increase,crop=576:1024,setsar=1`,
        ...textFilters
      ].join(',');
      const inputAud = audSrc ? `-i "${audSrc}"` : '';
      // Loop motion video sampai durasi audio
      cmd = `"${FFMPEG}" -y -stream_loop -1 -i "${s.motionFile}" ${inputAud} -vf "${vFilters}" ${mapAud} -c:v libx264 -preset fast -crf 24 -pix_fmt yuv420p -r 24 -t ${durSec} -shortest -movflags +faststart "${clipOut}"`;
    } else {
      // Pakai gambar static (loop)
      const vFilters = [
        `scale=576:1024:force_original_aspect_ratio=increase,crop=576:1024,setsar=1`,
        ...textFilters
      ].join(',');
      const imgSrc  = s.imgOk ? s.imgFile : `https://picsum.photos/seed/fb${i}/576/1024`;
      const inputAud = audSrc ? `-i "${audSrc}"` : '';
      cmd = `"${FFMPEG}" -y -loop 1 -t ${durSec} -i "${imgSrc}" ${inputAud} -vf "${vFilters}" ${mapAud} -c:v libx264 -preset fast -crf 26 -pix_fmt yuv420p -r 24 -shortest -movflags +faststart "${clipOut}"`;
    }

    try {
      execSync(cmd, { stdio:'pipe', timeout:120000 });
      const clipOk = fs.existsSync(clipOut) && fs.statSync(clipOut).size > 1000;
      if (clipOk) {
        clipPaths.push(clipOut);
        const mode = s.motionOk ? '🎞️  motion' : '🖼️  static';
        ok(`Clip ${String(i+1).padStart(2,' ')} ${mode}: ${durSec}s → ${Math.round(fs.statSync(clipOut).size/1024)}KB`);
      } else {
        renderErrors.push(`clip${i+1}: file kosong`);
        warn(`Clip ${i+1}: file kosong`);
      }
    } catch(e) {
      const msg = e.message.substring(0, 200);
      renderErrors.push(`clip${i+1}: ${msg}`);
      err(`Clip ${i+1}: ${msg.substring(0,100)}`);
      try { fs.writeFileSync(`${BUNDLE}/err_clip${i+1}.txt`, e.message); } catch(ex) {}
    }
  }

  log(`\n  📊 ${clipPaths.length}/${SCRIPT.scenes.length} clips berhasil`);

  // Concat
  let renderOk = false, sizeMb = 0, videoPath = '';
  if (clipPaths.length > 0) {
    log('\n  🔗 Menggabungkan semua clips...');
    const concatFile = `${TMP_CLIPS}/list.txt`;
    fs.writeFileSync(concatFile, clipPaths.map(p => `file '${p}'`).join('\n'), 'utf8');
    videoPath = `${BUNDLE}/${slug}.mp4`;
    const concatCmd = `"${FFMPEG}" -y -f concat -safe 0 -i "${concatFile}" -c:v libx264 -preset fast -crf 24 -pix_fmt yuv420p -r 24 -c:a aac -b:a 128k -movflags +faststart "${videoPath}"`;
    try {
      execSync(concatCmd, { stdio:'pipe', timeout:300000 });
      renderOk = fs.existsSync(videoPath) && fs.statSync(videoPath).size > 50000;
      sizeMb   = renderOk ? Math.round(fs.statSync(videoPath).size / 1048576 * 100) / 100 : 0;
      if (renderOk) ok(`Video final: ${sizeMb} MB → ${videoPath}`);
      else err('Concat gagal');
    } catch(e) {
      err('Concat: ' + e.message.substring(0,150));
      try { fs.writeFileSync(`${BUNDLE}/err_concat.txt`, e.message); } catch(ex) {}
    }
  }
  log('');

  // ── 4. Cleanup + social_media.txt ─────────────────────────
  step('4/5', '🗑️   Cleanup & social_media.txt...');

  if (renderOk) {
    [TMP_AUDIO, TMP_CLIPS, TMP_IMG, TMP_MOTION].forEach(dir => {
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
          ok(`Dihapus: ${path.basename(dir)}/`);
        }
      } catch(e) { warn(`Gagal hapus ${dir}: ${e.message}`); }
    });
  } else {
    warn('Render belum sukses. File mentah dipertahankan.');
  }

  const tvMin = Math.floor(totalAudioSec / 60);
  const tvSec = String(totalAudioSec % 60).padStart(2,'0');
  const narFull  = SCRIPT.scenes.map(s => s.narration).join(' ');
  const nar3     = SCRIPT.scenes.slice(0, 3).map(s => s.narration).join(' ');
  const nar5     = SCRIPT.scenes.slice(0, 5).map(s => s.narration).join(' ');
  const ttsMode  = useTTS === 'elevenlabs' ? `ElevenLabs Premium (${Object.keys(EL_VOICES).find(k=>EL_VOICES[k]===EL_VOICE_SELECTED)||'custom'})` : 'Edge TTS id-ID-ArdiNeural';
  const imgMode  = LEONARDO_KEY ? (USE_MOTION ? 'Leonardo Anime XL + Motion' : 'Leonardo Anime XL') : 'Picsum Fallback';
  const voiceLabel = useTTS === 'elevenlabs' ? 'ElevenLabs Multilingual v2' : 'Microsoft Edge TTS Neural';

  // ── Bangun hashtag lengkap (20–25 tag, campuran populer + niche) ──
  const BASE_TAGS = [
    '#shorts', '#fyp', '#foryou', '#foryoupage', '#viral', '#trending',
    '#edukasi', '#edukasianak', '#anakpintar', '#belajarbersamaanak',
    '#faktaseru', '#faktaunik', '#videoedukasi', '#kontenedukasi',
    '#clayanimation', '#animasianak', '#videoanak', '#pendidikan',
    '#belajarsambilbermain', '#indonesia'
  ];
  const allTags  = [...new Set([...(SCRIPT.hashtags || []), ...BASE_TAGS])];
  const tags20   = allTags.slice(0, 20);  // YouTube max 15, Instagram max 30, TikTok max 20
  const tags15   = allTags.slice(0, 15);
  const tagsNiche = allTags.filter(t => !['#shorts','#fyp','#foryou','#foryoupage','#viral','#trending'].includes(t)).slice(0, 12);

  // ── Scene highlight untuk deskripsi ──
  const highlights = SCRIPT.scenes.slice(0, 5).map((s, i) => `  ${i+1}. ${s.narration.split('.')[0].trim()}.`).join('\n');

  // ── Thumbnail ideas berdasarkan scene pertama & topik ──
  const thumbScene1 = SCRIPT.scenes[0];
  const thumbEmoji  = { excited:'🔥', curious:'🤔', wow:'😱', amazed:'✨', funny:'😂' }[thumbScene1?.emo] || '🎉';
  const thumbColors = { animals:'Hijau & Orange', science:'Biru & Kuning', history:'Merah & Emas', nature:'Hijau & Biru' }[SCRIPT.genre] || 'Biru & Kuning';

  const socialLines = [
    '╔══════════════════════════════════════════════════════╗',
    `║   📱 SOCIAL MEDIA KIT — ${dd}/${mm}/${yyyy}`,
    `║   📁 Folder : ${slug}`,
    `║   🎬 Durasi : ${tvMin}:${tvSec} (${totalAudioSec}s) | ${SCRIPT.scenes.length} scene`,
    `║   🎙️  Voice  : ${ttsMode}`,
    `║   🎨 Gambar : ${imgMode}`,
    `║   ✅ Status : ${renderOk ? '🟢 RENDER SUKSES (' + sizeMb + ' MB)' : '🟡 PERLU MANUAL RENDER'}`,
    '╚══════════════════════════════════════════════════════╝',
    '',
    // ────────────────────────────────────────────────────────
    '┌──────────────────────────────────────────────────────┐',
    '│  🖼️  THUMBNAIL IDEAS (Pilih salah satu)              │',
    '└──────────────────────────────────────────────────────┘',
    '',
    `KONSEP A — TEKS BESAR + KARAKTER`,
    `  Teks utama  : "${SCRIPT.hook.toUpperCase()}"`,
    `  Sub-teks    : "Fakta Yang Mengejutkan!"`,
    `  Karakter    : ${thumbScene1?.visual?.split(',')[0] || 'karakter clay lucu'} (ekspresi ${thumbScene1?.emo || 'excited'} ${thumbEmoji})`,
    `  Background  : ${thumbColors} gradient cerah`,
    `  Layout      : Karakter 60% kiri, teks 40% kanan, border thick putih`,
    '',
    `KONSEP B — CLOSE-UP EKSPRESIF`,
    `  Teks utama  : "${SCRIPT.topic}"`,
    `  Sub-teks    : "Episode ${dd} | #FaktaSeru"`,
    `  Gaya        : Close-up wajah karakter, ekspresi besar`,
    `  Background  : Warna solid ${thumbColors}, shadow dramatic`,
    `  Font        : Bold caps, outline hitam tebal`,
    '',
    `KONSEP C — SPLIT SCREEN`,
    `  Kiri (50%)  : Before — pertanyaan "Tau nggak?"`,
    `  Kanan (50%) : After  — reveal jawaban + karakter terkejut`,
    `  Warna border: Merah tebal (click-bait friendly)`,
    `  Teks hook   : "${SCRIPT.scenes[0]?.label || SCRIPT.hook}"`,
    '',
    `TOOLS THUMBNAIL: Canva (template YouTube Shorts) | Adobe Express | CapCut`,
    '',
    // ────────────────────────────────────────────────────────
    '┌──────────────────────────────────────────────────────┐',
    '│  🎬 YOUTUBE & YOUTUBE SHORTS                         │',
    '└──────────────────────────────────────────────────────┘',
    '',
    '── JUDUL (pilih salah satu) ──',
    `A) ${thumbEmoji} ${SCRIPT.hook}`,
    `B) ${SCRIPT.topic} | Video Edukasi Anak Seru!`,
    `C) ${thumbEmoji} ${SCRIPT.hook} | Clay Animation Kids`,
    `D) Fakta Seru: ${SCRIPT.topic} yang Bikin Kamu Takjub! ${thumbEmoji}`,
    '',
    '── DESKRIPSI YOUTUBE (copy-paste langsung) ──',
    '',
    `${thumbEmoji} ${SCRIPT.hook}`,
    '',
    `Di video ini, anak-anak akan belajar tentang ${SCRIPT.topic} dengan cara yang seru dan menyenangkan! ${nar3.substring(0, 200).trim()}...`,
    '',
    `✅ APA YANG AKAN KAMU PELAJARI:`,
    highlights,
    '',
    `🎯 Video ini cocok untuk:`,
    `  • Anak usia 5–12 tahun`,
    `  • Belajar sambil bermain`,
    `  • Orang tua yang ingin edukasi seru untuk anak`,
    `  • Guru dan pendidik PAUD/TK/SD`,
    '',
    `🔔 SUBSCRIBE & nyalakan notifikasi bel 🔔`,
    `  → Agar tidak ketinggalan video edukasi seru setiap hari!`,
    '',
    `👇 TONTON VIDEO LAINNYA:`,
    `  → Playlist: [tambahkan link playlist Anda]`,
    '',
    tags20.join(' '),
    '',
    '── TAGS YOUTUBE (pisahkan koma di kolom Tags) ──',
    tags20.map(h => h.replace('#','')).join(', '),
    '',
    '── END SCREEN (saran) ──',
    `  • 0:00–0:05  : Subscribe animation`,
    `  • Akhir video: Rekomendasikan 2 video terkait`,
    `  • Card popup : Di detik ke-5 dan pertengahan video`,
    '',
    // ────────────────────────────────────────────────────────
    '┌──────────────────────────────────────────────────────┐',
    '│  📸 INSTAGRAM (Feed & Reels)                         │',
    '└──────────────────────────────────────────────────────┘',
    '',
    '── CAPTION INSTAGRAM ──',
    '',
    `${thumbEmoji} ${SCRIPT.hook}`,
    '',
    nar5.substring(0, 300).trim() + '...',
    '',
    `💡 Simpan video ini dan share ke teman-teman ya!`,
    `👇 Tag siapa yang harus nonton ini?`,
    '',
    tags15.join(' '),
    '',
    '── ALT TEXT (untuk aksesibilitas) ──',
    `Video animasi clay berjudul "${SCRIPT.topic}" untuk edukasi anak-anak.`,
    '',
    // ────────────────────────────────────────────────────────
    '┌──────────────────────────────────────────────────────┐',
    '│  🎵 TIKTOK                                           │',
    '└──────────────────────────────────────────────────────┘',
    '',
    '── CAPTION TIKTOK ──',
    '',
    `${thumbEmoji} ${SCRIPT.hook} #fyp`,
    '',
    SCRIPT.scenes[0]?.narration?.substring(0, 150).trim() + '...',
    '',
    `Swipe up untuk lihat lebih! 👆`,
    '',
    tags20.slice(0, 20).join(' '),
    '',
    '── TIKTOK METADATA ──',
    `  Judul video     : ${SCRIPT.topic}`,
    `  Durasi ideal    : ${tvMin}:${tvSec} (Shorts <60s paling optimal)`,
    `  Sound           : Gunakan trending sound/lagu anak di TikTok`,
    `  Sticker/Effect  : Tambahkan sticker teks dan efek green screen`,
    `  Best post time  : Senin–Jumat pukul 07:00–09:00 & 19:00–21:00 WIB`,
    '',
    // ────────────────────────────────────────────────────────
    '┌──────────────────────────────────────────────────────┐',
    '│  📊 META / SEO DATA                                  │',
    '└──────────────────────────────────────────────────────┘',
    '',
    `Topik utama   : ${SCRIPT.topic}`,
    `Genre konten  : ${SCRIPT.genre || 'edukasi'} | anak-anak | animasi`,
    `Target usia   : 5–12 tahun (COPPA-safe)`,
    `Bahasa        : Indonesia`,
    `Durasi video  : ${tvMin} menit ${tvSec} detik`,
    `Total scene   : ${SCRIPT.scenes.length}`,
    `Tipe konten   : Edukasi animasi clay / Fakta seru`,
    '',
    `SEO Keywords  :`,
    `  • ${SCRIPT.topic.toLowerCase()}`,
    `  • video edukasi anak indonesia`,
    `  • animasi clay anak`,
    `  • belajar ${SCRIPT.genre || 'fakta'} untuk anak`,
    `  • ${(tagsNiche.slice(0,5).map(t=>t.replace('#','')).join(', '))}`,
    '',
    `Kategori YT   : Education`,
    `Lisensi       : Standard YouTube License`,
    `Bahasa audio  : id-ID (Indonesia)`,
    `Subtitle      : Tambahkan auto-subtitle YouTube untuk jangkauan lebih luas`,
    '',
    // ────────────────────────────────────────────────────────
    '┌──────────────────────────────────────────────────────┐',
    '│  🎬 SCENE BREAKDOWN                                  │',
    '└──────────────────────────────────────────────────────┘',
    '',
    ...SCRIPT.scenes.map((s, i) => {
      const dur = scenesAudio[i]?.duration || s.dur;
      const mv  = scenesImages[i]?.motionOk ? '[🎬motion]' : '[📷static]';
      return `  Scene ${String(i+1).padStart(2,' ')} [${dur}s] ${mv}: ${s.narration.substring(0, 70)}`;
    }),
    '',
    // ────────────────────────────────────────────────────────
    '┌──────────────────────────────────────────────────────┐',
    '│  ⚙️  PIPELINE INFO                                   │',
    '└──────────────────────────────────────────────────────┘',
    '',
    `Generated  : ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
    `Pipeline   : v2 | ${SCRIPT.pipeline_id}`,
    `Script AI  : ${SCRIPT._source || 'Groq llama-3.3-70b'}`,
    `Voice AI   : ${voiceLabel}`,
    `Image AI   : ${imgMode}`,
    `Video path : ${videoPath || 'N/A'}`,
    `File size  : ${sizeMb} MB`,
    '─────────────────────────────────────────────────────',
  ];

  const socialPath = `${BUNDLE}/social_media.txt`;
  try {
    fs.writeFileSync(socialPath, socialLines.join('\n'), 'utf8');
    ok(`social_media.txt dibuat (${Math.round(fs.statSync(socialPath).size/1024)}KB)`);
  } catch(e) { warn('social_media.txt gagal: ' + e.message); }

  // ── 5. Telegram ───────────────────────────────────────────
  step('5/5', '📲  Kirim ke Telegram...');

  if (TG_TOKEN && TG_TOKEN !== 'SKIP' && TG_CHAT_ID && TG_CHAT_ID !== 'SKIP') {
    const motionCount = scenesImages.filter(s => s.motionOk).length;
    const msgText = renderOk
      ? `<b>🎬 Video Baru Siap!</b>\n\n`
        + `<b>${SCRIPT.topic}</b>\n`
        + `Durasi: ${tvMin}m${tvSec}s | ${SCRIPT.scenes.length} scene\n`
        + `Ukuran: ${sizeMb} MB\n`
        + `TTS: ${ttsMode}\n`
        + `Gambar: ${imgMode}\n`
        + (motionCount > 0 ? `Motion: ${motionCount}/${SCRIPT.scenes.length} scene bergerak\n` : '')
        + `Script: ${SCRIPT._source || 'fallback'}\n\n`
        + (SCRIPT.hashtags || []).slice(0,5).join(' ')
      : `<b>⚠️ Pipeline selesai dengan error</b>\n\n${SCRIPT.topic}\nCek folder output.`;

    const msgOk = tgSendMessage(TG_TOKEN, TG_CHAT_ID, msgText);
    if (msgOk) ok('Pesan notifikasi terkirim');

    if (renderOk && videoPath && fs.existsSync(videoPath.replace(/\//g,'\\'))) {
      info(`Mengirim video ${sizeMb} MB...`);
      const vOk = tgUploadFile(TG_TOKEN, TG_CHAT_ID, videoPath, 'video', null)
                || tgUploadFile(TG_TOKEN, TG_CHAT_ID, videoPath, 'document', SCRIPT.topic);
      if (vOk) ok('Video terkirim ke Telegram!');
      else warn('Kirim video gagal');
    }

    if (fs.existsSync(socialPath)) {
      const sOk = tgUploadFile(TG_TOKEN, TG_CHAT_ID, socialPath, 'document', 'Social Media Kit');
      if (sOk) ok('social_media.txt terkirim!');
    }
  } else {
    info('Telegram SKIP. Set TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID untuk aktifkan.');
  }

  // ── Hasil akhir ───────────────────────────────────────────
  log('');
  if (renderOk) {
    const motionCount = scenesImages.filter(s => s.motionOk).length;
    log('╔══════════════════════════════════════════════════╗');
    log('║  ✅  VIDEO BERHASIL DIBUAT!                       ║');
    log(`║  📁  ${slug.substring(0,44)}  ║`);
    log(`║  🎬  ${sizeMb} MB | ${tvMin}m${tvSec}s | ${SCRIPT.scenes.length} scene          ║`);
    log(`║  🎞️   Motion: ${motionCount}/${SCRIPT.scenes.length} scene bergerak                    ║`);
    log('╚══════════════════════════════════════════════════╝');
    log('');
    log('  Isi folder:');
    fs.readdirSync(BUNDLE).forEach(f => {
      const stat = fs.statSync(`${BUNDLE}/${f}`);
      log(`    📄 ${f}  (${Math.round(stat.size/1024)} KB)`);
    });
    log('');
    log(`  📂 ${BUNDLE.replace(/\//g,'\\')}`);
  } else {
    log('╔══════════════════════════════════════════════════╗');
    log('║  ⚠️  PIPELINE SELESAI DENGAN ERROR                ║');
    log('╚══════════════════════════════════════════════════╝');
    renderErrors.forEach(e => log('    - ' + e.substring(0,80)));
  }
}

// ══════════════════════════════════════════════════════════════
//  FALLBACK SCRIPT (dipakai jika tidak ada Groq/OpenAI)
// ══════════════════════════════════════════════════════════════
const FALLBACK_SCRIPT = {
  _source: 'fallback_hardcoded',
  topic:    'Fakta Seru Gajah Afrika yang Menakjubkan',
  hook:     'Gajah Afrika punya rahasia luar biasa!',
  genre:    'animals',
  hashtags: ['#gajah','#gajahahrika','#anakpintar','#edukasi','#faktaseru','#shorts','#fyp','#belajar'],
  scenes: [
    { n:1, dur:14, emo:'excited',
      narration: 'Halo teman-teman! Tahukah kalian bahwa gajah Afrika adalah hewan darat terbesar di seluruh dunia? Gajah dewasa bisa memiliki berat hingga enam ton, seberat dua mobil truk besar. Sungguh menakjubkan sekali!',
      label: 'GAJAH TERBESAR DI DUNIA!',
      keywords: ['elephant','africa','safari','biggest'],
      visual: 'giant African elephant standing on green savana, acacia tree, blue sky' },
    { n:2, dur:13, emo:'wow',
      narration: 'Lihat telinga gajah yang sangat besar itu! Telinga gajah Afrika bisa selebar dua meter, hampir sebesar pintu rumah kita lho. Gajah menggunakan telinganya seperti kipas raksasa untuk mendinginkan tubuhnya di hari yang panas terik.',
      label: 'TELINGA RAKSASA SEPERTI KIPAS!',
      keywords: ['elephant ears','fan','cooling','closeup'],
      visual: 'closeup elephant head with wide ears spread, bright savana background' },
    { n:3, dur:14, emo:'curious',
      narration: 'Belalai gajah adalah alat paling serbaguna di dunia hewan! Di dalam belalai panjang itu terdapat lebih dari empat puluh ribu otot yang bekerja bersama. Dengan belalainya, gajah bisa mengangkat benda sangat berat dan mengambil kacang yang kecil sekaligus!',
      label: 'BELALAI PUNYA 40 RIBU OTOT!',
      keywords: ['trunk','muscles','watermelon','picking'],
      visual: 'elephant trunk picking up giant watermelon, colorful open nature lab' },
    { n:4, dur:13, emo:'amazed',
      narration: 'Gigi gading gajah bukan sekadar hiasan yang indah! Gading adalah gigi taring yang terus tumbuh sepanjang hidup gajah. Gajah menggunakan gadingnya untuk menggali tanah mencari air, mengupas kulit pohon, dan melindungi diri dari bahaya.',
      label: 'GADING TUMBUH SEPANJANG HIDUP!',
      keywords: ['ivory tusk','digging','water','elephant'],
      visual: 'elephant with white shiny tusks digging brown soil, hidden blue water below' },
    { n:5, dur:14, emo:'funny',
      narration: 'Bayi gajah adalah makhluk yang paling menggemaskan di savana! Saat baru lahir, bayi gajah sudah seberat seratus kilogram. Yang sangat lucu, bayi gajah butuh waktu berbulan-bulan untuk bisa mengendalikan belalainya sendiri!',
      label: 'BAYI GAJAH SUPER MENGGEMASKAN!',
      keywords: ['baby elephant','cute','clumsy trunk','mother'],
      visual: 'cute baby elephant with uncontrolled dangling trunk, mother elephant watching, sunny savana' },
    { n:6, dur:13, emo:'wow',
      narration: 'Tahukah kamu, gajah bisa berkomunikasi dengan suara yang tidak bisa kita dengar! Gajah menggunakan gelombang infrasonik yang bisa terdengar hingga sepuluh kilometer jauhnya. Mereka juga bisa merasakan getaran tanah melalui telapak kaki yang besar.',
      label: 'KOMUNIKASI RAHASIA GAJAH!',
      keywords: ['elephant sound','infrasound','vibration','rainbow waves'],
      visual: 'elephant making sound with colorful rainbow waves coming out, elephants far away responding' },
    { n:7, dur:14, emo:'curious',
      narration: 'Gajah adalah salah satu hewan paling cerdas di seluruh dunia! Mereka bisa mengenali wajah diri sendiri di cermin, sama seperti manusia yang sangat cerdas. Gajah juga memiliki ingatan yang luar biasa kuat dan bisa mengingat teman serta jalan pulang selama puluhan tahun!',
      label: 'GAJAH SECERDAS MANUSIA!',
      keywords: ['elephant intelligence','mirror','smart','library'],
      visual: 'elephant standing in front of big golden mirror looking at reflection, open air library' },
    { n:8, dur:13, emo:'amazed',
      narration: 'Kawanan gajah selalu dipimpin oleh matriark, yaitu gajah betina tertua dan paling bijaksana dalam kawanan. Dia yang memimpin perjalanan jauh mencari air dan makanan. Semua gajah dalam kawanan saling menjaga dan melindungi satu sama lain seperti keluarga yang solid!',
      label: 'GAJAH BETINA MEMIMPIN KAWANAN!',
      keywords: ['elephant herd','matriarch','leader','family'],
      visual: 'elephant herd in line led by old female elephant with small crown, green wide savana and blue river' },
    { n:9, dur:14, emo:'funny',
      narration: 'Gajah sangat suka mandi dan bermain air yang menyenangkan! Mereka bisa menyedot air hingga dua belas liter sekali hisap menggunakan belalai panjangnya. Setelah mandi, gajah suka melumuri tubuh dengan lumpur seperti tabir surya alami!',
      label: 'MANDI LUMPUR TABIR SURYA ALAMI!',
      keywords: ['elephant bath','water spray','mud','river'],
      visual: 'elephant splashing water from trunk at clear river, brown mud on body, smiling sun in blue sky' },
    { n:10, dur:13, emo:'excited',
      narration: 'Gajah adalah hewan yang luar biasa dan harus kita lindungi bersama-sama! Sayangnya gajah kini terancam punah karena kehilangan habitat dan perburuan liar. Dengan belajar dan mencintai gajah, kita semua bisa ikut menjaga mereka tetap hidup di bumi kita yang indah!',
      label: 'JAGA GAJAH BERSAMA-SAMA!',
      keywords: ['save elephants','colorful characters','celebration','love nature'],
      visual: 'big elephant surrounded by happy colorful characters holding love banner, golden sunlight forest' },
  ]
};

// Run
main().catch(e => { console.error('\n❌ PIPELINE ERROR:', e.message); process.exit(1); });
