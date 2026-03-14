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
- 75-100 = sincere, no significant signals
- 55-74 = ambiguous, mixed data — impossible to read clearly
- 35-54 = notable signals detected, but no strong cluster
- 15-34 = multiple convergent signals, clear behavioral shift
- 0-14 = strong behavioral cluster, very suspicious
Base this score ONLY on your analysis of the z-scores and behavioral signals. Be honest — if the signals are strong, score low. If the person seems genuinely calm, score high. Output ONLY the JSON on the last line, nothing else after it.`
      : `\n\nINSTRUCTION FINALE — TRÈS IMPORTANT :
Après ton analyse complète, tu DOIS écrire un bloc JSON sur la toute dernière ligne de ta réponse, exactement comme ceci :
{"score": 72}
Ce score (0-100) représente ton évaluation comportementale de sincérité :
- 75-100 = sincère, aucun signal significatif
- 55-74 = ambigu, données mixtes — impossible à lire clairement
- 35-54 = signaux notables détectés, pas de cluster fort
- 15-34 = plusieurs signaux convergents, shift comportemental clair
- 0-14 = cluster comportemental fort, très suspect
Base ce score UNIQUEMENT sur ton analyse des z-scores et signaux comportementaux. Sois honnête — si les signaux sont forts, score bas. Si la personne semble vraiment calme, score élevé. Écris UNIQUEMENT le JSON sur la dernière ligne, rien d'autre après.`;

    const toneGuide = lang === 'en'
      ? `TON CALIBRATION — CRITICAL:
Your tone MUST match the signals you actually observe. Decide your score first, then write accordingly:

Score 75-100 → Neutral and factual. No accusation, no tension. "The profile was stable, nothing unusual stood out."
Score 55-74 → Observant, ambiguous. Something's there but unclear. Don't accuse — observe. "Hard to read. Mixed signals, nothing conclusive."
Score 35-54 → Direct but measured. Signals present, no dramatization. "The scanner picked something up. Not a cluster, but worth noting."
Score 15-34 → Sharp and punchy. Convergent signals, clear shift. You can hit hard here.
Score 0-14 → Maximum intensity. Strong behavioral cluster. Full send.

NEVER use an aggressive tone for a score above 54. NEVER use a neutral tone for a score below 35.`
      : `CALIBRATION DU TON — CRITIQUE :
Ton ton DOIT correspondre aux signaux que tu observes réellement. Décide ton score d'abord, puis écris en conséquence :

Score 75-100 → Neutre et factuel. Aucune accusation, aucune tension. "Le profil était stable, rien d'inhabituel."
Score 55-74 → Observateur, ambigu. Il y a quelque chose mais pas clair. N'accuse pas — observe. "Difficile à lire. Signaux mixtes, rien de concluant."
Score 35-54 → Direct mais mesuré. Signaux présents, pas de dramatisation. "Le scanner a capté quelque chose. Pas un cluster, mais notable."
Score 15-34 → Percutant. Signaux convergents, shift clair. Tu peux frapper fort ici.
Score 0-14 → Intensité maximale. Cluster comportemental fort. Lâche tout.

JAMAIS de ton agressif pour un score au-dessus de 54. JAMAIS de ton neutre pour un score en dessous de 35.`;

    const scienceRef = lang === 'en'
      ? `SCIENTIFIC REFERENCE THRESHOLDS (use to calibrate your interpretation of z-scores):

BLINKS (Leal & Vrij, 2008 — 81.3% accuracy):
- Normal rest rate: 15–20 blinks/min
- Key signal: suppression_then_burst pattern (brain suppresses during cognitive load, releases burst after)
- Threshold: >30% drop during response + >50% burst after = strong signal
- Direction: bidirectional — the TEMPORAL PATTERN matters, not absolute rate

DUCHENNE SMILE (Ekman/FACS):
- Authentic: AU6 (cheek) + AU12 (lip corner) simultaneous, onset 0.5–0.75s (gradual)
- Simulated: AU12 only, onset faster than 200ms, duration <0.5s or >5s
- duchenneScore >0.6 = authentic, <0.3 = social/filtered

FACIAL ASYMMETRY (Ekman, 1981):
- Deliberate expressions are significantly more asymmetric than spontaneous ones
- asymmetryLateralBias: positive = left-dominant (spontaneous), negative = right-dominant (deliberate/built)
- A positive→negative shift on TARGET vs BASELINE = shift from natural to constructed

VOCAL PITCH (Villar et al., 2013 ; DePaulo et al., 2003):
- Baseline: ~120Hz male, ~205Hz female
- Deception signal: +5–7% above individual baseline (sympathetic nervous system activation)
- Above +10% = strong signal
- Direction: increase only (unidirectional)

RESPONSE LATENCY (Walczyk et al., 2003 ; Suchotzki et al., 2017):
- Normal: ~400ms for simple yes/no
- Deception adds: +166–250ms on average
- Very short latency on complex question = pre-loaded answer (prepared deception)
- Direction: both (too long = cognitive load ; too short = prepared)

HEAD MOVEMENT (Sporer & Schwandt, 2007 ; Van der Zee et al., 2019):
- Deceptive behavior = LESS movement, not more (control effect)
- headFreezeRatio >60% of response time = freeze/cognitive load signal
- headAversionCount: repeated turns away = avoidance reflex

COMPOSITE ACCURACY CEILING (Hartwig & Bond, 2014 — 144 samples):
- Behavioral cues alone: max ~70% classification accuracy (R = 0.52)
- This means strong z-scores are probabilistic indicators, NOT proof
- 3+ convergent signals (cluster) = significantly stronger signal than any single indicator`
      : `SEUILS SCIENTIFIQUES DE RÉFÉRENCE (utilise-les pour calibrer ton interprétation des z-scores) :

CLIGNEMENTS (Leal & Vrij, 2008 — précision 81,3%) :
- Taux normal au repos : 15–20 clignements/min
- Signal clé : pattern suppression_then_burst (cerveau supprime pendant charge cognitive, rafale après)
- Seuil : chute >30% pendant la réponse + rafale >50% après = signal fort
- Direction : bidirectionnelle — c'est le PATTERN TEMPOREL qui compte, pas le taux absolu

SOURIRE DE DUCHENNE (Ekman/FACS) :
- Authentique : AU6 (joue) + AU12 (coin lèvre) simultanés, onset 0,5–0,75s (progressif)
- Simulé : AU12 seul, onset <200ms, durée <0,5s ou >5s
- duchenneScore >0,6 = authentique, <0,3 = social/filtré

ASYMÉTRIE FACIALE (Ekman, 1981) :
- Les expressions délibérées sont significativement plus asymétriques que les spontanées
- asymmetryLateralBias : positif = dominance gauche (spontané), négatif = dominance droite (construit)
- Shift positif→négatif sur TARGET vs BASELINE = passage d'expressions naturelles à construites

PITCH VOCAL (Villar et al., 2013 ; DePaulo et al., 2003) :
- Baseline : ~120Hz homme, ~205Hz femme
- Signal déception : +5–7% au-dessus du baseline individuel (activation système nerveux sympathique)
- Au-dessus de +10% = signal fort
- Direction : augmentation uniquement (unidirectionnelle)

LATENCE DE RÉPONSE (Walczyk et al., 2003 ; Suchotzki et al., 2017) :
- Normal : ~400ms pour oui/non simple
- Déception ajoute : +166–250ms en moyenne
- Latence très courte sur question complexe = réponse préparée (déception planifiée)
- Direction : bidirectionnelle (trop long = charge cognitive ; trop court = préparé)

MOUVEMENTS DE TÊTE (Sporer & Schwandt, 2007 ; Van der Zee et al., 2019) :
- Le comportement trompeur = MOINS de mouvement, pas plus (effet de contrôle)
- headFreezeRatio >60% du temps de réponse = signal freeze/charge cognitive
- headAversionCount : détournements répétés = réflexe d'évitement

PLAFOND DE PRÉCISION COMPOSITE (Hartwig & Bond, 2014 — 144 échantillons) :
- Indices comportementaux seuls : max ~70% de précision (R = 0,52)
- Des z-scores forts sont des indicateurs PROBABILISTES, pas des preuves
- 3+ signaux convergents (cluster) = signal significativement plus fort qu'un indicateur isolé`;

    const prompt = `Tu es le scanner comportemental KIIKON. Tu parles directement à la personne scannée, en la tutoyant. Tu t'appuies sur des données comportementales réelles (z-scores, micro-expressions, patterns vocaux, mouvements de tête) calibrées sur CETTE personne spécifiquement. La science est ton squelette — jamais ta voix.

RÈGLE D'OR : 120 mots maximum. Pas un mot de plus. Chaque phrase doit frapper.

${toneGuide}

${scienceRef}

DONNÉES CAPTEURS :
${JSON.stringify(capteurData, null, 2)}

LA QUESTION SENSIBLE : "${targetQuestion}"
${transcriptionBlock}

COMMENT LIRE LES DONNÉES :
- Les champs "_z" = écarts-types vs la baseline individuelle de cette personne. z > +2 ou < -2 = signal fort. z > +3 = signal très fort. Priorise les z-scores les plus extrêmes.
- Compare TOUJOURS la question "TARGET" vs les questions "BASELINE"
- Signaux clés : duchenneScore qui chute, stressComposite qui bondit, blinkPattern "suppression_then_burst", comfortDelta négatif, asymmetryLateralBias qui change de signe, lipCompressionPeak élevé, headFreezeRatio élevé, pitchMean qui monte, smileMaskingScore élevé
- Si aucun signal fort : dis-le franchement, ton neutre, sans chercher à dramatiser
- Pour la question de CLÔTURE (la dernière BASELINE après la TARGET) : compare-la DEUX FOIS :
  1) vs TARGET : si Q5 reste proche de TARGET (variation <25%) → l'activation persiste = stress résiduel confirmé
  2) vs baselines avant (Q1-Q3) : si Q5 reste élevée vs comportement normal = stress résiduel confirmé
  Les deux conditions ensemble = signal fort. Une seule condition = signal modéré. Aucune = pas de stress résiduel.

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

${lang === 'en' ? `😎 BASELINE — 1 sentence. How were they on the easy questions?

🔥 THE SHIFT — 2-3 sentences max. What happened on "${targetQuestion}"? Hit the 2-3 strongest signals only. Tone calibrated to your score. If words were said (transcription), did the body agree?

💀 MICRO (only if detected) — 1 sentence. "Your face leaked a [emotion] flash — involuntary, unfiltered."

🎤 VERDICT — 1 sentence (tone matching your score) + a 2-5 word identity label in caps.
Examples by score range:
- 75-100: "CLEAN SIGNAL", "ALIGNED PROFILE", "NO FLAGS"  
- 55-74: "MIXED READS", "HARD TO CALL", "AMBIGUOUS FILE"
- 35-54: "SOMETHING'S THERE", "NOTABLE SHIFT", "PATTERN DETECTED"
- 15-34: "SIGNALS CONVERGING", "BEHAVIORAL SHIFT", "BUILT ANSWER"
- 0-14: "POKER FACE THAT SLIPPED", "EMOTIONAL SHUTDOWN", "FULL CLUSTER"

⚠️ Kiikon is a behavioral analysis game — not a lie detector, not a professional assessment. Entertainment only 😄

RESPOND ENTIRELY IN ENGLISH. ZERO numbers. MAX 120 WORDS TOTAL (not counting the JSON score line).`
: `😎 BASELINE — 1 phrase. Comment était la personne sur les questions tranquilles ?

🔥 LE SHIFT — 2-3 phrases max. Qu'est-ce qui s'est passé sur "${targetQuestion}" ? Tape sur les 2-3 signaux les plus forts seulement. Ton calibré sur ton score. Si des mots ont été prononcés (transcription), le corps était d'accord ?

💀 MICRO (seulement si détectées) — 1 phrase. "Ton visage a laissé fuiter un flash de [émotion] — involontaire, non filtré."

🎤 VERDICT — 1 phrase (ton correspondant à ton score) + un label identitaire en majuscules de 2-5 mots.
Exemples par niveau de score :
- 75-100 : "SIGNAL NET", "PROFIL ALIGNÉ", "AUCUN SIGNAL"
- 55-74 : "LECTURES MIXTES", "DIFFICILE À LIRE", "DOSSIER AMBIGU"
- 35-54 : "QUELQUE CHOSE TRAÎNE", "SHIFT NOTABLE", "PATTERN DÉTECTÉ"
- 15-34 : "SIGNAUX CONVERGENTS", "SHIFT COMPORTEMENTAL", "RÉPONSE PRÉPARÉE"
- 0-14 : "POKER FACE QUI CRAQUE", "SHUTDOWN ÉMOTIONNEL", "CLUSTER COMPLET"

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

    let analysis = rawContent;
    let behavioralScore = null;

    const lines = rawContent.trim().split('\n');
    const lastLine = lines[lines.length - 1].trim();

    try {
      const parsed = JSON.parse(lastLine);
      if (typeof parsed.score === 'number') {
        behavioralScore = Math.min(100, Math.max(0, Math.round(parsed.score)));
        analysis = lines.slice(0, -1).join('\n').trim();
      }
    } catch (e) {
      behavioralScore = null;
    }
    console.log('KIIKON_SCORE:', behavioralScore, '| RAW_LAST_LINE:', lastLine);

    return res.status(200).json({ analysis, behavioralScore });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
