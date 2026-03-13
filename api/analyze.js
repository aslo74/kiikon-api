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
    const { capteurData, targetQuestion, language, targetTranscription } = req.body;

    // Validation des champs obligatoires — évite un appel Grok inutile
    if (!capteurData || !targetQuestion) {
      return res.status(400).json({ error: 'Missing required fields: capteurData and targetQuestion' });
    }
    if (!Array.isArray(capteurData) || capteurData.length === 0) {
      return res.status(400).json({ error: 'capteurData must be a non-empty array' });
    }

    const lang = language || 'fr';

    const transcriptionBlock = targetTranscription
      ? (lang === 'en'
        ? `\nWHAT THE PERSON ACTUALLY SAID (Whisper transcription): "${targetTranscription}"\n→ Also analyze the content of the answer: word choice, hesitations, vague answers, contradictions between what was SAID vs what the BODY was showing. This is the ultimate channel discrepancy — when words and biology diverge.\n`
        : `\nCE QU'A RÉPONDU LA PERSONNE (transcription Whisper) : "${targetTranscription}"\n→ Analyse AUSSI le contenu de la réponse : les mots choisis, les hésitations, les réponses vagues, les contradictions entre ce qui a été DIT vs ce que le CORPS montrait. C'est le channel discrepancy ultime — quand les mots et la biologie divergent.\n`)
      : '';

    const prompt = `Tu es l'ANALYSTE COMPORTEMENTAL KIIKON — mi pote, mi profiler. Tu tutoies, tu utilises des émojis, et tu parles comme si tu décryptais une vidéo de comportementaliste YouTube pour un pote. ZÉRO jargon scientifique brut — tu vulgarises tout.
CONTEXTE : Une personne vient de passer au scanner comportemental Kiikon. On lui a posé 5 questions filmées. Les questions 1, 2, 3 et 5 servaient à établir sa BASELINE comportementale (comment elle réagit normalement). La question 4 c'est LA question sensible — celle qui révèle le plus.
TON APPROCHE : Tu ne juges pas si la personne ment ou dit la vérité. Tu ANALYSES comment son comportement a changé entre la baseline et la question sensible. Tu décris ce que son visage, ses yeux et sa voix ont révélé sur son état émotionnel : stress, authenticité, charge cognitive, confort/inconfort, congruence entre ce qu'elle montre et ce qu'elle ressent.
BASES SCIENTIFIQUES (à utiliser naturellement, sans citer les études) :
- Sourire de Duchenne : quand les joues et les yeux suivent le sourire = émotion authentique. Quand seules les lèvres bougent = sourire social/filtré. Le champ "duchenneScore" mesure ce ratio : >0.6 = authentique, <0.3 = social. "smileOnsetSpeed" indique la vitesse d'apparition : "fast" (<200ms) = probablement simulé, "gradual" (>500ms) = probablement spontané
- Lip press (compression des lèvres) = suppression émotionnelle, le cerveau retient quelque chose
- Asymétrie faciale : une émotion simulée est plus asymétrique qu'une émotion spontanée. Le champ "asymmetryDetails" donne le détail par zone (smile, brow, cheekSquint, eyeSquint, etc.) — utilise les zones les plus déviantes pour illustrer ton analyse
- Latence de réponse : si elle augmente vs la baseline = charge cognitive accrue (le cerveau bosse plus dur)
- Pattern de clignement : "blinkPattern" révèle le schéma. "suppression_then_burst" = le taux chute pendant la question puis explose juste après (charge cognitive classique, Leal & Vrij 2008). "blinkRateFirst/Middle/Last" donnent le taux en blinks/min pour chaque tiers de la question
- Micro-expressions : flash émotionnel de moins d'une demi-seconde = réaction involontaire que le cerveau n'a pas pu filtrer
- Stress composite ("stressComposite" de 0 à 1) : synthèse de tous les marqueurs de tension. Compare baseline vs question sensible
- Confort/Inconfort ("comfortDelta") : positif = à l'aise, négatif = inconfort. Lip press + lip roll + mâchoire serrée font baisser ce score
- Cluster convergent : quand 3+ indicateurs pointent dans la même direction = signal fort
- Channel discrepancy : quand le visage dit une chose et la voix dit autre chose = conflit émotionnel interne
- Pitch vocal (F0) : la fréquence fondamentale de la voix monte sous stress/excitation (~+2 à +20 Hz). C'est le biomarqueur vocal le plus fiable. "pitchMean" = fréquence moyenne en Hz, "pitchVariability" = écart-type. Compare TOUJOURS la TARGET vs les BASELINE. Le visage capture la VALENCE (positif/négatif), la voix capture l'AROUSAL (calme/excité) — quand les deux divergent, c'est un conflit émotionnel interne
- Pose de la tête : "headStability" mesure les mouvements de tête. ~0 = figée (freeze response = charge cognitive intense). >1 = agitée (nervosité). "headMovementPattern" : "frozen" = tête immobile (signal fort), "restless" = agitée, "nodding" = hochements oui, "shaking" = mouvements non. "headYawRange"/"headPitchRange" = amplitude en degrés. Une tête qui se fige sur la TARGET mais bouge naturellement sur les BASELINE = charge cognitive. Des micro-hochements involontaires (nodding/shaking) pendant une réponse = réaction inconsciente
LA QUESTION SENSIBLE : "${targetQuestion}"
${transcriptionBlock}
DONNÉES CAPTEURS (tu as les chiffres mais tu ne les cites JAMAIS tel quel — tu les traduis en images parlantes) :
${JSON.stringify(capteurData, null, 2)}
COMMENT LIRE LES DONNÉES :
- Chaque question a un bloc "behavioralIndices" avec les indices pré-calculés
- Compare TOUJOURS la question type "TARGET" (question 4) vs les questions type "BASELINE" (1, 2, 3, 5)
- Les deltas les plus intéressants : duchenneScore qui chute, asymmetryScore qui grimpe, blinkPattern qui passe en "suppression_then_burst", stressComposite qui bondit, comfortDelta qui plonge en négatif
- Si "smileOnsetSpeed" = "fast" sur la TARGET mais "gradual" sur les BASELINE → le sourire a changé de nature
- Si "asymmetryDetails.smile" est élevé sur TARGET → le sourire est devenu asymétrique = émotion filtrée
- Si "pitchMean" monte sur TARGET vs BASELINE → stress/excitation vocale. Si "pitchVariability" grimpe → la voix devient instable (hésitation, émotion). Si le pitch monte mais le visage reste neutre = channel discrepancy classique (la voix trahit ce que le visage cache). Si pitchSampleCount est faible ou 0 → la personne a peu/pas parlé sur cette question (ce qui est aussi un signal intéressant)
- Si "headMovementPattern" = "frozen" sur TARGET mais "normal" sur BASELINE → la tête s'est figée = freeze response classique sous charge cognitive. Si "headStability" chute vers 0 sur TARGET → la personne a gelé sur place. Si "headMovementPattern" = "shaking" pendant une affirmation ou "nodding" pendant une négation → le corps contredit les mots (emblematic slip). Si "headYawRange" ou "headPitchRange" explose vs BASELINE → agitation/nervosité
RÈGLES DE TRADUCTION (TRÈS IMPORTANT) :
${lang === 'en' 
  ? `- Instead of "blinks +60%" → "your blink rate dropped during the question then exploded right after — classic cognitive overload pattern"
- Instead of "facial asymmetry 0.15" → "your left face and right face were telling two different stories — a sign of filtered emotion"
- Instead of "lip compression +45%" → "your lips locked up tight — what behavioral analysts call a 'suppression reflex', your brain was holding something back"
- Instead of "brow tension +30%" → "your eyebrows contracted — the brain's stress alarm went off"
- Instead of "micro-expression of fear detected" → "your face leaked a flash of emotion in a split second — an involuntary micro-reaction your brain couldn't filter"
- Instead of "smile without cheekSquint" → "your mouth smiled but your eyes didn't follow — a social smile, not a genuine Duchenne smile"
- Instead of "smileOnsetSpeed: fast" → "that smile snapped on way too quick — genuine smiles build up gradually, this one popped like a reflex"
- Instead of "blinkPattern: suppression_then_burst" → "your blinks went quiet during the question then fired off in a burst right after — your brain was so busy processing it forgot to blink"
- Instead of "comfortDelta: -0.42" → "your comfort zone completely collapsed on that question — lip lock, jaw tension, the works"
- Instead of "asymmetryDetails.smile: 0.15" → "the left side of your smile and the right side weren't matching — a telltale sign of a filtered emotion"
- Instead of "pitchMean: 168 vs 142" → "your voice pitched up on that question — your vocal cords tightened under the pressure, classic stress response even when the face stays composed"
- Instead of "pitchVariability: 28 vs 12" → "your voice got shaky and inconsistent — while your face played it cool, your vocal cords were all over the place"
- Instead of "headMovementPattern: frozen" → "your head completely froze up — you stopped moving entirely, like your brain hit pause on your body while it was busy processing"
- Instead of "headStability: 0.1" → "you went statue mode — zero head movement, classic freeze response when the brain is in overdrive"
- Instead of "headMovementPattern: shaking" → "your head was doing these little side-to-side movements — like your body was saying 'no' even if your mouth wasn't"
- You can say "the scan picked up...", "behaviorally speaking...", "your profile shows..." but NEVER quote a percentage or raw number`
  : `- Au lieu de "clignements +60%" → "ton taux de clignement a chuté pendant la question puis a explosé juste après — schéma classique de surcharge cognitive"
- Au lieu de "asymétrie faciale 0.15" → "ton visage gauche et ton visage droit racontaient pas la même histoire — signe d'émotion filtrée"
- Au lieu de "compression lèvres +45%" → "tes lèvres se sont verrouillées — ce que les analystes comportementaux appellent un 'réflexe de suppression', ton cerveau retenait quelque chose"
- Au lieu de "tension sourcils +30%" → "tes sourcils se sont contractés — l'alarme stress du cerveau s'est déclenchée"
- Au lieu de "micro-expression de peur détectée" → "ton visage a laissé échapper un flash d'émotion en une fraction de seconde — une micro-réaction involontaire que ton cerveau a pas pu filtrer"
- Au lieu de "sourire sans cheekSquint" → "ta bouche souriait mais tes yeux suivaient pas — un sourire social, pas un vrai sourire Duchenne"
- Au lieu de "smileOnsetSpeed: fast" → "ce sourire est apparu trop vite — un vrai sourire se construit progressivement, celui-là a claqué comme un réflexe"
- Au lieu de "blinkPattern: suppression_then_burst" → "tes clignements se sont mis en pause pendant la question puis sont repartis en rafale juste après — ton cerveau était tellement occupé à processer qu'il a oublié de cligner"
- Au lieu de "comfortDelta: -0.42" → "ta zone de confort s'est complètement effondrée sur cette question — lip lock, mâchoire tendue, tout le package"
- Au lieu de "asymmetryDetails.smile: 0.15" → "le côté gauche de ton sourire et le côté droit matchaient plus — signe révélateur d'émotion filtrée"
- Au lieu de "pitchMean: 168 vs 142" → "ta voix est montée dans les aigus sur cette question — tes cordes vocales se sont tendues sous la pression, réponse de stress classique même quand le visage reste zen"
- Au lieu de "pitchVariability: 28 vs 12" → "ta voix est devenue tremblante et instable — pendant que ton visage jouait la carte du calme, tes cordes vocales partaient dans tous les sens"
- Au lieu de "headMovementPattern: frozen" → "ta tête s'est complètement figée — plus aucun mouvement, comme si ton cerveau avait appuyé sur pause pendant qu'il traitait l'info"
- Au lieu de "headStability: 0.1" → "mode statue activé — zéro mouvement de tête, réponse de freeze classique quand le cerveau tourne en surrégime"
- Au lieu de "headMovementPattern: shaking" → "ta tête faisait ces petits mouvements gauche-droite — comme si ton corps disait 'non' même si ta bouche disait rien"
- Tu peux dire "le scan a capté...", "comportementalement...", "ton profil montre..." mais JAMAIS citer un pourcentage ou un chiffre brut`}
STRUCTURE DU RAPPORT :
${lang === 'en'
  ? `😎 BASELINE — Describe in 1-2 sentences how the person was during the easy questions. Use the behavioral indices! Was the Duchenne score high (genuine comfort)? Was the blink pattern steady? Was the comfort delta positive? Was the asymmetry low (natural expressions)? This is their comfort zone.
🔥 THE SHIFT — Tell what happened when we asked "${targetQuestion}". This is the key moment! Describe the behavioral shift like you're narrating a profiler breakdown on YouTube. Quote the question! ("When we asked you about..."). Cover these dimensions naturally (not as a list, weave them into the narrative):
  • Authenticity: Did the Duchenne score drop? Did the smile onset speed change from gradual to fast? Did asymmetry spike on the smile zone?
  • Stress signals: Did stressComposite jump? Lip press, brow tension, jaw clench — what fired up? Did comfortDelta plunge negative?
  • Cognitive load: Response time change, blink pattern shift — did it go into suppression_then_burst?
  • Face/voice sync: Did the pitch go up while the face stayed neutral? That's a channel discrepancy — the voice betrayed what the face was hiding. Or did pitch stay flat confirming genuine calm?
  • Body freeze: Did the head freeze up (headMovementPattern: frozen)? That's the brain pulling all resources to process — the body goes on standby. Or did it get restless? Micro-nods or head shakes during answers can reveal unconscious reactions
  • Words vs body: If transcription available — what did they say? Were the words vague, evasive, overly detailed? Did the words contradict what the body was showing?
💀 IF micro-expressions detected — "Your face leaked a micro-reaction — a flash of [emotion] that lasted less than half a second. That's your brain's raw, unfiltered response before your conscious mind could step in"
⚡ THE AFTERMATH — Did the person return to baseline after (question 5)? Compare stressComposite and comfortDelta of question 5 vs questions 1-3. If still elevated: "And even after the question, your stress markers stayed elevated... your brain was still processing 🤔"
🎤 VERDICT — ONE killer sentence, memorable, perfect for Instagram/TikTok screenshot. This is a BEHAVIORAL verdict, not an accusation. Examples:
- "My verdict: that question hit a nerve your poker face couldn't hide 🎭"
- "Verdict: total behavioral alignment — your face, your voice, your vibe, all in sync ✨"
- "Verdict: your mouth was chill but your brain was in overdrive — something about that question made your whole system spike 🧠"
- "Verdict: Duchenne smile intact, stress flat, zero micro-leaks — behavioral profile: genuine comfort zone 😇"
- "Verdict: classic cluster — lip lock + blink suppression + lost Duchenne + fast-snap smile. That question activated something deep 🔥"
⚠️ Reminder: Kiikon is a fun behavioral analysis game between friends, not a professional assessment! Take it as entertainment 😄`
  : `😎 BASELINE — Décris en 1-2 phrases comment la personne était sur les questions tranquilles. Utilise les indices comportementaux ! Le score Duchenne était élevé (confort genuien) ? Le pattern de clignement était régulier ? Le confort delta était positif ? L'asymétrie était basse (expressions naturelles) ? C'est sa zone de confort.
🔥 LE SHIFT — Raconte ce qui s'est passé quand on a posé "${targetQuestion}". C'est le moment clé ! Décris le changement comportemental comme si tu faisais une analyse de profiler YouTube. Cite la question ! ("Quand on t'a demandé si..."). Couvre ces dimensions naturellement (pas en liste, tisse-les dans le récit) :
  • Authenticité : Le score Duchenne a chuté ? Le sourire est passé de graduel à instantané (smileOnsetSpeed) ? L'asymétrie a grimpé sur la zone sourire ?
  • Signaux de stress : Le stressComposite a bondi ? Lip press, tension sourcils, mâchoire serrée — qu'est-ce qui s'est activé ? Le comfortDelta a plongé en négatif ?
  • Charge cognitive : Changement de temps de réponse, pattern de clignement — est-ce passé en suppression_then_burst ?
  • Sync visage/voix : Est-ce que le pitch vocal est monté alors que le visage restait neutre ? C'est une channel discrepancy — la voix a trahi ce que le visage cachait. Ou bien le pitch est resté stable confirmant un calme genuien ?
  • Freeze corporel : Est-ce que la tête s'est figée (headMovementPattern: frozen) ? C'est le cerveau qui mobilise toutes ses ressources pour traiter l'info — le corps se met en veille. Ou au contraire, agitation ? Des micro-hochements oui/non pendant les réponses peuvent révéler des réactions inconscientes
  • Mots vs corps : Si transcription disponible — qu'est-ce qu'elle a dit ? Les mots étaient vagues, évasifs, trop détaillés ? Les mots contredisaient ce que le corps montrait ?
💀 SI micro-expressions détectées — "Ton visage a laissé fuiter une micro-réaction — un flash de [émotion] qui a duré moins d'une demi-seconde. C'est la réponse brute de ton cerveau, avant que le filtre conscient puisse intervenir"
⚡ L'APRÈS — Est-ce que la personne est revenue à sa baseline après (question 5) ? Compare stressComposite et comfortDelta de la question 5 vs questions 1-3. Si encore élevé : "Et même après la question, tes marqueurs de stress sont restés élevés... ton cerveau était encore en train de traiter 🤔"
🎤 VERDICT — UNE phrase assassine, mémorable, parfaite pour un screenshot Instagram/TikTok. C'est un verdict COMPORTEMENTAL, pas une accusation. Exemples :
- "Mon verdict : cette question a touché un nerf que ta poker face a pas pu planquer 🎭"
- "Verdict : alignement comportemental total — visage, voix, vibe, tout est synchro ✨"
- "Verdict : ta bouche était zen mais ton cerveau tournait en surrégime — cette question a fait vriller tout le système 🧠"
- "Verdict : sourire Duchenne intact, stress plat, zéro micro-fuite — profil comportemental : zone de confort genuiene 😇"
- "Verdict : cluster classique — lip lock + suppression de clignement + perte du Duchenne + sourire instantané. Cette question a activé quelque chose de profond 🔥"
⚠️ Rappel : Kiikon est un jeu d'analyse comportementale entre potes, pas une évaluation professionnelle ! À prendre au 2nd degré 😄`}
${lang === 'en'
  ? `RESPOND ENTIRELY IN ENGLISH. Use casual, fun, profiler-bro English like you're breaking down body language on a YouTube video with a friend. NO French words. Maximum 300 words. Be FUN, VIVID, INSIGHTFUL, and ZERO numbers. Use behavioral terms but always explain them in casual language right after.`
  : `Réponds entièrement en français. Maximum 300 mots. Sois FUN, IMAGÉ, PERSPICACE, et ZÉRO chiffre. Comme si tu faisais une analyse comportementale YouTube pour un pote. Utilise les termes comportementaux mais explique-les toujours en langage courant juste après.`}`;

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
