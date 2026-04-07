#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  gen_content.js — Generate jadwal konten AI via Groq
//  Dipanggil dari gen_content.ps1
//  Usage: node gen_content.js --tema "Sejarah Islam" --hari 30 --bulan 5 --tahun 2026 --output content/...json
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── Parse args ────────────────────────────────────────────────────────────────
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) {
    const key = process.argv[i].slice(2);
    args[key] = process.argv[i + 1] || true;
    i++;
  }
}

const TEMA       = args.tema    || 'Sejarah Kerajaan Indonesia';
const HARI       = parseInt(args.hari)   || 30;
const BULAN      = parseInt(args.bulan)  || new Date().getMonth() + 1;
const TAHUN      = parseInt(args.tahun)  || new Date().getFullYear();
const OUTPUT     = args.output  || `content/sejarah_kerajaan/${BULAN}_${TAHUN}.json`;
const GROQ_KEY   = process.env.GROQ_API_KEY || '';

const NAMA_BULAN = ['','Januari','Februari','Maret','April','Mei','Juni',
                    'Juli','Agustus','September','Oktober','November','Desember'];

if (!GROQ_KEY) {
  console.error('❌  GROQ_API_KEY tidak ada!');
  process.exit(1);
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function httpsPost(host, path, headers, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: host, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) { const t = Date.now(); while (Date.now() - t < ms) {} }

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🤖  Generate ${HARI} topik untuk tema: "${TEMA}"`);
  console.log(`📅  Periode: ${NAMA_BULAN[BULAN]} ${TAHUN}\n`);

  const systemPrompt = `Kamu adalah content planner untuk channel YouTube/TikTok edukasi anak Indonesia.
Buat jadwal konten ${HARI} hari untuk tema: "${TEMA}".
Setiap topik harus:
- Menarik untuk anak usia 6-14 tahun
- Judul mengandung kata seru (!, ?, atau emoji)
- Beragam sub-topik, tidak repetitif
- Ada hook yang membuat penonton penasaran

WAJIB return JSON valid tanpa markdown, dengan format persis ini:
{
  "channel": "nama channel",
  "tema": "${TEMA}",
  "bulan": ${BULAN},
  "tahun": ${TAHUN},
  "deskripsi": "deskripsi channel 1 kalimat",
  "gaya_narasi": "deskripsi gaya narasi",
  "gaya_visual": "deskripsi gaya visual",
  "hashtags_tetap": ["#hashtag1","#hashtag2","#hashtag3","#hashtag4","#hashtag5"],
  "jadwal_${HARI}_hari": [
    { "hari": 1, "judul": "...", "topik_groq": "penjelasan detail untuk AI...", "era": "...", "genre": "history", "thumbnail_warna": "gold" },
    ... total ${HARI} item
  ]
}

Untuk field "era", gunakan: Hindu-Buddha | Islam | Penjajahan | Pergerakan | Kemerdekaan | Modern | Sains | Alam | Budaya (sesuai tema)
Untuk "thumbnail_warna": gold | merah | biru | hijau | kuning | putih | abu | hitam | coklat`;

  const userPrompt = `Buat jadwal ${HARI} hari untuk tema "${TEMA}" bulan ${NAMA_BULAN[BULAN]} ${TAHUN}.
Pastikan topik-topik tersebar merata, dari yang paling populer hingga fakta tersembunyi.
Setiap "topik_groq" harus detail (2-3 kalimat) agar AI bisa generate script yang kaya.`;

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`⏳  Retry ${attempt}/5 setelah 60 detik...`);
        sleep(60000);
      }

      const res = await httpsPost(
        'api.groq.com',
        '/openai/v1/chat/completions',
        { 'Authorization': `Bearer ${GROQ_KEY}` },
        JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 6000,
          temperature: 0.85
        })
      );

      if (res.status === 429) {
        console.log(`⚠️   Rate limit (429), attempt ${attempt}/5`);
        continue;
      }
      if (res.status !== 200) {
        console.error(`❌  Groq error ${res.status}:`, res.body);
        process.exit(1);
      }

      const content = res.body.choices?.[0]?.message?.content || '';
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let jadwal;
      try {
        jadwal = JSON.parse(cleaned);
      } catch (e) {
        console.error('❌  JSON parse error:', e.message);
        console.error('Raw:', cleaned.substring(0, 500));
        continue;
      }

      // Normalize key jadwal (bisa jadwal_30_hari atau jadwal_15_hari dll)
      const jadwalKey = Object.keys(jadwal).find(k => k.startsWith('jadwal_'));
      if (!jadwalKey || !jadwal[jadwalKey]?.length) {
        console.error('❌  Format JSON tidak valid — tidak ada jadwal_*_hari');
        continue;
      }

      // Normalize ke key standar "jadwal_30_hari" agar compatible dengan run_sejarah.js
      if (jadwalKey !== 'jadwal_30_hari') {
        jadwal.jadwal_30_hari = jadwal[jadwalKey];
        delete jadwal[jadwalKey];
      }

      // Tambah metadata
      jadwal.bulan  = BULAN;
      jadwal.tahun  = TAHUN;
      jadwal.dibuat = new Date().toISOString();

      // Simpan output
      const outDir = path.dirname(OUTPUT);
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(OUTPUT, JSON.stringify(jadwal, null, 2), 'utf8');

      console.log(`✅  Berhasil generate ${jadwal.jadwal_30_hari.length} topik!`);
      console.log(`📋  Preview 3 topik pertama:`);
      jadwal.jadwal_30_hari.slice(0, 3).forEach(j => {
        console.log(`   Hari ${j.hari}: ${j.judul}`);
      });
      console.log(`\n💾  Disimpan: ${OUTPUT}`);
      process.exit(0);

    } catch (e) {
      console.error(`❌  Error attempt ${attempt}:`, e.message);
      if (attempt < 5) sleep(15000);
    }
  }

  console.error('❌  Gagal setelah 5x retry');
  process.exit(1);
}

main();
