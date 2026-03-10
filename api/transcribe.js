import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';

export const config = {
  api: {
    bodyParser: false, // On gère le multipart manuellement
  },
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parser le fichier audio uploadé
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 }); // 10MB max
    const [fields, files] = await form.parse(req);

    const audioFile = files.audio?.[0];
    const language = fields.language?.[0] || 'fr';

    if (!audioFile) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Lire le fichier audio
    const audioBuffer = fs.readFileSync(audioFile.filepath);

    // Préparer la requête Whisper
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: 'audio.m4a',
      contentType: audioFile.mimetype || 'audio/m4a',
    });
    formData.append('model', 'whisper-1');
    formData.append('language', language);
    formData.append('response_format', 'text');

    // Appel API OpenAI Whisper
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Whisper API error:', error);
      return res.status(500).json({ error: 'Whisper API error', details: error });
    }

    const transcription = await response.text();

    // Nettoyer le fichier temporaire
    fs.unlinkSync(audioFile.filepath);

    return res.status(200).json({ transcription: transcription.trim() });

  } catch (error) {
    console.error('Transcribe error:', error);
    return res.status(500).json({ error: error.message });
  }
}
