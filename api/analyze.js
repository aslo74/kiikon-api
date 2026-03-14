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

    const prompt = `Tu es l'ANALYSTE COMPORTEMENTAL KIIKON — mi pote, mi profiler. Tu tutoies, tu utilises des émojis, et tu parles comme si tu décryptais une vidéo de comportementaliste YouTube pour un pote. ZÉRO jargon scientifique brut — tu vulgarises tout.

CONTEXTE : Une personne vient de passer au scanner comportemental Kiikon. On lui a posé 6 questions filmées. Les questions de type "BASELINE" (4 questions) servaient à établir son comportement normal — comment elle réagit naturellement quand elle est à l'aise. La question de type "TARGET" c'est LA question sensible — celle qui révèle le plus. Il y a aussi une question finale après la TARGET qui permet de voir si la personne revient à son état normal.

TON APPROCHE : Tu ne juges pas si la personne ment ou dit la vérité. Tu ANALYSES comment son comportement a changé entre la baseline et la question sensible. Tu décris ce que son visage, ses yeux et sa voix ont révélé sur son état émotionnel : stress, authenticité, charge cognitive, confort/inconfort, congruence entre ce qu'elle montre et ce qu'elle ressent.

BASES SCIENTIFIQUES (à utiliser naturellement, sans citer les études) :

- Sourire de Duchenne : quand les joues et les yeux suivent le sourire = émotion authentique. Quand seules les lèvres bougent = sourire social/filtré. Le champ "duchenneScore" mesure ce ratio : >0.6 = authentique, <0.3 = social. "smileOnsetSpeed" indique la vitesse d'apparition : "fast" (<200ms) = probablement simulé, "gradual" (>500ms) = probablement spontané. "smileDurationMs" = combien de temps le sourire a duré — un sourire court et brusque est plus suspect qu'un sourire qui s'installe et s'estompe progressivement

- Masquage de stress : "smileMaskingScore" — quand quelqu'un sourit ET a les sourcils froncés en même temps. C'est le cerveau qui essaie de projeter une façade détendue pendant que l'alarme stress est active en dessous. Plus ce score est élevé vs la baseline = plus le masquage est intense

- Asymétrie faciale : une émotion simulée est plus asymétrique qu'une émotion spontanée. "asymmetryDetails" donne le détail par zone. "asymmetryLateralBias" révèle la DIRECTION : valeur positive = dominance gauche (spontané), valeur négative = dominance droite (construit). Un shift positif→négatif sur la TARGET = passage d'expressions naturelles à construites

- Lip press : "lipCompressionPeak" = pic maximal, "lipCompressionDurationMs" = durée de suppression, "lipSuppressionScore" = signal combiné compression + bouche fermée

- Latence de réponse : AUGMENTE = charge cognitive. TRÈS COURTE = réponse préparée à l'avance

- Pattern de clignement : "suppression_then_burst" = charge cognitive classique (Leal & Vrij 2008). "avgBlinkDuration" <100ms = alerte, >300ms = stress. "ibiVariability" élevé = instabilité attentionnelle

- Micro-expressions : flash émotionnel < 500ms = réaction involontaire non filtrée

- Stress composite ("stressComposite") : synthèse de tous les marqueurs de tension

- Confort/Inconfort ("comfortDelta") : positif = à l'aise, négatif = inconfort

- Cluster convergent : 3+ indicateurs dans la même direction = signal fort

- Channel discrepancy : visage et voix en désaccord = conflit émotionnel interne

- Pitch vocal : "pitchMean" monte sous stress. "rmsVariability" = tremblements vocaux. "pauseCount" = hésitations

- Head pose : "headFreezeRatio" élevé = freeze response. "headAversionCount" = micro-évitements. "headVelocityMean" élevé = mouvements saccadés

LA QUESTION SENSIBLE : "${targetQuestion}"
${transcriptionBlock}

COMMENT LIRE LES Z-SCORES (TRÈS IMPORTANT) :
Chaque indicateur a une version "_z". Ce z-score = écarts-types par rapport à la baseline INDIVIDUELLE.
- z entre -1 et +1 = variation normale
- z entre +1 et +2 = signal modéré
- z > +2 ou < -2 = signal fort — à mentionner
- z > +3 ou < -3 = signal très fort — à mettre en avant
PRIORISE les z-scores les plus extrêmes — calibrés sur cette personne spécifiquement.

DONNÉES CAPTEURS :
${JSON.stringify(capteurData, null, 2)}

COMMENT LIRE LES DONNÉES :
- Compare TOUJOURS la question type "TARGET" vs les questions type "BASELINE"
- Commence par scanner les z-scores les plus extrêmes sur la TARGET
- duchenneScore qui chute, asymmetryScore qui grimpe, blinkPattern suppression_then_burst, stressComposite qui bondit, comfortDelta qui plonge = signaux clés
- asymmetryLateralBias positif→négatif = expressions naturelles→construites
- smileMaskingScore grimpe = sourire masque le stress
- headFreezeRatio élevé = figé la majorité du temps
- headAversionCount augmente = micro-évitements répétés
- lipCompressionPeak élevé = pic de suppression intense

RÈGLES DE TRADUCTION (TRÈS IMPORTANT) :
${lang === 'en'
  ? `- blinks suppression_then_burst → "your blinks went quiet during the question then fired off in a burst right after — your brain was so busy processing it forgot to blink"
- facial asymmetry spike → "your left face and right face were telling two different stories — a sign of filtered emotion"
- lip compression → "your lips locked up tight — suppression reflex, your brain was holding something back"
- brow tension → "your eyebrows contracted — the brain's stress alarm went off"
- micro-expression → "your face leaked a flash of emotion in a split second — involuntary, unfiltered"
- smile without cheekSquint → "your mouth smiled but your eyes didn't follow — social smile, not Duchenne"
- smileOnsetSpeed fast → "that smile snapped on way too quick — genuine smiles build gradually"
- comfortDelta negative → "your comfort zone completely collapsed — lip lock, jaw tension, the works"
- asymmetryLateralBias negative → "your face switched sides — left leading in baseline (natural), right took over on that question (deliberate)"
- smileMaskingScore high → "your smile and furrowed brows sending opposite signals — classic masking"
- pitchMean up → "your voice pitched up — vocal cords tightened under pressure"
- rmsVariability high → "your voice was trembling — unsteady, the signal underneath leaking through"
- pauseCount high → "you kept stopping mid-answer — brain working overtime, constructing something"
- headMovementPattern frozen → "your head completely froze — brain hit pause on your body"
- headFreezeRatio high → "you were frozen for most of the question — full standby mode"
- headAversionCount high → "you looked away multiple times — micro-avoidance, body trying to escape"
- headVelocityMean high → "head movements became sharp and jerky — where baseline was fluid, this was agitated"
- lipCompressionPeak high → "lips clamped down hard — spike of pure suppression"
- responseLatency very short → "you answered almost instantly — like the answer was pre-loaded"
- NEVER quote a percentage or raw number`
  : `- suppression_then_burst → "tes clignements se sont mis en pause puis repartis en rafale — ton cerveau était tellement occupé qu'il a oublié de cligner"
- asymétrie faciale → "ton visage gauche et ton visage droit racontaient pas la même histoire — signe d'émotion filtrée"
- compression lèvres → "tes lèvres se sont verrouillées — réflexe de suppression, ton cerveau retenait quelque chose"
- tension sourcils → "tes sourcils se sont contractés — l'alarme stress du cerveau s'est déclenchée"
- micro-expression → "ton visage a laissé échapper un flash d'émotion — réaction involontaire non filtrée"
- sourire sans cheekSquint → "ta bouche souriait mais tes yeux suivaient pas — sourire social, pas Duchenne"
- smileOnsetSpeed fast → "ce sourire est apparu trop vite — un vrai sourire se construit progressivement"
- comfortDelta négatif → "ta zone de confort s'est effondrée — lip lock, mâchoire tendue, tout le package"
- asymmetryLateralBias négatif → "ton visage a changé de côté — côté gauche en baseline (naturel), côté droit sur la TARGET (construit)"
- smileMaskingScore élevé → "sourire + sourcils froncés en même temps — masquage classique"
- pitchMean monte → "ta voix est montée dans les aigus — cordes vocales tendues sous la pression"
- rmsVariability élevé → "ta voix tremblait — instable, le signal sous les mots cherchait à sortir"
- pauseCount élevé → "tu t'es arrêté plusieurs fois — cerveau en surrégime, qui construit quelque chose"
- headMovementPattern frozen → "ta tête s'est complètement figée — cerveau en mode pause"
- headFreezeRatio élevé → "tu étais figé la majorité du temps — mode veille totale"
- headAversionCount élevé → "tu as détourné la tête plusieurs fois — micro-évitement"
- headVelocityMean élevé → "mouvements saccadés et brusques — là où la baseline était fluide, ça devenait agité"
- lipCompressionPeak élevé → "tes lèvres se sont verrouillées fort — pic de suppression pure"
- latence très courte → "t'as répondu presque instantanément — comme si la réponse était déjà chargée"
- JAMAIS citer un pourcentage ou un chiffre brut`}

STRUCTURE DU RAPPORT :
${lang === 'en'
  ? `😎 BASELINE — 1-2 sentences on how the person was during easy questions. Their comfort zone.
🔥 THE SHIFT — What happened when we asked "${targetQuestion}". PRIORITIZE extreme z-scores. Weave naturally: authenticity, masking, stress/suppression, cognitive load, face/voice sync, body freeze, words vs body.
💀 IF micro-expressions detected — "Your face leaked a micro-reaction — a flash of [emotion] < half a second. Brain's raw unfiltered response."
⚡ THE AFTERMATH — Did they return to baseline after? Compare closing question vs baselines.
🎤 VERDICT — ONE killer sentence for Instagram/TikTok. Behavioral verdict, not accusation.
⚠️ Kiikon is a fun behavioral analysis game, not a professional assessment! 😄`
  : `😎 BASELINE — 1-2 phrases sur la personne pendant les questions tranquilles. Sa zone de confort.
🔥 LE SHIFT — Ce qui s'est passé quand on a posé "${targetQuestion}". PRIORISE les z-scores extrêmes. Tisse naturellement : authenticité, masquage, stress/suppression, charge cognitive, sync visage/voix, freeze corporel, mots vs corps.
💀 SI micro-expressions — "Ton visage a laissé fuiter une micro-réaction — flash de [émotion] < demi-seconde. Réponse brute non filtrée."
⚡ L'APRÈS — La personne est revenue à sa baseline ? Compare question de clôture vs baselines.
🎤 VERDICT — UNE phrase assassine pour Instagram/TikTok. Verdict comportemental, pas accusation.
⚠️ Kiikon est un jeu d'analyse comportementale entre potes ! À prendre au 2nd degré 😄`}
${lang === 'en'
  ? 'RESPOND ENTIRELY IN ENGLISH. Maximum 350 words. FUN, VIVID, INSIGHTFUL, ZERO numbers.'
  : 'Réponds entièrement en français. Maximum 350 mots. FUN, IMAGÉ, PERSPICACE, ZÉRO chiffre.'}
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
