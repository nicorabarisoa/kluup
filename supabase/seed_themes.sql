-- Seed questions for apero, no-filter, unmasked themes
-- Run this in the Supabase SQL editor

INSERT INTO questions (theme, type, intensity, question, tags) VALUES

-- =====================
-- APÉRO
-- =====================

-- Type A | intensity 1
('apero', 'A', 1, '{"fr":"Qui du groupe commande toujours une bière même quand il préfère autre chose ?","en":"Who in the group always orders a beer even when they prefer something else?","es":"¿Quién del grupo siempre pide una cerveza aunque prefiera otra cosa?","de":"Wer in der Gruppe bestellt immer ein Bier, auch wenn er etwas anderes bevorzugt?"}', '[{"tag":"mysterieux","points":1}]'),
('apero', 'A', 1, '{"fr":"Qui du groupe fait semblant de connaître le vin qu''on lui propose ?","en":"Who in the group pretends to know the wine being offered?","es":"¿Quién del grupo finge conocer el vino que le ofrecen?","de":"Wer in der Gruppe tut so, als würde er den angebotenen Wein kennen?"}', '[{"tag":"drole","points":1},{"tag":"audacieux","points":1}]'),
('apero', 'A', 1, '{"fr":"Qui du groupe finit toujours les chips en premier ?","en":"Who in the group always finishes the chips first?","es":"¿Quién del grupo siempre termina primero las patatas?","de":"Wer in der Gruppe isst immer zuerst die Chips auf?"}', '[{"tag":"drole","points":1}]'),

-- Type A | intensity 2
('apero', 'A', 2, '{"fr":"Qui du groupe devient philosophe après deux verres ?","en":"Who in the group becomes a philosopher after two drinks?","es":"¿Quién del grupo se vuelve filósofo después de dos copas?","de":"Wer in der Gruppe wird nach zwei Gläsern zum Philosophen?"}', '[{"tag":"drole","points":2},{"tag":"audacieux","points":1}]'),
('apero', 'A', 2, '{"fr":"Qui du groupe est le plus susceptible de commencer un débat qu''il ne peut pas gagner ?","en":"Who in the group is most likely to start a debate they cannot win?","es":"¿Quién del grupo tiene más probabilidades de iniciar un debate que no puede ganar?","de":"Wer in der Gruppe beginnt am ehesten eine Debatte, die er nicht gewinnen kann?"}', '[{"tag":"audacieux","points":2},{"tag":"drole","points":1}]'),

-- Type A | intensity 3
('apero', 'A', 3, '{"fr":"Qui du groupe a le plus de secrets que personne ne soupçonne ?","en":"Who in the group has the most secrets that nobody suspects?","es":"¿Quién del grupo tiene más secretos que nadie sospecha?","de":"Wer in der Gruppe hat die meisten Geheimnisse, die niemand ahnt?"}', '[{"tag":"mysterieux","points":3}]'),

-- Type B | intensity 1
('apero', 'B', 1, '{"fr":"T''as déjà fait semblant d''aimer un plat pour ne pas vexer l''hôte ?","en":"Have you ever pretended to like a dish to avoid offending the host?","es":"¿Alguna vez has fingido que te gustaba un plato para no ofender al anfitrión?","de":"Hast du schon mal so getan, als würde dir ein Gericht schmecken, um den Gastgeber nicht zu kränken?"}', '[{"tag":"empathique","points":1}]'),
('apero', 'B', 1, '{"fr":"T''as déjà bu plus que prévu parce que tu t''ennuyais à une soirée ?","en":"Have you ever drunk more than planned because you were bored at a party?","es":"¿Alguna vez has bebido más de lo planeado porque te aburrías en una fiesta?","de":"Hast du schon mal mehr getrunken als geplant, weil du auf einer Party gelangweilt warst?"}', '[{"tag":"drole","points":1}]'),
('apero', 'B', 1, '{"fr":"T''as déjà inventé un prétexte pour partir plus tôt d''une soirée ?","en":"Have you ever made up an excuse to leave a party early?","es":"¿Alguna vez has inventado una excusa para irte antes de una fiesta?","de":"Hast du schon mal eine Ausrede erfunden, um früher von einer Party zu gehen?"}', '[{"tag":"mysterieux","points":1}]'),
('apero', 'B', 1, '{"fr":"T''as déjà dit que tu allais venir à une soirée sans avoir l''intention d''y aller ?","en":"Have you ever said you were going to a party with no intention of going?","es":"¿Alguna vez has dicho que ibas a una fiesta sin intención de ir?","de":"Hast du schon mal gesagt, du kommst zu einer Party, obwohl du es gar nicht vorhast?"}', '[{"tag":"fiable","points":-1},{"tag":"mysterieux","points":1}]'),

-- Type B | intensity 2
('apero', 'B', 2, '{"fr":"T''as déjà eu une conversation sérieuse avec quelqu''un alors que t''étais complètement ivre ?","en":"Have you ever had a serious conversation with someone while completely drunk?","es":"¿Alguna vez has tenido una conversación seria con alguien estando completamente borracho/a?","de":"Hast du schon mal ein ernstes Gespräch mit jemandem geführt, während du völlig betrunken warst?"}', '[{"tag":"audacieux","points":1}]'),
('apero', 'B', 2, '{"fr":"T''as déjà envoyé un message que tu regrettes après une soirée ?","en":"Have you ever sent a message you regret after a night out?","es":"¿Alguna vez has enviado un mensaje del que te arrepientes después de una noche de fiesta?","de":"Hast du schon mal nach einem Abend eine Nachricht geschickt, die du bereust?"}', '[{"tag":"audacieux","points":1},{"tag":"romantique","points":1}]'),

-- Type B | intensity 3
('apero', 'B', 3, '{"fr":"T''as déjà avoué quelque chose d''important à quelqu''un parce que tu avais bu ?","en":"Have you ever confessed something important to someone because you had been drinking?","es":"¿Alguna vez le has confesado algo importante a alguien porque habías bebido?","de":"Hast du jemandem schon mal etwas Wichtiges gestanden, weil du getrunken hattest?"}', '[{"tag":"audacieux","points":2},{"tag":"romantique","points":1}]'),

-- Type C | intensity 1
('apero', 'C', 1, '{"fr":"Quel est ton rituel pour te préparer avant une soirée ?","en":"What is your ritual to get ready before a night out?","es":"¿Cuál es tu ritual para prepararte antes de una fiesta?","de":"Was ist dein Ritual, um dich vor einer Party vorzubereiten?"}', '[{"tag":"empathique","points":1}]'),
('apero', 'C', 1, '{"fr":"Quelle est la soirée la plus mémorable que tu aies vécue ?","en":"What is the most memorable night out you have experienced?","es":"¿Cuál es la noche más memorable que has vivido?","de":"Was war die unvergesslichste Nacht, die du erlebt hast?"}', '[{"tag":"audacieux","points":1}]'),
('apero', 'C', 1, '{"fr":"Quel est le truc le plus gênant que t''as fait en soirée ?","en":"What is the most embarrassing thing you have done at a party?","es":"¿Cuál es la cosa más vergonzosa que has hecho en una fiesta?","de":"Was ist das Peinlichste, das du auf einer Party gemacht hast?"}', '[{"tag":"drole","points":2}]'),

-- Type C | intensity 2
('apero', 'C', 2, '{"fr":"Qu''est-ce qui te manquerait le plus si tu devais arrêter de boire de l''alcool ?","en":"What would you miss the most if you had to stop drinking alcohol?","es":"¿Qué es lo que más echarías de menos si tuvieras que dejar de beber alcohol?","de":"Was würdest du am meisten vermissen, wenn du aufhören müsstest, Alkohol zu trinken?"}', '[{"tag":"empathique","points":1}]'),

-- Type C | intensity 3
('apero', 'C', 3, '{"fr":"Quelle vérité as-tu dite un soir que tu n''aurais jamais dite sobre ?","en":"What truth did you tell one evening that you would never have said sober?","es":"¿Qué verdad dijiste una noche que nunca habrías dicho sobrio/a?","de":"Welche Wahrheit hast du an einem Abend gesagt, die du nüchtern nie gesagt hättest?"}', '[{"tag":"audacieux","points":3}]'),

-- =====================
-- NO FILTER
-- =====================

-- Type A | intensity 1
('no-filter', 'A', 1, '{"fr":"Qui du groupe est le plus hypocrite ?","en":"Who in the group is the most hypocritical?","es":"¿Quién del grupo es el más hipócrita?","de":"Wer in der Gruppe ist am heuchlerischsten?"}', '[{"tag":"fiable","points":-2},{"tag":"audacieux","points":1}]'),
('no-filter', 'A', 1, '{"fr":"Qui du groupe donne le plus de conseils qu''il ne suit jamais lui-même ?","en":"Who in the group gives the most advice they never follow themselves?","es":"¿Quién del grupo da más consejos que nunca sigue él mismo?","de":"Wer in der Gruppe gibt am meisten Ratschläge, die er selbst nie befolgt?"}', '[{"tag":"drole","points":1},{"tag":"audacieux","points":1}]'),
('no-filter', 'A', 1, '{"fr":"Qui du groupe est le plus difficile à contenter ?","en":"Who in the group is the hardest to please?","es":"¿A quién del grupo es más difícil complacer?","de":"Wer in der Gruppe ist am schwierigsten zufriedenzustellen?"}', '[{"tag":"mysterieux","points":1}]'),

-- Type A | intensity 2
('no-filter', 'A', 2, '{"fr":"Qui du groupe mens le plus souvent, même pour de petites choses ?","en":"Who in the group lies the most often, even about small things?","es":"¿Quién del grupo miente con más frecuencia, incluso en cosas pequeñas?","de":"Wer in der Gruppe lügt am häufigsten, auch bei Kleinigkeiten?"}', '[{"tag":"fiable","points":-2},{"tag":"audacieux","points":1}]'),
('no-filter', 'A', 2, '{"fr":"Qui du groupe est le plus susceptible de parler dans le dos des gens ?","en":"Who in the group is most likely to talk behind people''s backs?","es":"¿Quién del grupo tiene más probabilidades de hablar a espaldas de la gente?","de":"Wer in der Gruppe redet am ehesten hinter dem Rücken von Leuten?"}', '[{"tag":"fiable","points":-2}]'),

-- Type A | intensity 3
('no-filter', 'A', 3, '{"fr":"Qui du groupe a le plus besoin d''une thérapie sans le savoir ?","en":"Who in the group needs therapy the most without knowing it?","es":"¿Quién del grupo necesita más terapia sin saberlo?","de":"Wer in der Gruppe braucht am dringendsten Therapie, ohne es zu wissen?"}', '[{"tag":"drole","points":2},{"tag":"mysterieux","points":1}]'),
('no-filter', 'A', 3, '{"fr":"Qui du groupe serait le plus dangereux avec le pouvoir ?","en":"Who in the group would be the most dangerous with power?","es":"¿Quién del grupo sería el más peligroso con el poder?","de":"Wer in der Gruppe wäre mit Macht am gefährlichsten?"}', '[{"tag":"audacieux","points":2},{"tag":"mysterieux","points":1}]'),

-- Type B | intensity 1
('no-filter', 'B', 1, '{"fr":"T''as déjà jugé quelqu''un très fort sur sa première impression, et tu avais tort ?","en":"Have you ever judged someone very harshly on first impression and been wrong?","es":"¿Alguna vez has juzgado duramente a alguien por la primera impresión y estabas equivocado/a?","de":"Hast du schon mal jemanden sehr hart nach dem ersten Eindruck beurteilt und lagst falsch?"}', '[{"tag":"audacieux","points":1},{"tag":"fiable","points":-1}]'),
('no-filter', 'B', 1, '{"fr":"T''as déjà dit du mal de quelqu''un à une personne qui le connaissait bien ?","en":"Have you ever spoken badly about someone to a person who knew them well?","es":"¿Alguna vez has hablado mal de alguien con una persona que lo conocía bien?","de":"Hast du schon mal schlecht über jemanden zu einer Person gesprochen, die ihn gut kannte?"}', '[{"tag":"fiable","points":-2},{"tag":"audacieux","points":1}]'),
('no-filter', 'B', 1, '{"fr":"T''as déjà utilisé quelqu''un pour avancer dans quelque chose ?","en":"Have you ever used someone to get ahead in something?","es":"¿Alguna vez has usado a alguien para avanzar en algo?","de":"Hast du schon mal jemanden benutzt, um in etwas voranzukommen?"}', '[{"tag":"audacieux","points":1},{"tag":"fiable","points":-1}]'),

-- Type B | intensity 2
('no-filter', 'B', 2, '{"fr":"T''as déjà fait semblant d''être quelqu''un d''autre pour plaire à quelqu''un ?","en":"Have you ever pretended to be someone else to please someone?","es":"¿Alguna vez has fingido ser otra persona para agradar a alguien?","de":"Hast du schon mal so getan, als wärst du jemand anderes, um jemandem zu gefallen?"}', '[{"tag":"mysterieux","points":1},{"tag":"fiable","points":-1}]'),
('no-filter', 'B', 2, '{"fr":"T''as déjà ressenti de la jalousie envers quelqu''un dans ce groupe ?","en":"Have you ever felt jealous of someone in this group?","es":"¿Alguna vez has sentido celos de alguien de este grupo?","de":"Hast du schon mal Neid auf jemanden in dieser Gruppe empfunden?"}', '[{"tag":"romantique","points":1},{"tag":"audacieux","points":1}]'),

-- Type B | intensity 3
('no-filter', 'B', 3, '{"fr":"T''as déjà fait quelque chose que tu considères moralement douteux mais que tu referais quand même ?","en":"Have you ever done something you consider morally questionable but would do again?","es":"¿Alguna vez has hecho algo que consideras moralmente cuestionable pero que volverías a hacer?","de":"Hast du schon mal etwas getan, das du moralisch zweifelhaft findest, aber trotzdem wieder tun würdest?"}', '[{"tag":"audacieux","points":2}]'),
('no-filter', 'B', 3, '{"fr":"T''as déjà blessé quelqu''un intentionnellement et tu t''en es jamais excusé ?","en":"Have you ever intentionally hurt someone and never apologized?","es":"¿Alguna vez has herido a alguien intencionalmente y nunca te has disculpado?","de":"Hast du schon mal jemanden absichtlich verletzt und dich nie entschuldigt?"}', '[{"tag":"fiable","points":-3},{"tag":"audacieux","points":1}]'),

-- Type C | intensity 1
('no-filter', 'C', 1, '{"fr":"Quelle opinion impopulaire tu défends vraiment ?","en":"What unpopular opinion do you genuinely defend?","es":"¿Qué opinión impopular defiendes de verdad?","de":"Welche unpopuläre Meinung vertrittst du wirklich?"}', '[{"tag":"audacieux","points":2}]'),
('no-filter', 'C', 1, '{"fr":"Quelle est la chose la plus honnête que tu pourrais dire sur toi-même là, maintenant ?","en":"What is the most honest thing you could say about yourself right now?","es":"¿Cuál es la cosa más honesta que podrías decir sobre ti mismo/a ahora mismo?","de":"Was ist das Ehrlichste, das du gerade jetzt über dich selbst sagen könntest?"}', '[{"tag":"audacieux","points":2},{"tag":"empathique","points":1}]'),

-- Type C | intensity 2
('no-filter', 'C', 2, '{"fr":"Quel est le mensonge que tu racontes le plus souvent sur toi-même ?","en":"What is the lie you tell most often about yourself?","es":"¿Cuál es la mentira que te cuentas más a menudo sobre ti mismo/a?","de":"Was ist die Lüge, die du am häufigsten über dich selbst erzählst?"}', '[{"tag":"mysterieux","points":1}]'),
('no-filter', 'C', 2, '{"fr":"De quoi es-tu le plus fier(e) que tu n''avoues jamais ?","en":"What are you most proud of that you never admit?","es":"¿De qué estás más orgulloso/a y nunca lo admites?","de":"Worauf bist du am stolzesten, das du nie zugibst?"}', '[{"tag":"mysterieux","points":1},{"tag":"audacieux","points":1}]'),

-- Type C | intensity 3
('no-filter', 'C', 3, '{"fr":"Qu''est-ce que tu n''as jamais dit à voix haute mais que tu penses depuis longtemps ?","en":"What have you never said out loud but have been thinking for a long time?","es":"¿Qué es lo que nunca has dicho en voz alta pero llevas mucho tiempo pensando?","de":"Was hast du noch nie laut gesagt, aber denkst du schon lange?"}', '[{"tag":"audacieux","points":2},{"tag":"mysterieux","points":1}]'),

-- =====================
-- UNMASKED
-- =====================

-- Type A | intensity 1
('unmasked', 'A', 1, '{"fr":"Qui du groupe est le plus difficile à vraiment connaître ?","en":"Who in the group is the hardest to truly know?","es":"¿A quién del grupo es más difícil conocer de verdad?","de":"Wer in der Gruppe ist am schwierigsten wirklich kennenzulernen?"}', '[{"tag":"mysterieux","points":3}]'),
('unmasked', 'A', 1, '{"fr":"Qui du groupe cache le mieux ses émotions ?","en":"Who in the group hides their emotions the best?","es":"¿Quién del grupo oculta mejor sus emociones?","de":"Wer in der Gruppe versteckt seine Emotionen am besten?"}', '[{"tag":"mysterieux","points":3}]'),

-- Type A | intensity 2
('unmasked', 'A', 2, '{"fr":"Qui du groupe a la plus grande peur de ce que les autres pensent de lui ?","en":"Who in the group fears the most what others think of them?","es":"¿Quién del grupo tiene más miedo a lo que otros piensan de él?","de":"Wer in der Gruppe hat am meisten Angst davor, was andere über ihn denken?"}', '[{"tag":"mysterieux","points":1},{"tag":"empathique","points":1}]'),
('unmasked', 'A', 2, '{"fr":"Qui du groupe souffre le plus en silence ?","en":"Who in the group suffers the most in silence?","es":"¿Quién del grupo sufre más en silencio?","de":"Wer in der Gruppe leidet am meisten im Stillen?"}', '[{"tag":"mysterieux","points":2},{"tag":"empathique","points":1}]'),

-- Type A | intensity 3
('unmasked', 'A', 3, '{"fr":"Qui du groupe a le plus besoin d''entendre qu''on l''aime ?","en":"Who in the group needs to hear they are loved the most?","es":"¿Quién del grupo necesita más escuchar que se le quiere?","de":"Wer in der Gruppe muss am dringendsten hören, dass er geliebt wird?"}', '[{"tag":"romantique","points":2},{"tag":"empathique","points":2}]'),
('unmasked', 'A', 3, '{"fr":"Qui du groupe est le plus susceptible de tout sacrifier pour quelqu''un qu''il aime ?","en":"Who in the group is most likely to sacrifice everything for someone they love?","es":"¿Quién del grupo tiene más probabilidades de sacrificarlo todo por alguien que ama?","de":"Wer in der Gruppe würde am ehesten alles für jemanden opfern, den er liebt?"}', '[{"tag":"romantique","points":3},{"tag":"empathique","points":2}]'),

-- Type B | intensity 1
('unmasked', 'B', 1, '{"fr":"T''as déjà pleuré sans savoir exactement pourquoi ?","en":"Have you ever cried without knowing exactly why?","es":"¿Alguna vez has llorado sin saber exactamente por qué?","de":"Hast du schon mal geweint, ohne genau zu wissen warum?"}', '[{"tag":"empathique","points":2}]'),
('unmasked', 'B', 1, '{"fr":"T''as déjà eu honte de quelque chose que tu aimes vraiment ?","en":"Have you ever been ashamed of something you genuinely love?","es":"¿Alguna vez te has avergonzado de algo que realmente te gusta?","de":"Hast du dich schon mal für etwas geschämt, das du wirklich liebst?"}', '[{"tag":"mysterieux","points":1},{"tag":"empathique","points":1}]'),
('unmasked', 'B', 1, '{"fr":"T''as déjà ressenti que personne ne te comprenait vraiment ?","en":"Have you ever felt that nobody truly understood you?","es":"¿Alguna vez has sentido que nadie te entendía de verdad?","de":"Hast du schon mal das Gefühl gehabt, dass dich niemand wirklich versteht?"}', '[{"tag":"empathique","points":2},{"tag":"mysterieux","points":1}]'),

-- Type B | intensity 2
('unmasked', 'B', 2, '{"fr":"T''as déjà eu peur que les gens que tu aimes te quittent si ils te connaissaient vraiment ?","en":"Have you ever feared that people you love would leave if they truly knew you?","es":"¿Alguna vez has temido que las personas que amas se vayan si te conocieran de verdad?","de":"Hast du schon mal Angst gehabt, dass die Menschen, die du liebst, gehen würden, wenn sie dich wirklich kennen würden?"}', '[{"tag":"mysterieux","points":2},{"tag":"empathique","points":1}]'),
('unmasked', 'B', 2, '{"fr":"T''as déjà sabordé quelque chose de bien parce que tu ne te sentais pas à la hauteur ?","en":"Have you ever sabotaged something good because you did not feel worthy?","es":"¿Alguna vez has saboteado algo bueno porque no te sentías a la altura?","de":"Hast du schon mal etwas Gutes sabotiert, weil du dich nicht gut genug gefühlt hast?"}', '[{"tag":"mysterieux","points":1},{"tag":"empathique","points":1}]'),

-- Type B | intensity 3
('unmasked', 'B', 3, '{"fr":"T''as déjà pensé que ta vie aurait été différente si une seule décision avait été autre ?","en":"Have you ever thought your life would have been different if just one decision had been different?","es":"¿Alguna vez has pensado que tu vida habría sido diferente si solo una decisión hubiera sido distinta?","de":"Hast du schon mal gedacht, dein Leben wäre anders gewesen, wenn nur eine Entscheidung anders gewesen wäre?"}', '[{"tag":"empathique","points":2},{"tag":"romantique","points":1}]'),
('unmasked', 'B', 3, '{"fr":"T''as déjà eu des pensées sur toi-même que tu aurais honte d''admettre ?","en":"Have you ever had thoughts about yourself that you would be ashamed to admit?","es":"¿Alguna vez has tenido pensamientos sobre ti mismo/a que te avergonzaría admitir?","de":"Hast du schon mal Gedanken über dich selbst gehabt, die du dich schämen würdest zuzugeben?"}', '[{"tag":"mysterieux","points":2}]'),

-- Type C | intensity 1
('unmasked', 'C', 1, '{"fr":"Quelle est la chose dont tu as le plus peur dans la vie ?","en":"What is the thing you fear the most in life?","es":"¿Cuál es la cosa que más temes en la vida?","de":"Was ist die Sache, die du im Leben am meisten fürchtest?"}', '[{"tag":"empathique","points":1},{"tag":"mysterieux","points":1}]'),
('unmasked', 'C', 1, '{"fr":"Qu''est-ce qui te rend vraiment toi, que les gens ne voient pas forcément ?","en":"What makes you truly you, that people do not necessarily see?","es":"¿Qué te hace verdaderamente tú, que la gente no necesariamente ve?","de":"Was macht dich wirklich zu dir, was die Menschen nicht unbedingt sehen?"}', '[{"tag":"mysterieux","points":2}]'),

-- Type C | intensity 2
('unmasked', 'C', 2, '{"fr":"Quelle est la chose que tu n''as jamais osé demander à quelqu''un dans ce groupe ?","en":"What is the thing you have never dared to ask someone in this group?","es":"¿Cuál es la cosa que nunca has osado preguntarle a alguien de este grupo?","de":"Was ist die Sache, die du jemandem in dieser Gruppe noch nie zu fragen gewagt hast?"}', '[{"tag":"audacieux","points":2},{"tag":"romantique","points":1}]'),
('unmasked', 'C', 2, '{"fr":"Qu''est-ce que tu aimerais que les gens comprennent mieux chez toi ?","en":"What would you like people to better understand about you?","es":"¿Qué te gustaría que la gente entendiera mejor de ti?","de":"Was würdest du dir wünschen, dass die Menschen besser an dir verstehen?"}', '[{"tag":"empathique","points":2}]'),

-- Type C | intensity 3
('unmasked', 'C', 3, '{"fr":"Si tu pouvais dire une chose vraie à quelqu''un dans ce groupe que tu n''as jamais dite, ce serait quoi ?","en":"If you could say one true thing to someone in this group that you have never said, what would it be?","es":"Si pudieras decirle una cosa verdadera a alguien de este grupo que nunca has dicho, ¿qué sería?","de":"Wenn du jemandem in dieser Gruppe eine wahre Sache sagen könntest, die du noch nie gesagt hast, was wäre das?"}', '[{"tag":"audacieux","points":2},{"tag":"empathique","points":1}]'),
('unmasked', 'C', 3, '{"fr":"Quel est le moment de ta vie où tu t''es senti(e) le plus seul(e) ?","en":"What is the moment in your life when you felt the most alone?","es":"¿Cuál es el momento de tu vida en el que te has sentido más solo/a?","de":"Was ist der Moment in deinem Leben, in dem du dich am einsamsten gefühlt hast?"}', '[{"tag":"empathique","points":2},{"tag":"mysterieux","points":1}]');
