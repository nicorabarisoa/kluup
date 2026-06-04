-- Run this in the Supabase SQL editor

-- Add game columns to rooms table
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'lobby',
  ADD COLUMN IF NOT EXISTS theme text DEFAULT 'hello-stranger',
  ADD COLUMN IF NOT EXISTS game_state jsonb;

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme text NOT NULL,
  type text NOT NULL CHECK (type IN ('A', 'B', 'C')),
  intensity int NOT NULL DEFAULT 1 CHECK (intensity BETWEEN 1 AND 3),
  question jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Votes table
CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE,
  round int NOT NULL DEFAULT 1,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  vote_type text NOT NULL, -- 'question_selection' | 'designation' | 'confession' | 'volunteer'
  target_player_id uuid REFERENCES players(id) ON DELETE SET NULL,
  answer boolean,
  question_index int,
  created_at timestamptz DEFAULT now(),
  UNIQUE (room_id, round, player_id, vote_type)
);

-- Basic RLS (open for MVP)
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "questions_read" ON questions FOR SELECT USING (true);
CREATE POLICY "votes_insert" ON votes FOR INSERT WITH CHECK (true);
CREATE POLICY "votes_select" ON votes FOR SELECT USING (true);

-- Enable Realtime on votes (rooms already added)
ALTER PUBLICATION supabase_realtime ADD TABLE votes;

-- =====================
-- Seed questions
-- =====================

INSERT INTO questions (theme, type, intensity, question) VALUES

-- hello-stranger | Type A | intensity 1
('hello-stranger', 'A', 1, '{"fr":"Qui du groupe est le plus susceptible de mentir pour éviter une conversation difficile ?","en":"Who in the group is most likely to lie to avoid a difficult conversation?","es":"¿Quién del grupo tiene más probabilidades de mentir para evitar una conversación difícil?","de":"Wer in der Gruppe lügt am ehesten, um ein schwieriges Gespräch zu vermeiden?"}'),
('hello-stranger', 'A', 1, '{"fr":"Qui du groupe serait le dernier à demander de l''aide quand il est perdu ?","en":"Who in the group would be the last to ask for help when lost?","es":"¿Quién del grupo sería el último en pedir ayuda cuando está perdido?","de":"Wer in der Gruppe würde als Letzter um Hilfe bitten, wenn er sich verirrt hat?"}'),
('hello-stranger', 'A', 1, '{"fr":"Qui du groupe commande toujours ce qu''il connaît déjà au restaurant ?","en":"Who in the group always orders what they already know at a restaurant?","es":"¿Quién del grupo siempre pide lo que ya conoce en el restaurante?","de":"Wer in der Gruppe bestellt immer das, was er schon kennt?"}'),

-- hello-stranger | Type A | intensity 2
('hello-stranger', 'A', 2, '{"fr":"Qui du groupe a l''ego le plus fragile ?","en":"Who in the group has the most fragile ego?","es":"¿Quién del grupo tiene el ego más frágil?","de":"Wer in der Gruppe hat das zerbrechlichste Ego?"}'),
('hello-stranger', 'A', 2, '{"fr":"Qui du groupe est le plus difficile à contredire ?","en":"Who in the group is the hardest to contradict?","es":"¿A quién del grupo es más difícil contradecir?","de":"Wer in der Gruppe lässt sich am schwierigsten widersprechen?"}'),

-- hello-stranger | Type A | intensity 3
('hello-stranger', 'A', 3, '{"fr":"Qui du groupe a le plus de secrets ?","en":"Who in the group has the most secrets?","es":"¿Quién del grupo tiene más secretos?","de":"Wer in der Gruppe hat die meisten Geheimnisse?"}'),

-- hello-stranger | Type B | intensity 1
('hello-stranger', 'B', 1, '{"fr":"T''as déjà inventé une excuse pour annuler des plans ?","en":"Have you ever made up an excuse to cancel plans?","es":"¿Alguna vez has inventado una excusa para cancelar planes?","de":"Hast du schon mal eine Ausrede erfunden, um Pläne abzusagen?"}'),
('hello-stranger', 'B', 1, '{"fr":"T''as déjà relu une conversation pour savoir si t''avais bien répondu ?","en":"Have you ever re-read a conversation to check if you replied well?","es":"¿Alguna vez has releído una conversación para ver si respondiste bien?","de":"Hast du schon mal eine Unterhaltung erneut gelesen, um zu prüfen, ob du gut geantwortet hast?"}'),
('hello-stranger', 'B', 1, '{"fr":"T''as déjà fait semblant de ne pas avoir vu un message pour gagner du temps avant de répondre ?","en":"Have you ever pretended not to have seen a message to buy time before responding?","es":"¿Alguna vez has fingido no haber visto un mensaje para ganar tiempo antes de responder?","de":"Hast du schon mal so getan, als hättest du eine Nachricht nicht gesehen, um Zeit zu gewinnen?"}'),
('hello-stranger', 'B', 1, '{"fr":"T''as déjà googelé les symptômes d''une maladie et convaincu que t''avais quelque chose de grave ?","en":"Have you ever googled symptoms and convinced yourself you had something serious?","es":"¿Alguna vez has buscado síntomas en Google y te has convencido de que tenías algo grave?","de":"Hast du schon mal Symptome gegoogelt und dich überzeugt, etwas Ernstes zu haben?"}'),

-- hello-stranger | Type B | intensity 2
('hello-stranger', 'B', 2, '{"fr":"T''as déjà eu des sentiments pour quelqu''un dans ce groupe ?","en":"Have you ever had feelings for someone in this group?","es":"¿Alguna vez has tenido sentimientos por alguien de este grupo?","de":"Hattest du schon mal Gefühle für jemanden in dieser Gruppe?"}'),
('hello-stranger', 'B', 2, '{"fr":"T''as déjà dit du mal de quelqu''un présent ce soir ?","en":"Have you ever talked badly about someone here tonight?","es":"¿Alguna vez has hablado mal de alguien presente esta noche?","de":"Hast du schon mal schlecht über jemanden hier heute Abend geredet?"}'),

-- hello-stranger | Type B | intensity 3
('hello-stranger', 'B', 3, '{"fr":"T''as déjà menti sur quelque chose d''important à quelqu''un dans ce groupe ?","en":"Have you ever lied about something important to someone in this group?","es":"¿Alguna vez has mentido sobre algo importante a alguien de este grupo?","de":"Hast du schon mal jemanden in dieser Gruppe über etwas Wichtiges angelogen?"}'),

-- hello-stranger | Type C | intensity 1
('hello-stranger', 'C', 1, '{"fr":"Quelle est la chose dont tu es le plus fier(e) cette année ?","en":"What are you most proud of this year?","es":"¿De qué estás más orgulloso/a este año?","de":"Worauf bist du dieses Jahr am stolzesten?"}'),
('hello-stranger', 'C', 1, '{"fr":"Quel est le truc le plus spontané que t''as fait récemment ?","en":"What is the most spontaneous thing you have done recently?","es":"¿Cuál es la cosa más espontánea que has hecho recientemente?","de":"Was ist das Spontanste, das du zuletzt getan hast?"}'),
('hello-stranger', 'C', 1, '{"fr":"Quelle est la dernière chose qui t''a vraiment surpris(e) ?","en":"What is the last thing that truly surprised you?","es":"¿Cuál es la última cosa que realmente te sorprendió?","de":"Was hat dich zuletzt wirklich überrascht?"}'),

-- hello-stranger | Type C | intensity 2
('hello-stranger', 'C', 2, '{"fr":"Si tu devais décrire ta vie avec un titre de film, ce serait lequel ?","en":"If you had to describe your life with a movie title, what would it be?","es":"Si tuvieras que describir tu vida con un título de película, ¿cuál sería?","de":"Wenn du dein Leben mit einem Filmtitel beschreiben müsstest, welcher wäre es?"}'),
('hello-stranger', 'C', 2, '{"fr":"Quelle est la chose que tu ferais si tu savais que tu ne pourrais pas échouer ?","en":"What would you do if you knew you could not fail?","es":"¿Qué harías si supieras que no puedes fallar?","de":"Was würdest du tun, wenn du wüsstest, dass du nicht scheitern kannst?"}'),

-- hello-stranger | Type C | intensity 3
('hello-stranger', 'C', 3, '{"fr":"Quelle vérité sur toi-même t''as mis longtemps à accepter ?","en":"What truth about yourself took you a long time to accept?","es":"¿Qué verdad sobre ti mismo tardaste mucho en aceptar?","de":"Welche Wahrheit über dich selbst hat lange gedauert, bis du sie akzeptiert hast?"}');
