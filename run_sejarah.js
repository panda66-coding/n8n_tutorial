/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  SEJARAH KERAJAAN INDONESIA — Auto Video Pipeline            ║
 * ║  30 hari konten otomatis untuk anak-anak                     ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  CARA PAKAI:                                                 ║
 * ║  node run_sejarah.js              → hari ini otomatis        ║
 * ║  node run_sejarah.js --hari 5     → paksa hari ke-5          ║
 * ║  node run_sejarah.js --semua      → generate semua 30 hari   ║
 * ║  node run_sejarah.js --list       → tampilkan daftar 30 judul║
 * ║  node run_sejarah.js --no-motion  → skip animasi             ║
 * ║  node run_sejarah.js --motion-all → animasi semua scene      ║
 * ║  node run_sejarah.js --long       → 15 scene, 3-5 menit      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const { execSync, spawnSync } = require('child_process');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

// ── PATHS ──────────────────────────────────────────────────────
const FFMPEG    = 'C:/Users/User/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe';
const FFPROBE   = 'C:/Users/User/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffprobe.exe';
const FONT_BOLD = 'C\\:/Windows/Fonts/arialbd.ttf';
const FONT_NRM  = 'C\\:/Windows/Fonts/arial.ttf';
const BASE_DIR  = path.join(__dirname, 'output/sejarah').replace(/\\/g, '/');
const JADWAL    = JSON.parse(fs.readFileSync(path.join(__dirname, 'content/sejarah_kerajaan_30hari.json'), 'utf8'));

// ── API KEYS ───────────────────────────────────────────────────
const GROQ_KEY     = process.env.GROQ_API_KEY       || '';
const LEONARDO_KEY = process.env.LEONARDO_API_KEY   || '';
const KLING_ACCESS = process.env.KLING_ACCESS_KEY   || '';
const KLING_SECRET = process.env.KLING_SECRET_KEY   || '';
const TG_TOKEN     = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT_ID   = process.env.TELEGRAM_CHAT_ID   || '';

// ── FLAGS ──────────────────────────────────────────────────────
const USE_MOTION = !process.argv.includes('--no-motion');
const MOTION_ALL = process.argv.includes('--motion-all');
const RUN_SEMUA  = process.argv.includes('--semua');
const SHOW_LIST  = process.argv.includes('--list');
const HARI_ARG   = (() => { const i = process.argv.indexOf('--hari'); return i > -1 ? parseInt(process.argv[i+1]) : null; })();
const USE_LONG   = process.argv.includes('--long'); // 15 scene, 3-5 menit, DYK segments

// ── VIDEO SETTINGS ─────────────────────────────────────────────
const VIDEO_W = 720;   // 9:16 portrait — upgrade dari 576
const VIDEO_H = 1280;  // 9:16 portrait — upgrade dari 1024

// ── WARNA TEMA per ERA ─────────────────────────────────────────
const ERA_STYLE = {
  'Hindu-Buddha': { bg: '8B4513', accent: 'FFD700', label: '🏛️ ERA HINDU-BUDDHA' },
  'Islam':        { bg: '2E7D32', accent: 'A5D6A7', label: '☪️ ERA KESULTANAN ISLAM' },
  'Penjajahan':   { bg: '1A237E', accent: 'EF5350', label: '⚔️ ERA PERLAWANAN' },
  'Pergerakan':   { bg: '880E4F', accent: 'F48FB1', label: '✊ ERA KEBANGKITAN' },
  'Kemerdekaan':  { bg: 'B71C1C', accent: 'FFEB3B', label: '🇮🇩 ERA KEMERDEKAAN' },
  'Modern':       { bg: '0D47A1', accent: '90CAF9', label: '🌟 INDONESIA MODERN' },
};

// ────────────────────────────────────────────────────────────────
//  HELPER FUNCTIONS
// ────────────────────────────────────────────────────────────────
function log(m)  { console.log(m); }
function ok(m)   { console.log('  ✅ ' + m); }
function warn(m) { console.warn('  ⚠️  ' + m); }
function info(m) { console.log('  ℹ️  ' + m); }
function err(m)  { console.error('  ❌ ' + m); }
function step(n,t){ log(`\n${'━'.repeat(50)}\nSTEP ${n} ${t}\n${'━'.repeat(50)}`); }
function sleep(ms){ const t=Date.now(); while(Date.now()-t<ms){} }

function slugify(s) {
  return s.toLowerCase()
    .replace(/[àáâã]/g,'a').replace(/[èéêë]/g,'e').replace(/[ìíîï]/g,'i')
    .replace(/[òóôõ]/g,'o').replace(/[ùúûü]/g,'u')
    .replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,'_').replace(/_+/g,'_').trim().substring(0,40);
}

function getAudioDuration(f) {
  try {
    const out = execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${f}"`,
      { encoding:'utf8', timeout:8000, shell:'cmd.exe' });
    return Math.ceil(parseFloat(out.trim()) + 0.5) || 12;
  } catch(e) { return 12; }
}

function downloadFile(url, dest) {
  try {
    execSync(`curl -s -L --max-time 60 -o "${dest}" "${url}"`, { shell:'cmd.exe', timeout:70000 });
    return fs.existsSync(dest) && fs.statSync(dest).size > 5000;
  } catch(e) { return false; }
}

function escTxt(t) {
  return (t || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\u2019')
    .replace(/:/g, '\\:')
    .replace(/[\[\]]/g, '')
    .replace(/,/g, ' ')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/[^\x20-\x7E\u00C0-\u024F]/g, '')
    .trim()
    .substring(0, 160);
}

function wrapTxt(t, videoW) {
  const CONFIGS = [
    { size: 32, coef: 0.65 }, { size: 28, coef: 0.63 },
    { size: 24, coef: 0.60 }, { size: 20, coef: 0.57 },
  ];
  const usableW = videoW - 24;
  for (const { size, coef } of CONFIGS) {
    const cpl = Math.floor(usableW / (size * coef));
    const words = t.split(' ');
    const lines = []; let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (test.length <= cpl) { cur = test; }
      else {
        if (cur) lines.push(cur);
        cur = w.length > cpl ? w.substring(0, cpl-1) + '-' : w;
      }
    }
    if (cur) lines.push(cur);
    if (lines.length <= 3) return { lines: lines.slice(0,3), fontSize: size };
  }
  // Fallback
  const coef = 0.57, size = 20;
  const cpl = Math.floor(usableW / (size * coef));
  const words = t.split(' '); const lines = []; let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (test.length <= cpl) { cur = test; }
    else { if (cur) lines.push(cur); if (lines.length >= 3) break; cur = w; }
  }
  if (lines.length < 3 && cur) lines.push(cur);
  const result = lines.slice(0,3);
  if (result.length === 3) { const l = result[2]; if (l.length+3 <= cpl) result[2] = l+'...'; }
  return { lines: result, fontSize: size };
}

// ── HTTP helpers ───────────────────────────────────────────────
function httpsPost(hostname, path, headers, bodyStr) {
  return new Promise((resolve, reject) => {
    const bodyBuf = Buffer.from(bodyStr, 'utf8');
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type':'application/json', 'Content-Length':bodyBuf.length, ...headers }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject); req.write(bodyBuf); req.end();
  });
}

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method:'GET', headers }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject); req.end();
  });
}

// ────────────────────────────────────────────────────────────────
//  GROQ AI — Generate Script Sejarah
//  Upgrade: hook 3 variasi, storytelling dramatis, cinematic prompts
// ────────────────────────────────────────────────────────────────
async function generateScriptSejarah(jadwalItem, longFormat = false) {
  if (!GROQ_KEY) { warn('Groq key tidak ada'); return null; }

  const numScenes = longFormat ? 15 : 10;
  const wordMin   = longFormat ? 50  : 35;
  const wordMax   = longFormat ? 65  : 45;
  const durBase   = longFormat ? 18  : 14;

  info(`Groq AI: generate script "${jadwalItem.judul}" (${numScenes} scene, ${wordMin}-${wordMax} kata/scene)...`);

  const systemPrompt = `Kamu adalah penulis konten video viral tier-1 yang juga ahli sejarah Indonesia.
Kamu menguasai teknik storytelling YouTube Shorts dan TikTok yang membuat penonton TIDAK BISA berhenti menonton.

GAYA STORYTELLING:
- Dramatis, misterius, dan penuh ketegangan seperti trailer film
- Bahasa Indonesia yang kuat, padat, dan mengejutkan
- Gunakan kalimat pendek dan kuat: "Mereka tidak pernah menyangka...", "Rahasianya tersimpan selama berabad-abad...", "Tidak ada yang tahu bahwa..."
- Sesekali gunakan "Kamu tidak akan percaya..." atau "Ini bukan cerita biasa..."
- Bangun rasa PENASARAN dan KETEGANGAN di setiap scene
- Scene terakhir HARUS memberikan emotional punch / twist mengejutkan

STRUKTUR WAJIB:
- Scene 1 (HOOK): Fakta mengejutkan / pertanyaan misterius yang langsung menarik — MAX 10 kata yang sangat kuat
- Scene 2-3 (BUILD): Bangun latar, masuk ke inti cerita dengan tempo cepat
- Scene 4-7 (CLIMAX): Drama puncak, fakta-fakta mencengangkan, konflik
- Scene 8-9 (TWIST): Hal mengejutkan yang jarang diketahui
- Scene 10 (ENDING): Emotional close / call to action yang kuat

IMAGE PROMPT — WAJIB CINEMATIC & DETAIL:
Setiap image_prompt HARUS mengandung semua elemen ini:
1. TOKOH dengan ekspresi dramatis (warna kostum spesifik, aksesori detail)
2. SETTING yang imersif (arsitektur era, cuaca, waktu hari)
3. PENCAHAYAAN CINEMATIC: "dramatic rim lighting", "volumetric golden light", "deep shadow contrast", "torch-lit atmosphere", "misty dawn light"
4. DEPTH: "shallow depth of field", "foreground elements blurred", "layers of depth"
5. MOOD: "epic cinematic atmosphere", "mysterious fog", "dramatic tension"
6. Gaya visual: clay animation style, 3D claymation render, soft plasticine texture, smooth shiny surface, bright cheerful colors, cute chibi characters, miniature world feel, highly detailed, 8K, no text, no watermark

CONTOH HOOK KUAT:
- "Kerajaan ini menghilang dalam semalam — dan tidak ada yang tahu kenapa."
- "Satu sumpah mengubah nasib seluruh Nusantara selamanya."
- "Ia hanya seorang pemuda — tapi menaklukkan setengah dunia."

VARIASI HOOK: Kamu akan menghasilkan 3 variasi hook untuk setiap script.
Sistem akan memilih yang terbaik secara otomatis.`;

  const longRules = longFormat ? `
STRUKTUR 15 SCENE (FORMAT PANJANG):
  Scene  1       : HOOK misterius — 1 kalimat, max 10 kata, sangat mengejutkan
  Scene  2- 3    : Latar dunia — bangun atmosfer era tersebut
  Scene  4- 5    : Fakta tersembunyi yang jarang diketahui
  Scene  6- 8    : Drama puncak — momen paling mencengangkan
  Scene  9       : 🔍 DID YOU KNOW #1 — "Tahukah kamu..." + fakta spesifik
  Scene 10-11    : Dampak besar — perubahan yang diakibatkan
  Scene 12       : 🔍 DID YOU KNOW #2 — "Fakta tersembunyi..." + twist
  Scene 13       : Warisan hingga hari ini
  Scene 14       : 🔍 DID YOU KNOW #3 — "Satu lagi fakta..." + hubungan ke masa kini
  Scene 15       : EMOTIONAL ENDING — kalimat yang meninggalkan kesan mendalam` : '';

  const userPrompt = `Buat script video sejarah VIRAL berjudul: "${jadwalItem.judul}"

Topik detail: ${jadwalItem.topik_groq}
Era: ${jadwalItem.era}
${longRules}

Format JSON (WAJIB PERSIS):
{
  "topic": "${jadwalItem.judul}",
  "hook": "hook terpilih — max 10 kata, sangat kuat",
  "hook_variants": [
    "variasi hook 1 — dramatis",
    "variasi hook 2 — misterius",
    "variasi hook 3 — mengejutkan"
  ],
  "genre": "history",
  "era": "${jadwalItem.era}",
  "hashtags": ["#sejarahindonesia","#kerajaannusantara","#edukasianakid","#faktasejarah","#belajarsejarah","#anakpintarid"],
  "scenes": [
    {
      "n": 1,
      "dur": ${durBase},
      "emo": "shocked",
      "narration": "WAJIB ${wordMin}-${wordMax} kata. Kalimat HOOK yang langsung menghantam — dramatis, misterius, mengejutkan. Buat penonton tidak bisa berhenti.",
      "label": "JUDUL SCENE CAPS MAX 26 KARAKTER",
      "image_prompt": "BAHASA INGGRIS WAJIB — nama tokoh + ekspresi dramatis + warna kostum spesifik + setting detail + dramatic rim lighting OR volumetric golden light + shallow depth of field + epic cinematic atmosphere + clay animation style, 3D claymation render, soft plasticine texture, smooth shiny surface, bright cheerful colors, cute chibi characters, miniature world feel, highly detailed, 8K, no text, no watermark",
      "visual": "deskripsi singkat max 12 kata",
      "mood": "epic|mysterious|emotional|triumphant|dark|wonder"
    }
  ]
}

RULES KETAT:
1. TEPAT ${numScenes} scene
2. narration WAJIB ${wordMin}-${wordMax} kata per scene (HITUNG!)
3. hook_variants: 3 variasi berbeda karakter (dramatis / misterius / mengejutkan)
4. image_prompt: SETIAP scene HARUS BERBEDA pose/lokasi/aktivitas + selalu ada lighting cinematic
5. Scene terakhir: berikan emotional punch / twist yang tidak terduga
6. JSON SAJA, TANPA markdown, TANPA komentar`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (attempt > 1) { info(`Retry ${attempt}/3 setelah 25 detik...`); sleep(25000); }
      const res = await httpsPost('api.groq.com', '/openai/v1/chat/completions',
        { 'Authorization': `Bearer ${GROQ_KEY}` },
        JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: longFormat ? 5500 : 4000,
          temperature: 0.88
        })
      );

      if (res.status === 429) { warn(`Groq rate limit (429), attempt ${attempt}/3`); continue; }
      if (res.status !== 200) { warn(`Groq error ${res.status}`); return null; }

      const content = res.body.choices?.[0]?.message?.content || '';
      const cleaned = content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
      const script  = JSON.parse(cleaned);

      if (!script.scenes || script.scenes.length < 5) { warn('Script kurang lengkap'); return null; }

      // Pilih hook terbaik dari 3 variasi (terpanjang = paling detail)
      if (script.hook_variants?.length >= 3) {
        const best = script.hook_variants.reduce((a, b) => b.length > a.length ? b : a);
        script.hook = script.hook || best;
        info(`Hook terpilih: "${script.hook}"`);
        info(`Variasi: ${script.hook_variants.map((h,i) => `[${i+1}] ${h}`).join(' | ')}`);
      }

      ok(`Script: "${script.topic}" (${script.scenes.length} scene)`);
      return script;
    } catch(e) {
      warn(`Groq gagal (attempt ${attempt}): ${e.message.substring(0,100)}`);
      if (attempt < 3) sleep(15000);
    }
  }
  warn('Groq gagal setelah 3x retry');
  return null;
}

// ────────────────────────────────────────────────────────────────
//  EDGE TTS — Microsoft Neural (natural, cocok narasi sejarah)
//  Voice: id-ID-ArdiNeural  (pria dramatis)
//  Fallback: Google TTS
// ────────────────────────────────────────────────────────────────

// Preprocessing teks untuk pacing narasi lebih natural & dramatis
function prepareNarrationText(text) {
  return text
    .replace(/\.\s+/g, '... ')              // jeda panjang setelah titik
    .replace(/!\s+/g, '! ')                  // sedikit jeda setelah seru
    .replace(/\?\s+/g, '?... ')             // suspense setelah tanda tanya
    .replace(/,\s+/g, ', ')                  // jeda natural koma
    .replace(/—/g, '... ')                   // em-dash jadi jeda dramatis
    .replace(/:/g, '... ')                   // titik dua jadi jeda
    .trim();
}

async function generateTTSEdge(text, destPath) {
  const destWin  = destPath.replace(/\//g, '\\');
  const prepared = prepareNarrationText(text);   // pacing dramatis
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata('id-ID-ArdiNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = await tts.toStream(prepared);
      const chunks = [];
      for await (const chunk of audioStream) chunks.push(chunk);
      const buf = Buffer.concat(chunks);
      if (buf.length < 1000) throw new Error(`Audio terlalu kecil: ${buf.length} bytes`);
      fs.writeFileSync(destWin, buf);
      return true;
    } catch(e) {
      warn(`Edge TTS attempt ${attempt} gagal: ${e.message.substring(0,100)}`);
      try { if (fs.existsSync(destWin)) fs.unlinkSync(destWin); } catch(ex) {}
      if (attempt < 3) { const t = Date.now(); while(Date.now()-t<2000){} }
    }
  }
  // Fallback ke Google TTS jika Edge gagal total
  warn('Edge TTS gagal 3x, fallback ke Google TTS...');
  return generateTTSGoogle(text, destPath);
}

// Google TTS — fallback jika Edge TTS tidak tersedia
function generateTTSGoogle(text, destPath) {
  const destWin = destPath.replace(/\//g, '\\');
  const chunks = [];
  const words  = text.split(' ');
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 180) {
      if (cur) chunks.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) chunks.push(cur.trim());

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const allBufs = [];
      for (let i = 0; i < chunks.length; i++) {
        const encoded = encodeURIComponent(chunks[i]);
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=id&client=tw-ob`;
        const result = spawnSync(
          'C:\\Windows\\System32\\curl.exe',
          ['-s', '-L', '--max-time', '20', '-A',
           'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
           url],
          { encoding:'buffer', timeout:25000 }
        );
        if (result.error) throw new Error(`spawnSync error: ${result.error.message}`);
        if (result.status !== 0) throw new Error(`curl exit ${result.status}`);
        if (!result.stdout || result.stdout.length < 500) throw new Error(`Chunk ${i+1} terlalu kecil`);
        allBufs.push(result.stdout);
        if (i < chunks.length - 1) { const t=Date.now(); while(Date.now()-t<300){} }
      }
      const combined = Buffer.concat(allBufs);
      fs.writeFileSync(destWin, combined);
      if (fs.statSync(destWin).size > 1000) return true;
      throw new Error(`File terlalu kecil: ${fs.statSync(destWin).size} bytes`);
    } catch(e) {
      warn(`Google TTS attempt ${attempt} gagal: ${e.message.substring(0,100)}`);
      try { if(fs.existsSync(destWin)) fs.unlinkSync(destWin); } catch(ex) {}
      if (attempt < 3) { const t=Date.now(); while(Date.now()-t<3000){} }
    }
  }
  return false;
}

// ────────────────────────────────────────────────────────────────
//  LEONARDO AI — Generate Gambar Historis
// ────────────────────────────────────────────────────────────────
const NEGATIVE_PROMPT = [
  'modern clothes','contemporary','photo','realistic','ugly','deformed',
  'blurry','text','watermark','signature','stiff','rigid','lifeless',
  'nsfw','adult content','violence','gore','blood'
].join(', ');

function buildSejarahPrompt(scene, era) {
  // ── Tag sinematik yang SELALU ditambahkan ─────────────────────
  const CINEMATIC_TAGS = [
    'dramatic rim lighting', 'volumetric golden light rays', 'deep shadow contrast',
    'shallow depth of field', 'cinematic epic atmosphere',
  ].join(', ');

  const CLAY_TAGS = [
    'clay animation style', '3D claymation render', 'soft plasticine texture',
    'smooth shiny surface', 'bright cheerful colors', 'cute chibi characters',
    'miniature world feel', 'highly detailed', '8K', 'no text', 'no watermark',
  ].join(', ');

  // Deteksi mood dari scene untuk menyesuaikan pencahayaan
  const mood = (scene.mood || '').toLowerCase();
  let moodTag = '';
  if (mood === 'dark' || mood === 'mysterious') {
    moodTag = 'mysterious fog, torch-lit atmosphere, deep shadows, moody';
  } else if (mood === 'epic' || mood === 'triumphant') {
    moodTag = 'golden hour sunlight, heroic epic lighting, lens flare';
  } else if (mood === 'wonder') {
    moodTag = 'magical soft glow, ethereal misty light, awe-inspiring';
  } else if (mood === 'emotional') {
    moodTag = 'warm backlight, soft bokeh, emotional close-up atmosphere';
  } else {
    moodTag = 'warm dramatic lighting, rich saturated colors';
  }

  // Prioritas utama: image_prompt detail dari Groq
  if (scene.image_prompt && scene.image_prompt.trim().length > 50) {
    const base = scene.image_prompt.trim()
      .replace(/,\s*(no text|no watermark|8K|highly detailed)[^,]*/gi, '')  // hapus duplikat
      .replace(/clay animation style[^,]*/i, '')
      .trim().replace(/,\s*$/, '');

    // Susun ulang dengan tag cinematic + clay di urutan optimal
    const full = `${base}, ${moodTag}, ${CINEMATIC_TAGS}, ${CLAY_TAGS}`;
    return full.substring(0, 950);
  }

  // Fallback: bangun dari visual + era style
  const visual   = (scene.visual || '').trim();
  const keywords = (scene.keywords || []).slice(0, 4).join(', ');

  const eraStyle = {
    'Hindu-Buddha': 'ancient Javanese temple with intricate stone carvings, gold ornaments, lotus motifs, red brick walls overgrown with moss',
    'Islam':        'grand Islamic mosque with geometric tilework, Arabic calligraphy inscribed on walls, crescent moon overhead',
    'Penjajahan':   'colonial-era port of Batavia, Dutch East Indies architecture, warships in harbor, humid tropical air',
    'Pergerakan':   '1940s Indonesian city streets, red-white flag colors, passionate crowd, revolutionary tension',
    'Kemerdekaan':  'Indonesian independence proclamation 1945, red-white flag raised high, jubilant crowd, historical moment',
    'Modern':       'vibrant modern Indonesia, Garuda Pancasila emblem, colorful batik, diverse smiling people',
  };

  return [
    visual,
    keywords,
    eraStyle[era] || 'ancient Indonesian kingdom with majestic palace',
    moodTag,
    CINEMATIC_TAGS,
    CLAY_TAGS,
    'portrait 9:16 vertical',
  ].filter(Boolean).join(', ').substring(0, 950);
}

async function leonardoGenerateImage(scene, era) {
  if (!LEONARDO_KEY) return null;

  const prompt = buildSejarahPrompt(scene, era);
  const isDetailPrompt = scene.image_prompt && scene.image_prompt.trim().length > 50;
  log(`     Prompt [${isDetailPrompt ? '🎨 DETAIL' : '⚠️ FALLBACK'}]: ${prompt.substring(0, 80)}...`);

  const body = JSON.stringify({
    prompt,
    negative_prompt: NEGATIVE_PROMPT,
    modelId: 'aa77f04e-3eec-4034-9c07-d0f619684628', // Lightning XL
    width: 720, height: 1280,
    num_images: 1,
    guidance_scale: 7,
    num_inference_steps: 10,
    public: false,
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
      warn(`Leonardo error: ${JSON.stringify(genRes).substring(0,80)}`);
      return null;
    }

    const genId = genRes.sdGenerationJob.generationId;
    log(`     Gen ID: ${genId.substring(0,16)}... | polling...`);

    for (let p = 0; p < 18; p++) {
      sleep(5000);
      const pollOut = execSync(
        `curl -s -H "Authorization: Bearer ${LEONARDO_KEY}" "https://cloud.leonardo.ai/api/rest/v1/generations/${genId}"`,
        { encoding:'utf8', timeout:15000, shell:'cmd.exe' }
      );
      const pollRes = JSON.parse(pollOut);
      const imgs = pollRes.generations_by_pk?.generated_images || [];
      if (imgs.length > 0 && imgs[0].url) {
        log(`     Selesai (poll ${p+1})`);
        return { imageId: imgs[0].id, imageUrl: imgs[0].url };
      }
    }
    warn(`Leonardo timeout`);
    return null;
  } catch(e) {
    warn(`Leonardo error: ${e.message.substring(0,80)}`);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────
//  LEONARDO AI — Thumbnail Generator (Landscape 16:9)
// ────────────────────────────────────────────────────────────────
async function generateThumbnail(script, era, outDir) {
  if (!LEONARDO_KEY) return null;
  const judul = script.judul || script.scenes[0]?.label || 'Sejarah Indonesia';
  const hook  = script.hook  || judul;
  const eraStyle = {
    'Hindu-Buddha': 'ancient Javanese Hindu-Buddhist temple, golden stone carvings, intricate reliefs',
    'Islam':        'Islamic kingdom architecture, arabesque ornaments, crescent and star motifs',
    'Penjajahan':   'colonial era Indonesia, Dutch colonial buildings, batik motifs, dramatic contrast',
    'Pergerakan':   'Indonesian national awakening, heroes in traditional dress, patriotic atmosphere',
    'Kemerdekaan':  'Indonesian independence, red and white flag, 1945 era, triumphant atmosphere',
    'Modern':       'modern Indonesia, diverse culture, progress and tradition',
  }[era] || 'historical Indonesia, traditional culture';

  const prompt = [
    `YouTube thumbnail for Indonesian history video about "${judul}"`,
    `Hook text concept: "${hook}"`,
    eraStyle,
    'clay animation style, 3D cartoon characters, cute chibi style',
    'vibrant saturated colors, dramatic lighting, eye-catching composition',
    'landscape 16:9 format, cinematic wide shot',
    'Indonesian historical scene, educational content for children',
    'highly detailed, no text overlay, no watermark, 4K quality',
  ].join(', ').substring(0, 900);

  log(`\n  🖼️  Thumbnail: ${prompt.substring(0, 80)}...`);

  const body = JSON.stringify({
    prompt,
    negative_prompt: 'blurry, low quality, text, watermark, ugly, distorted',
    modelId: 'aa77f04e-3eec-4034-9c07-d0f619684628',
    width: 1024, height: 576,
    num_images: 1,
    guidance_scale: 7,
    num_inference_steps: 10,
    public: false,
  });

  try {
    const tmpBody = `${BASE_DIR}/_tmp_thumb_body.json`;
    fs.writeFileSync(tmpBody, body, 'utf8');
    const genOut = execSync(
      `curl -s -X POST -H "Authorization: Bearer ${LEONARDO_KEY}" -H "Content-Type: application/json" -d @"${tmpBody}" "https://cloud.leonardo.ai/api/rest/v1/generations"`,
      { encoding:'utf8', timeout:30000, shell:'cmd.exe' }
    );
    try { fs.unlinkSync(tmpBody); } catch(e) {}

    const genRes = JSON.parse(genOut);
    if (!genRes.sdGenerationJob?.generationId) {
      warn(`Thumbnail Leonardo error: ${JSON.stringify(genRes).substring(0,80)}`);
      return null;
    }
    const genId = genRes.sdGenerationJob.generationId;
    log(`     Thumbnail Gen ID: ${genId.substring(0,16)}... | polling...`);

    for (let p = 0; p < 18; p++) {
      sleep(5000);
      const pollOut = execSync(
        `curl -s -H "Authorization: Bearer ${LEONARDO_KEY}" "https://cloud.leonardo.ai/api/rest/v1/generations/${genId}"`,
        { encoding:'utf8', timeout:15000, shell:'cmd.exe' }
      );
      const pollRes = JSON.parse(pollOut);
      const imgs = pollRes.generations_by_pk?.generated_images || [];
      if (imgs.length > 0 && imgs[0].url) {
        const thumbFile = `${outDir}/thumbnail.jpg`;
        const dlOk = downloadFile(imgs[0].url, thumbFile);
        if (dlOk) {
          ok(`Thumbnail OK (${Math.round(fs.statSync(thumbFile).size/1024)}KB) → thumbnail.jpg`);
          return thumbFile;
        }
      }
    }
    warn('Thumbnail Leonardo timeout');
    return null;
  } catch(e) {
    warn(`Thumbnail error: ${e.message.substring(0,80)}`);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────
//  KEN BURNS — Cinematic zoom/pan menggunakan scale+crop (stable)
//  Syntax: scale=iw:ih:eval=frame, scale='W':'H':eval=frame, crop
//  Terbukti bekerja di FFmpeg 8.x (diuji langsung)
// ────────────────────────────────────────────────────────────────
function buildKenBurns(sceneIdx, dur, w, h) {
  const fps = 24;
  const TF  = dur * fps;
  // 20% overscan supaya ada ruang gerak
  const OW  = Math.round(w * 1.22);
  const OH  = Math.round(h * 1.22);
  const PX  = OW - w;
  const PY  = OH - h;

  // ── Easing helpers (quadratic, nilai dalam pixel/frame) ─────
  // ease-in  zoom: mulai lambat, makin cepat  → n*n/TF
  // ease-out zoom: mulai cepat, makin lambat  → TF*(1-(TF-n)*(TF-n)/TF/TF)*px
  // linear (fallback): n/TF * totalPx
  const zxE = Math.max(1, Math.round((OW - w) / TF));  // px/frame zoom
  const zyE = Math.max(1, Math.round((OH - h) / TF));
  const pxE = Math.max(1, Math.round(PX / TF));
  const pyE = Math.max(1, Math.round(PY / TF));

  // ── Handheld shake parameters ────────────────────────────────
  // 3 profil: halus (A), sedang (B), kuat (C)
  const SHAKE = [
    { amp: 2.5, freq: 7  },   // A — hampir tidak terasa, subtle
    { amp: 3.5, freq: 5  },   // B — sedikit gerak tangan
    { amp: 2.0, freq: 11 },   // C — tremor frekuensi tinggi
  ];
  const sh  = SHAKE[sceneIdx % SHAKE.length];
  const sAx = sh.amp.toFixed(1);
  const sAy = (sh.amp * 0.7).toFixed(1);
  const sF  = sh.freq;

  // ── Rotation (tilt kecil, imersif) ──────────────────────────
  const TILTS = [0, 0.012, -0.010, 0.015, -0.008, 0.010, -0.015, 0];
  const tilt  = TILTS[sceneIdx % TILTS.length];  // radian — ≈0.5-0.86°

  // ── 8 patterns pakai easing + shake ─────────────────────────
  const patterns = [
    // 0: Zoom in ease-in + shake A
    { label: 'zoom-in-ease',
      w2: `${OW}-${zxE}*n*n/${TF}`,
      h2: `${OH}-${zyE}*n*n/${TF}`,
      cx: `(iw-${w})/2+${sAx}*sin(2*PI*n/${sF})`,
      cy: `(ih-${h})/2+${sAy}*cos(2*PI*n/${sF})` },
    // 1: Zoom out ease-out + pan kanan
    { label: 'zoom-out-pan-right',
      w2: `${w}+${zxE}*(${TF}-n)*(${TF}-n)/${TF}/${TF}*${OW - w}/${Math.max(1,zxE)}`,
      h2: `${h}+${zyE}*(${TF}-n)*(${TF}-n)/${TF}/${TF}*${OH - h}/${Math.max(1,zyE)}`,
      cx: `${pxE}*n+${sAx}*sin(2*PI*n/${sF+2})`,
      cy: `0+${sAy}*cos(2*PI*n/${sF})` },
    // 2: Pan kanan smooth + shake
    { label: 'pan-right-shake',
      w2: `${OW}`,
      h2: `${OH}`,
      cx: `${pxE}*n+${sAx}*sin(2*PI*n/${sF})`,
      cy: `${Math.round(PY/2)}+${sAy}*cos(2*PI*n/${sF+1})` },
    // 3: Zoom in + pan atas ease-in
    { label: 'zoom-in-pan-up',
      w2: `${OW}-${zxE}*n*n/${TF}`,
      h2: `${OH}-${zyE}*n*n/${TF}`,
      cx: `(iw-${w})/2+${sAx}*sin(2*PI*n/${sF})`,
      cy: `${PY}-${pyE}*n+${sAy}*sin(2*PI*n/${sF-1>1?sF-1:3})` },
    // 4: Zoom out pojok kiri bawah + shake
    { label: 'zoom-out-bottom-left',
      w2: `${w}+${zxE}*n`,
      h2: `${h}+${zyE}*n`,
      cx: `0+${sAx}*sin(2*PI*n/${sF})`,
      cy: `ih-${h}+${sAy}*cos(2*PI*n/${sF})` },
    // 5: Pan diagonal + shake lemah
    { label: 'diagonal-pan',
      w2: `${OW}`,
      h2: `${OH}`,
      cx: `${Math.round(pxE*0.7)}*n+${sAx}*sin(2*PI*n/${sF+3})`,
      cy: `${Math.round(pyE*0.7)}*n+${sAy}*cos(2*PI*n/${sF})` },
    // 6: Zoom in + pan kiri ease-in
    { label: 'zoom-in-pan-left',
      w2: `${OW}-${zxE}*n*n/${TF}`,
      h2: `${OH}-${zyE}*n*n/${TF}`,
      cx: `${PX}-${pxE}*n+${sAx}*sin(2*PI*n/${sF})`,
      cy: `(ih-${h})/2+${sAy}*cos(2*PI*n/${sF+1})` },
    // 7: Pan ke atas + shake halus
    { label: 'pan-up-shake',
      w2: `${OW}`,
      h2: `${OH}`,
      cx: `${Math.round(PX/2)}+${sAx}*sin(2*PI*n/${sF})`,
      cy: `${PY}-${pyE}*n+${sAy}*cos(2*PI*n/${sF})` },
  ];

  const p = patterns[sceneIdx % patterns.length];

  // ── Susun filter chain ────────────────────────────────────────
  const filterParts = [
    `scale=iw:ih:eval=frame`,
    `scale='${p.w2}':'${p.h2}':eval=frame:flags=lanczos`,
    `crop=${w}:${h}:'${p.cx}':'${p.cy}'`,
  ];

  // Tambah tilt ringan jika ada (tidak untuk scene 0 & 7 — biar steady)
  if (tilt !== 0) {
    filterParts.push(`rotate='${tilt}:fillcolor=black@0'`);
  }

  filterParts.push(`setsar=1`);

  return { filter: filterParts.join(','), label: p.label };
}

// Fade-in / Fade-out pada video clip
function buildFadeFilter(dur, fps = 24) {
  const fadeFrames = Math.min(8, Math.floor(fps * 0.35)); // ~0.35 detik
  const fadeInEnd  = fadeFrames / fps;
  const fadeOutStart = dur - (fadeFrames / fps);
  return `fade=t=in:st=0:d=${fadeInEnd.toFixed(3)},fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeInEnd.toFixed(3)}`;
}

// ────────────────────────────────────────────────────────────────
//  ASS SUBTITLE — Word-by-word, kata penting di-highlight
//  Upgrade: scale-up effect, SuperHighlight layer, shadow
// ────────────────────────────────────────────────────────────────
const HIGHLIGHT_WORDS = [
  'kerajaan','sultan','raja','ratu','maharaja','panglima','prajurit',
  'perang','merdeka','nusantara','maritim','armada','pelabuhan',
  'sriwijaya','majapahit','mataram','demak','singosari','kediri',
  'pajang','banten','ternate','tidore','gowa','aceh','cirebon',
  'gajah mada','hayam wuruk','ken arok','tribhuwana','raden wijaya',
  'diponegoro','sukarno','hatta','kartini','pattimura',
  'indonesia','nusantara','melayu','jawa','sumatera','kalimantan',
  'tahukah','fakta','mengejutkan','bersejarah','legendaris','terkuat',
  'terbesar','pertama kali','berhasil','rahasia','sumpah','janji',
];

// Super-highlight: lebih besar + kuning cerah + bold (untuk kata paling dramatis)
const SUPER_HIGHLIGHT_WORDS = [
  'tahukah','mengejutkan','luar biasa','wow','pertama kali',
  'terbesar','terkuat','rahasia','sumpah','tidak pernah',
  'ternyata','fakta','misteri',
];

function generateASSSubtitle(scenes, scenesAudio, outDir) {
  const toASSTime = (sec) => {
    const h  = Math.floor(sec / 3600);
    const m  = Math.floor((sec % 3600) / 60);
    const s  = Math.floor(sec % 60);
    const cs = Math.round((sec - Math.floor(sec)) * 100);
    return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  };

  // ── ASS styles ─────────────────────────────────────────────────
  // Shadow=2 di semua style, MarginV=80 (lebih ke bawah untuk sosmed)
  // Normal     : putih, ukuran 22, shadow 2
  // Highlight  : kuning, ukuran 27, bold, scale 115%, shadow 2
  // SuperHL    : cyan terang, ukuran 30, bold, scale 130%, shadow 3
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${VIDEO_W}
PlayResY: ${VIDEO_H}
WrapStyle: 1

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,Strikeout,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Normal,Arial,22,&H00FFFFFF,&H000000FF,&H00000000,&HBB000000,0,0,0,0,100,100,0.5,0,1,2.5,2,2,20,20,80,1
Style: Highlight,Arial,27,&H0000FFFF,&H000000FF,&H00000000,&HBB000000,-1,0,0,0,115,115,0.5,0,1,2.5,2,2,20,20,80,1
Style: SuperHL,Arial,30,&H00FFFF00,&H000000FF,&H00220022,&HBB000000,-1,0,0,0,130,130,0.5,0,1,3.0,3,2,20,20,80,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text`;

  const lines = [header];
  let cursor  = 0;
  let wordCount = 0;

  for (let i = 0; i < scenes.length; i++) {
    const dur     = scenesAudio[i]?.duration || scenes[i].dur || 10;
    const text    = (scenes[i].narration || '').trim();
    const words   = text.split(/\s+/).filter(Boolean);
    if (!words.length) { cursor += dur; continue; }

    const secPerWord = dur / words.length;

    words.forEach((word, wi) => {
      const wStart = cursor + wi * secPerWord;
      const wEnd   = Math.min(wStart + secPerWord * 1.18, cursor + dur);
      const cleanW = word.replace(/[^\w\s\u00C0-\u024F]/g, '').toLowerCase();

      const isSuper = SUPER_HIGHLIGHT_WORDS.some(k => cleanW.includes(k));
      const isKey   = !isSuper && HIGHLIGHT_WORDS.some(k => cleanW.includes(k));

      let style, display;
      if (isSuper) {
        style   = 'SuperHL';
        display = `{\\b1\\fscx130\\fscy130}${word}{\\r}`;
      } else if (isKey) {
        style   = 'Highlight';
        display = `{\\b1\\fscx115\\fscy115}${word}{\\b0\\r}`;
      } else {
        style   = 'Normal';
        display = word;
      }

      lines.push(`Dialogue: 0,${toASSTime(wStart)},${toASSTime(wEnd)},${style},,0,0,0,,${display}`);
      wordCount++;
    });

    cursor += dur;
  }

  const assPath = `${outDir}/subtitle.ass`;
  fs.writeFileSync(assPath, lines.join('\n'), 'utf8');
  ok(`subtitle.ass dibuat (word-by-word, ${wordCount} kata, ${scenes.length} scene, ${lines.length-1} cue)`);

  // Tetap simpan .srt sebagai cadangan
  generateSubtitleSRT(scenes, scenesAudio, outDir);
  return assPath;
}

function generateSubtitleSRT(scenes, scenesAudio, outDir) {
  const toSRTTime = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.round((sec - Math.floor(sec)) * 1000);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
  };

  let cursor = 0;
  const lines = [];
  for (let i = 0; i < scenes.length; i++) {
    const dur = scenesAudio[i]?.duration || scenes[i].dur || 10;
    const start = cursor;
    const end   = cursor + dur;
    const narration = scenes[i].narration || '';
    lines.push(`${i + 1}`);
    lines.push(`${toSRTTime(start)} --> ${toSRTTime(end)}`);
    lines.push(narration.trim());
    lines.push('');
    cursor = end;
  }

  const srtPath = `${outDir}/subtitle.srt`;
  fs.writeFileSync(srtPath, lines.join('\n'), 'utf8');
  ok(`subtitle.srt dibuat (${scenes.length} cue, ${Math.round(cursor)}s total)`);
  return srtPath;
}

// ────────────────────────────────────────────────────────────────
//  KLING AI — Image to Video
// ────────────────────────────────────────────────────────────────
function generateKlingJWT() {
  const header  = Buffer.from(JSON.stringify({ alg:'HS256', typ:'JWT' })).toString('base64url');
  const now     = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss:KLING_ACCESS, exp:now+1800, nbf:now-5 })).toString('base64url');
  const sig     = crypto.createHmac('sha256', KLING_SECRET).update(header+'.'+payload).digest('base64url');
  return header+'.'+payload+'.'+sig;
}

async function klingImageToVideo(imgFilePath, prompt, sceneNum) {
  if (!KLING_ACCESS || !KLING_SECRET) return null;
  try {
    const imgBuf = fs.readFileSync(imgFilePath);
    if (imgBuf.length < 5000) return null;

    const b64   = imgBuf.toString('base64');
    const token = generateKlingJWT();
    const body  = JSON.stringify({
      model_name: 'kling-v1-6',
      prompt: prompt.substring(0, 300),
      image: b64,
      duration: '5',
      cfg_scale: 0.5,
      mode: 'std'
    });

    const genRes = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.klingai.com',
        path: '/v1/videos/image2video',
        method: 'POST',
        headers: { 'Authorization':'Bearer '+token, 'Content-Type':'application/json', 'Content-Length':Buffer.byteLength(body) }
      }, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
      });
      req.on('error', reject); req.write(body); req.end();
    });

    if (genRes.code !== 0 || !genRes.data?.task_id) {
      warn(`Kling error: code=${genRes.code} msg=${genRes.message}`);
      return null;
    }

    const taskId = genRes.data.task_id;
    log(`     Kling task: ${taskId} | polling...`);

    for (let p = 0; p < 36; p++) {
      sleep(5000);
      const freshToken = generateKlingJWT();
      const pollRes = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: 'api.klingai.com',
          path: `/v1/videos/image2video/${taskId}`,
          method: 'GET',
          headers: { 'Authorization':'Bearer '+freshToken, 'Content-Type':'application/json' }
        }, (res) => {
          let d = ''; res.on('data', c => d += c);
          res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
        });
        req.on('error', reject); req.end();
      });

      const status   = pollRes.data?.task_status;
      const videoUrl = pollRes.data?.task_result?.videos?.[0]?.url;
      if (status === 'succeed' && videoUrl) { log(`     Kling selesai ✅`); return videoUrl; }
      if (status === 'failed') { warn(`Kling FAILED: ${pollRes.data?.task_status_msg}`); return null; }
    }
    warn(`Kling timeout`);
    return null;
  } catch(e) {
    warn(`Kling error: ${e.message.substring(0,80)}`);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────
//  TELEGRAM
// ────────────────────────────────────────────────────────────────
function tgSendMessage(text) {
  if (!TG_TOKEN || TG_TOKEN === 'SKIP') return;
  const tmpFile = `${BASE_DIR}/_tg_msg.json`.replace(/\//g,'\\');
  const buf = Buffer.from(JSON.stringify({ chat_id: TG_CHAT_ID, parse_mode:'HTML', text }), 'utf8');
  fs.writeFileSync(tmpFile, buf);
  try {
    execSync(`powershell -NoProfile -Command "$b=[System.IO.File]::ReadAllText('${tmpFile}',[System.Text.Encoding]::UTF8);Invoke-RestMethod -Uri 'https://api.telegram.org/bot${TG_TOKEN}/sendMessage' -Method POST -ContentType 'application/json;charset=utf-8' -Body $b"`,
      { encoding:'utf8', timeout:15000, shell:'cmd.exe' });
    try { fs.unlinkSync(tmpFile); } catch(e) {}
  } catch(e) { warn('Telegram message gagal'); }
}

function tgSendVideo(videoPath, caption) {
  if (!TG_TOKEN || TG_TOKEN === 'SKIP') return;
  const vidWin = videoPath.replace(/\//g,'\\');
  // Strip emoji & karakter non-ASCII agar aman di cmd.exe
  const safeCaption = caption.replace(/[^\x00-\x7F]/g, '').substring(0,1024).trim();
  try {
    // Pakai curl.exe eksplisit (bukan alias PowerShell Invoke-WebRequest)
    execSync(
      `curl.exe -s -F chat_id=${TG_CHAT_ID} -F "caption=${safeCaption}" -F video=@"${vidWin}" "https://api.telegram.org/bot${TG_TOKEN}/sendVideo"`,
      { shell:'cmd.exe', timeout:300000 }  // 5 menit untuk video besar
    );
    ok('Video terkirim ke Telegram!');
  } catch(e) { warn(`Telegram video gagal: ${e.message.substring(0,80)}`); }
}

function tgSendPhoto(photoPath, caption) {
  if (!TG_TOKEN || TG_TOKEN === 'SKIP') return;
  if (!photoPath || !fs.existsSync(photoPath)) return;
  const imgWin = photoPath.replace(/\//g,'\\');
  // Strip emoji & karakter non-ASCII agar aman di cmd.exe
  const safeCaption = caption.replace(/[^\x00-\x7F]/g, '').substring(0,1024).trim();
  try {
    // Pakai curl.exe eksplisit (bukan alias PowerShell Invoke-WebRequest)
    execSync(
      `curl.exe -s -F chat_id=${TG_CHAT_ID} -F "caption=${safeCaption}" -F photo=@"${imgWin}" "https://api.telegram.org/bot${TG_TOKEN}/sendPhoto"`,
      { shell:'cmd.exe', timeout:30000 }
    );
    ok('Thumbnail terkirim ke Telegram!');
  } catch(e) { warn(`Telegram photo gagal: ${e.message.substring(0,80)}`); }
}

// ────────────────────────────────────────────────────────────────
//  RENDER SATU VIDEO (1 episode)
// ────────────────────────────────────────────────────────────────
async function renderEpisode(jadwalItem) {
  const { hari, judul, era } = jadwalItem;
  const eraInfo  = ERA_STYLE[era] || ERA_STYLE['Hindu-Buddha'];
  const slugJudul = slugify(judul);
  const today    = new Date();
  const dd = String(today.getDate()).padStart(2,'0');
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const yyyy = today.getFullYear();
  const dateStr  = `${dd}_${mm}_${yyyy}`;

  const OUT_DIR  = `${BASE_DIR}/hari_${String(hari).padStart(2,'0')}_${slugJudul}`;
  const TMP_IMG  = `${OUT_DIR}/_tmp_img`;
  const TMP_AUD  = `${OUT_DIR}/_tmp_aud`;
  const TMP_CLIP = `${OUT_DIR}/_tmp_clip`;
  const TMP_MOT  = `${OUT_DIR}/_tmp_motion`;

  [OUT_DIR, TMP_IMG, TMP_AUD, TMP_CLIP, TMP_MOT].forEach(d => fs.mkdirSync(d, { recursive: true }));
  fs.mkdirSync(BASE_DIR, { recursive: true });

  log('\n');
  log('╔══════════════════════════════════════════════════╗');
  log(`║  📅 HARI ${String(hari).padStart(2,' ')} — ${judul.substring(0,38).padEnd(38,' ')} ║`);
  log(`║  🏛️  Era: ${era.padEnd(41,' ')} ║`);
  log('╚══════════════════════════════════════════════════╝');
  log('');

  // Cek apakah sudah pernah dibuat
  const finalVideo = `${OUT_DIR}/${slugJudul}.mp4`;
  if (fs.existsSync(finalVideo) && fs.statSync(finalVideo).size > 500000) {
    ok(`Hari ${hari} sudah ada: ${finalVideo}`);
    return true;
  }

  // ── STEP 0: Generate Script ─────────────────────────────────
  step('0/5', '📝  Generate script sejarah dari Groq AI...');
  const scriptFile = `${OUT_DIR}/script.json`;
  let SCRIPT;
  if (fs.existsSync(scriptFile)) {
    SCRIPT = JSON.parse(fs.readFileSync(scriptFile, 'utf8'));
    ok(`Script di-cache: ${scriptFile} (skip Groq AI)`);
  } else {
    SCRIPT = await generateScriptSejarah(jadwalItem, USE_LONG);
    if (!SCRIPT) { err('Script gagal dibuat, skip hari ini'); return false; }
    fs.writeFileSync(scriptFile, JSON.stringify(SCRIPT, null, 2), 'utf8');
    ok(`Script disimpan: ${scriptFile}`);
  }

  // ── STEP 1: TTS Audio ────────────────────────────────────────
  step('1/5', '🎙️  Generate audio narasi (Edge TTS / Microsoft Neural)...');
  const scenesAudio = [];
  let totalSec = 0;

  for (const s of SCRIPT.scenes) {
    const audioFile   = `${TMP_AUD}/scene${s.n}.mp3`;
    const audioExists = fs.existsSync(audioFile) && fs.statSync(audioFile).size > 1000;
    const ok2 = audioExists ? true : await generateTTSEdge(s.narration, audioFile);
    const dur  = ok2 ? getAudioDuration(audioFile) : Math.ceil(s.narration.split(' ').length * 0.42);
    const durFinal = Math.max(12, Math.ceil(dur + 0.8));
    totalSec += durFinal;
    ok(`Scene ${String(s.n).padStart(2,' ')} [${audioExists ? 'cached' : 'Edge TTS id-ID-ArdiNeural'}]: ${durFinal}s`);
    scenesAudio.push({ ...s, audioFile, audioOk: ok2, duration: durFinal });
  }
  log(`\n  📊 Total: ${Math.floor(totalSec/60)}m${totalSec%60}s\n`);

  // ── STEP 2: Gambar + Motion ──────────────────────────────────
  step('2/5', '🎨  Generate gambar historis + motion...');

  const hasKling = KLING_ACCESS && KLING_SECRET && KLING_ACCESS.length > 5;
  info(`Leonardo: ${LEONARDO_KEY ? '✅' : '❌'} | Kling AI: ${hasKling ? '✅' : '—'}`);

  const scenesImages = [];
  for (const s of scenesAudio) {
    const imgFile    = `${TMP_IMG}/scene${s.n}.jpg`;
    const motionFile = `${TMP_MOT}/scene${s.n}_motion.mp4`;
    let imgOk = false, imageId = null, motionOk = false;

    log(`\n  Scene ${s.n}: ${(s.visual || '').substring(0,50)}...`);

    // ── Cache: skip jika gambar sudah ada ──
    if (fs.existsSync(imgFile) && fs.statSync(imgFile).size > 10000) {
      imgOk = true;
      ok(`Scene ${s.n}: Gambar di-cache (${Math.round(fs.statSync(imgFile).size/1024)}KB) [skip Leonardo]`);
    }

    // Generate gambar Leonardo
    if (!imgOk && LEONARDO_KEY) {
      const imgResult = await leonardoGenerateImage(s, era);
      if (imgResult) {
        imgOk   = downloadFile(imgResult.imageUrl, imgFile);
        imageId = imgResult.imageId;
        if (imgOk) ok(`Scene ${s.n}: Gambar OK (${Math.round(fs.statSync(imgFile).size/1024)}KB)`);
      }
    }

    // Fallback: gambar placeholder bertema sejarah
    if (!imgOk) {
      const seed = `sejarah_${slugJudul}_${s.n}`;
      imgOk = downloadFile(`https://picsum.photos/seed/${seed}/576/1024`, imgFile);
      if (imgOk) ok(`Scene ${s.n}: Fallback OK`);
    }

    // Motion
    if (USE_MOTION && imgOk) {
      const keyScenes = [1, 5, SCRIPT.scenes.length];
      const doMotion  = MOTION_ALL || keyScenes.includes(s.n);
      if (doMotion) {
        if (hasKling) {
          const motionPrompt = buildSejarahPrompt(s, era);
          const mUrl = await klingImageToVideo(imgFile, motionPrompt, s.n);
          if (mUrl) {
            motionOk = downloadFile(mUrl, motionFile);
            if (motionOk) ok(`Scene ${s.n}: Kling motion OK! 🎬✨`);
          }
        }
        if (!motionOk) info(`Scene ${s.n}: gambar static (Kling perlu kredit)`);
      }
    }

    if (s.n < SCRIPT.scenes.length) sleep(3000);
    scenesImages.push({ ...s, imgFile, imgOk, motionFile, motionOk });
  }

  // ── Generate Thumbnail (16:9) ────────────────────────────────
  const thumbFile = `${OUT_DIR}/thumbnail.jpg`;
  let thumbnailPath = null;
  if (fs.existsSync(thumbFile) && fs.statSync(thumbFile).size > 10000) {
    thumbnailPath = thumbFile;
    ok(`Thumbnail di-cache (${Math.round(fs.statSync(thumbFile).size/1024)}KB) [skip Leonardo]`);
  } else {
    thumbnailPath = await generateThumbnail(SCRIPT, era, OUT_DIR);
  }

  // ── STEP 3: Render Clips FFmpeg (Cinematic Ken Burns) ───────
  step('3/5', '🎬  Render video clips (Ken Burns + Fade)...');

  const clipPaths = [];

  for (const s of scenesImages) {
    const clipOut  = `${TMP_CLIP}/clip${String(s.n).padStart(2,'0')}.mp4`;

    // Text overlay
    const isHook   = s.n === 1;
    const narEsc   = escTxt(s.narration);
    const hookEsc  = escTxt(SCRIPT.hook || judul);
    const labelEsc = escTxt(s.label || '');

    const { lines: narLines,  fontSize: narFontSize  } = wrapTxt(narEsc, VIDEO_W);
    const { lines: hookLines, fontSize: hookFontSize } = wrapTxt(hookEsc, VIDEO_W);

    const narSz  = Math.min(28, Math.max(18, narFontSize));
    const hookSz = Math.min(40, Math.max(26, hookFontSize + 6));
    const eraColor = eraInfo.accent || 'FFD700';
    const dur = s.duration;

    let textFilters = [];

    // Label era di pojok atas kiri
    textFilters.push(`drawbox=x=0:y=0:w=${VIDEO_W}:h=44:color=0x${eraInfo.bg}@0.85:t=fill`);
    textFilters.push(`drawtext=text='${escTxt(eraInfo.label)}':fontsize=18:fontcolor=0x${eraColor}:x=10:y=12:fontfile='${FONT_BOLD}'`);

    // Nomor scene pojok kanan atas
    textFilters.push(`drawbox=x=${VIDEO_W-60}:y=48:w=56:h=30:color=black@0.6:t=fill`);
    textFilters.push(`drawtext=text='${s.n}/${SCRIPT.scenes.length}':fontsize=18:fontcolor=white:x=${VIDEO_W-50}:y=54:fontfile='${FONT_NRM}'`);

    if (isHook) {
      // Scene 1: hook besar di tengah atas + narasi di bawah
      const hookH  = 60 + hookLines.length * (hookSz + 8) + 16;
      textFilters.push(`drawbox=x=0:y=52:w=${VIDEO_W}:h=${hookH}:color=0x${eraInfo.bg}@0.88:t=fill`);
      hookLines.forEach((ln, i) => {
        const y = 68 + i * (hookSz + 6);
        textFilters.push(`drawtext=text='${ln}':fontsize=${hookSz}:fontcolor=0x${eraColor}:borderw=3:bordercolor=black@0.9:x=(w-text_w)/2:y=${y}:fontfile='${FONT_BOLD}'`);
      });
      const subSz = Math.min(22, narSz - 4);
      const lineH2 = subSz + 8;
      const narH  = 14 + narLines.length * lineH2 + 10;
      const narY0 = 52 + hookH + 8;
      textFilters.push(`drawbox=x=0:y=${narY0}:w=${VIDEO_W}:h=${narH}:color=black@0.65:t=fill`);
      narLines.forEach((ln, i) => {
        const y = narY0 + 8 + i * lineH2;
        textFilters.push(`drawtext=text='${ln}':fontsize=${subSz}:fontcolor=#FFFDE7:borderw=2:bordercolor=black@0.7:x=(w-text_w)/2:y=${y}:fontfile='${FONT_NRM}'`);
      });
    } else {
      // Scene lain: narasi di bawah dengan background semi-transparan
      const lineH  = narSz + 8;
      const totalH = 20 + narLines.length * lineH + 16;
      const bgY    = VIDEO_H - totalH - 18;
      textFilters.push(`drawbox=x=0:y=${bgY}:w=${VIDEO_W}:h=${totalH + 20}:color=black@0.70:t=fill`);
      narLines.forEach((ln, i) => {
        const y     = bgY + 12 + i * lineH;
        const color = i === 0 ? 'white' : (i === 1 ? '#FFFDE7' : '#FFF9C4');
        const bw    = i === 0 ? 3 : 2;
        const font  = i === 0 ? FONT_BOLD : FONT_NRM;
        const sz    = i === 0 ? narSz : narSz - 2;
        textFilters.push(`drawtext=text='${ln}':fontsize=${sz}:fontcolor=${color}:borderw=${bw}:bordercolor=black@0.85:x=(w-text_w)/2:y=${y}:fontfile='${font}'`);
      });
      if (labelEsc) {
        textFilters.push(`drawbox=x=0:y=${VIDEO_H - (20 + narLines.length * (narSz + 8) + 16) - 18 - 32}:w=${VIDEO_W}:h=30:color=0x${eraInfo.bg}@0.75:t=fill`);
        textFilters.push(`drawtext=text='${labelEsc}':fontsize=17:fontcolor=0x${eraColor}:x=(w-text_w)/2:y=${VIDEO_H - (20 + narLines.length * (narSz + 8) + 16) - 18 - 28}:fontfile='${FONT_BOLD}'`);
      }
    }

    let cmd;

    if (s.motionOk) {
      // ── Sumber video Kling: scale + crop + teks overlay + fade ──
      const fadeFilter = buildFadeFilter(dur);
      const vf = [
        `scale=${VIDEO_W}:${VIDEO_H}:force_original_aspect_ratio=increase`,
        `crop=${VIDEO_W}:${VIDEO_H}`,
        `setsar=1`,
        ...textFilters,
        fadeFilter,
      ].join(',');
      cmd = `"${FFMPEG}" -y -i "${s.motionFile}" -i "${s.audioFile}" -vf "${vf}" -c:v libx264 -preset fast -crf 18 -b:v 2500k -maxrate 3500k -bufsize 7000k -pix_fmt yuv420p -r 24 -c:a aac -b:a 160k -shortest "${clipOut}"`;
    } else {
      // ── Sumber gambar statis: Ken Burns + teks overlay + fade ──
      const { filter: kbFilter, label: kbLabel } = buildKenBurns(s.n - 1, dur, VIDEO_W, VIDEO_H);
      const fadeFilter = buildFadeFilter(dur);
      const vf = [kbFilter, `setsar=1`, ...textFilters, fadeFilter].join(',');
      log(`     🎥 Ken Burns [${kbLabel}] dur=${dur}s`);
      cmd = `"${FFMPEG}" -y -loop 1 -framerate 24 -t ${dur + 0.5} -i "${s.imgFile}" -i "${s.audioFile}" -vf "${vf}" -c:v libx264 -preset fast -crf 18 -b:v 2500k -maxrate 3500k -bufsize 7000k -pix_fmt yuv420p -r 24 -c:a aac -b:a 160k -t ${dur} "${clipOut}"`;
    }

    try {
      execSync(cmd, { stdio:'pipe', timeout:120000, shell:'cmd.exe' });
    } catch(e) {
      // FFmpeg exit code 1 = warning non-fatal (bukan error sebenarnya)
      // Cek apakah file output tetap valid sebelum declare gagal
      const outputExists = fs.existsSync(clipOut) && fs.statSync(clipOut).size > 50000;
      if (!outputExists) {
        err(`Clip ${s.n} GAGAL: ${e.message.substring(0,120)}`);
        // Fallback: tanpa Ken Burns
        try {
          const vfSimple = [
            `scale=${VIDEO_W}:${VIDEO_H}:force_original_aspect_ratio=increase`,
            `crop=${VIDEO_W}:${VIDEO_H}`,
            `setsar=1`,
            ...textFilters,
          ].join(',');
          const cmdFallback = `"${FFMPEG}" -y -loop 1 -t ${dur} -i "${s.imgFile}" -i "${s.audioFile}" -vf "${vfSimple}" -c:v libx264 -preset fast -crf 18 -b:v 2500k -maxrate 3500k -bufsize 7000k -pix_fmt yuv420p -r 24 -c:a aac -b:a 160k -t ${dur} "${clipOut}"`;
          execSync(cmdFallback, { stdio:'pipe', timeout:90000, shell:'cmd.exe' });
          const kb = Math.round(fs.statSync(clipOut).size / 1024);
          ok(`Clip ${s.n} [fallback static]: ${dur}s → ${kb}KB`);
          clipPaths.push(clipOut);
        } catch(e2) {
          err(`Clip ${s.n} fallback juga GAGAL: ${e2.message.substring(0,80)}`);
        }
        continue;
      }
      // File valid → exit code 1 adalah warning biasa, lanjutkan
      log(`     ⚠️  Clip ${s.n} exit code 1 (FFmpeg warning, output valid)`);
    }
    if (fs.existsSync(clipOut) && fs.statSync(clipOut).size > 50000) {
      const kb = Math.round(fs.statSync(clipOut).size / 1024);
      ok(`Clip ${s.n} ${s.motionOk ? '🎬' : '🎥'}: ${dur}s → ${kb}KB`);
      clipPaths.push(clipOut);
    }
  }

  if (clipPaths.length === 0) { err('Tidak ada clip yang berhasil'); return false; }

  // ── Gabungkan semua clips dengan cross-dissolve transition ──
  const concatList = `${TMP_CLIP}/concat_list.txt`;
  fs.writeFileSync(concatList, clipPaths.map(p => `file '${path.resolve(p)}'`).join('\n'), 'utf8');
  log('\n  🔗 Menggabungkan semua clips...');

  try {
    execSync(
      `"${FFMPEG}" -y -f concat -safe 0 -i "${concatList}" -c:v libx264 -preset fast -crf 18 -b:v 2500k -maxrate 3500k -bufsize 7000k -pix_fmt yuv420p -c:a aac -b:a 160k "${finalVideo}"`,
      { stdio:'pipe', timeout:180000, shell:'cmd.exe' }
    );
    const mb = (fs.statSync(finalVideo).size / (1024*1024)).toFixed(2);
    ok(`Video final: ${mb} MB → ${finalVideo}`);
  } catch(e) {
    err(`Concat gagal: ${e.message.substring(0,100)}`);
    return false;
  }

  // ── STEP 4: Buat ASS Subtitle + Social Media Text ──────────
  step('4/5', '📝  Buat subtitle word-by-word + social_media.txt...');

  const motionCount = scenesImages.filter(s => s.motionOk).length;
  const ttsLabel    = 'Edge TTS id-ID-ArdiNeural';
  const imgLabel    = LEONARDO_KEY ? (motionCount > 0 ? `Leonardo AI + Kling Motion (${motionCount} scene)` : 'Leonardo AI') : 'Picsum Fallback';

  // ── Generate ASS subtitle word-by-word (+ SRT sebagai backup) ──
  const assPath = generateASSSubtitle(SCRIPT.scenes, scenesAudio, OUT_DIR);

  // ── Burn subtitle ke video final ──
  const assEsc = assPath.replace(/\\/g,'/').replace(/^([A-Z]):/, (_, d) => `${d}\\:`);
  const concatNoSub = finalVideo.replace('.mp4', '_nosub.mp4');

  // Rename video tanpa sub dulu, lalu burn subtitle
  try {
    fs.renameSync(finalVideo, concatNoSub);
    execSync(
      `"${FFMPEG}" -y -i "${concatNoSub}" -vf "ass='${assEsc}'" -c:v libx264 -preset fast -crf 18 -b:v 2500k -maxrate 3500k -bufsize 7000k -pix_fmt yuv420p -c:a copy "${finalVideo}"`,
      { stdio:'pipe', timeout:300000, shell:'cmd.exe' }
    );
    fs.unlinkSync(concatNoSub); // hapus file sementara
    const mb2 = (fs.statSync(finalVideo).size / (1024*1024)).toFixed(2);
    ok(`Subtitle word-by-word di-burn ke video: ${mb2} MB`);
  } catch(e) {
    // Jika burn subtitle gagal, pakai video tanpa subtitle
    warn(`Burn subtitle gagal (${e.message.substring(0,60)}), pakai video tanpa subtitle`);
    if (fs.existsSync(concatNoSub) && !fs.existsSync(finalVideo)) {
      fs.renameSync(concatNoSub, finalVideo);
    } else if (fs.existsSync(concatNoSub)) {
      fs.unlinkSync(concatNoSub);
    }
  }

  // ── Bangun hashtag 30+ (sejarah + trending) ──
  const BASE_TAGS_SEJARAH = [
    '#shorts', '#fyp', '#foryou', '#foryoupage', '#viral', '#trending',
    '#sejarahindonesia', '#kerajaannusantara', '#edukasianakid', '#faktasejarah',
    '#belajarsejarah', '#anakpintarid', '#edukasi', '#sejarah', '#indonesia',
    '#pendidikan', '#budayaindonesia', '#warisanbudaya', '#kerajaanindonesia',
    '#videoedukasi', '#faktaunik', '#kontenedukasi', '#sejarahseru',
    '#animasiclay', '#clayanimation', '#anakbelajar', '#sekolah',
    '#historicalfacts', '#nusantara', '#indonesianhistory', '#pendidikananak',
  ];
  const allTagsSejarah = [...new Set([...(SCRIPT.hashtags || []), ...BASE_TAGS_SEJARAH])];
  const tags30 = allTagsSejarah.slice(0, 30);
  const tags20 = allTagsSejarah.slice(0, 20);
  const tags15 = allTagsSejarah.slice(0, 15);

  // ── Full highlights — kalimat lengkap (no truncation) ──
  const highlights = SCRIPT.scenes.slice(0, 5)
    .map((s, i) => `  ${i+1}. ${s.narration.trim()}`)
    .join('\n');

  // ── Narasi lengkap scene 1-3 dan 1-5 ──
  const nar3  = SCRIPT.scenes.slice(0, 3).map(s => s.narration.trim()).join(' ');
  const nar5  = SCRIPT.scenes.slice(0, 5).map(s => s.narration.trim()).join(' ');
  const narAll = SCRIPT.scenes.map(s => s.narration.trim()).join(' ');

  const thumbEmoji = { 'Hindu-Buddha':'🏛️', 'Islam':'☪️', 'Penjajahan':'⚔️', 'Pergerakan':'✊', 'Kemerdekaan':'🇮🇩', 'Modern':'🌟' }[era] || '📚';
  const thumbColor = { 'Hindu-Buddha':'Emas & Merah', 'Islam':'Hijau & Emas', 'Penjajahan':'Biru & Merah', 'Pergerakan':'Ungu & Merah Muda', 'Kemerdekaan':'Merah & Putih', 'Modern':'Biru & Putih' }[era] || 'Merah & Emas';
  const tvMin  = Math.floor(totalSec / 60);
  const tvSec2 = String(totalSec % 60).padStart(2,'0');

  // ── YouTube title pilihan (max 100 karakter) ──
  const ytTitles = [
    `${thumbEmoji} ${SCRIPT.hook}`,
    `${judul} | Video Sejarah Anak Seru!`,
    `${thumbEmoji} ${judul} | Animasi Clay Sejarah Indonesia`,
    `Fakta Sejarah: ${judul} yang Bikin Kamu Takjub! ${thumbEmoji}`,
    `Hari ${hari}/30 Sejarah Indonesia: ${judul}`,
  ].map(t => t.substring(0, 100));

  // ── YouTube Tags array (max 500 karakter total) ──
  const ytTagsArr = [
    judul.toLowerCase(),
    era.toLowerCase(),
    'sejarah indonesia untuk anak',
    'kerajaan nusantara',
    'video edukasi sejarah anak sd',
    'animasi clay sejarah indonesia',
    'belajar sejarah seru',
    'sejarah indonesia',
    'edukasi anak indonesia',
    'fakta sejarah indonesia',
    'sejarah sd smp',
    'animasi edukasi',
    '30 hari sejarah indonesia',
    'clay animation history',
    'indonesian history for kids',
  ];

  // ── Deskripsi YouTube (full, no truncation) ──
  const ytDesc = [
    `${thumbEmoji} ${SCRIPT.hook}`,
    '',
    `Di video ini, anak-anak akan mengenal sejarah tentang ${judul} dengan cara yang seru dan menyenangkan melalui animasi clay yang berwarna-warni!`,
    '',
    `${nar3}`,
    '',
    `✅ APA YANG AKAN KAMU PELAJARI:`,
    highlights,
    '',
    `🏛️ Era Sejarah : ${era} | ${eraInfo.label}`,
    `📅 Seri        : 30 Hari Sejarah Indonesia — Hari ${hari}/30`,
    `🎬 Durasi      : ${tvMin} menit ${tvSec2} detik | ${SCRIPT.scenes.length} scene`,
    '',
    `🎯 Video ini cocok untuk:`,
    `  • Anak usia 7–14 tahun`,
    `  • Pelajaran IPS / Sejarah SD & SMP`,
    `  • Orang tua yang ingin ajak anak belajar sejarah`,
    `  • Guru sejarah yang butuh materi visual menarik`,
    '',
    `🔔 SUBSCRIBE & nyalakan notifikasi bel 🔔`,
    `  → Video sejarah baru setiap hari selama 30 hari!`,
    '',
    `👇 TONTON SERI LENGKAP 30 HARI SEJARAH INDONESIA:`,
    `  → Playlist: [tambahkan link playlist Anda]`,
    '',
    tags20.join(' '),
  ].join('\n');

  const socialLines = [
    '╔══════════════════════════════════════════════════════╗',
    `║   📱 SOCIAL MEDIA KIT — Hari ${String(hari).padStart(2,' ')}/30`,
    `║   🏛️  ${judul.substring(0, 50)}`,
    `║   🕰️  Era : ${era} | ${eraInfo.label}`,
    `║   🎬 Durasi: ${tvMin}:${tvSec2} | ${SCRIPT.scenes.length} scene | ${motionCount > 0 ? motionCount + ' motion' : 'static'}`,
    `║   🎙️  Voice : ${ttsLabel}`,
    `║   🎨 Gambar: ${imgLabel}`,
    '╚══════════════════════════════════════════════════════╝',
    '',
    '┌──────────────────────────────────────────────────────┐',
    '│  🖼️  THUMBNAIL                                       │',
    '└──────────────────────────────────────────────────────┘',
    '',
    thumbnailPath
      ? `✅ Thumbnail AI (Leonardo): ${thumbnailPath}`
      : `⚠️  Thumbnail AI tidak tersedia — buat manual`,
    '',
    `KONSEP A — DRAMATIS HISTORIS`,
    `  Teks utama  : "${judul.toUpperCase()}"`,
    `  Sub-teks    : "Fakta Sejarah Yang Mengejutkan!"`,
    `  Karakter    : ${SCRIPT.scenes[0]?.visual?.split(',')[0] || 'tokoh sejarah clay'} + ekspresi ${thumbEmoji}`,
    `  Background  : ${thumbColor} gradient dengan motif batik/ukiran`,
    `  Layout      : Tokoh 60% kiri, teks tebal 40% kanan, border emas`,
    '',
    `KONSEP B — PERTANYAAN HOOK`,
    `  Teks utama  : "${SCRIPT.hook}"`,
    `  Sub-teks    : "Jawabannya Bikin Kaget!"`,
    `  Gaya        : Latar keraton/istana clay, tanda tanya besar`,
    `  Warna       : ${thumbColor}, efek glow di teks`,
    `  Font        : Bold caps dengan shadow tebal`,
    '',
    `TOOLS THUMBNAIL: Canva | Adobe Express | CapCut PC`,
    '',
    '┌──────────────────────────────────────────────────────┐',
    '│  🎬 YOUTUBE & YOUTUBE SHORTS                         │',
    '└──────────────────────────────────────────────────────┘',
    '',
    '── JUDUL YOUTUBE (pilih salah satu, max 100 karakter) ──',
    ...ytTitles.map((t, i) => `${String.fromCharCode(65+i)}) ${t}`),
    '',
    '── DESKRIPSI YOUTUBE (copy-paste langsung) ──',
    '',
    ytDesc,
    '',
    '── TAGS YOUTUBE (copy-paste ke kolom tags) ──',
    ytTagsArr.join(', '),
    '',
    '── END SCREEN & CARD (saran) ──',
    `  • 0:00–0:03 : Animasi subscribe`,
    `  • Akhir     : Rekomendasikan episode sebelum/sesudah`,
    `  • Card popup: Muncul di detik ke-5`,
    '',
    '┌──────────────────────────────────────────────────────┐',
    '│  📸 INSTAGRAM (Feed & Reels)                         │',
    '└──────────────────────────────────────────────────────┘',
    '',
    '── CAPTION INSTAGRAM ──',
    '',
    `${thumbEmoji} ${SCRIPT.hook}`,
    '',
    nar5,
    '',
    `💡 Simpan & share ke teman-teman! Sejarah itu seru lho! 🎓`,
    `👇 Tag teman yang suka sejarah Indonesia!`,
    '',
    tags15.join(' '),
    '',
    '── ALT TEXT (aksesibilitas) ──',
    `Video animasi clay berjudul "${judul}" tentang sejarah Indonesia era ${era} untuk edukasi anak.`,
    '',
    '┌──────────────────────────────────────────────────────┐',
    '│  🎵 TIKTOK                                           │',
    '└──────────────────────────────────────────────────────┘',
    '',
    '── CAPTION TIKTOK ──',
    '',
    `${thumbEmoji} ${SCRIPT.hook} #sejarahindonesia #fyp`,
    '',
    SCRIPT.scenes[0]?.narration?.trim(),
    '',
    `Follow untuk lanjut 30 hari sejarah Indonesia! 👆`,
    '',
    tags20.join(' '),
    '',
    '── TIKTOK METADATA ──',
    `  Judul        : ${judul}`,
    `  Durasi       : ${tvMin}:${tvSec2} (target <60s untuk Shorts)`,
    `  Sound        : Gunakan gamelan/instrumen tradisional sebagai BGM`,
    `  Sticker      : Tambah sticker bendera Indonesia & teks sejarah`,
    `  Best post    : Senin–Jumat pukul 07:00–09:00 & 19:00–21:00 WIB`,
    '',
    '┌──────────────────────────────────────────────────────┐',
    '│  📊 META / SEO DATA                                  │',
    '└──────────────────────────────────────────────────────┘',
    '',
    `Topik utama   : ${judul}`,
    `Era sejarah   : ${era} | ${eraInfo.label}`,
    `Seri          : 30 Hari Sejarah Indonesia — Hari ${hari}/30`,
    `Genre konten  : Sejarah | Edukasi | Animasi Clay`,
    `Target usia   : 7–14 tahun`,
    `Bahasa        : Indonesia`,
    `Durasi video  : ${tvMin} menit ${tvSec2} detik`,
    `Total scene   : ${SCRIPT.scenes.length}`,
    `Subtitle SRT  : subtitle.srt (${SCRIPT.scenes.length} cue)`,
    thumbnailPath ? `Thumbnail     : thumbnail.jpg (Leonardo AI 1024×576)` : `Thumbnail     : —`,
    '',
    `SEO Keywords  :`,
    ...ytTagsArr.map(k => `  • ${k}`),
    '',
    `Kategori YT   : Education`,
    `Bahasa audio  : id-ID (Indonesia)`,
    `COPPA         : Made for kids`,
    `Subtitle      : subtitle.srt disertakan (${SCRIPT.scenes.length} cue, ${tvMin}m${tvSec2}s)`,
    '',
    '┌──────────────────────────────────────────────────────┐',
    '│  🎬 SCENE BREAKDOWN (narasi lengkap)                 │',
    '└──────────────────────────────────────────────────────┘',
    '',
    ...SCRIPT.scenes.map((s, i) => {
      const dur = scenesAudio[i]?.duration || s.dur || '?';
      const mv  = scenesImages[i]?.motionOk ? '[🎬motion]' : '[📷static]';
      const isDYK = /^(tahukah kamu|fakta tersembunyi|satu lagi fakta)/i.test(s.narration.trim());
      const dykBadge = isDYK ? ' 🔍 DID YOU KNOW' : '';
      return [
        `  Scene ${String(i+1).padStart(2,' ')} [${dur}s] ${mv}${dykBadge}`,
        `  Narasi : ${s.narration.trim()}`,
        `  Visual : ${(s.visual || s.image_prompt || '').trim()}`,
        `  Label  : ${s.label || ''}`,
        '',
      ].join('\n');
    }),
    '┌──────────────────────────────────────────────────────┐',
    '│  #️⃣  HASHTAG LENGKAP (30 tag)                       │',
    '└──────────────────────────────────────────────────────┘',
    '',
    tags30.join(' '),
    '',
    '┌──────────────────────────────────────────────────────┐',
    '│  ⚙️  PIPELINE INFO                                   │',
    '└──────────────────────────────────────────────────────┘',
    '',
    `Generated  : ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
    `Hari ke    : ${hari}/30`,
    `Script AI  : Groq llama-3.3-70b`,
    `Voice AI   : ${ttsLabel}`,
    `Image AI   : ${imgLabel}`,
    `Thumbnail  : ${thumbnailPath ? 'Leonardo AI (1024×576)' : '—'}`,
    `Subtitle   : subtitle.srt`,
    `Output dir : ${OUT_DIR}`,
    '─────────────────────────────────────────────────────',
  ];

  fs.writeFileSync(`${OUT_DIR}/social_media.txt`, socialLines.join('\n'), 'utf8');
  ok('social_media.txt dibuat');

  // ── Cleanup tmp ─────────────────────────────────────────────
  [TMP_IMG, TMP_AUD, TMP_CLIP, TMP_MOT].forEach(d => {
    try { fs.rmSync(d, { recursive: true, force: true }); ok(`Dihapus: ${path.basename(d)}/`); } catch(e) {}
  });

  // ── STEP 5: Kirim Telegram ───────────────────────────────────
  step('5/5', '📲  Kirim ke Telegram...');

  const tgMsg = `🏛️ <b>Hari ${hari}/30 — Sejarah Indonesia</b>\n<b>${judul}</b>\n\n${eraInfo.label}\n\n📊 ${SCRIPT.scenes.length} scene | ${Math.floor(totalSec/60)}m${totalSec%60}s | ${motionCount > 0 ? `${motionCount} scene animasi Kling` : 'gambar static'}\n\n✅ Siap upload ke TikTok/YouTube Shorts!`;
  tgSendMessage(tgMsg);

  // Kirim thumbnail dulu
  if (thumbnailPath && fs.existsSync(thumbnailPath)) {
    // Hindari emoji di caption curl.exe (encoding issue di Windows cmd)
    const thumbCaption = `Thumbnail Hari ${hari}/30 - ${judul} - Leonardo AI 1024x576`;
    tgSendPhoto(thumbnailPath, thumbCaption);
  }

  tgSendVideo(finalVideo.replace(/\//g,'\\'), `Hari ${hari}/30: ${judul}`);

  // Kirim social_media.txt
  const socialPath = `${OUT_DIR}/social_media.txt`.replace(/\//g,'\\');
  try {
    execSync(`curl.exe -s -F chat_id=${TG_CHAT_ID} -F document=@"${socialPath}" "https://api.telegram.org/bot${TG_TOKEN}/sendDocument"`,
      { shell:'cmd.exe', timeout:30000 });
    ok('social_media.txt terkirim!');
  } catch(e) {}

  // ── Summary ─────────────────────────────────────────────────
  log('');
  log('╔══════════════════════════════════════════════════╗');
  log(`║  ✅  HARI ${String(hari).padStart(2,' ')} SELESAI!                            ║`);
  log(`║  📁  ${slugJudul.substring(0,40).padEnd(40,' ')}  ║`);
  log(`║  🎬  ${(fs.statSync(finalVideo).size/(1024*1024)).toFixed(2)} MB | ${Math.floor(totalSec/60)}m${totalSec%60}s | ${clipPaths.length}/${SCRIPT.scenes.length} clips      ║`);
  log('╚══════════════════════════════════════════════════╝');

  return true;
}

// ────────────────────────────────────────────────────────────────
//  MAIN — Tentukan hari mana yang dijalankan
// ────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(BASE_DIR, { recursive: true });

  // ── Tampilkan list ─────────────────────────────────────────
  if (SHOW_LIST) {
    log('\n📋 DAFTAR 30 HARI KONTEN SEJARAH INDONESIA:');
    log('═'.repeat(70));
    JADWAL.jadwal_30_hari.forEach(j => {
      const check = fs.existsSync(`${BASE_DIR}/hari_${String(j.hari).padStart(2,'0')}_${slugify(j.judul)}/${slugify(j.judul)}.mp4`) ? '✅' : '⬜';
      log(`  ${check} Hari ${String(j.hari).padStart(2,' ')}: [${j.era.padEnd(12,' ')}] ${j.judul}`);
    });
    log('═'.repeat(70));
    const done = JADWAL.jadwal_30_hari.filter(j =>
      fs.existsSync(`${BASE_DIR}/hari_${String(j.hari).padStart(2,'0')}_${slugify(j.judul)}/${slugify(j.judul)}.mp4`)
    ).length;
    log(`\n  Progress: ${done}/30 hari selesai\n`);
    return;
  }

  // ── Tentukan hari ─────────────────────────────────────────
  let hariList = [];

  if (RUN_SEMUA) {
    // Generate semua 30 hari
    hariList = JADWAL.jadwal_30_hari.map(j => j.hari);
    log('\n🚀 Mode: SEMUA 30 HARI (akan membutuhkan waktu lama)');
  } else if (HARI_ARG) {
    // Paksa hari tertentu
    hariList = [HARI_ARG];
    log(`\n🎯 Mode: Paksa Hari ${HARI_ARG}`);
  } else {
    // Otomatis: cari hari yang belum dibuat
    const belumDibuat = JADWAL.jadwal_30_hari.filter(j =>
      !fs.existsSync(`${BASE_DIR}/hari_${String(j.hari).padStart(2,'0')}_${slugify(j.judul)}/${slugify(j.judul)}.mp4`)
    );

    if (belumDibuat.length === 0) {
      log('\n🎉 Semua 30 hari sudah selesai! Gunakan --list untuk melihat daftar.');
      return;
    }

    // Ambil hari berikutnya yang belum dibuat
    hariList = [belumDibuat[0].hari];
    log(`\n📅 Mode: Otomatis → Hari ${belumDibuat[0].hari} (${belumDibuat.length} hari tersisa)`);
  }

  // ── Jalankan ──────────────────────────────────────────────
  for (const hari of hariList) {
    const jadwalItem = JADWAL.jadwal_30_hari.find(j => j.hari === hari);
    if (!jadwalItem) { err(`Hari ${hari} tidak ditemukan di jadwal`); continue; }
    await renderEpisode(jadwalItem);
    if (RUN_SEMUA && hari < hariList[hariList.length-1]) {
      info('Jeda 10 detik antar episode...');
      sleep(10000);
    }
  }
}

main().catch(e => { err('Fatal: ' + e.message); process.exit(1); });
