-- Kluup — Contextual follow-up questions
-- Run AFTER seed.sql + seed_themes.sql + seed_cut.sql.
-- Each INSERT references the parent via subquery on question->>'fr'.
-- Multiple rows per parent = one drawn randomly at trigger time.

CREATE TABLE IF NOT EXISTS contextual_questions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  template           jsonb NOT NULL
);

INSERT INTO contextual_questions (parent_question_id, template) VALUES

-- ===========================================================
-- HELLO STRANGER — Type A
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''arriver en retard à son propre anniversaire' LIMIT 1),
  '{"fr": "{pseudo}, t''assumes ? Raconte la dernière fois que t''étais en retard.", "en": "{pseudo}, do you own it? Tell us about the last time you were late.", "es": "{pseudo}, ¿lo asumes? Cuéntanos la última vez que llegaste tarde.", "de": "{pseudo}, stehst du dazu? Erzähl vom letzten Mal, als du zu spät warst."}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir un dossier « photos de honte » sur son téléphone' LIMIT 1),
  '{"fr": "{pseudo}, il y a quoi dans ce dossier exactement ?", "en": "{pseudo}, what exactly is in that folder?", "es": "{pseudo}, ¿qué hay exactamente en esa carpeta?", "de": "{pseudo}, was ist genau in diesem Ordner?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir pleuré en regardant une pub' LIMIT 1),
  '{"fr": "{pseudo}, c''était quelle pub ? T''as les larmes si on la montre maintenant ?", "en": "{pseudo}, which ad was it? Would you tear up if we played it now?", "es": "{pseudo}, ¿qué anuncio era? ¿Se te llenan los ojos si lo ponemos ahora?", "de": "{pseudo}, welche Werbung war es? Würdest du weinen, wenn wir sie zeigen?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir fait semblant de ne pas voir un message' LIMIT 1),
  '{"fr": "{pseudo}, c''était de qui le message ? T''as finalement répondu ?", "en": "{pseudo}, whose message was it? Did you ever reply?", "es": "{pseudo}, ¿de quién era el mensaje? ¿Lo respondiste al final?", "de": "{pseudo}, von wem war die Nachricht? Hast du sie je beantwortet?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir fait semblant de ne pas voir un message' LIMIT 1),
  '{"fr": "{pseudo}, quelqu''un dans cette pièce t''a peut-être déjà subi. Tu veux qu''on vote ?", "en": "{pseudo}, maybe someone here has been on the receiving end. Want us to vote?", "es": "{pseudo}, quizás alguien aquí ya lo vivió. ¿Votamos?", "de": "{pseudo}, vielleicht hat das jemand hier schon erlebt. Abstimmung?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible de tenir une rancune sans jamais en parler' LIMIT 1),
  '{"fr": "{pseudo}, t''en veux à quelqu''un en ce moment ? On t''écoute.", "en": "{pseudo}, are you holding a grudge right now? We''re listening.", "es": "{pseudo}, ¿le guardas rencor a alguien ahora mismo? Te escuchamos.", "de": "{pseudo}, bist du gerade jemandem böse? Wir hören zu."}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir googlé son ex récemment' LIMIT 1),
  '{"fr": "{pseudo}, t''as trouvé quoi ? Jaloux·se ou soulagé·e ?", "en": "{pseudo}, what did you find? Jealous or relieved?", "es": "{pseudo}, ¿qué encontraste? ¿Con envidia o aliviado/a?", "de": "{pseudo}, was hast du gefunden? Eifersüchtig oder erleichtert?"}'
),

-- ===========================================================
-- HELLO STRANGER — Type B
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà mangé directement dans le pot de Nutella ?' LIMIT 1),
  '{"fr": "{pseudo}, à quelle heure et dans quel état c''était ?", "en": "{pseudo}, what time was it and what state were you in?", "es": "{pseudo}, ¿a qué hora y en qué estado estabas?", "de": "{pseudo}, wie spät war es und in welchem Zustand warst du?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà fait semblant de dormir pour éviter une conversation ?' LIMIT 1),
  '{"fr": "{pseudo}, c''était avec qui et sur quel sujet ?", "en": "{pseudo}, who was it with and what was the topic?", "es": "{pseudo}, ¿con quién era y de qué tema?", "de": "{pseudo}, mit wem und worüber?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà annulé des plans au dernier moment juste pour rester chez toi ?' LIMIT 1),
  '{"fr": "{pseudo}, t''as inventé quelle excuse ? La personne l''a crue ?", "en": "{pseudo}, what excuse did you make up? Did they believe you?", "es": "{pseudo}, ¿qué excusa inventaste? ¿Te creyeron?", "de": "{pseudo}, welche Ausrede hast du erfunden? Hat sie jemand geglaubt?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà bloqué quelqu''un par lâcheté ?' LIMIT 1),
  '{"fr": "{pseudo}, cette personne sait pourquoi ? T''as des regrets ?", "en": "{pseudo}, does that person know why? Any regrets?", "es": "{pseudo}, ¿esa persona sabe por qué? ¿Tienes arrepentimientos?", "de": "{pseudo}, weiß die Person warum? Hast du Reue?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà espionné quelqu''un sur les réseaux sans qu''il le sache ?' LIMIT 1),
  '{"fr": "{pseudo}, t''en es à combien de posts remontés ? Cette personne est dans la pièce ?", "en": "{pseudo}, how far back did you scroll? Is that person in this room?", "es": "{pseudo}, ¿cuántos posts repasaste? ¿Esa persona está en la sala?", "de": "{pseudo}, wie weit bist du zurückgescrollt? Ist die Person hier im Raum?"}'
),

-- ===========================================================
-- HELLO STRANGER — Type C
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'C''est quoi ton talent caché que personne dans ce groupe ne connaît ?' LIMIT 1),
  '{"fr": "{pseudo}, prouve-le maintenant.", "en": "{pseudo}, prove it right now.", "es": "{pseudo}, demuéstralo ahora mismo.", "de": "{pseudo}, beweise es jetzt."}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'C''est quoi ton plus grand regret de la semaine passée ?' LIMIT 1),
  '{"fr": "{pseudo}, t''aurais fait quoi différemment ?", "en": "{pseudo}, what would you have done differently?", "es": "{pseudo}, ¿qué habrías hecho diferente?", "de": "{pseudo}, was hättest du anders gemacht?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'C''est quoi quelque chose que tout le monde aime et que toi tu détestes ?' LIMIT 1),
  '{"fr": "{pseudo}, t''as déjà essayé de comprendre pourquoi les autres aiment ça ?", "en": "{pseudo}, have you ever tried to understand why others love it?", "es": "{pseudo}, ¿has intentado alguna vez entender por qué a otros les gusta?", "de": "{pseudo}, hast du je versucht zu verstehen, warum andere das mögen?"}'
),

-- ===========================================================
-- APÉRO — Type A
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible de raconter une histoire de plus en plus exagérée à chaque fois' LIMIT 1),
  '{"fr": "{pseudo}, raconte cette histoire — on va voir si elle grossit encore.", "en": "{pseudo}, tell that story — let''s see if it keeps growing.", "es": "{pseudo}, cuenta esa historia — veremos si sigue creciendo.", "de": "{pseudo}, erzähl die Geschichte — mal sehen, ob sie noch größer wird."}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir envoyé un message regrettable sous l''influence' LIMIT 1),
  '{"fr": "{pseudo}, c''était à qui ? T''en es où avec cette personne aujourd''hui ?", "en": "{pseudo}, who was it to? Where do things stand with them today?", "es": "{pseudo}, ¿a quién fue? ¿Cómo estás con esa persona hoy?", "de": "{pseudo}, an wen ging es? Wie ist es heute mit der Person?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir embrassé quelqu''un en soirée et de l''avoir regretté' LIMIT 1),
  '{"fr": "{pseudo}, c''était qui et quelle soirée ?", "en": "{pseudo}, who was it and which party?", "es": "{pseudo}, ¿quién era y en qué fiesta?", "de": "{pseudo}, wer war es und auf welcher Party?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible de prétendre être sobre alors qu''il est parti' LIMIT 1),
  '{"fr": "{pseudo}, le groupe valide ou pas ? Donne 3 preuves que t''étais sobre.", "en": "{pseudo}, does the group agree? Give 3 proofs you were sober.", "es": "{pseudo}, ¿el grupo lo valida? Danos 3 pruebas de que estabas sobrio/a.", "de": "{pseudo}, stimmt die Gruppe zu? Gib 3 Beweise, dass du nüchtern warst."}'
),

-- ===========================================================
-- APÉRO — Type B
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà dit « je t''aime » en premier sans être sûr·e de la réponse ?' LIMIT 1),
  '{"fr": "{pseudo}, qu''est-ce qu''il ou elle t''a répondu ?", "en": "{pseudo}, what did they say back?", "es": "{pseudo}, ¿qué te respondió?", "de": "{pseudo}, was hat sie/er geantwortet?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà dit « je t''aime » en premier sans être sûr·e de la réponse ?' LIMIT 1),
  '{"fr": "{pseudo}, fierté ou gêne en y repensant ?", "en": "{pseudo}, proud or embarrassed looking back?", "es": "{pseudo}, ¿orgullo o vergüenza al recordarlo?", "de": "{pseudo}, stolz oder verlegen im Rückblick?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà envoyé un message à quelqu''un que t''aurais jamais envoyé sobre ?' LIMIT 1),
  '{"fr": "{pseudo}, c''était à qui et t''en es où avec ça aujourd''hui ?", "en": "{pseudo}, who was it to and where do you stand today?", "es": "{pseudo}, ¿a quién fue y cómo estás con eso hoy?", "de": "{pseudo}, an wen ging es und wie stehst du heute dazu?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà fait quelque chose d''irrationnel par jalousie ?' LIMIT 1),
  '{"fr": "{pseudo}, t''as fait quoi exactement ? Niveau irrationnel de 1 à 10.", "en": "{pseudo}, what exactly did you do? Irrational level, 1 to 10.", "es": "{pseudo}, ¿qué hiciste exactamente? Nivel de irracional del 1 al 10.", "de": "{pseudo}, was genau hast du getan? Irrationalitätslevel 1 bis 10."}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà flirté avec quelqu''un juste pour voir sa réaction ?' LIMIT 1),
  '{"fr": "{pseudo}, la réaction était à la hauteur ?", "en": "{pseudo}, was the reaction what you expected?", "es": "{pseudo}, ¿la reacción fue la esperada?", "de": "{pseudo}, war die Reaktion wie erwartet?"}'
),

-- ===========================================================
-- APÉRO — Type C
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'C''est quoi la chose la plus impulsive que tu aies faite en soirée ?' LIMIT 1),
  '{"fr": "{pseudo}, t''as des regrets ou t''en es fier·e ?", "en": "{pseudo}, any regrets or are you proud?", "es": "{pseudo}, ¿tienes arrepentimientos o estás orgulloso/a?", "de": "{pseudo}, Reue oder Stolz?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'C''est quoi ton plus grand regret de soirée ?' LIMIT 1),
  '{"fr": "{pseudo}, t''en as parlé à la personne concernée ?", "en": "{pseudo}, have you talked to the person involved?", "es": "{pseudo}, ¿hablaste con la persona implicada?", "de": "{pseudo}, hast du mit der betroffenen Person gesprochen?"}'
),

-- ===========================================================
-- NO FILTER — Type A
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir balancé un secret « accidentellement »' LIMIT 1),
  '{"fr": "{pseudo}, c''était quel secret et la personne sait que c''est toi ?", "en": "{pseudo}, what was the secret and does that person know it was you?", "es": "{pseudo}, ¿cuál era el secreto y esa persona sabe que fuiste tú?", "de": "{pseudo}, was war das Geheimnis und weiß die Person, dass du es warst?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible de lire les messages de son/sa partenaire s''il laisse son téléphone ouvert' LIMIT 1),
  '{"fr": "{pseudo}, t''as déjà trouvé quelque chose ou c''est juste de la curiosité préventive ?", "en": "{pseudo}, have you ever found something, or is it just preventive curiosity?", "es": "{pseudo}, ¿alguna vez encontraste algo o es solo curiosidad preventiva?", "de": "{pseudo}, hast du je etwas gefunden oder ist es nur präventive Neugier?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir humilié quelqu''un en public, même gentiment' LIMIT 1),
  '{"fr": "{pseudo}, raconte. Cette personne est dans la pièce ?", "en": "{pseudo}, tell us. Is that person in the room?", "es": "{pseudo}, cuéntanos. ¿Esa persona está en la sala?", "de": "{pseudo}, erzähl uns. Ist die Person hier im Raum?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir trompé quelqu''un ou de l''avoir envisagé sérieusement' LIMIT 1),
  '{"fr": "{pseudo}, t''assumes ou t''expliques ?", "en": "{pseudo}, do you own it or explain it?", "es": "{pseudo}, ¿lo asumes o lo explicas?", "de": "{pseudo}, stehst du dazu oder erklärst du dich?"}'
),

-- ===========================================================
-- NO FILTER — Type B
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà flirté avec quelqu''un en couple (toi ou l''autre) ?' LIMIT 1),
  '{"fr": "{pseudo}, ça a mené où ?", "en": "{pseudo}, where did that lead?", "es": "{pseudo}, ¿adónde llevó eso?", "de": "{pseudo}, wohin hat das geführt?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà révélé un secret qu''on t''avait confié ?' LIMIT 1),
  '{"fr": "{pseudo}, c''était quel genre de secret ? La personne te fait encore confiance ?", "en": "{pseudo}, what kind of secret was it? Does that person still trust you?", "es": "{pseudo}, ¿qué tipo de secreto era? ¿Esa persona aún confía en ti?", "de": "{pseudo}, was für ein Geheimnis war es? Vertraut die Person dir noch?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà laissé quelqu''un prendre le blâme à ta place ?' LIMIT 1),
  '{"fr": "{pseudo}, cette personne sait que c''était toi ? T''as jamais avoué ?", "en": "{pseudo}, does that person know it was you? Have you ever confessed?", "es": "{pseudo}, ¿esa persona sabe que fuiste tú? ¿Nunca lo confesaste?", "de": "{pseudo}, weiß die Person, dass du es warst? Hast du es je gestanden?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà trompé quelqu''un que t''aimais vraiment ?' LIMIT 1),
  '{"fr": "{pseudo}, tu t''en veux encore ?", "en": "{pseudo}, do you still blame yourself?", "es": "{pseudo}, ¿aún te lo reproches?", "de": "{pseudo}, gibst du dir noch die Schuld?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà coupé quelqu''un de ta vie sans lui expliquer pourquoi ?' LIMIT 1),
  '{"fr": "{pseudo}, cette personne méritait une explication ?", "en": "{pseudo}, did that person deserve an explanation?", "es": "{pseudo}, ¿esa persona merecía una explicación?", "de": "{pseudo}, hätte die Person eine Erklärung verdient?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà fait quelque chose dont t''as honte et que personne ne sait ?' LIMIT 1),
  '{"fr": "{pseudo}, là tu viens de le dire au groupe — t''as l''air comment ?", "en": "{pseudo}, you just told the whole group — how does that feel?", "es": "{pseudo}, acabas de decírselo al grupo entero — ¿cómo te sientes?", "de": "{pseudo}, du hast es gerade allen erzählt — wie fühlt sich das an?"}'
),

-- ===========================================================
-- NO FILTER — Type C
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'C''est quoi quelque chose que tu penses et que tu n''oses jamais dire à voix haute ?' LIMIT 1),
  '{"fr": "{pseudo}, c''est maintenant ou jamais.", "en": "{pseudo}, now or never.", "es": "{pseudo}, ahora o nunca.", "de": "{pseudo}, jetzt oder nie."}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Si tu devais avouer quelque chose à quelqu''un dans cette pièce, ce serait quoi ?' LIMIT 1),
  '{"fr": "{pseudo}, tu le dis maintenant ? Cette personne est là.", "en": "{pseudo}, are you saying it now? That person is here.", "es": "{pseudo}, ¿lo dices ahora? Esa persona está aquí.", "de": "{pseudo}, sagst du es jetzt? Die Person ist hier."}'
),

-- ===========================================================
-- UNMASKED — Type A
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''idéaliser quelqu''un jusqu''à la déception' LIMIT 1),
  '{"fr": "{pseudo}, ça t''est arrivé récemment ? T''en es où maintenant ?", "en": "{pseudo}, did this happen recently? Where are you now?", "es": "{pseudo}, ¿pasó recientemente? ¿Cómo estás ahora?", "de": "{pseudo}, ist das kürzlich passiert? Wie stehst du jetzt dazu?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible de saboter quelque chose qui allait bien par peur que ça dure' LIMIT 1),
  '{"fr": "{pseudo}, t''en es conscient·e sur le moment ou seulement après ?", "en": "{pseudo}, are you aware of it in the moment or only after?", "es": "{pseudo}, ¿eres consciente de ello en el momento o solo después?", "de": "{pseudo}, bist du dir im Moment bewusst darüber oder erst danach?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''être encore marqué·e par une rupture ancienne' LIMIT 1),
  '{"fr": "{pseudo}, ça remonte à quand ? T''es à quel pourcentage de guéri·e ?", "en": "{pseudo}, how long ago was it? What percentage healed would you say?", "es": "{pseudo}, ¿cuándo fue? ¿Qué porcentaje curado/a dirías?", "de": "{pseudo}, wie lange ist das her? Zu wie viel Prozent bist du drüber weg?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir une peur inavouée de l''abandon' LIMIT 1),
  '{"fr": "{pseudo}, ça vient d''où cette peur, à ton avis ?", "en": "{pseudo}, where does that fear come from, do you think?", "es": "{pseudo}, ¿de dónde crees que viene ese miedo?", "de": "{pseudo}, woher kommt diese Angst deiner Meinung nach?"}'
),

-- ===========================================================
-- UNMASKED — Type B
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà aimé quelqu''un en silence pendant longtemps sans jamais rien dire ?' LIMIT 1),
  '{"fr": "{pseudo}, cette personne est dans la pièce ?", "en": "{pseudo}, is that person in the room?", "es": "{pseudo}, ¿esa persona está en la sala?", "de": "{pseudo}, ist diese Person im Raum?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà aimé quelqu''un en silence pendant longtemps sans jamais rien dire ?' LIMIT 1),
  '{"fr": "{pseudo}, tu l''as dit un jour ou c''est resté dans ta tête pour toujours ?", "en": "{pseudo}, did you ever say it? Or did it stay in your head forever?", "es": "{pseudo}, ¿lo dijiste alguna vez? ¿O se quedó para siempre en tu cabeza?", "de": "{pseudo}, hast du es je gesagt? Oder blieb es für immer in deinem Kopf?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà eu peur que les gens te quittent s''ils te connaissaient vraiment ?' LIMIT 1),
  '{"fr": "{pseudo}, qu''est-ce qu''ils ne savent pas sur toi, là dans cette pièce ?", "en": "{pseudo}, what don''t they know about you, right here in this room?", "es": "{pseudo}, ¿qué no saben sobre ti en esta sala?", "de": "{pseudo}, was wissen sie nicht über dich, hier in diesem Raum?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà dit « je vais bien » alors que tu vivais une période difficile ?' LIMIT 1),
  '{"fr": "{pseudo}, quelqu''un dans cette pièce t''a vu à travers ?", "en": "{pseudo}, did anyone in this room see through it?", "es": "{pseudo}, ¿alguien en esta sala lo vio a través?", "de": "{pseudo}, hat jemand in diesem Raum es durchschaut?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà coupé quelqu''un de ta vie pour te protéger, même si tu l''aimais encore ?' LIMIT 1),
  '{"fr": "{pseudo}, tu penses encore à cette personne ?", "en": "{pseudo}, do you still think about that person?", "es": "{pseudo}, ¿aún piensas en esa persona?", "de": "{pseudo}, denkst du noch an diese Person?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà fait une erreur grave dans une relation dont tu t''en veux encore ?' LIMIT 1),
  '{"fr": "{pseudo}, tu aurais fait quoi différemment ?", "en": "{pseudo}, what would you have done differently?", "es": "{pseudo}, ¿qué habrías hecho diferente?", "de": "{pseudo}, was hättest du anders gemacht?"}'
),

-- ===========================================================
-- UNMASKED — Type C
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'C''est quoi ta plus grande peur dans une relation proche ?' LIMIT 1),
  '{"fr": "{pseudo}, t''as déjà vécu ça ? C''est une peur abstraite ou une cicatrice ?", "en": "{pseudo}, have you lived through that? Abstract fear or a scar?", "es": "{pseudo}, ¿lo has vivido? ¿Miedo abstracto o cicatriz?", "de": "{pseudo}, hast du das erlebt? Abstrakte Angst oder eine Narbe?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'C''est quoi le moment de ta vie où tu t''es senti·e le plus seul·e ?' LIMIT 1),
  '{"fr": "{pseudo}, qu''est-ce qui t''a aidé à en sortir ?", "en": "{pseudo}, what helped you get through it?", "es": "{pseudo}, ¿qué te ayudó a salir de eso?", "de": "{pseudo}, was hat dir geholfen, da rauszukommen?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Si tu devais écrire une lettre à ta version d''il y a 10 ans, tu lui dirais quoi ?' LIMIT 1),
  '{"fr": "{pseudo}, et toi dans 10 ans — qu''est-ce qu''il te dirait ?", "en": "{pseudo}, and you in 10 years — what would they say to you?", "es": "{pseudo}, y tú en 10 años — ¿qué te diría?", "de": "{pseudo}, und du in 10 Jahren — was würde er dir sagen?"}'
),

-- ===========================================================
-- SEED_THEMES — APÉRO
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà avoué quelque chose d''important à quelqu''un parce que tu avais bu ?' LIMIT 1),
  '{"fr": "{pseudo}, c''était quoi et cette personne s''en souvient ?", "en": "{pseudo}, what was it and does that person remember?", "es": "{pseudo}, ¿qué fue y esa persona lo recuerda?", "de": "{pseudo}, was war es und erinnert sich die Person?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Quelle vérité as-tu dite un soir que tu n''aurais jamais dite sobre ?' LIMIT 1),
  '{"fr": "{pseudo}, tu regrettes de l''avoir dite ?", "en": "{pseudo}, do you regret saying it?", "es": "{pseudo}, ¿te arrepientes de haberlo dicho?", "de": "{pseudo}, bereust du es gesagt zu haben?"}'
),

-- ===========================================================
-- SEED_THEMES — NO FILTER
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà ressenti de la jalousie envers quelqu''un dans ce groupe ?' LIMIT 1),
  '{"fr": "{pseudo}, envers qui et pour quoi ?", "en": "{pseudo}, towards whom and for what?", "es": "{pseudo}, ¿hacia quién y por qué?", "de": "{pseudo}, gegenüber wem und wofür?"}'
),

-- ===========================================================
-- SEED_THEMES — UNMASKED
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'Qui du groupe souffre le plus en silence ?' LIMIT 1),
  '{"fr": "{pseudo}, tu confirmes ou tu infirmes ?", "en": "{pseudo}, do you confirm or deny?", "es": "{pseudo}, ¿lo confirmas o lo niegas?", "de": "{pseudo}, bestätigst oder widersprichst du?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Qui du groupe a le plus besoin d''entendre qu''on l''aime ?' LIMIT 1),
  '{"fr": "{pseudo}, quelqu''un dans cette pièce veut profiter de l''occasion ?", "en": "{pseudo}, does anyone in this room want to take the opportunity?", "es": "{pseudo}, ¿alguien en esta sala quiere aprovechar la oportunidad?", "de": "{pseudo}, möchte jemand in diesem Raum die Gelegenheit nutzen?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà sabordé quelque chose de bien parce que tu ne te sentais pas à la hauteur ?' LIMIT 1),
  '{"fr": "{pseudo}, c''était quoi ce truc bien que t''as laissé filer ?", "en": "{pseudo}, what was the good thing you let go?", "es": "{pseudo}, ¿qué era esa cosa buena que dejaste ir?", "de": "{pseudo}, was war das Gute, das du gehen lassen hast?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà pensé que ta vie aurait été différente si une seule décision avait été autre ?' LIMIT 1),
  '{"fr": "{pseudo}, c''était quelle décision ?", "en": "{pseudo}, which decision was it?", "es": "{pseudo}, ¿cuál fue esa decisión?", "de": "{pseudo}, welche Entscheidung war es?"}'
),

-- ===========================================================
-- SEED_CUT — APÉRO
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'Ton pire rencard. Balance tout.' LIMIT 1),
  '{"fr": "{pseudo}, et cette personne, t''as eu des nouvelles depuis ?", "en": "{pseudo}, and that person — any news since?", "es": "{pseudo}, ¿y esa persona, tienes noticias desde entonces?", "de": "{pseudo}, und diese Person — irgendwelche Neuigkeiten seitdem?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Décris ton premier vrai baiser. Plante le décor.' LIMIT 1),
  '{"fr": "{pseudo}, vous vous êtes revus ?", "en": "{pseudo}, did you see each other again?", "es": "{pseudo}, ¿os volvisteis a ver?", "de": "{pseudo}, habt ihr euch wiedergesehen?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà été vraiment amoureux·se ?' LIMIT 1),
  '{"fr": "{pseudo}, c''était qui et ça s''est terminé comment ?", "en": "{pseudo}, who was it and how did it end?", "es": "{pseudo}, ¿quién era y cómo terminó?", "de": "{pseudo}, wer war es und wie hat es geendet?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Quel titre de film résume ta dernière relation ?' LIMIT 1),
  '{"fr": "{pseudo}, c''est un titre optimiste ou catastrophique ?", "en": "{pseudo}, is that an optimistic or catastrophic title?", "es": "{pseudo}, ¿es un título optimista o catastrófico?", "de": "{pseudo}, ist das ein optimistischer oder katastrophaler Titel?"}'
),

-- ===========================================================
-- SEED_CUT — NO FILTER
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as mis combien de temps à oublier ton ex ? Et c''est vraiment réglé ?' LIMIT 1),
  '{"fr": "{pseudo}, vraiment réglé ? Le groupe vote.", "en": "{pseudo}, really over it? The group votes.", "es": "{pseudo}, ¿de verdad superado? El grupo vota.", "de": "{pseudo}, wirklich drüber weg? Die Gruppe stimmt ab."}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Raconte le plus beau râteau que tu t''es pris·e.' LIMIT 1),
  '{"fr": "{pseudo}, t''as retentré ou tu es passé·e à autre chose ?", "en": "{pseudo}, did you try again or move on?", "es": "{pseudo}, ¿lo volviste a intentar o pasaste página?", "de": "{pseudo}, hast du es nochmal versucht oder weitergemacht?"}'
),

-- ===========================================================
-- SEED_CUT — UNMASKED
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'Si tu mourais ce soir, ton plus grand regret ?' LIMIT 1),
  '{"fr": "{pseudo}, t''as prévu de le faire un jour, ce truc que tu regrettes pas avoir fait ?", "en": "{pseudo}, do you plan to do it someday, the thing you regret not having done?", "es": "{pseudo}, ¿tienes pensado hacerlo algún día, lo que lamentas no haber hecho?", "de": "{pseudo}, planst du es irgendwann zu tun, das was du zu bereuen nicht getan hast?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Ce qui te manque de ton dernier ex sérieux ?' LIMIT 1),
  '{"fr": "{pseudo}, t''as cherché ça chez quelqu''un depuis ?", "en": "{pseudo}, have you looked for that in someone since?", "es": "{pseudo}, ¿has buscado eso en alguien desde entonces?", "de": "{pseudo}, hast du das seitdem bei jemandem gesucht?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà craqué pour quelqu''un juste parce qu''il/elle craquait pour toi ?' LIMIT 1),
  '{"fr": "{pseudo}, ça s''est bien passé ou c''était une erreur ?", "en": "{pseudo}, did it go well or was it a mistake?", "es": "{pseudo}, ¿fue bien o fue un error?", "de": "{pseudo}, lief es gut oder war es ein Fehler?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà pleuré pendant ou après l''amour ?' LIMIT 1),
  '{"fr": "{pseudo}, joie ou tristesse ?", "en": "{pseudo}, joy or sadness?", "es": "{pseudo}, ¿alegría o tristeza?", "de": "{pseudo}, Freude oder Trauer?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as des fantasmes qui te surprennent toi-même ?' LIMIT 1),
  '{"fr": "{pseudo}, tu veux en partager un ou garder le mystère ?", "en": "{pseudo}, want to share one or keep the mystery?", "es": "{pseudo}, ¿quieres compartir uno o mantener el misterio?", "de": "{pseudo}, willst du einen teilen oder das Geheimnis bewahren?"}'
);
