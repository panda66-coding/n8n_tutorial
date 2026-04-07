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
 * ╚══════════════════════════════════════════════════════════════╝
 */

const { execSync } = require('child_process');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ── PATHS ──────────────────────────────────────────────────────
const FFMPEG    = 'C:/Users/User/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffmpeg.exe';
const FFPROBE   = 'C:/Users/User/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1-full_build/bin/ffprobe.exe';
const FONT_BOLD = 'C\\:/Windows/Fonts/arialbd.ttf';
const FONT_NRM  = 'C\\:/Windows/Fonts/arial.ttf';
const BASE_DIR  = 'E:/tutorial_n8n/output/sejarah';
const JADWAL    = JSON.parse(fs.readFileSync('E:/tutorial_n8n/content/sejarah_kerajaan_30hari.json', 'utf8'));

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

// ── VIDEO SETTINGS ─────────────────────────────────────────────
const VIDEO_W = 576;
const VIDEO_H = 1024;

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
function sleep(ms){ execSync(`ping -n ${Math.ceil(ms/1000)+1} 127.0.0.1 > nul`, { shell:'cmd.exe', timeout:ms+5000 }); }

function slugify(s) {
  return s.toLowerCase()
    .replace(/[àáâã]/g,'a').replace(/[èéêë]/g,'e').replace(/[ìíîï]/g,'i')
    .replace(/[òóôõ]/g,'o').replace(/[ùúûü]/g,'u')
    .replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,'_').replace(/_+/g,'_').trim().substring(0,40);
}

function getAudioDuration(f) {
  try {
    const out = execSync(`"${FFPROBE}" -v quiet -show_entries format=duration -of csv=p=0 "${f}"`,
      { encoding:'utf8', timeout:8000 });
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
// ────────────────────────────────────────────────────────────────
async function generateScriptSejarah(jadwalItem) {
  if (!GROQ_KEY) { warn('Groq key tidak ada'); return null; }

  info(`Groq AI: generate script "${jadwalItem.judul}"...`);

  const systemPrompt = `Kamu adalah pendongeng sejarah Indonesia yang jenius untuk anak-anak.
Kamu membuat konten video edukasi sejarah yang seru, mengejutkan, dan mudah dipahami anak usia 7-14 tahun.
Gaya: Seperti teman bermain yang bercerita, bukan guru yang membosankan.
Bahasa: Indonesia yang hidup, penuh semangat, sesekali kata seru seperti "Wow!", "Luar biasa!", "Tahukah kamu?".
Selalu hubungkan fakta sejarah dengan kehidupan anak-anak sehari-hari agar mudah dipahami.

PENTING — Untuk setiap scene, buat image_prompt yang SANGAT DETAIL seperti contoh CapCut:
CONTOH BAGUS: "Raja muda berambut hitam panjang, mahkota emas berukir teratai, jubah sutra merah bordiran emas, duduk di singgasana kayu jati, istana berdinding batu bata merah, pilar ukir tinggi, lampu minyak berkelip hangat, prajurit berseragam di samping, clay animation style, 3D claymation render, soft plasticine texture, smooth shiny surface, bright cheerful colors, cute chibi characters, miniature world feel, highly detailed, 8K"
CONTOH BURUK (JANGAN): "raja kerajaan, clay style" ← terlalu generik!

image_prompt harus mengandung:
1. Nama tokoh + ciri fisik spesifik (warna baju, mahkota, rambut)
2. Setting lokasi + detail arsitektur atau alam (warna, tekstur, bahan)
3. Suasana/pencahayaan (pagi/siang/malam, api, matahari, dll)
4. SELALU akhiri dengan: clay animation style, 3D claymation render, soft plasticine texture, smooth shiny surface, bright cheerful colors, cute chibi characters, miniature world feel, highly detailed, 8K`;

  const userPrompt = `Buat script video sejarah SERU berjudul: "${jadwalItem.judul}"

Topik detail: ${jadwalItem.topik_groq}
Era: ${jadwalItem.era}

Format JSON berikut (WAJIB):
{
  "topic": "${jadwalItem.judul}",
  "hook": "pertanyaan atau fakta mengejutkan max 15 kata untuk hook pembuka",
  "genre": "history",
  "era": "${jadwalItem.era}",
  "hashtags": ["#sejarahindonesia","#kerajaannusantara","#edukasianakid","#faktasejarah","#belajarsejarah","#anakpintarid"],
  "scenes": [
    {
      "n": 1,
      "dur": 14,
      "emo": "excited",
      "narration": "WAJIB 35-45 kata. Kalimat hook yang langsung menarik perhatian anak dengan fakta mengejutkan tentang topik ini. Awali dengan pertanyaan atau fakta yang membuat anak-anak terkejut dan penasaran.",
      "label": "JUDUL SCENE CAPS MAX 26 KARAKTER",
      "image_prompt": "WAJIB DETAIL — nama tokoh spesifik + ciri fisik + warna kostum + lokasi arsitektur detail + suasana pencahayaan + clay animation style, 3D claymation render, soft plasticine texture, smooth shiny surface, bright cheerful colors, cute chibi characters, miniature world feel, highly detailed, 8K, no text, no watermark",
      "visual": "deskripsi singkat gambar max 12 kata untuk referensi internal"
    }
  ]
}

RULES PENTING:
1. TEPAT 10 scene
2. narration WAJIB 35-45 kata setiap scene (hitung! jangan kurang)
3. Scene 1: hook yang mengejutkan
4. Scene 2-3: latar belakang & fakta unik
5. Scene 4-6: kisah utama paling seru & dramatis  
6. Scene 7-8: dampak & pengaruh hingga kini
7. Scene 9: fakta tersembunyi yang jarang diketahui
8. Scene 10: penutup inspiratif untuk anak-anak
9. image_prompt: BAHASA INGGRIS, SANGAT DETAIL, sebutkan nama tokoh + warna + setting + clay style tags
10. image_prompt setiap scene HARUS BERBEDA (jangan copy paste, beda pose/lokasi/aktivitas)
11. JSON SAJA, TANPA markdown`;

  try {
    const res = await httpsPost('api.groq.com', '/openai/v1/chat/completions',
      { 'Authorization': `Bearer ${GROQ_KEY}` },
      JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 4500,
        temperature: 0.85
      })
    );

    if (res.status !== 200) { warn(`Groq error ${res.status}`); return null; }

    const content = res.body.choices?.[0]?.message?.content || '';
    const cleaned = content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    const script  = JSON.parse(cleaned);

    if (!script.scenes || script.scenes.length < 5) { warn('Script kurang lengkap'); return null; }

    ok(`Script: "${script.topic}" (${script.scenes.length} scene)`);
    return script;
  } catch(e) {
    warn(`Groq gagal: ${e.message.substring(0,100)}`);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────
//  EDGE TTS — Narasi Audio
// ────────────────────────────────────────────────────────────────
function generateTTSEdge(text, destPath) {
  const txtFile = destPath.replace('.mp3', '_tmp.txt');
  fs.writeFileSync(txtFile, text, 'utf8');
  try {
    execSync(`python -m edge_tts --voice "id-ID-ArdiNeural" --file "${txtFile}" --write-media "${destPath}"`,
      { encoding:'utf8', timeout:30000 });
    try { fs.unlinkSync(txtFile); } catch(e) {}
    return fs.existsSync(destPath) && fs.statSync(destPath).size > 1000;
  } catch(e) { try { fs.unlinkSync(txtFile); } catch(e2) {} return false; }
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
  // Prioritas utama: image_prompt detail dari Groq (gaya CapCut)
  if (scene.image_prompt && scene.image_prompt.trim().length > 50) {
    // Pastikan selalu ada clay style tags di akhir
    const base = scene.image_prompt.trim();
    const clayTags = 'clay animation style, 3D claymation render, soft plasticine texture, smooth shiny surface, bright cheerful colors, cute chibi characters, miniature world feel, highly detailed, 8K, no text, no watermark';
    // Jika sudah mengandung clay tags, pakai apa adanya
    if (base.toLowerCase().includes('clay animation')) {
      return base.substring(0, 900);
    }
    // Jika belum, tambahkan clay tags
    return (base + ', ' + clayTags).substring(0, 900);
  }

  // Fallback: bangun prompt dari visual + era style (untuk kompatibilitas mundur)
  const visual   = (scene.visual || '').trim();
  const keywords = (scene.keywords || []).slice(0, 4).join(', ');

  const eraStyle = {
    'Hindu-Buddha': 'ancient Javanese temple, gold ornaments, lotus motifs, batik patterns, red brick walls',
    'Islam':        'Islamic geometric art, mosque architecture, Arabic calligraphy, green gold colors',
    'Penjajahan':   'colonial era Indonesia, Dutch East Indies, sepia warm tones, historical',
    'Pergerakan':   'Indonesian independence movement, red white flag colors, heroic pose',
    'Kemerdekaan':  'Indonesian independence 1945, red white flag, heroic moment, patriotic',
    'Modern':       'modern Indonesia, Garuda Pancasila, colorful batik, diverse happy people',
  };

  return [
    visual,
    keywords,
    eraStyle[era] || 'ancient Indonesian kingdom',
    'clay animation style, 3D claymation render, soft plasticine texture, smooth shiny surface',
    'bright cheerful colors, cute chibi characters, miniature world feel',
    'highly detailed, 8K, no text, no watermark',
    'portrait 9:16 vertical'
  ].filter(Boolean).join(', ').substring(0, 900);
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
    width: 576, height: 1024,
    num_images: 1,
    guidance_scale: 7,
    num_inference_steps: 30,
    presetStyle: 'ILLUSTRATION',
    alchemy: true,
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
      { encoding:'utf8', timeout:15000 });
    try { fs.unlinkSync(tmpFile); } catch(e) {}
  } catch(e) { warn('Telegram message gagal'); }
}

function tgSendVideo(videoPath, caption) {
  if (!TG_TOKEN || TG_TOKEN === 'SKIP') return;
  const vidWin = videoPath.replace(/\//g,'\\');
  try {
    execSync(`curl -s -F chat_id=${TG_CHAT_ID} -F "caption=${caption.substring(0,1024)}" -F video=@"${vidWin}" "https://api.telegram.org/bot${TG_TOKEN}/sendVideo"`,
      { shell:'cmd.exe', timeout:120000 });
    ok('Video terkirim ke Telegram!');
  } catch(e) { warn('Telegram video gagal'); }
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
  const SCRIPT = await generateScriptSejarah(jadwalItem);

  if (!SCRIPT) { err('Script gagal dibuat, skip hari ini'); return false; }

  // Simpan script
  fs.writeFileSync(`${OUT_DIR}/script.json`, JSON.stringify(SCRIPT, null, 2), 'utf8');
  ok(`Script disimpan: ${OUT_DIR}/script.json`);

  // ── STEP 1: TTS Audio ────────────────────────────────────────
  step('1/5', '🎙️  Generate audio narasi...');
  const scenesAudio = [];
  let totalSec = 0;

  for (const s of SCRIPT.scenes) {
    const audioFile = `${TMP_AUD}/scene${s.n}.mp3`;
    const ok2 = generateTTSEdge(s.narration, audioFile);
    const dur  = ok2 ? getAudioDuration(audioFile) : Math.ceil(s.narration.split(' ').length * 0.42);
    const durFinal = Math.max(12, Math.ceil(dur + 0.8));
    totalSec += durFinal;
    ok(`Scene ${String(s.n).padStart(2,' ')} [Edge TTS]: ${durFinal}s`);
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

    // Generate gambar Leonardo
    if (LEONARDO_KEY) {
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

  // ── STEP 3: Render Clips FFmpeg ──────────────────────────────
  step('3/5', '🎬  Render video clips...');

  const clipPaths = [];

  for (const s of scenesImages) {
    const clipOut  = `${TMP_CLIP}/clip${String(s.n).padStart(2,'0')}.mp4`;
    const inputSrc = s.motionOk ? s.motionFile : s.imgFile;
    const inputArg = s.motionOk
      ? `-i "${inputSrc}"`
      : `-loop 1 -t ${s.duration} -i "${inputSrc}"`;

    // Text overlay
    const isHook   = s.n === 1;
    const narEsc   = escTxt(s.narration);
    const hookEsc  = escTxt(SCRIPT.hook || judul);
    const labelEsc = escTxt(s.label || '');

    const { lines: narLines,  fontSize: narFontSize  } = wrapTxt(narEsc, VIDEO_W);
    const { lines: hookLines, fontSize: hookFontSize } = wrapTxt(hookEsc, VIDEO_W);

    const narSz  = Math.min(28, Math.max(18, narFontSize));
    const hookSz = Math.min(40, Math.max(26, hookFontSize + 6));

    // Warna label era (atas kiri)
    const eraColor = eraInfo.accent || 'FFD700';

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

      // Narasi kecil di bawah hook
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

      // Label scene di tengah bawah (kecil)
      if (labelEsc) {
        textFilters.push(`drawbox=x=0:y=${bgY - 32}:w=${VIDEO_W}:h=30:color=0x${eraInfo.bg}@0.75:t=fill`);
        textFilters.push(`drawtext=text='${labelEsc}':fontsize=17:fontcolor=0x${eraColor}:x=(w-text_w)/2:y=${bgY - 28}:fontfile='${FONT_BOLD}'`);
      }
    }

    const vfBase = s.motionOk
      ? `scale=576:1024:force_original_aspect_ratio=increase,crop=576:1024,setsar=1`
      : `scale=576:1024:force_original_aspect_ratio=increase,crop=576:1024,setsar=1`;

    const vf  = [vfBase, ...textFilters].join(',');
    const dur = s.duration;

    const cmd = s.motionOk
      ? `"${FFMPEG}" -y ${inputArg} -i "${s.audioFile}" -vf "${vf}" -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -r 24 -c:a aac -b:a 128k -shortest "${clipOut}"`
      : `"${FFMPEG}" -y ${inputArg} -i "${s.audioFile}" -vf "${vf}" -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p -r 24 -c:a aac -b:a 128k -t ${dur} "${clipOut}"`;

    try {
      execSync(cmd, { stdio:'pipe', timeout:90000 });
      const kb = Math.round(fs.statSync(clipOut).size / 1024);
      ok(`Clip ${s.n} ${s.motionOk ? '🎬' : '🖼️'}: ${dur}s → ${kb}KB`);
      clipPaths.push(clipOut);
    } catch(e) {
      err(`Clip ${s.n} GAGAL: ${e.message.substring(0,80)}`);
    }
  }

  if (clipPaths.length === 0) { err('Tidak ada clip yang berhasil'); return false; }

  // ── Gabungkan semua clips ───────────────────────────────────
  const concatList = `${TMP_CLIP}/concat_list.txt`;
  fs.writeFileSync(concatList, clipPaths.map(p => `file '${path.resolve(p)}'`).join('\n'), 'utf8');
  log('\n  🔗 Menggabungkan semua clips...');

  try {
    execSync(
      `"${FFMPEG}" -y -f concat -safe 0 -i "${concatList}" -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -c:a aac -b:a 128k "${finalVideo}"`,
      { stdio:'pipe', timeout:180000 }
    );
    const mb = (fs.statSync(finalVideo).size / (1024*1024)).toFixed(2);
    ok(`Video final: ${mb} MB → ${finalVideo}`);
  } catch(e) {
    err(`Concat gagal: ${e.message.substring(0,100)}`);
    return false;
  }

  // ── STEP 4: Buat Social Media Text ──────────────────────────
  step('4/5', '📝  Buat social_media.txt...');

  const motionCount = scenesImages.filter(s => s.motionOk).length;
  const hashtags    = [...(SCRIPT.hashtags || []), '#shorts', '#sejarahindonesia', '#kerajaannusantara'].slice(0,12).join(' ');

  const socialText = `🏛️ ${judul}

${SCRIPT.hook || judul}

📚 Apa yang kamu pelajari hari ini:
${SCRIPT.scenes.slice(0,5).map((s,i) => `${i+1}. ${s.narration.split(' ').slice(0,8).join(' ')}...`).join('\n')}

⚡ Fakta unik: ${SCRIPT.scenes[8]?.narration?.substring(0,100) || ''}...

📅 Hari ke-${hari} dari 30 Hari Sejarah Indonesia
${hashtags}

---
🎬 Tech: ${motionCount > 0 ? `Kling AI (${motionCount} scene animasi)` : 'Leonardo AI + FFmpeg'}
🎙️ Narasi: Edge TTS id-ID-ArdiNeural
🤖 Script: Groq AI llama-3.3-70b`;

  fs.writeFileSync(`${OUT_DIR}/social_media.txt`, socialText, 'utf8');
  ok('social_media.txt dibuat');

  // ── Cleanup tmp ─────────────────────────────────────────────
  [TMP_IMG, TMP_AUD, TMP_CLIP, TMP_MOT].forEach(d => {
    try { fs.rmSync(d, { recursive: true, force: true }); ok(`Dihapus: ${path.basename(d)}/`); } catch(e) {}
  });

  // ── STEP 5: Kirim Telegram ───────────────────────────────────
  step('5/5', '📲  Kirim ke Telegram...');

  const tgMsg = `🏛️ <b>Hari ${hari}/30 — Sejarah Indonesia</b>\n<b>${judul}</b>\n\n${eraInfo.label}\n\n📊 ${SCRIPT.scenes.length} scene | ${Math.floor(totalSec/60)}m${totalSec%60}s | ${motionCount > 0 ? `${motionCount} scene animasi Kling` : 'gambar static'}\n\n✅ Siap upload ke TikTok/YouTube Shorts!`;
  tgSendMessage(tgMsg);
  tgSendVideo(finalVideo.replace(/\//g,'\\'), `Hari ${hari}/30: ${judul}`);

  // Kirim social_media.txt
  const socialPath = `${OUT_DIR}/social_media.txt`.replace(/\//g,'\\');
  try {
    execSync(`curl -s -F chat_id=${TG_CHAT_ID} -F document=@"${socialPath}" "https://api.telegram.org/bot${TG_TOKEN}/sendDocument"`,
      { shell:'cmd.exe', timeout:30000 });
    ok('social_media.txt terkirim!');
  } catch(e) {}

  // ── Summary ─────────────────────────────────────────────────
  log('');
  log('╔══════════════════════════════════════════════════╗');
  log(`║  ✅  HARI ${String(hari).padStart(2,' ')} SELESAI!                            ║`);
  log(`║  📁  ${slugJudul.substring(0,40).padEnd(40,' ')}  ║`);
  log(`║  🎬  ${(fs.statSync(finalVideo).size/(1024*1024)).toFixed(2)} MB | ${Math.floor(totalSec/60)}m${totalSec%60}s | ${clipPaths.length}/10 clips     ║`);
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
