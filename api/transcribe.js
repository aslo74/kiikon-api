import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const audioFile = files.audio?.[0];
    const language = fields.language?.[0] || 'fr';

    if (!audioFile) return res.status(400).json({ error: 'No audio file provided' });

    const audioBuffer = fs.readFileSync(audioFile.filepath);

    // Native FormData + fetch (Node 18+, disponible sur Vercel)
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: audioFile.mimetype || 'audio/m4a' });
    formData.append('file', blob, 'audio.m4a');
    formData.append('model', 'whisper-1');
    formData.append('language', language);
    formData.append('response_format', 'text');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Whisper API error:', error);
      return res.status(500).json({ error: 'Whisper API error', details: error });
    }

    const transcription = await response.text();
    try { fs.unlinkSync(audioFile.filepath); } catch (_) {}

    return res.status(200).json({ transcription: transcription.trim() });

  } catch (error) {
    console.error('Transcribe error:', error);
    return res.status(500).json({ error: error.message });
  }
}
