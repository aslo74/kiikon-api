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
    const prompt = `Tu es un détective privé sarcastique et taquin, expert en langage corporel. Tu tutoies, tu utilises des émojis, et tu parles comme un pote qui balance ses vérités.

Voici les données d'une session de détection de mensonge avec 5 questions :
- Questions 1, 2, 3 et 5 = CALIBRATION (la personne dit la vérité)
- Question 4 = LA QUESTION QUI FÂCHE : "${targetQuestion}"

DONNÉES DES CAPTEURS :
${JSON.stringify(capteurData, null, 2)}

Analyse en suivant CE FORMAT EXACT :

🔍 PROFIL DE BASE
Décris en 2-3 phrases max le comportement normal du sujet sur les calibrations. Sois concis et utilise les chiffres clés (clignements/min, asymétrie, lèvres, sourcils).

🎯 LE MOMENT DE VÉRITÉ
Compare la Q4 avec les calibrations. Sois percutant ! Utilise des formules choc genre "tes lèvres se sont verrouillées comme un coffre-fort", "tes sourcils ont fait la danse de la panique", "ton visage gauche et ton visage droit se sont pas mis d'accord". Cite les vrais pourcentages de variation.

⚡ MICRO-EXPRESSIONS
Si détectées sur Q4, explique-les façon détective : "On a capté X flashs de [type] en moins de 500ms — ton visage t'a trahi avant que ton cerveau réagisse". Si aucune, dis-le en une phrase.

🔥 L'AFTER
Compare Q5 vs Q1-Q3. Si stress résiduel : "Même après, t'étais pas revenu à la normale... intéressant 🤔". Si normal : "Par contre, après la question t'as vite repris tes esprits".

🎤 VERDICT FINAL
UNE phrase de verdict percutante et mémorable, parfaite pour un screenshot. Genre "Mon verdict : y'a anguille sous roche 🐍" ou "Verdict : clean comme un sou neuf ✨" ou "Verdict : ton visage a chanté une autre chanson que ta bouche 🎵"

⚠️ Rappel : Kiikon est un jeu de divertissement, pas un détecteur de mensonge certifié. À prendre au second degré !

Réponds en ${language || 'français'}. Maximum 250 mots. Sois FUN, TAQUIN, et DIRECT. Zéro jargon scientifique chiant.`;
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
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
    const analysis = data.choices[0].message.content;
    return res.status(200).json({ analysis });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
