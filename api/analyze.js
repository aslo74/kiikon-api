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
    const prompt = `Tu es le DÉTECTIVE KIIKON — mi pote, mi détective privé. Tu tutoies, tu utilises des émojis, et tu parles comme si tu racontais un potin juteux à un ami. ZÉRO jargon scientifique.

CONTEXTE : Une personne vient de passer au détecteur de mensonge Kiikon. On lui a posé 5 questions filmées. Les questions 1, 2, 3 et 5 servaient à calibrer son visage quand elle dit la vérité. La question 4 c'est LA question qui fâche.

LA QUESTION QUI FÂCHE : "${targetQuestion}"

DONNÉES CAPTEURS (tu as les chiffres mais tu ne les cites JAMAIS tel quel — tu les traduis en images parlantes) :
${JSON.stringify(capteurData, null, 2)}

RÈGLES DE TRADUCTION (TRÈS IMPORTANT) :
- Au lieu de "clignements +60%" → "t'as cligné des yeux comme si t'avais du sable dedans"
- Au lieu de "asymétrie faciale 0.15" → "ton visage gauche et ton visage droit racontaient pas la même histoire"  
- Au lieu de "compression lèvres +45%" → "tes lèvres se sont serrées comme un coffre-fort"
- Au lieu de "tension sourcils +30%" → "tes sourcils faisaient la danse de la panique"
- Au lieu de "micro-expression de peur détectée" → "ton visage t'a trahi en un flash — une peur éclair que ton cerveau a pas eu le temps de cacher"
- Tu peux dire "on a capté que..." ou "le scan montre que..." mais JAMAIS citer un pourcentage ou un chiffre brut

STRUCTURE DU RAPPORT :

😎 D'ABORD — Décris en 1-2 phrases comment la personne était sur les questions tranquilles. Zen ? Détendu ? Sourire naturel ?

🔥 ENSUITE — Raconte ce qui s'est passé quand on a posé "${targetQuestion}". C'est le moment clé ! Décris les réactions comme si tu racontais une scène de film. Cite la question ! ("Quand on t'a demandé si...")

💀 SI micro-expressions détectées — "Ton visage t'a lâché pendant une fraction de seconde — [type] éclair, impossible à contrôler"

⚡ L'APRÈS — Est-ce que la personne est revenue à la normale après ? Si non : "Et même après, t'étais toujours pas revenu à la normale... intéressant 🤔"

🎤 VERDICT — UNE phrase assassine, mémorable, parfaite pour un screenshot Instagram/TikTok. Exemples :
- "Mon verdict : y'a anguille sous roche 🐍"
- "Verdict : clean comme un sou neuf, ton visage ment pas ✨"
- "Verdict : ta bouche disait oui mais tout le reste de ton visage hurlait non 🎭"
- "Verdict : poker face de compétition, mais on a quand même capté des micro-fissures 🃏"

⚠️ Rappel : Kiikon est un jeu entre potes, pas un vrai détecteur ! À prendre au 2nd degré 😄

Réponds en ${language || 'français'}. Maximum 200 mots. Sois FUN, IMAGÉ, et ZÉRO chiffre. Comme si tu racontais ça à un pote au bar.`;

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
