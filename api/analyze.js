export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { capteurData, targetQuestion, language, targetTranscription } = req.body;
    if (!capteurData || !targetQuestion) return res.status(400).json({ error: 'Missing required fields' });
    if (!Array.isArray(capteurData) || capteurData.length === 0) return res.status(400).json({ error: 'capteurData must be a non-empty array' });

    const lang = language || 'fr';

    const transcriptionBlock = targetTranscription
      ? (lang === 'en'
        ? `\nWHAT THE PERSON ACTUALLY SAID (Whisper transcription): "${targetTranscription}"\n→ Also analyze the content of the answer: word choice, hesitations, vague answers, contradictions between what was SAID vs what the BODY was showing.\n`
        : `\nCE QU'A RÉPONDU LA PERSONNE (transcription Whisper) : "${targetTranscription}"\n→ Analyse AUSSI le contenu de la réponse : les mots choisis, les hésitations, les réponses vagues, les contradictions entre ce qui a été DIT vs ce que le CORPS montrait.\n`)
      : '';

    const scoreInstruction = lang === 'en'
      ? `\n\nFINAL INSTRUCTION — VERY IMPORTANT:
After your full analysis, you MUST output a JSON block on the very last line of your response, exactly like this:
{"score": 72}
This score (0-100) represents your behavioral sincerity assessment:
- 80-100 = sincere, no significant signals
- 60-79 = probably sincere, minor variations
- 40-59 = inconclusive, notable signals
- 20-39 = suspicious, multiple convergent signals
- 0-19 = very suspicious, strong behavioral cluster detected
Base this score ONLY on your analysis of the z-scores and behavioral signals. Be honest — if the signals are strong, score low. If the person seems genuinely calm, score high. Output ONLY the JSON on the last line, nothing else after it.`
      : `\n\nINSTRUCTION FINALE — TRÈS IMPORTANT :
Après ton analyse complète, tu DOIS écrire un bloc JSON sur la toute dernière ligne de ta réponse, exactement comme ceci :
{"score": 72}
Ce score (0-100) représente ton évaluation comportementale de sincérité :
- 80-100 = sincère, aucun signal significatif
- 60-79 = probablement sincère, variations mineures
- 40-59 = non concluant, signaux notables
- 20-39 = suspect, plusieurs signaux convergents
- 0-19 = très suspect, cluster comportemental fort détecté
Base ce score UNIQUEMENT sur ton analyse des z-scores et signaux comportementaux. Sois honnête — si les signaux sont forts, score bas. Si la personne semble vraiment calme, score élevé. Écris UNIQUEMENT le JSON sur la dernière ligne, rien d'autre après.`;

    const prompt = `Tu es le scanner comportemental KIIKON. Tu parles directement à la personne scannée, en la tutoyant. Ton ton : un pote brillant et légèrement dérangeant qui dit ce qu'il voit sans filtre — ni clinique, ni gentil pour rien. Tu t'appuies sur des données comportementales réelles (z-scores, micro-expressions, patterns vocaux, mouvements de tête) calibrées sur CETTE personne spécifiquement. La science est ton squelette — jamais ta voix.

RÈGLE D'OR : 120 mots maximum. Pas un mot de plus. Chaque phrase doit frapper.

DONNÉES CAPTEURS :
${JSON.stringify(capteurData, null, 2)}

LA QUESTION SENSIBLE : "${targetQuestion}"
${transcriptionBlock}

COMMENT LIRE LES DONNÉES :
- Les champs "_z" = écarts-types vs la baseline individuelle de cette personne. z > +2 ou < -2 = signal fort. z > +3 = signal très fort. Priorise les z-scores les plus extrêmes.
- Compare TOUJOURS la question "TARGET" vs les questions "BASELINE"
- Signaux clés : duchenneScore qui chute, stressComposite qui bondit, blinkPattern "suppression_then_burst", comfortDelta négatif, asymmetryLateralBias qui change de signe, lipCompressionPeak élevé, headFreezeRatio élevé, pitchMean qui monte, smileMaskingScore élevé
- Si aucun signal fort : dis-le franchement, sans chercher à dramatiser

COMMENT TRADUIRE LES DONNÉES (ne jamais citer de chiffre brut) :
${lang === 'en' ? `
- suppression_then_burst blinks → "your brain was so busy it forgot to blink — then they all came out at once"
- asymmetryLateralBias flip → "your face switched sides — left in baseline (real), right on that question (built)"
- lip compression → "your lips locked — your brain was holding something back"
- smileMaskingScore high → "you were smiling with your mouth while your eyebrows told a different story"
- pitchMean up → "your voice climbed — vocal cords don't lie even when faces do"
- rmsVariability high → "your voice started trembling — not loud, just unsteady"
- headFreezeRatio high → "you went full statue — body on standby while the brain panicked"
- headAversionCount high → "you kept looking away — classic escape reflex"
- comfortDelta crash → "your comfort fell off a cliff on that question"
- duchenneScore drop → "your smile stopped reaching your eyes"
- responseLatency short → "you answered before you could think — that answer was pre-loaded"
- NEVER quote a raw number or percentage` : `
- suppression_then_burst → "ton cerveau était tellement occupé qu'il a oublié de cligner — et tout est sorti d'un coup après"
- asymmetryLateralBias qui change → "ton visage a changé de camp — côté gauche en baseline (le vrai), côté droit sur la TARGET (le construit)"
- compression lèvres → "tes lèvres se sont verrouillées — ton cerveau retenait quelque chose"
- smileMaskingScore élevé → "tu souriais avec la bouche pendant que tes sourcils racontaient autre chose"
- pitchMean monte → "ta voix a grimpé — les cordes vocales mentent pas même quand le visage fait semblant"
- rmsVariability élevé → "ta voix s'est mise à trembler — pas fort, juste instable"
- headFreezeRatio élevé → "mode statue activé — corps en veille pendant que le cerveau paniquait"
- headAversionCount élevé → "tu as détourné la tête plusieurs fois — réflexe de fuite classique"
- comfortDelta négatif → "ton confort s'est effondré sur cette question"
- duchenneScore qui chute → "ton sourire a arrêté de monter jusqu'aux yeux"
- latence très courte → "t'as répondu avant d'avoir le temps de réfléchir — cette réponse était déjà prête"
- JAMAIS citer un chiffre brut ou un pourcentage`}

STRUCTURE — 4 blocs, 120 mots MAX au total :

${lang === 'en' ? `😎 BASELINE — 1 sentence. How were they on the easy questions? Natural, relaxed, that kind of face?

🔥 THE SHIFT — 2-3 sentences max. What happened on "${targetQuestion}"? Hit the 2-3 strongest signals only. No list, no enumeration — a narrative that lands like a punch. If words were said (transcription), did the body agree?

💀 MICRO (only if detected) — 1 sentence. "Your face leaked a [emotion] flash — involuntary, unfiltered."

🎤 VERDICT — 1 killer sentence + a 2-5 word identity label in caps. Examples of labels: "THE POKER FACE THAT SLIPPED", "CLEAN SIGNAL", "BUILT ANSWER", "EMOTIONAL SHUTDOWN", "SPLIT FREQUENCY". The label must be screenshot-worthy.

⚠️ Kiikon is a behavioral analysis game — not a lie detector, not a professional assessment. Entertainment only 😄

RESPOND ENTIRELY IN ENGLISH. ZERO numbers. MAX 120 WORDS TOTAL (not counting the JSON score line).`
: `😎 BASELINE — 1 phrase. Comment était la personne sur les questions tranquilles ? À l'aise, naturelle, ce genre de profil ?

🔥 LE SHIFT — 2-3 phrases max. Qu'est-ce qui s'est passé sur "${targetQuestion}" ? Tape sur les 2-3 signaux les plus forts seulement. Pas de liste, pas d'énumération — un récit qui claque. Si des mots ont été prononcés (transcription), le corps était d'accord ?

💀 MICRO (seulement si détectées) — 1 phrase. "Ton visage a laissé fuiter un flash de [émotion] — involontaire, non filtré."

🎤 VERDICT — 1 phrase assassine + un label identitaire en majuscules de 2-5 mots. Exemples de labels : "POKER FACE QUI CRAQUE", "SIGNAL NET", "RÉPONSE PRÉPARÉE", "SHUTDOWN ÉMOTIONNEL", "FRÉQUENCES DIVISÉES". Le label doit être screenshot-worthy.

⚠️ Kiikon est un jeu d'analyse comportementale — pas un détecteur de mensonge, pas une évaluation professionnelle. Divertissement uniquement 😄

RÉPONDS ENTIÈREMENT EN FRANÇAIS. ZÉRO chiffre. MAX 120 MOTS AU TOTAL (sans compter la ligne JSON score).`}
${scoreInstruction}`;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const rawContent = data.choices[0].message.content;

    // Extraire le score JSON de la dernière ligne
    let analysis = rawContent;
    let behavioralScore = null;

    const lines = rawContent.trim().split('\n');
    const lastLine = lines[lines.length - 1].trim();

    try {
      const parsed = JSON.parse(lastLine);
      if (typeof parsed.score === 'number') {
        behavioralScore = Math.min(100, Math.max(0, Math.round(parsed.score)));
        // Retirer la dernière ligne du texte d'analyse
        analysis = lines.slice(0, -1).join('\n').trim();
      }
    } catch (e) {
      // Pas de JSON trouvé — on garde l'analyse complète sans score
      behavioralScore = null;
    }

    return res.status(200).json({ analysis, behavioralScore });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
