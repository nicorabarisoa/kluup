-- Kluup — Contextual follow-up questions
-- Run AFTER seed.sql + seed_themes.sql + seed_cut.sql.
-- Each template references the parent moment explicitly so the question
-- makes sense without replaying what just happened.
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
  '{"fr": "{pseudo}, vu que le groupe te voit comme le roi/la reine du retard — raconte la dernière fois que t''étais en retard à quelque chose d''important.", "en": "{pseudo}, since the group sees you as the ultimate latecomer — tell us about the last time you were seriously late to something.", "es": "{pseudo}, ya que el grupo te ve como el rey/la reina de los retrasos — cuéntanos la última vez que llegaste tarde a algo importante.", "de": "{pseudo}, da die Gruppe dich als den/die ewige Zuspätkommende sieht — erzähl vom letzten Mal, als du zu etwas Wichtigem zu spät warst."}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir un dossier « photos de honte » sur son téléphone' LIMIT 1),
  '{"fr": "{pseudo}, puisque le groupe pense que t''as un dossier de photos de honte caché sur ton téléphone — il y a quoi dedans exactement ?", "en": "{pseudo}, since the group thinks you have a hidden cringe folder on your phone — what''s in it exactly?", "es": "{pseudo}, ya que el grupo cree que tienes una carpeta de fotos vergonzosas escondida en tu teléfono — ¿qué hay en ella exactamente?", "de": "{pseudo}, da die Gruppe denkt, du hast einen versteckten Scham-Ordner auf deinem Handy — was ist genau drin?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir pleuré en regardant une pub' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe pense que t''as déjà pleuré devant une pub — c''était quelle pub et t''aurais les larmes si on la montre maintenant ?", "en": "{pseudo}, since the group thinks you''ve cried watching an ad — which ad was it, and would you tear up if we played it now?", "es": "{pseudo}, ya que el grupo cree que has llorado viendo un anuncio — ¿cuál era y se te llenarían los ojos si lo ponemos ahora?", "de": "{pseudo}, da die Gruppe denkt, du hast schon mal bei einer Werbung geweint — welche war es und würdest du jetzt weinen, wenn wir sie zeigen?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir fait semblant de ne pas voir un message' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe pense que tu fais semblant de pas voir les messages — c''était de qui le dernier que t''as ignoré ? T''as finalement répondu ?", "en": "{pseudo}, since the group thinks you pretend not to see messages — whose was the last one you ignored? Did you ever reply?", "es": "{pseudo}, ya que el grupo cree que finges no ver los mensajes — ¿de quién fue el último que ignoraste? ¿Lo respondiste al final?", "de": "{pseudo}, da die Gruppe denkt, du tust so, als hättest du Nachrichten nicht gesehen — von wem war die letzte, die du ignoriert hast? Hast du je geantwortet?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir fait semblant de ne pas voir un message' LIMIT 1),
  '{"fr": "{pseudo}, puisque le groupe te voit comme quelqu''un qui ignore les messages — quelqu''un dans cette pièce t''a peut-être déjà subi. On vote ?", "en": "{pseudo}, since the group sees you as a message-ignorer — maybe someone here has been on the receiving end. Want us to vote?", "es": "{pseudo}, ya que el grupo te ve como alguien que ignora los mensajes — quizás alguien aquí ya lo ha vivido. ¿Votamos?", "de": "{pseudo}, da die Gruppe dich als Nachrichten-Ignorierer sieht — vielleicht hat jemand hier das schon erlebt. Abstimmung?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible de tenir une rancune sans jamais en parler' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe pense que tu gardes les rancunes bien au chaud sans jamais en parler — t''en veux à quelqu''un en ce moment ? On t''écoute.", "en": "{pseudo}, since the group thinks you keep grudges quietly to yourself — are you holding one against someone right now? We''re listening.", "es": "{pseudo}, ya que el grupo cree que guardas rencores sin decir nada — ¿le guardas rencor a alguien ahora mismo? Te escuchamos.", "de": "{pseudo}, da die Gruppe denkt, du hegst Groll still und leise — bist du gerade jemandem böse? Wir hören zu."}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir googlé son ex récemment' LIMIT 1),
  '{"fr": "{pseudo}, puisque le groupe pense que t''as googlé ton ex récemment — t''as trouvé quoi ? T''es ressorti·e jaloux·se ou soulagé·e ?", "en": "{pseudo}, since the group thinks you''ve recently googled your ex — what did you find? Did it make you jealous or relieved?", "es": "{pseudo}, ya que el grupo cree que has buscado a tu ex recientemente en Google — ¿qué encontraste? ¿Con envidia o aliviado/a?", "de": "{pseudo}, da die Gruppe denkt, du hast deinen Ex kürzlich gegoogelt — was hast du gefunden? Eifersüchtig oder erleichtert?"}'
),

-- ===========================================================
-- HELLO STRANGER — Type B
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà mangé directement dans le pot de Nutella ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué manger dans le pot de Nutella — c''était à quelle heure et dans quel état t''étais ?", "en": "{pseudo}, since you confessed to eating straight from the Nutella jar — what time was it and what state were you in?", "es": "{pseudo}, ya que confesaste comer directamente del bote de Nutella — ¿a qué hora era y en qué estado estabas?", "de": "{pseudo}, da du gestanden hast, direkt aus dem Nutella-Glas zu essen — wie spät war es und in welchem Zustand warst du?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà fait semblant de dormir pour éviter une conversation ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué faire semblant de dormir pour éviter une conversation — c''était avec qui et sur quel sujet tu voulais pas parler ?", "en": "{pseudo}, since you confessed to faking sleep to avoid a conversation — who was it with and what topic were you dodging?", "es": "{pseudo}, ya que confesaste fingir que dormías para evitar una conversación — ¿con quién era y de qué tema querías escapar?", "de": "{pseudo}, da du gestanden hast, Schlafen vorzutäuschen, um einem Gespräch zu entkommen — mit wem war es und welches Thema wolltest du vermeiden?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà annulé des plans au dernier moment juste pour rester chez toi ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué annuler des plans au dernier moment pour rester chez toi — t''as inventé quelle excuse ? La personne l''a crue ?", "en": "{pseudo}, since you confessed to cancelling plans last minute to stay home — what excuse did you make up? Did they believe you?", "es": "{pseudo}, ya que confesaste cancelar planes a última hora para quedarte en casa — ¿qué excusa inventaste? ¿Te creyeron?", "de": "{pseudo}, da du gestanden hast, Pläne in letzter Minute abzusagen, um zuhause zu bleiben — welche Ausrede hast du erfunden? Hat sie jemand geglaubt?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà bloqué quelqu''un par lâcheté ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué bloquer quelqu''un par lâcheté — cette personne sait pourquoi tu l''as bloqué·e ? T''as des regrets ?", "en": "{pseudo}, since you confessed to blocking someone out of cowardice — does that person know why you blocked them? Any regrets?", "es": "{pseudo}, ya que confesaste bloquear a alguien por cobardía — ¿esa persona sabe por qué la bloqueaste? ¿Tienes arrepentimientos?", "de": "{pseudo}, da du gestanden hast, jemanden aus Feigheit blockiert zu haben — weiß die Person warum? Hast du Reue?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà espionné quelqu''un sur les réseaux sans qu''il le sache ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué stalker quelqu''un sur les réseaux — t''en es à combien de posts remontés ? Et cette personne est dans la pièce ?", "en": "{pseudo}, since you confessed to secretly stalking someone on social media — how far back did you scroll? Is that person in this room?", "es": "{pseudo}, ya que confesaste espiar a alguien en redes sociales — ¿cuántos posts repasaste? ¿Esa persona está en la sala?", "de": "{pseudo}, da du gestanden hast, jemanden heimlich in sozialen Medien zu stalken — wie weit bist du zurückgescrollt? Ist die Person hier im Raum?"}'
),

-- ===========================================================
-- HELLO STRANGER — Type C
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'C''est quoi ton talent caché que personne dans ce groupe ne connaît ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que tu viens de parler de ton talent caché — prouve-le maintenant.", "en": "{pseudo}, since you just talked about your hidden talent — prove it right now.", "es": "{pseudo}, ya que acabas de hablar de tu talento oculto — demuéstralo ahora mismo.", "de": "{pseudo}, da du gerade über dein verstecktes Talent gesprochen hast — beweise es jetzt."}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'C''est quoi ton plus grand regret de la semaine passée ?' LIMIT 1),
  '{"fr": "{pseudo}, vu ce regret que tu viens de partager — t''aurais fait quoi différemment ?", "en": "{pseudo}, given the regret you just shared — what would you have done differently?", "es": "{pseudo}, dado el arrepentimiento que acabas de compartir — ¿qué habrías hecho diferente?", "de": "{pseudo}, angesichts des Bedauerns, das du gerade geteilt hast — was hättest du anders gemacht?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'C''est quoi quelque chose que tout le monde aime et que toi tu détestes ?' LIMIT 1),
  '{"fr": "{pseudo}, vu ce que tu viens de dire sur ce que tu détestes — t''as déjà sincèrement essayé de comprendre pourquoi les autres aiment ça ?", "en": "{pseudo}, given what you just said about what you hate — have you ever genuinely tried to understand why others love it?", "es": "{pseudo}, dado lo que acabas de decir sobre lo que odias — ¿has intentado de verdad entender por qué a otros les encanta?", "de": "{pseudo}, angesichts dessen, was du gerade über das gesagt hast, was du hasst — hast du je wirklich versucht zu verstehen, warum andere das lieben?"}'
),

-- ===========================================================
-- APÉRO — Type A
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible de raconter une histoire de plus en plus exagérée à chaque fois' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe pense que t''exagères tes histoires à chaque fois — raconte-en une maintenant, on va voir si elle grossit en direct.", "en": "{pseudo}, since the group thinks you exaggerate your stories each time — tell one now, let''s watch it grow live.", "es": "{pseudo}, ya que el grupo cree que exageras tus historias cada vez — cuenta una ahora, veamos si crece en directo.", "de": "{pseudo}, da die Gruppe denkt, du übertreibst deine Geschichten jedes Mal — erzähl eine jetzt, mal sehen ob sie live größer wird."}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir envoyé un message regrettable sous l''influence' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe pense que t''as envoyé un message regrettable sous influence — c''était à qui et t''en es où avec cette personne aujourd''hui ?", "en": "{pseudo}, since the group thinks you''ve sent a regrettable message while under the influence — who was it to and where do things stand with them today?", "es": "{pseudo}, ya que el grupo cree que has enviado un mensaje lamentable bajo los efectos del alcohol — ¿a quién fue y cómo estás con esa persona hoy?", "de": "{pseudo}, da die Gruppe denkt, du hast unter Einfluss eine bereute Nachricht geschickt — an wen ging sie und wie ist es heute mit der Person?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir embrassé quelqu''un en soirée et de l''avoir regretté' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe pense que t''as embrassé quelqu''un en soirée et regretté — c''était qui et c''était quelle soirée ?", "en": "{pseudo}, since the group thinks you''ve kissed someone at a party and regretted it — who was it and which party?", "es": "{pseudo}, ya que el grupo cree que has besado a alguien en una fiesta y te has arrepentido — ¿quién era y en qué fiesta?", "de": "{pseudo}, da die Gruppe denkt, du hast jemanden auf einer Party geküsst und es bereut — wer war es und auf welcher Party?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible de prétendre être sobre alors qu''il est parti' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe pense que tu prétends être sobre quand t''es clairement parti·e — donne 3 preuves que t''étais sobre la dernière fois. Le groupe valide.", "en": "{pseudo}, since the group thinks you pretend to be sober when you''re clearly not — give 3 proofs you were sober last time. Group validates.", "es": "{pseudo}, ya que el grupo cree que finges estar sobrio/a cuando claramente no lo estás — da 3 pruebas de que estabas sobrio/a la última vez. El grupo valida.", "de": "{pseudo}, da die Gruppe denkt, du tust nüchtern, wenn du es klar nicht bist — gib 3 Beweise, dass du das letzte Mal nüchtern warst. Die Gruppe bewertet."}'
),

-- ===========================================================
-- APÉRO — Type B
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà dit « je t''aime » en premier sans être sûr·e de la réponse ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué dire « je t''aime » en premier sans être sûr·e — qu''est-ce qu''il ou elle t''a répondu ?", "en": "{pseudo}, since you confessed to saying ''I love you'' first without being sure — what did they say back?", "es": "{pseudo}, ya que confesaste decir ''te quiero'' primero sin estar seguro/a — ¿qué te respondió?", "de": "{pseudo}, da du gestanden hast, zuerst ''Ich liebe dich'' gesagt zu haben ohne sicher zu sein — was hat sie/er geantwortet?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà dit « je t''aime » en premier sans être sûr·e de la réponse ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as osé dire « je t''aime » en premier — en y repensant, t''es fier·e de toi ou t''aurais préféré attendre ?", "en": "{pseudo}, since you dared to say ''I love you'' first — looking back, are you proud or would you have waited?", "es": "{pseudo}, ya que te atreviste a decir ''te quiero'' primero — mirando atrás, ¿estás orgulloso/a o hubieras preferido esperar?", "de": "{pseudo}, da du gewagt hast, zuerst ''Ich liebe dich'' zu sagen — im Rückblick, bist du stolz oder hättest du lieber gewartet?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà envoyé un message à quelqu''un que t''aurais jamais envoyé sobre ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué envoyer des messages que t''enverrais jamais sobre — c''était à qui et t''en es où avec ça aujourd''hui ?", "en": "{pseudo}, since you confessed to sending a message you''d never send sober — who was it to and where do you stand with it today?", "es": "{pseudo}, ya que confesaste enviar un mensaje que nunca mandarías sobrio/a — ¿a quién fue y cómo estás con eso hoy?", "de": "{pseudo}, da du gestanden hast, eine Nachricht geschickt zu haben, die du nüchtern nie geschickt hättest — an wen und wie stehst du heute dazu?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà fait quelque chose d''irrationnel par jalousie ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué faire quelque chose d''irrationnel par jalousie — t''as fait quoi exactement ? Niveau irrationnel de 1 à 10.", "en": "{pseudo}, since you confessed to doing something irrational out of jealousy — what exactly did you do? Irrational level, 1 to 10.", "es": "{pseudo}, ya que confesaste hacer algo irracional por celos — ¿qué hiciste exactamente? Nivel de irracional del 1 al 10.", "de": "{pseudo}, da du gestanden hast, aus Eifersucht etwas Irrationales getan zu haben — was genau hast du getan? Irrationalitätslevel 1 bis 10."}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà flirté avec quelqu''un juste pour voir sa réaction ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué flirter avec quelqu''un juste pour voir sa réaction — la réaction était à la hauteur de ce que t''attendais ?", "en": "{pseudo}, since you confessed to flirting with someone just to see their reaction — was the reaction what you were hoping for?", "es": "{pseudo}, ya que confesaste coquetear con alguien solo para ver su reacción — ¿la reacción fue la que esperabas?", "de": "{pseudo}, da du gestanden hast, mit jemandem geflirtet zu haben, nur um die Reaktion zu sehen — war die Reaktion das, was du erwartet hast?"}'
),

-- ===========================================================
-- APÉRO — Type C
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'C''est quoi la chose la plus impulsive que tu aies faite en soirée ?' LIMIT 1),
  '{"fr": "{pseudo}, vu ce truc impulsif que tu viens de raconter — t''as des regrets ou t''en es fier·e ?", "en": "{pseudo}, given that impulsive thing you just described — any regrets or are you proud?", "es": "{pseudo}, dado ese acto impulsivo que acabas de contar — ¿tienes arrepentimientos o estás orgulloso/a?", "de": "{pseudo}, angesichts des impulsiven Dings, das du gerade beschrieben hast — Reue oder Stolz?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'C''est quoi ton plus grand regret de soirée ?' LIMIT 1),
  '{"fr": "{pseudo}, vu ce regret de soirée que tu viens de partager — t''en as parlé à la personne concernée ?", "en": "{pseudo}, given the party regret you just shared — have you talked to the person involved?", "es": "{pseudo}, dado el arrepentimiento de fiesta que acabas de compartir — ¿hablaste con la persona implicada?", "de": "{pseudo}, angesichts des Party-Bedauerns, das du gerade geteilt hast — hast du mit der betroffenen Person gesprochen?"}'
),

-- ===========================================================
-- NO FILTER — Type A
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir balancé un secret « accidentellement »' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe pense que t''as déjà balancé un secret « accidentellement » — c''était quel genre de secret et la personne sait que c''est toi ?", "en": "{pseudo}, since the group thinks you''ve ''accidentally'' spilled a secret — what kind of secret was it and does that person know it was you?", "es": "{pseudo}, ya que el grupo cree que has revelado un secreto ''accidentalmente'' — ¿qué tipo de secreto era y esa persona sabe que fuiste tú?", "de": "{pseudo}, da die Gruppe denkt, du hast ''versehentlich'' ein Geheimnis verraten — was für ein Geheimnis und weiß die Person, dass du es warst?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible de lire les messages de son/sa partenaire s''il laisse son téléphone ouvert' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe pense que tu lis les messages de ton partenaire quand le téléphone est ouvert — t''as déjà trouvé quelque chose ou c''est juste de la curiosité préventive ?", "en": "{pseudo}, since the group thinks you read your partner''s messages when the phone is unlocked — have you ever found something, or is it just preventive curiosity?", "es": "{pseudo}, ya que el grupo cree que lees los mensajes de tu pareja cuando el teléfono está abierto — ¿alguna vez encontraste algo o es solo curiosidad preventiva?", "de": "{pseudo}, da die Gruppe denkt, du liest die Nachrichten deines Partners wenn das Handy offen liegt — hast du je etwas gefunden oder ist es nur präventive Neugier?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir humilié quelqu''un en public, même gentiment' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe pense que t''as déjà humilié quelqu''un en public, même gentiment — raconte. Cette personne est dans la pièce ?", "en": "{pseudo}, since the group thinks you''ve publicly embarrassed someone, even gently — tell us. Is that person in the room?", "es": "{pseudo}, ya que el grupo cree que has humillado a alguien en público, aunque sea con buenas intenciones — cuéntanos. ¿Esa persona está en la sala?", "de": "{pseudo}, da die Gruppe denkt, du hast jemanden öffentlich bloßgestellt, sogar nett — erzähl uns. Ist die Person hier im Raum?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir trompé quelqu''un ou de l''avoir envisagé sérieusement' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe t''a désigné pour ça — t''assumes ou t''expliques ?", "en": "{pseudo}, since the group pointed at you for this — do you own it or explain it?", "es": "{pseudo}, ya que el grupo te señaló por esto — ¿lo asumes o lo explicas?", "de": "{pseudo}, da die Gruppe auf dich gezeigt hat — stehst du dazu oder erklärst du dich?"}'
),

-- ===========================================================
-- NO FILTER — Type B
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà flirté avec quelqu''un en couple (toi ou l''autre) ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué flirter avec quelqu''un en couple — ça a mené où ?", "en": "{pseudo}, since you confessed to flirting with someone in a relationship — where did that lead?", "es": "{pseudo}, ya que confesaste coquetear con alguien que estaba en una relación — ¿adónde llevó eso?", "de": "{pseudo}, da du gestanden hast, mit jemandem in einer Beziehung geflirtet zu haben — wohin hat das geführt?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà révélé un secret qu''on t''avait confié ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué révéler un secret qu''on t''avait confié — c''était quel genre de secret ? Cette personne te fait encore confiance ?", "en": "{pseudo}, since you confessed to revealing a secret someone trusted you with — what kind of secret was it? Does that person still trust you?", "es": "{pseudo}, ya que confesaste revelar un secreto que te confiaron — ¿qué tipo de secreto era? ¿Esa persona aún confía en ti?", "de": "{pseudo}, da du gestanden hast, ein anvertrautes Geheimnis verraten zu haben — was für ein Geheimnis? Vertraut die Person dir noch?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà laissé quelqu''un prendre le blâme à ta place ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué laisser quelqu''un prendre le blâme à ta place — cette personne sait que c''était toi ? T''as jamais avoué ?", "en": "{pseudo}, since you confessed to letting someone else take the blame for you — does that person know it was you? Have you ever confessed?", "es": "{pseudo}, ya que confesaste dejar que alguien cargara con la culpa en tu lugar — ¿esa persona sabe que fuiste tú? ¿Nunca lo confesaste?", "de": "{pseudo}, da du gestanden hast, jemand anderen die Schuld übernehmen zu lassen — weiß die Person, dass du es warst? Hast du es je gestanden?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà trompé quelqu''un que t''aimais vraiment ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué tromper quelqu''un que t''aimais vraiment — tu t''en veux encore ?", "en": "{pseudo}, since you confessed to cheating on someone you truly loved — do you still blame yourself?", "es": "{pseudo}, ya que confesaste haber engañado a alguien que amabas de verdad — ¿aún te lo reproches?", "de": "{pseudo}, da du gestanden hast, jemanden betrogen zu haben, den du wirklich geliebt hast — gibst du dir noch die Schuld?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà coupé quelqu''un de ta vie sans lui expliquer pourquoi ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué couper quelqu''un de ta vie sans lui expliquer pourquoi — cette personne méritait une explication ?", "en": "{pseudo}, since you confessed to cutting someone out of your life without explaining why — did that person deserve an explanation?", "es": "{pseudo}, ya que confesaste alejarte de alguien sin explicarle por qué — ¿esa persona merecía una explicación?", "de": "{pseudo}, da du gestanden hast, jemanden aus deinem Leben gestrichen zu haben ohne zu erklären warum — hätte die Person eine Erklärung verdient?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà fait quelque chose dont t''as honte et que personne ne sait ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué avoir fait quelque chose dont t''as honte que personne ne sait — là tu viens de le dire au groupe entier. T''as l''air comment ?", "en": "{pseudo}, since you just confessed to something shameful nobody knew — you just told the whole group. How does that feel?", "es": "{pseudo}, ya que acabas de confesar algo vergonzoso que nadie sabía — acabas de decírselo al grupo entero. ¿Cómo te sientes?", "de": "{pseudo}, da du gerade etwas Beschämendes gestanden hast, das niemand wusste — du hast es gerade allen erzählt. Wie fühlt sich das an?"}'
),

-- ===========================================================
-- NO FILTER — Type C
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'C''est quoi quelque chose que tu penses et que tu n''oses jamais dire à voix haute ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que tu viens de mentionner une pensée que tu n''oses jamais dire — c''est maintenant ou jamais.", "en": "{pseudo}, since you just mentioned a thought you never dare say out loud — now or never.", "es": "{pseudo}, ya que acabas de mencionar un pensamiento que nunca te atreves a decir — ahora o nunca.", "de": "{pseudo}, da du gerade einen Gedanken erwähnt hast, den du nie auszusprechen wagst — jetzt oder nie."}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Si tu devais avouer quelque chose à quelqu''un dans cette pièce, ce serait quoi ?' LIMIT 1),
  '{"fr": "{pseudo}, vu ce que tu viens de partager — tu le dis maintenant ? Cette personne est là.", "en": "{pseudo}, given what you just shared — are you saying it now? That person is here.", "es": "{pseudo}, dado lo que acabas de compartir — ¿lo dices ahora? Esa persona está aquí.", "de": "{pseudo}, angesichts dessen, was du gerade geteilt hast — sagst du es jetzt? Die Person ist hier."}'
),

-- ===========================================================
-- UNMASKED — Type A
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''idéaliser quelqu''un jusqu''à la déception' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe pense que tu idéalises les gens jusqu''à la déception — ça t''est arrivé récemment ? T''en es où maintenant ?", "en": "{pseudo}, since the group thinks you idealise people until you''re disappointed — did this happen recently? Where are you now?", "es": "{pseudo}, ya que el grupo cree que idealizas a las personas hasta la decepción — ¿pasó recientemente? ¿Cómo estás ahora?", "de": "{pseudo}, da die Gruppe denkt, du idealisierst Menschen bis zur Enttäuschung — ist das kürzlich passiert? Wie stehst du jetzt dazu?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible de saboter quelque chose qui allait bien par peur que ça dure' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe te voit comme quelqu''un qui sabote ce qui va bien — t''en es conscient·e sur le moment ou seulement après ?", "en": "{pseudo}, since the group sees you as someone who sabotages good things — are you aware of it in the moment or only after?", "es": "{pseudo}, ya que el grupo te ve como alguien que sabotea lo que va bien — ¿eres consciente de ello en el momento o solo después?", "de": "{pseudo}, da die Gruppe dich als jemanden sieht, der Gutes sabotiert — bist du dir im Moment bewusst darüber oder erst danach?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''être encore marqué·e par une rupture ancienne' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe pense que t''es encore marqué·e par une ancienne rupture — ça remonte à quand ? T''es à quel pourcentage de guéri·e ?", "en": "{pseudo}, since the group thinks you''re still affected by an old break-up — how long ago was it? What percentage healed would you say?", "es": "{pseudo}, ya que el grupo cree que aún estás marcado/a por una antigua ruptura — ¿cuándo fue? ¿Qué porcentaje curado/a dirías que estás?", "de": "{pseudo}, da die Gruppe denkt, du bist noch von einer alten Trennung betroffen — wie lange ist das her? Zu wie viel Prozent bist du drüber weg?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Le plus susceptible d''avoir une peur inavouée de l''abandon' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe pense que t''as une peur inavouée de l''abandon — ça vient d''où cette peur, à ton avis ?", "en": "{pseudo}, since the group thinks you have an unspoken fear of abandonment — where does that fear come from, do you think?", "es": "{pseudo}, ya que el grupo cree que tienes un miedo inconfesable al abandono — ¿de dónde crees que viene ese miedo?", "de": "{pseudo}, da die Gruppe denkt, du hast eine unausgesprochene Angst vor dem Verlassenwerden — woher kommt diese Angst deiner Meinung nach?"}'
),

-- ===========================================================
-- UNMASKED — Type B
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà aimé quelqu''un en silence pendant longtemps sans jamais rien dire ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué aimer quelqu''un en silence pendant longtemps — cette personne est dans la pièce ?", "en": "{pseudo}, since you confessed to loving someone in silence for a long time — is that person in the room?", "es": "{pseudo}, ya que confesaste amar a alguien en silencio durante mucho tiempo — ¿esa persona está en la sala?", "de": "{pseudo}, da du gestanden hast, jemanden lange in Stille geliebt zu haben — ist diese Person im Raum?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà aimé quelqu''un en silence pendant longtemps sans jamais rien dire ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as aimé quelqu''un en silence sans jamais rien dire — tu l''as dit un jour ou c''est resté dans ta tête pour toujours ?", "en": "{pseudo}, since you loved someone in silence without ever saying anything — did you ever say it? Or did it stay in your head forever?", "es": "{pseudo}, ya que amaste a alguien en silencio sin decir nada — ¿lo dijiste alguna vez? ¿O se quedó para siempre en tu cabeza?", "de": "{pseudo}, da du jemanden in Stille geliebt hast ohne je etwas zu sagen — hast du es je gesagt? Oder blieb es für immer in deinem Kopf?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà eu peur que les gens te quittent s''ils te connaissaient vraiment ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué avoir peur que les gens te quittent s''ils te connaissaient vraiment — qu''est-ce qu''ils ne savent pas sur toi, là dans cette pièce ?", "en": "{pseudo}, since you confessed to fearing people would leave if they truly knew you — what don''t they know about you, right here in this room?", "es": "{pseudo}, ya que confesaste tener miedo de que la gente se vaya si te conociera de verdad — ¿qué no saben sobre ti en esta sala?", "de": "{pseudo}, da du gestanden hast, Angst zu haben, dass Menschen gehen würden, wenn sie dich wirklich kennen würden — was wissen sie nicht über dich, hier in diesem Raum?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà dit « je vais bien » alors que tu vivais une période difficile ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué dire « je vais bien » alors que t''allais pas — quelqu''un dans cette pièce t''a vu à travers à l''époque ?", "en": "{pseudo}, since you confessed to saying ''I''m fine'' while going through a hard time — did anyone in this room see through it at the time?", "es": "{pseudo}, ya que confesaste decir ''estoy bien'' mientras pasabas por un momento difícil — ¿alguien en esta sala lo vio a través entonces?", "de": "{pseudo}, da du gestanden hast, ''mir geht es gut'' gesagt zu haben, während es dir nicht gut ging — hat jemand in diesem Raum es damals durchschaut?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà coupé quelqu''un de ta vie pour te protéger, même si tu l''aimais encore ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué couper quelqu''un pour te protéger même si tu l''aimais encore — tu penses encore à cette personne ?", "en": "{pseudo}, since you confessed to cutting someone out to protect yourself even though you still loved them — do you still think about that person?", "es": "{pseudo}, ya que confesaste alejarte de alguien para protegerte aunque aún lo querías — ¿aún piensas en esa persona?", "de": "{pseudo}, da du gestanden hast, jemanden aus Selbstschutz aus deinem Leben gestrichen zu haben obwohl du ihn noch liebtest — denkst du noch an diese Person?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà fait une erreur grave dans une relation dont tu t''en veux encore ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué une erreur grave dans une relation dont tu t''en veux encore — tu aurais fait quoi différemment ?", "en": "{pseudo}, since you confessed to a serious mistake in a relationship you still regret — what would you have done differently?", "es": "{pseudo}, ya que confesaste un error grave en una relación del que aún te arrepientes — ¿qué habrías hecho diferente?", "de": "{pseudo}, da du einen schwerwiegenden Fehler in einer Beziehung gestanden hast, den du noch bereust — was hättest du anders gemacht?"}'
),

-- ===========================================================
-- UNMASKED — Type C
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'C''est quoi ta plus grande peur dans une relation proche ?' LIMIT 1),
  '{"fr": "{pseudo}, vu cette peur que tu viens de partager sur les relations proches — t''as déjà vécu ça ? C''est une peur abstraite ou une cicatrice ?", "en": "{pseudo}, given the fear you just shared about close relationships — have you lived through that? Abstract fear or a scar?", "es": "{pseudo}, dado el miedo que acabas de compartir sobre las relaciones cercanas — ¿lo has vivido? ¿Miedo abstracto o cicatriz?", "de": "{pseudo}, angesichts der Angst, die du gerade über enge Beziehungen geteilt hast — hast du das erlebt? Abstrakte Angst oder eine Narbe?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'C''est quoi le moment de ta vie où tu t''es senti·e le plus seul·e ?' LIMIT 1),
  '{"fr": "{pseudo}, vu ce moment de solitude que tu viens d''évoquer — qu''est-ce qui t''a aidé à en sortir ?", "en": "{pseudo}, given the moment of loneliness you just described — what helped you get through it?", "es": "{pseudo}, dado el momento de soledad que acabas de evocar — ¿qué te ayudó a salir de eso?", "de": "{pseudo}, angesichts des Moments der Einsamkeit, den du gerade beschrieben hast — was hat dir geholfen, da rauszukommen?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Si tu devais écrire une lettre à ta version d''il y a 10 ans, tu lui dirais quoi ?' LIMIT 1),
  '{"fr": "{pseudo}, vu ce que tu viens de dire à ton toi d''il y a 10 ans — et toi dans 10 ans, qu''est-ce qu''il te dirait sur aujourd''hui ?", "en": "{pseudo}, given what you just said to your self of 10 years ago — what would your self 10 years from now say to you about today?", "es": "{pseudo}, dado lo que acabas de decirle a tu yo de hace 10 años — ¿qué te diría tu yo dentro de 10 años sobre hoy?", "de": "{pseudo}, angesichts dessen, was du gerade deinem Ich von vor 10 Jahren gesagt hast — was würde dein Ich in 10 Jahren dir über heute sagen?"}'
),

-- ===========================================================
-- SEED_THEMES — APÉRO
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà avoué quelque chose d''important à quelqu''un parce que tu avais bu ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué avoir confessé quelque chose d''important parce que t''avais bu — c''était quoi et cette personne s''en souvient ?", "en": "{pseudo}, since you confessed to telling someone something important because you''d been drinking — what was it and does that person remember?", "es": "{pseudo}, ya que confesaste haber dicho algo importante a alguien porque habías bebido — ¿qué fue y esa persona lo recuerda?", "de": "{pseudo}, da du gestanden hast, jemandem etwas Wichtiges gesagt zu haben, weil du getrunken hattest — was war es und erinnert sich die Person?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Quelle vérité as-tu dite un soir que tu n''aurais jamais dite sobre ?' LIMIT 1),
  '{"fr": "{pseudo}, vu la vérité que tu viens de partager — tu regrettes de l''avoir dite ou tu penses que c''était mieux comme ça ?", "en": "{pseudo}, given the truth you just shared — do you regret saying it or do you think it was better that way?", "es": "{pseudo}, dada la verdad que acabas de compartir — ¿te arrepientes de haberla dicho o crees que fue mejor así?", "de": "{pseudo}, angesichts der Wahrheit, die du gerade geteilt hast — bereust du es gesagt zu haben oder denkst du, es war besser so?"}'
),

-- ===========================================================
-- SEED_THEMES — NO FILTER
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà ressenti de la jalousie envers quelqu''un dans ce groupe ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué avoir ressenti de la jalousie envers quelqu''un dans ce groupe — envers qui et pour quoi ?", "en": "{pseudo}, since you confessed to feeling jealous of someone in this group — towards whom and for what?", "es": "{pseudo}, ya que confesaste haber sentido celos de alguien de este grupo — ¿hacia quién y por qué?", "de": "{pseudo}, da du gestanden hast, Eifersucht gegenüber jemandem in dieser Gruppe empfunden zu haben — gegenüber wem und wofür?"}'
),

-- ===========================================================
-- SEED_THEMES — UNMASKED
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'Qui du groupe souffre le plus en silence ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe pense que c''est toi qui souffres le plus en silence — tu confirmes ou tu infirmes ?", "en": "{pseudo}, since the group thinks you''re the one suffering the most in silence — do you confirm or deny?", "es": "{pseudo}, ya que el grupo cree que eres tú quien más sufre en silencio — ¿lo confirmas o lo niegas?", "de": "{pseudo}, da die Gruppe denkt, du leidest am meisten im Stillen — bestätigst oder widersprichst du?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Qui du groupe a le plus besoin d''entendre qu''on l''aime ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que le groupe pense que t''as le plus besoin d''entendre qu''on t''aime — quelqu''un dans cette pièce veut profiter de l''occasion ?", "en": "{pseudo}, since the group thinks you need to hear you''re loved the most — does anyone in this room want to take the opportunity?", "es": "{pseudo}, ya que el grupo cree que tú más necesitas escuchar que te quieren — ¿alguien en esta sala quiere aprovechar la oportunidad?", "de": "{pseudo}, da die Gruppe denkt, du brauchst am dringendsten zu hören, dass du geliebt wirst — möchte jemand in diesem Raum die Gelegenheit nutzen?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà sabordé quelque chose de bien parce que tu ne te sentais pas à la hauteur ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué saboter quelque chose de bien parce que tu te sentais pas à la hauteur — c''était quoi ce truc bien que t''as laissé filer ?", "en": "{pseudo}, since you confessed to sabotaging something good because you didn''t feel worthy — what was that good thing you let go?", "es": "{pseudo}, ya que confesaste sabotear algo bueno porque no te sentías a la altura — ¿qué era esa cosa buena que dejaste ir?", "de": "{pseudo}, da du gestanden hast, etwas Gutes sabotiert zu haben, weil du dich nicht gut genug gefühlt hast — was war das Gute, das du gehen lassen hast?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà pensé que ta vie aurait été différente si une seule décision avait été autre ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué penser que ta vie aurait été différente à cause d''une décision — c''était quelle décision ?", "en": "{pseudo}, since you confessed to thinking your life would have been different because of one decision — which decision was it?", "es": "{pseudo}, ya que confesaste pensar que tu vida habría sido diferente por una decisión — ¿cuál fue esa decisión?", "de": "{pseudo}, da du gestanden hast zu denken, dein Leben wäre wegen einer Entscheidung anders gewesen — welche Entscheidung war es?"}'
),

-- ===========================================================
-- SEED_CUT — APÉRO
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'Ton pire rencard. Balance tout.' LIMIT 1),
  '{"fr": "{pseudo}, vu ce pire rencard que tu viens de raconter — et cette personne, t''as eu des nouvelles depuis ?", "en": "{pseudo}, given that worst date you just described — any news from that person since?", "es": "{pseudo}, dado ese peor cita que acabas de contar — ¿tienes noticias de esa persona desde entonces?", "de": "{pseudo}, angesichts des schlimmsten Dates, das du gerade beschrieben hast — irgendwelche Neuigkeiten von der Person seitdem?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Décris ton premier vrai baiser. Plante le décor.' LIMIT 1),
  '{"fr": "{pseudo}, vu ce premier baiser que tu viens de décrire — vous vous êtes revus après ?", "en": "{pseudo}, given that first kiss you just described — did you see each other again?", "es": "{pseudo}, dado ese primer beso que acabas de describir — ¿os volvisteis a ver?", "de": "{pseudo}, angesichts des ersten Kusses, den du gerade beschrieben hast — habt ihr euch danach wiedergesehen?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà été vraiment amoureux·se ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué avoir été vraiment amoureux·se — c''était qui et ça s''est terminé comment ?", "en": "{pseudo}, since you confessed to having been truly in love — who was it and how did it end?", "es": "{pseudo}, ya que confesaste haber estado de verdad enamorado/a — ¿quién era y cómo terminó?", "de": "{pseudo}, da du gestanden hast, wirklich verliebt gewesen zu sein — wer war es und wie hat es geendet?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Quel titre de film résume ta dernière relation ?' LIMIT 1),
  '{"fr": "{pseudo}, vu le titre que tu viens de choisir pour ta dernière relation — c''est un titre plutôt optimiste ou catastrophique ?", "en": "{pseudo}, given the film title you just chose for your last relationship — is it more optimistic or catastrophic?", "es": "{pseudo}, dado el título de película que acabas de elegir para tu última relación — ¿es más optimista o catastrófico?", "de": "{pseudo}, angesichts des Filmtitels, den du gerade für deine letzte Beziehung gewählt hast — ist er eher optimistisch oder katastrophal?"}'
),

-- ===========================================================
-- SEED_CUT — NO FILTER
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as mis combien de temps à oublier ton ex ? Et c''est vraiment réglé ?' LIMIT 1),
  '{"fr": "{pseudo}, vu ta réponse sur combien de temps t''as mis à oublier ton ex — vraiment réglé ? Le groupe vote.", "en": "{pseudo}, given your answer about how long it took to get over your ex — really over it? The group votes.", "es": "{pseudo}, dado tu respuesta sobre cuánto tardaste en superar a tu ex — ¿de verdad superado? El grupo vota.", "de": "{pseudo}, angesichts deiner Antwort darüber, wie lange es gedauert hat über deinen Ex hinwegzukommen — wirklich drüber weg? Die Gruppe stimmt ab."}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Raconte le plus beau râteau que tu t''es pris·e.' LIMIT 1),
  '{"fr": "{pseudo}, vu ce beau râteau que tu viens de raconter — t''as retentré ou tu es passé·e à autre chose ?", "en": "{pseudo}, given that glorious rejection you just described — did you try again or move on?", "es": "{pseudo}, dado ese bello rechazo que acabas de contar — ¿lo volviste a intentar o pasaste página?", "de": "{pseudo}, angesichts der herrlichen Abfuhr, die du gerade beschrieben hast — hast du es nochmal versucht oder weitergemacht?"}'
),

-- ===========================================================
-- SEED_CUT — UNMASKED
-- ===========================================================

(
  (SELECT id FROM questions WHERE question->>'fr' = 'Si tu mourais ce soir, ton plus grand regret ?' LIMIT 1),
  '{"fr": "{pseudo}, vu ce regret que tu viens de partager — t''as prévu de le faire un jour, cette chose que tu regrettes de pas avoir faite ?", "en": "{pseudo}, given the regret you just shared — do you plan to do it someday, the thing you regret not having done?", "es": "{pseudo}, dado el arrepentimiento que acabas de compartir — ¿tienes pensado hacerlo algún día, lo que lamentas no haber hecho?", "de": "{pseudo}, angesichts des Bedauerns, das du gerade geteilt hast — planst du es irgendwann zu tun, das was du bereust nicht getan zu haben?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'Ce qui te manque de ton dernier ex sérieux ?' LIMIT 1),
  '{"fr": "{pseudo}, vu ce que tu viens de dire sur ce qui te manque de ton ex — t''as cherché ça chez quelqu''un depuis ?", "en": "{pseudo}, given what you just said about what you miss from your ex — have you looked for that in someone since?", "es": "{pseudo}, dado lo que acabas de decir sobre lo que echas de menos de tu ex — ¿has buscado eso en alguien desde entonces?", "de": "{pseudo}, angesichts dessen, was du gerade über das gesagt hast, was du an deinem Ex vermisst — hast du das seitdem bei jemandem gesucht?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà craqué pour quelqu''un juste parce qu''il/elle craquait pour toi ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué craquer pour quelqu''un juste parce qu''il ou elle craquait pour toi — ça s''est bien passé ou c''était une erreur ?", "en": "{pseudo}, since you confessed to falling for someone just because they liked you — did it go well or was it a mistake?", "es": "{pseudo}, ya que confesaste colgarte de alguien solo porque le gustabas — ¿fue bien o fue un error?", "de": "{pseudo}, da du gestanden hast, für jemanden gefallen zu haben, nur weil er auf dich stand — lief es gut oder war es ein Fehler?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as déjà pleuré pendant ou après l''amour ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué avoir pleuré pendant ou après l''amour — c''était de joie ou de tristesse ?", "en": "{pseudo}, since you confessed to crying during or after sex — was it joy or sadness?", "es": "{pseudo}, ya que confesaste haber llorado durante o después del sexo — ¿fue alegría o tristeza?", "de": "{pseudo}, da du gestanden hast, beim oder nach dem Sex geweint zu haben — war es Freude oder Trauer?"}'
),
(
  (SELECT id FROM questions WHERE question->>'fr' = 'T''as des fantasmes qui te surprennent toi-même ?' LIMIT 1),
  '{"fr": "{pseudo}, vu que t''as avoué avoir des fantasmes qui te surprennent toi-même — tu veux en partager un ou garder le mystère ?", "en": "{pseudo}, since you confessed to having fantasies that surprise even yourself — want to share one or keep the mystery?", "es": "{pseudo}, ya que confesaste tener fantasías que te sorprenden a ti mismo/a — ¿quieres compartir una o mantener el misterio?", "de": "{pseudo}, da du gestanden hast, Fantasien zu haben, die dich selbst überraschen — willst du eine teilen oder das Geheimnis bewahren?"}'
);
