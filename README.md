# AI Video Pipeline - Kids Edition

Pipeline otomatis generate konten video edukasi anak 2 menit.

## Output Per Video
Folder bundle: output/{pipeline_id}/video, images, audio, social_media.txt

## Spesifikasi
- Durasi: ~2 menit (10 scene x 12 detik)
- Resolusi: 576x1024 (9:16 Shorts)
- Style: Clay animation + sayuran/buah lucu
- Audio: Edge TTS gratis
- Overlay: Teks narasi per scene

## Setup
1. npm install -g n8n
2. pip install edge-tts
3. Isi config/env_variables.txt
4. n8n start + import workflows/ai_video_pipeline.json
