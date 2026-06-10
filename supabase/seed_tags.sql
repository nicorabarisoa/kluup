-- Kluup — Tags des questions (traits du système d'archétypes)
-- ⚠️ Nécessite d'avoir exécuté le ALTER TABLE avant :
--   ALTER TABLE questions ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
--
-- Tags disponibles : drole, fiable, audacieux, empathique, mysterieux, romantique
-- Points positifs = le trait est renforcé, négatifs = le trait est diminué
-- 1 = léger, 2 = modéré, 3 = fort
--
-- Logique d'attribution :
--   Type A : la personne DÉSIGNÉE gagne/perd les points
--   Type B : la personne qui dit "oui" gagne/perd les points
--   Type C : le·la VOLONTAIRE gagne/perd les points

-- ============================================================
-- HELLO STRANGER — Type A
-- ============================================================

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible d''arriver en retard à son propre anniversaire';

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible de commander un plat et vouloir celui du voisin';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible de googler quelque chose juste après qu''on le lui ait expliqué';

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible de s''endormir dans un film d''action';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir un dossier « photos de honte » sur son téléphone';

UPDATE questions SET tags = '[{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible de relire ses anciens messages en grimacant';

UPDATE questions SET tags = '[{"tag":"empathique","points":2}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir pleuré en regardant une pub';

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible d''envoyer un message à la mauvaise personne';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"fiable","points":-1}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir fait semblant de ne pas voir un message';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir menti sur son âge en ligne';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2}]'
WHERE question->>'fr' = 'Le plus susceptible de tenir une rancune sans jamais en parler';

UPDATE questions SET tags = '[{"tag":"romantique","points":1},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir googlé son ex récemment';

-- ============================================================
-- HELLO STRANGER — Type B
-- ============================================================

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'T''as déjà mangé directement dans le pot de Nutella ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà fait semblant de dormir pour éviter une conversation ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'T''as déjà ri d''une blague que t''avais pas comprise ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà snobé un appel et envoyé « je peux pas parler » ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"fiable","points":-1}]'
WHERE question->>'fr' = 'T''as déjà annulé des plans au dernier moment juste pour rester chez toi ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà menti sur où t''étais à tes parents ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":2}]'
WHERE question->>'fr' = 'T''as déjà pleuré dans un lieu public en faisant semblant que tout allait bien ?';

UPDATE questions SET tags = '[{"tag":"fiable","points":-1},{"tag":"audacieux","points":-1}]'
WHERE question->>'fr' = 'T''as déjà bloqué quelqu''un par lâcheté ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà lu le journal intime ou les messages de quelqu''un sans sa permission ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'T''as déjà inventé une excuse pour quitter une soirée ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà espionné quelqu''un sur les réseaux sans qu''il le sache ?';

-- ============================================================
-- HELLO STRANGER — Type C
-- ============================================================

UPDATE questions SET tags = '[{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Si tu devais emporter 3 objets sur une île déserte, ce serait quoi ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'C''est quoi ton talent caché que personne dans ce groupe ne connaît ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Quel est ton plat réconfort absolu et pourquoi ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'C''est quoi la chose la plus étrange que tu fasses quand tu es seul·e ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'C''est quoi quelque chose que tout le monde aime et que toi tu détestes ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1},{"tag":"fiable","points":1}]'
WHERE question->>'fr' = 'C''est quoi le meilleur conseil que t''as jamais reçu ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Si tu devais résumer ta personnalité en 3 mots, ce serait lesquels ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2}]'
WHERE question->>'fr' = 'C''est quoi quelque chose que tu fais différemment des autres et dont tu es fier·e ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'C''est quoi ton plus grand regret de la semaine passée ?';

-- ============================================================
-- APÉRO — Type A
-- ============================================================

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible de finir le plateau de fromages sans prévenir';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible de donner un conseil non demandé après 2 verres';

UPDATE questions SET tags = '[{"tag":"drole","points":2},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible de faire un karaoké improvisé dans sa voiture';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible de checker son téléphone toutes les 5 minutes';

UPDATE questions SET tags = '[{"tag":"drole","points":2}]'
WHERE question->>'fr' = 'Le plus susceptible de raconter une histoire de plus en plus exagérée à chaque fois';

UPDATE questions SET tags = '[{"tag":"romantique","points":2}]'
WHERE question->>'fr' = 'Le plus susceptible de tomber amoureux·euse d''un personnage de série';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir envoyé un message regrettable sous l''influence';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir un rituel bizarre avant de dormir';

UPDATE questions SET tags = '[{"tag":"drole","points":2}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir dit « c''est la dernière fois » en se resservant';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir joué la comédie lors d''une dispute';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir embrassé quelqu''un en soirée et de l''avoir regretté';

UPDATE questions SET tags = '[{"tag":"drole","points":2},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible de prétendre être sobre alors qu''il est parti';

-- ============================================================
-- APÉRO — Type B
-- ============================================================

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'T''as déjà piqué de la nourriture dans l''assiette de quelqu''un sans lui demander ?';

UPDATE questions SET tags = '[{"tag":"drole","points":2}]'
WHERE question->>'fr' = 'T''as déjà dansé seul·e dans ta cuisine en préparant à manger ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'T''as déjà pris une photo de ton plat avant de manger ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'T''as déjà commandé plus que ce que tu pouvais manger ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà prétendu être malade pour ne pas aller à une soirée ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2}]'
WHERE question->>'fr' = 'T''as déjà flirté avec quelqu''un juste pour voir sa réaction ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"fiable","points":-1}]'
WHERE question->>'fr' = 'T''as déjà fait semblant de reconnaître quelqu''un pour ne pas avoir l''air idiot·e ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà menti sur ton niveau d''alcoolisation pour rentrer tôt ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":3},{"tag":"audacieux","points":2}]'
WHERE question->>'fr' = 'T''as déjà dit « je t''aime » en premier sans être sûr·e de la réponse ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'T''as déjà envoyé un message à quelqu''un que t''aurais jamais envoyé sobre ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":1},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà fait quelque chose d''irrationnel par jalousie ?';

-- ============================================================
-- APÉRO — Type C
-- ============================================================

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'C''est quoi la pire soirée de ta vie — en 30 secondes ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'C''est quoi ton rituel du vendredi soir idéal ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Si tu pouvais avoir une conversation de 10 minutes avec une célébrité, ce serait qui ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'C''est quoi le pire conseil en matière de relations que t''as jamais reçu ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'C''est quoi une chose que tu voulais à 15 ans et dont tu ris maintenant ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'Si tu devais choisir un film pour résumer ta vie, ce serait lequel ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2}]'
WHERE question->>'fr' = 'C''est quoi la chose la plus impulsive que tu aies faite en soirée ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'C''est quoi ton plus grand regret de soirée ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'Si tu pouvais effacer une soirée de ta mémoire, ce serait laquelle ?';

-- ============================================================
-- NO FILTER — Type A
-- ============================================================

UPDATE questions SET tags = '[{"tag":"audacieux","points":2}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir une opinion impopulaire et de la défendre mordicus';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible d''engueuler quelqu''un dans un film au cinéma';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible de roter sans s''excuser';

UPDATE questions SET tags = '[{"tag":"audacieux","points":3}]'
WHERE question->>'fr' = 'Le plus susceptible de dire ce qu''il pense sans filtre même si c''est brutal';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir humilié quelqu''un en public, même gentiment';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"fiable","points":-2}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir balancé un secret « accidentellement »';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"fiable","points":-1}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir jugé quelqu''un à son look avant de lui parler';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"fiable","points":-1},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible de lire les messages de son/sa partenaire s''il laisse son téléphone ouvert';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"fiable","points":-3}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir trompé quelqu''un ou de l''avoir envisagé sérieusement';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"fiable","points":-2}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir tiré avantage de la gentillesse de quelqu''un';

UPDATE questions SET tags = '[{"tag":"empathique","points":-2},{"tag":"fiable","points":-1}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir délibérément ignoré quelqu''un qui avait besoin d''aide';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"fiable","points":-2}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir menti pour se sortir d''une situation difficile';

-- ============================================================
-- NO FILTER — Type B
-- ============================================================

UPDATE questions SET tags = '[{"tag":"fiable","points":-2},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà parlé en mal de quelqu''un juste après lui avoir parlé gentiment en face ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1},{"tag":"fiable","points":-1}]'
WHERE question->>'fr' = 'T''as déjà fait semblant d''apprécier un cadeau que tu détestais ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà copié sur quelqu''un lors d''un exam ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"fiable","points":-1}]'
WHERE question->>'fr' = 'T''as déjà menti à un ami pour l''éviter ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'T''as déjà flirté avec quelqu''un en couple (toi ou l''autre) ?';

UPDATE questions SET tags = '[{"tag":"fiable","points":-3},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà révélé un secret qu''on t''avait confié ?';

UPDATE questions SET tags = '[{"tag":"fiable","points":-2},{"tag":"audacieux","points":-1}]'
WHERE question->>'fr' = 'T''as déjà laissé quelqu''un prendre le blâme à ta place ?';

UPDATE questions SET tags = '[{"tag":"fiable","points":-2},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'T''as déjà sabordé une amitié par jalousie ?';

UPDATE questions SET tags = '[{"tag":"fiable","points":-3},{"tag":"romantique","points":-1}]'
WHERE question->>'fr' = 'T''as déjà trompé quelqu''un que t''aimais vraiment ?';

UPDATE questions SET tags = '[{"tag":"fiable","points":-2},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà utilisé quelqu''un pour te sentir mieux ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2},{"tag":"fiable","points":-1}]'
WHERE question->>'fr' = 'T''as déjà coupé quelqu''un de ta vie sans lui expliquer pourquoi ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà fait quelque chose dont t''as honte et que personne ne sait ?';

-- ============================================================
-- NO FILTER — Type C
-- ============================================================

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'C''est quoi ton opinion la plus impopulaire sur la nourriture ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2}]'
WHERE question->>'fr' = 'C''est quoi quelque chose que tout le monde trouve « adorable » et que toi tu trouves insupportable ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2}]'
WHERE question->>'fr' = 'Si tu devais choisir une loi à supprimer, ce serait laquelle ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'C''est quoi quelque chose que tu penses et que tu n''oses jamais dire à voix haute ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'C''est quoi ta contradiction principale en tant que personne ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'C''est quoi la vérité la plus difficile que quelqu''un t''ait dite ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2}]'
WHERE question->>'fr' = 'C''est quoi quelque chose que tu as fait dont tu n''es pas fier·e, mais que tu referais ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Si tu devais avouer quelque chose à quelqu''un dans cette pièce, ce serait quoi ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":3}]'
WHERE question->>'fr' = 'C''est quoi la chose la plus courageuse que tu n''aies jamais faite ?';

-- ============================================================
-- UNMASKED — Type A
-- ============================================================

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2},{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible de cacher ses vraies émotions derrière l''humour';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"empathique","points":-1}]'
WHERE question->>'fr' = 'Le plus susceptible de se comparer constamment aux autres sans le montrer';

UPDATE questions SET tags = '[{"tag":"empathique","points":1},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir besoin d''approbation externe pour se sentir bien';

UPDATE questions SET tags = '[{"tag":"empathique","points":2}]'
WHERE question->>'fr' = 'Le plus susceptible de faire passer les besoins des autres avant les siens';

UPDATE questions SET tags = '[{"tag":"romantique","points":2},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible d''idéaliser quelqu''un jusqu''à la déception';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2}]'
WHERE question->>'fr' = 'Le plus susceptible de saboter quelque chose qui allait bien par peur que ça dure';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2},{"tag":"empathique","points":-1}]'
WHERE question->>'fr' = 'Le plus susceptible de se morfondre en silence plutôt que d''en parler';

UPDATE questions SET tags = '[{"tag":"romantique","points":1},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir une peur inavouée de l''abandon';

UPDATE questions SET tags = '[{"tag":"romantique","points":2},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible d''être encore marqué·e par une rupture ancienne';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"audacieux","points":-1}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir du mal à demander de l''aide même en difficulté';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir une relation compliquée avec sa famille sans le montrer';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Le plus susceptible d''avoir du mal à accepter les compliments sincères';

-- ============================================================
-- UNMASKED — Type B
-- ============================================================

UPDATE questions SET tags = '[{"tag":"empathique","points":2}]'
WHERE question->>'fr' = 'T''as déjà pleuré sans vraiment savoir pourquoi ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà eu honte d''une émotion que tu ressentais ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2}]'
WHERE question->>'fr' = 'T''as déjà souri pour cacher que t''allais pas bien ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":2},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'T''as déjà relu une conversation pour te souvenir comment quelqu''un te parlait ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":2}]'
WHERE question->>'fr' = 'T''as déjà eu l''impression d''être la seule personne à se sentir aussi seule dans un groupe ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2}]'
WHERE question->>'fr' = 'T''as déjà dit « je vais bien » alors que tu vivais une période difficile ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":3},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà aimé quelqu''un en silence pendant longtemps sans jamais rien dire ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'T''as déjà fait quelque chose pour te prouver ta valeur plutôt que par envie ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'T''as déjà coupé quelqu''un de ta vie pour te protéger, même si tu l''aimais encore ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'T''as déjà eu peur que les gens te quittent s''ils te connaissaient vraiment ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":1},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'T''as déjà été jaloux·se d''une vie que tu imaginais pour quelqu''un d''autre ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":1},{"tag":"empathique","points":2}]'
WHERE question->>'fr' = 'T''as déjà fait une erreur grave dans une relation dont tu t''en veux encore ?';

-- ============================================================
-- UNMASKED — Type C
-- ============================================================

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'C''est quoi une qualité que tu te reconnais que peu de gens voient en toi ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Qu''est-ce qui te donne de l''énergie quand tu te sens à plat ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":2},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'C''est quoi quelque chose de simple qui te rend profondément heureux·se ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'C''est quoi la version de toi-même que tu aimerais être dans 5 ans ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":2}]'
WHERE question->>'fr' = 'C''est quoi quelque chose que tu aurais voulu qu''on te dise plus jeune ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":2},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'C''est quoi le moment de ta vie où tu t''es senti·e le plus seul·e ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":2},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'C''est quoi ta plus grande peur dans une relation proche ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":2}]'
WHERE question->>'fr' = 'Si tu devais écrire une lettre à ta version d''il y a 10 ans, tu lui dirais quoi ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2}]'
WHERE question->>'fr' = 'C''est quoi quelque chose qui te définit et que tu aurais du mal à expliquer aux autres ?';

-- ============================================================
-- SEED_THEMES — APÉRO supplémentaire
-- ============================================================

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Qui du groupe commande toujours une bière même quand il préfère autre chose ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Qui du groupe fait semblant de connaître le vin qu''on lui propose ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Qui du groupe finit toujours les chips en premier ?';

UPDATE questions SET tags = '[{"tag":"drole","points":2},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Qui du groupe devient philosophe après deux verres ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Qui du groupe est le plus susceptible de commencer un débat qu''il ne peut pas gagner ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":3}]'
WHERE question->>'fr' = 'Qui du groupe a le plus de secrets que personne ne soupçonne ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'T''as déjà fait semblant d''aimer un plat pour ne pas vexer l''hôte ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'T''as déjà bu plus que prévu parce que tu t''ennuyais à une soirée ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà inventé un prétexte pour partir plus tôt d''une soirée ?';

UPDATE questions SET tags = '[{"tag":"fiable","points":-1},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà dit que tu allais venir à une soirée sans avoir l''intention d''y aller ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà eu une conversation sérieuse avec quelqu''un alors que t''étais complètement ivre ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'T''as déjà envoyé un message que tu regrettes après une soirée ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'T''as déjà avoué quelque chose d''important à quelqu''un parce que tu avais bu ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Quel est ton rituel pour te préparer avant une soirée ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Quelle est la soirée la plus mémorable que tu aies vécue ?';

UPDATE questions SET tags = '[{"tag":"drole","points":2}]'
WHERE question->>'fr' = 'Quel est le truc le plus gênant que t''as fait en soirée ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Qu''est-ce qui te manquerait le plus si tu devais arrêter de boire de l''alcool ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":3}]'
WHERE question->>'fr' = 'Quelle vérité as-tu dite un soir que tu n''aurais jamais dite sobre ?';

-- ============================================================
-- SEED_THEMES — NO FILTER supplémentaire
-- ============================================================

UPDATE questions SET tags = '[{"tag":"fiable","points":-2},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Qui du groupe est le plus hypocrite ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Qui du groupe donne le plus de conseils qu''il ne suit jamais lui-même ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Qui du groupe est le plus difficile à contenter ?';

UPDATE questions SET tags = '[{"tag":"fiable","points":-2},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Qui du groupe mens le plus souvent, même pour de petites choses ?';

UPDATE questions SET tags = '[{"tag":"fiable","points":-2}]'
WHERE question->>'fr' = 'Qui du groupe est le plus susceptible de parler dans le dos des gens ?';

UPDATE questions SET tags = '[{"tag":"drole","points":2},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Qui du groupe a le plus besoin d''une thérapie sans le savoir ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Qui du groupe serait le plus dangereux avec le pouvoir ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"fiable","points":-1}]'
WHERE question->>'fr' = 'T''as déjà jugé quelqu''un très fort sur sa première impression, et tu avais tort ?';

UPDATE questions SET tags = '[{"tag":"fiable","points":-2},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà dit du mal de quelqu''un à une personne qui le connaissait bien ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"fiable","points":-1}]'
WHERE question->>'fr' = 'T''as déjà utilisé quelqu''un pour avancer dans quelque chose ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"fiable","points":-1}]'
WHERE question->>'fr' = 'T''as déjà fait semblant d''être quelqu''un d''autre pour plaire à quelqu''un ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":1},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà ressenti de la jalousie envers quelqu''un dans ce groupe ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2}]'
WHERE question->>'fr' = 'T''as déjà fait quelque chose que tu considères moralement douteux mais que tu referais quand même ?';

UPDATE questions SET tags = '[{"tag":"fiable","points":-3},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà blessé quelqu''un intentionnellement et tu t''en es jamais excusé ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2}]'
WHERE question->>'fr' = 'Quelle opinion impopulaire tu défends vraiment ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Quelle est la chose la plus honnête que tu pourrais dire sur toi-même là, maintenant ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Quel est le mensonge que tu racontes le plus souvent sur toi-même ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'De quoi es-tu le plus fier(e) que tu n''avoues jamais ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Qu''est-ce que tu n''as jamais dit à voix haute mais que tu penses depuis longtemps ?';

-- ============================================================
-- SEED_THEMES — UNMASKED supplémentaire
-- ============================================================

UPDATE questions SET tags = '[{"tag":"mysterieux","points":3}]'
WHERE question->>'fr' = 'Qui du groupe est le plus difficile à vraiment connaître ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":3}]'
WHERE question->>'fr' = 'Qui du groupe cache le mieux ses émotions ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Qui du groupe a la plus grande peur de ce que les autres pensent de lui ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Qui du groupe souffre le plus en silence ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":2},{"tag":"empathique","points":2}]'
WHERE question->>'fr' = 'Qui du groupe a le plus besoin d''entendre qu''on l''aime ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":3},{"tag":"empathique","points":2}]'
WHERE question->>'fr' = 'Qui du groupe est le plus susceptible de tout sacrifier pour quelqu''un qu''il aime ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":2}]'
WHERE question->>'fr' = 'T''as déjà pleuré sans savoir exactement pourquoi ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'T''as déjà eu honte de quelque chose que tu aimes vraiment ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":2},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà ressenti que personne ne te comprenait vraiment ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'T''as déjà eu peur que les gens que tu aimes te quittent si ils te connaissaient vraiment ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'T''as déjà sabordé quelque chose de bien parce que tu ne te sentais pas à la hauteur ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":2},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'T''as déjà pensé que ta vie aurait été différente si une seule décision avait été autre ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2}]'
WHERE question->>'fr' = 'T''as déjà eu des pensées sur toi-même que tu aurais honte d''admettre ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Quelle est la chose dont tu as le plus peur dans la vie ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2}]'
WHERE question->>'fr' = 'Qu''est-ce qui te rend vraiment toi, que les gens ne voient pas forcément ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'Quelle est la chose que tu n''as jamais osé demander à quelqu''un dans ce groupe ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":2}]'
WHERE question->>'fr' = 'Qu''est-ce que tu aimerais que les gens comprennent mieux chez toi ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Si tu pouvais dire une chose vraie à quelqu''un dans ce groupe que tu n''as jamais dite, ce serait quoi ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":2},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Quel est le moment de ta vie où tu t''es senti(e) le plus seul(e) ?';

-- ============================================================
-- SEED_CUT — APÉRO
-- ============================================================

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Le compliment le plus bizarre qu''on t''ait fait ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"fiable","points":1}]'
WHERE question->>'fr' = 'Quelle mauvaise habitude t''as réussi à arrêter ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Un truc qui est meilleur la deuxième fois ?';

UPDATE questions SET tags = '[{"tag":"drole","points":2},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Qu''as-tu déjà fait juste pour avoir l''air cool ?';

UPDATE questions SET tags = '[{"tag":"drole","points":2},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'La chanson que t''as honte d''adorer ? Chante-la.';

UPDATE questions SET tags = '[{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'Si tu pouvais vivre la vie de quelqu''un, ce serait qui ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'Quel titre de film résume ta dernière relation ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":2},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Le type de personne que t''aurais aimé fréquenter sans jamais oser ?';

UPDATE questions SET tags = '[{"tag":"drole","points":2}]'
WHERE question->>'fr' = 'Ton pire rencard. Balance tout.';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Le meilleur moment passé avec des inconnus ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":1},{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'T''as fait quoi à ton tout premier rencard ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Ton truc préféré pour claquer ton argent ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'L''album que t''as le plus écouté ? Sans mentir.';

UPDATE questions SET tags = '[{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Ton dimanche parfait, ça ressemble à quoi ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":1},{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Une manie santé que t''as et que personne d''autre n''a ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":3},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Décris ton premier vrai baiser. Plante le décor.';

UPDATE questions SET tags = '[{"tag":"romantique","points":3}]'
WHERE question->>'fr' = 'T''as déjà été vraiment amoureux·se ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1},{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'La soirée parfaite avec tous tes potes, elle ressemble à quoi ?';

UPDATE questions SET tags = '[{"tag":"drole","points":2},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'La façon la plus bizarre dont t''as gagné de l''argent ?';

UPDATE questions SET tags = '[{"tag":"drole","points":2}]'
WHERE question->>'fr' = 'Un look de ton passé que t''es soulagé·e d''avoir abandonné ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Le snack vers lequel tu cours quand ça va mal ?';

UPDATE questions SET tags = '[{"tag":"drole","points":2}]'
WHERE question->>'fr' = 'Une fois où, gamin·e, t''as foutu la honte à tes parents ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Un truc que tu pensais détester et que t''adores ?';

-- ============================================================
-- SEED_CUT — NO FILTER
-- ============================================================

UPDATE questions SET tags = '[{"tag":"fiable","points":-2},{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'T''as déjà lâché une info qui devait rester secrète ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":1},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'T''as mis combien de temps à oublier ton ex ? Et c''est vraiment réglé ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'La dernière fois que t''as pété un câble ? Raconte.';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Un truc que tu fais en te demandant si les autres aussi ?';

UPDATE questions SET tags = '[{"tag":"drole","points":2}]'
WHERE question->>'fr' = 'Un point d''hygiène où tu pourrais clairement mieux faire ?';

UPDATE questions SET tags = '[{"tag":"fiable","points":-2},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà ghosté quelqu''un de proche ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"fiable","points":-2}]'
WHERE question->>'fr' = 'T''as déjà volé quelque chose ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Une habitude ou une relation que t''aimerais pouvoir larguer ?';

UPDATE questions SET tags = '[{"tag":"fiable","points":1},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Qui est le cerveau du groupe ? Défends ton choix.';

UPDATE questions SET tags = '[{"tag":"drole","points":2},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'Ce que tu fais exprès pour faire enrager ton/ta partenaire ?';

UPDATE questions SET tags = '[{"tag":"drole","points":2},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Un truc que t''as toujours fait et compris trop tard que c''était chelou ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":1},{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Raconte le plus beau râteau que tu t''es pris·e.';

UPDATE questions SET tags = '[{"tag":"drole","points":2}]'
WHERE question->>'fr' = 'Ton moment le plus gênant en public ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1},{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Pour quoi tu t''es fait sévèrement gronder, gamin·e ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Le plus gros mensonge sorti pour annuler des plans ?';

-- ============================================================
-- SEED_CUT — UNMASKED (contenu adulte/sexuel)
-- ============================================================

UPDATE questions SET tags = '[{"tag":"audacieux","points":3},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'La compétence sexuelle dont t''es le·la plus fier·ère ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'T''as déjà eu un coup d''un soir ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":3},{"tag":"romantique","points":2}]'
WHERE question->>'fr' = 'Donne un exemple de ton dirty talk. Convaincs-nous.';

UPDATE questions SET tags = '[{"tag":"audacieux","points":3}]'
WHERE question->>'fr' = 'T''as déjà envoyé un nude ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'T''es du genre bruyant·e au lit ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":3}]'
WHERE question->>'fr' = 'L''anulingus : déjà donné ou reçu ?';

UPDATE questions SET tags = '[{"tag":"fiable","points":-3},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà trompé quelqu''un ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"romantique","points":2}]'
WHERE question->>'fr' = 'Bouffe et sexe : ton meilleur souvenir mêlant les deux ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":3}]'
WHERE question->>'fr' = 'T''as déjà filmé tes ébats ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'Qui a eu le plus de partenaires, à ton avis ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":3}]'
WHERE question->>'fr' = 'T''as déjà fait l''amour dans un lieu public ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"fiable","points":-2}]'
WHERE question->>'fr' = 'T''as déjà couché avec quelqu''un déjà en couple ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":3}]'
WHERE question->>'fr' = 'L''endroit le plus insolite où t''as fait l''amour ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'T''as déjà tenté ta chance dans les DM de quelqu''un ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":3},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'La chose la plus coquine que t''as demandée à quelqu''un ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'On t''a déjà surpris·e en plein acte (ou en solo) ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2}]'
WHERE question->>'fr' = 'Un an sans sexe ni masturbation = 27 000 €. Tu tiendrais ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":1},{"tag":"drole","points":1}]'
WHERE question->>'fr' = 'Tes parents t''ont dit quoi sur le sexe ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'La demande la plus coquine que t''as refusée ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as une limite d''âge pour un coup d''un soir ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":3}]'
WHERE question->>'fr' = 'Combien de personnes max pour une partie à plusieurs ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":3},{"tag":"audacieux","points":2}]'
WHERE question->>'fr' = 'Décris les préliminaires parfaits.';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"romantique","points":2}]'
WHERE question->>'fr' = 'Un truc au lit que t''as jamais essayé mais qui te tente ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":3}]'
WHERE question->>'fr' = 'T''as déjà fait un plan à trois ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":2},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'T''as besoin d''amour pour du bon sexe ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'T''as des fantasmes qui te surprennent toi-même ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"romantique","points":1}]'
WHERE question->>'fr' = 'Ta position préférée, et pourquoi ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"fiable","points":1}]'
WHERE question->>'fr' = 'T''es confiant·e côté sexe oral ?';

UPDATE questions SET tags = '[{"tag":"drole","points":1},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'Un mensonge sorti à tes parents. Ils l''ont su ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":2},{"tag":"empathique","points":1}]'
WHERE question->>'fr' = 'Ce qui te manque de ton dernier ex sérieux ?';

UPDATE questions SET tags = '[{"tag":"drole","points":2},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà fait sous toi à l''âge adulte ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":2}]'
WHERE question->>'fr' = 'T''as déjà craqué pour quelqu''un juste parce qu''il/elle craquait pour toi ?';

UPDATE questions SET tags = '[{"tag":"drole","points":2},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Ton historique Google devient public. La recherche la plus dure à expliquer ?';

UPDATE questions SET tags = '[{"tag":"drole","points":2},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'La chose la plus gênante que t''as demandée à Google ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2},{"tag":"mysterieux","points":1}]'
WHERE question->>'fr' = 'Un truc que tu fais et que t''arrêteras seulement si on te choppe ?';

UPDATE questions SET tags = '[{"tag":"audacieux","points":2}]'
WHERE question->>'fr' = 'T''as fait un truc pas glorieux pour de l''argent ?';

UPDATE questions SET tags = '[{"tag":"romantique","points":2},{"tag":"empathique","points":2}]'
WHERE question->>'fr' = 'T''as déjà pleuré pendant ou après l''amour ?';

UPDATE questions SET tags = '[{"tag":"empathique","points":3}]'
WHERE question->>'fr' = 'Si tu mourais ce soir, ton plus grand regret ?';

UPDATE questions SET tags = '[{"tag":"fiable","points":-3},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà poignardé quelqu''un dans le dos ?';

UPDATE questions SET tags = '[{"tag":"mysterieux","points":2},{"tag":"audacieux","points":1}]'
WHERE question->>'fr' = 'T''as déjà prétendu être quelqu''un d''autre en ligne ?';
