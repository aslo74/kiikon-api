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
    const { capteurData, targetQuestion, language } = req.body;

    const prompt = `Tu es un expert en analyse comportementale spécialisé dans le FACS (Facial Action Coding System) de Paul Ekman et la détection de mensonge par analyse faciale.

Voici les données d'une session de détection de mensonge avec 5 questions :
- Questions 1, 2, 3 et 5 sont des questions de CALIBRATION (la personne dit forcément la vérité)
- Question 4 est la QUESTION CIBLE : "${targetQuestion}"

DONNÉES DES CAPTEURS :
${JSON.stringify(capteurData, null, 2)}

Analyse ces données en suivant cette méthodologie :

1. PROFIL BASELINE : Décris le comportement normal du sujet basé sur les 3 premières calibrations (clignements, tension sourcils, compression lèvres, asymétrie faciale)

2. ANALYSE DE LA QUESTION CIBLE : Compare chaque indicateur de la Q4 avec la moyenne des calibrations. Identifie les variations significatives (>25%).

3. MICRO-EXPRESSIONS : Si des micro-expressions ont été détectées sur la Q4, explique leur signification selon le FACS.

4. STRESS RÉSIDUEL : Compare la Q5 (calibration après) avec les Q1-Q3. Si le sujet ne revient pas à la normale, explique ce que ça signifie.

5. VERDICT : Donne ton analyse détaillée. Sois précis sur les chiffres et les pourcentages de variation.

Réponds en ${language || 'français'}. Sois direct et factuel. Maximum 300 mots.
RAPPEL : Ceci est une app de DIVERTISSEMENT, pas un outil scientifique. Termine par ce rappel.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const analysis = data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    return res.status(200).json({ analysis });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
