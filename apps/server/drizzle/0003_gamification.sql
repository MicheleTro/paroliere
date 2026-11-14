-- Gamification di Paroliere (decisioni whoru #29-#30), in un solo passo: progressione, partite, Settimana,
-- medaglie, oggetti, impostazioni e dati iniziali. Riunisce le migrazioni di sviluppo 0003-0013, che non sono mai
-- state applicate in produzione. Dalla 0002 il database parte da sfide 1 contro 1 e lascia le vecchie
-- tabelle di storico e statistiche (i dati vecchi si perdono: decisione presa).

-- ===== da 0003_rimuovi_storico_e_statistiche =====
-- Le sfide in corso si chiudono: cambiano struttura (la configurazione passa dentro la sfida) e il progresso riparte da zero (SPEC §11.2).
DELETE FROM "duels";--> statement-breakpoint
ALTER TABLE "game_configs" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "games" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "player_word_stats" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "game_configs" CASCADE;--> statement-breakpoint
DROP TABLE "games" CASCADE;--> statement-breakpoint
DROP TABLE "player_word_stats" CASCADE;--> statement-breakpoint
ALTER TABLE "duels" DROP CONSTRAINT IF EXISTS "duels_config_id_game_configs_id_fk";
--> statement-breakpoint
ALTER TABLE "duels" DROP COLUMN "config_id";--> statement-breakpoint
DROP TYPE "public"."game_source";--> statement-breakpoint
DROP TYPE "public"."point_mode";--> statement-breakpoint
DROP TYPE "public"."scoring";
--> statement-breakpoint
-- ===== da 0004_progressione_settimana_e_medaglie =====
CREATE TYPE "public"."found_word_source" AS ENUM('gioca', 'settimana', 'sfida');--> statement-breakpoint
CREATE TYPE "public"."play_mode" AS ENUM('gioca', 'settimana');--> statement-breakpoint
CREATE TYPE "public"."play_status" AS ENUM('started', 'finished', 'abandoned');--> statement-breakpoint
CREATE TABLE "found_words" (
	"user_id" varchar(64) NOT NULL,
	"word" varchar(64) NOT NULL,
	"first_found_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_mode" "found_word_source" NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "found_words_user_id_word_pk" PRIMARY KEY("user_id","word")
);
--> statement-breakpoint
CREATE TABLE "medals" (
	"user_id" varchar(64) NOT NULL,
	"medal_id" varchar(64) NOT NULL,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medals_user_id_medal_id_pk" PRIMARY KEY("user_id","medal_id")
);
--> statement-breakpoint
CREATE TABLE "plays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"mode" "play_mode" NOT NULL,
	"grid_id" uuid,
	"seed" bigint NOT NULL,
	"config" jsonb NOT NULL,
	"status" "play_status" DEFAULT 'started' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer NOT NULL,
	"help_used" boolean DEFAULT false NOT NULL,
	"words" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "plays_user_id_grid_id_unique" UNIQUE("user_id","grid_id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" varchar(64) PRIMARY KEY NOT NULL,
	"total_xp" bigint DEFAULT 0 NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"streak_last_day" date,
	"streak_cycles" integer DEFAULT 0 NOT NULL,
	"helps" integer DEFAULT 0 NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"max_words_in_game" integer DEFAULT 0 NOT NULL,
	"longest_word" varchar(64),
	"longest_word_length" integer DEFAULT 0 NOT NULL,
	"onboarded_at" timestamp with time zone,
	"notifications_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "week_plan" (
	"day_index" integer PRIMARY KEY NOT NULL,
	"variant_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "week_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(32) NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" varchar(400) DEFAULT '' NOT NULL,
	"size" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"min_word_length" integer DEFAULT 3 NOT NULL,
	"min_words" integer DEFAULT 50 NOT NULL,
	"bonus_cells" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"combo" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "week_variants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "weekly_grids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start" date NOT NULL,
	"day_index" integer NOT NULL,
	"variant_id" uuid NOT NULL,
	"config" jsonb NOT NULL,
	"tiles" jsonb NOT NULL,
	"multipliers" jsonb,
	"solutions" jsonb NOT NULL,
	"unlocks_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_grids_week_start_day_index_unique" UNIQUE("week_start","day_index")
);
--> statement-breakpoint
ALTER TABLE "duel_results" ADD COLUMN "xp_awarded" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "duel_starts" ADD COLUMN "help_used" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "duels" ADD COLUMN "config" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "found_words" ADD CONSTRAINT "found_words_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medals" ADD CONSTRAINT "medals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plays" ADD CONSTRAINT "plays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plays" ADD CONSTRAINT "plays_grid_id_weekly_grids_id_fk" FOREIGN KEY ("grid_id") REFERENCES "public"."weekly_grids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_plan" ADD CONSTRAINT "week_plan_variant_id_week_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."week_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_grids" ADD CONSTRAINT "weekly_grids_variant_id_week_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."week_variants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- ===== da 0005_rimuovi_tabelle_da_ricreare =====
DROP TABLE "duel_results" CASCADE;--> statement-breakpoint
DROP TABLE "duel_starts" CASCADE;--> statement-breakpoint
DROP TABLE "found_words" CASCADE;--> statement-breakpoint
DROP TABLE "plays" CASCADE;--> statement-breakpoint
DROP TABLE "week_plan" CASCADE;--> statement-breakpoint
DROP TABLE "week_variants" CASCADE;--> statement-breakpoint
DROP TABLE "weekly_grids" CASCADE;--> statement-breakpoint
DROP TYPE "public"."found_word_source";--> statement-breakpoint
DROP TYPE "public"."play_mode";--> statement-breakpoint
DROP TYPE "public"."play_status";
--> statement-breakpoint
-- ===== da 0006_presets_partite_parole_impostazioni =====
CREATE TYPE "public"."play_mode" AS ENUM('gioca', 'settimana', 'sfida');--> statement-breakpoint
CREATE TYPE "public"."play_status" AS ENUM('started', 'finished', 'abandoned');--> statement-breakpoint
CREATE TABLE "found_words" (
	"user_id" varchar(64) NOT NULL,
	"word" varchar(64) NOT NULL,
	"first_found_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_play_id" uuid,
	CONSTRAINT "found_words_user_id_word_pk" PRIMARY KEY("user_id","word")
);
--> statement-breakpoint
CREATE TABLE "game_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(32) NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" varchar(400) DEFAULT '' NOT NULL,
	"size" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"min_word_length" integer DEFAULT 3 NOT NULL,
	"min_words" integer DEFAULT 50 NOT NULL,
	"bonus_cells" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"combo" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_presets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "medal_definitions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" varchar(200) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"metric" varchar(32) NOT NULL,
	"threshold" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "play_words" (
	"play_id" uuid NOT NULL,
	"word" varchar(64) NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"path" jsonb NOT NULL,
	"points" integer NOT NULL,
	"at_ms" integer DEFAULT 0 NOT NULL,
	"combo" integer DEFAULT 1 NOT NULL,
	"is_new" boolean DEFAULT false NOT NULL,
	CONSTRAINT "play_words_play_id_word_pk" PRIMARY KEY("play_id","word")
);
--> statement-breakpoint
CREATE TABLE "plays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"mode" "play_mode" NOT NULL,
	"preset_id" uuid,
	"grid_id" uuid,
	"duel_id" uuid,
	"seed" bigint NOT NULL,
	"config" jsonb NOT NULL,
	"status" "play_status" DEFAULT 'started' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer NOT NULL,
	"help_used" boolean DEFAULT false NOT NULL,
	"submission" jsonb,
	"word_count" integer DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"xp_awarded" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "plays_user_id_grid_id_unique" UNIQUE("user_id","grid_id"),
	CONSTRAINT "plays_user_id_duel_id_unique" UNIQUE("user_id","duel_id")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" varchar(64) NOT NULL,
	"key" varchar(64) NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
CREATE TABLE "week_plan" (
	"day_index" integer PRIMARY KEY NOT NULL,
	"preset_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_grids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start" date NOT NULL,
	"day_index" integer NOT NULL,
	"preset_id" uuid NOT NULL,
	"config" jsonb NOT NULL,
	"tiles" jsonb NOT NULL,
	"multipliers" jsonb,
	"solutions" jsonb NOT NULL,
	"unlocks_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_grids_week_start_day_index_unique" UNIQUE("week_start","day_index")
);
--> statement-breakpoint
ALTER TABLE "found_words" ADD CONSTRAINT "found_words_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "found_words" ADD CONSTRAINT "found_words_first_play_id_plays_id_fk" FOREIGN KEY ("first_play_id") REFERENCES "public"."plays"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_words" ADD CONSTRAINT "play_words_play_id_plays_id_fk" FOREIGN KEY ("play_id") REFERENCES "public"."plays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_words" ADD CONSTRAINT "play_words_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plays" ADD CONSTRAINT "plays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plays" ADD CONSTRAINT "plays_preset_id_game_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."game_presets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plays" ADD CONSTRAINT "plays_grid_id_weekly_grids_id_fk" FOREIGN KEY ("grid_id") REFERENCES "public"."weekly_grids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plays" ADD CONSTRAINT "plays_duel_id_duels_id_fk" FOREIGN KEY ("duel_id") REFERENCES "public"."duels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_plan" ADD CONSTRAINT "week_plan_preset_id_game_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."game_presets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_grids" ADD CONSTRAINT "weekly_grids_preset_id_game_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."game_presets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "play_words_user_idx" ON "play_words" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "medals" ADD CONSTRAINT "medals_medal_id_medal_definitions_id_fk" FOREIGN KEY ("medal_id") REFERENCES "public"."medal_definitions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- ===== da 0007_dati_iniziali =====
-- Dati iniziali: preset di partita, piano della Settimana e catalogo delle medaglie. Sono solo i valori di partenza:
-- si modificano da amministrazione senza rilasciare (decisione whoru #29). I testi sono provvisori: le giornate si rivedranno.
INSERT INTO "game_presets" ("slug", "name", "description", "size", "duration_ms", "min_word_length", "min_words", "bonus_cells", "combo") VALUES
  ('gioca', 'Gioca', 'Griglia 5×5, 2 minuti, una griglia nuova ogni volta.', 5, 120000, 3, 50, '[]', false),
  ('classica', 'Classica', 'Regola classica: 1 punto per 3 lettere, +1 per ogni lettera in più.', 4, 120000, 3, 50, '[]', false),
  ('grande', '5×5', 'Griglia 5×5: più lettere, più parole.', 5, 120000, 3, 50, '[]', false),
  ('bonus', 'Bonus', 'Due caselle moltiplicano la parola che ci passa sopra: ×2 e ×3.', 4, 120000, 3, 50, '[3, 2]', false),
  ('lunghe', 'Lunghe', 'Valgono solo parole di almeno 4 lettere.', 4, 120000, 4, 50, '[]', false),
  ('combo', 'Combo', 'Trova una parola entro 5 secondi dalla precedente: la combo sale e ogni parola vale +1 per livello.', 4, 120000, 3, 50, '[]', true),
  ('gigante', '6×6', 'La griglia più grande: 6×6 e 3 minuti.', 6, 180000, 3, 50, '[]', false),
  ('domenica', 'Domenica', 'Griglia di chiusura della settimana: 5×5 e 3 minuti.', 5, 180000, 3, 50, '[]', false);
--> statement-breakpoint
INSERT INTO "week_plan" ("day_index", "preset_id") VALUES
  (0, (SELECT "id" FROM "game_presets" WHERE "slug" = 'classica')),
  (1, (SELECT "id" FROM "game_presets" WHERE "slug" = 'grande')),
  (2, (SELECT "id" FROM "game_presets" WHERE "slug" = 'bonus')),
  (3, (SELECT "id" FROM "game_presets" WHERE "slug" = 'lunghe')),
  (4, (SELECT "id" FROM "game_presets" WHERE "slug" = 'combo')),
  (5, (SELECT "id" FROM "game_presets" WHERE "slug" = 'gigante')),
  (6, (SELECT "id" FROM "game_presets" WHERE "slug" = 'domenica'));
--> statement-breakpoint
INSERT INTO "medal_definitions" ("id", "name", "description", "kind", "metric", "threshold", "sort_order") VALUES
  ('prima-parola', 'Prima parola', 'Trova la tua prima parola', 'parole', 'totalWords', 1, 1),
  ('prima-partita', 'Prima partita', 'Finisci la tua prima partita', 'partite', 'gamesPlayed', 1, 2),
  ('cento-parole', 'Cento parole', '100 parole trovate', 'parole', 'totalWords', 100, 3),
  ('mille-parole', 'Mille parole', '1.000 parole trovate', 'parole', 'totalWords', 1000, 4),
  ('diecimila-parole', 'Diecimila parole', '10.000 parole trovate', 'parole', 'totalWords', 10000, 5),
  ('settebello', 'Settebello', 'Una parola di 7 lettere o più', 'parole', 'longestWordLength', 7, 6),
  ('nove-lettere', 'Nove lettere', 'Una parola di 9 lettere o più', 'parole', 'longestWordLength', 9, 7),
  ('raccolto', 'Raccolto', '30 parole in una sola partita', 'partite', 'maxWordsInGame', 30, 8),
  ('livello-10', 'Livello 10', 'Raggiungi il livello 10', 'livello', 'level', 10, 9),
  ('prima-settimana', 'Prima settimana', 'Gioca la tua prima griglia della Settimana', 'settimana', 'weeklyGridsPlayed', 1, 10),
  ('settimana-piena', 'Settimana piena', 'Gioca tutte e 7 le griglie di una settimana', 'settimana', 'bestWeekGridsPlayed', 7, 11),
  ('puntuale', 'Puntuale', 'Gioca tutte e 7 le griglie di una settimana, ognuna nel suo giorno', 'settimana', 'bestWeekOnTime', 7, 12),
  ('tuttofare', 'Tuttofare', 'Gioca almeno una griglia per ciascuna variante', 'settimana', 'variantsCoverage', 100, 13),
  ('ciclo-completo', 'Ciclo completo', 'Completa una serie di 10 giorni', 'serie', 'streakCycles', 1, 14);
--> statement-breakpoint
-- ===== da 0008_oggetti_e_registro =====
CREATE TYPE "public"."item_ledger_reason" AS ENUM('streak_cycle', 'medal', 'level', 'used', 'admin', 'migration');--> statement-breakpoint
CREATE TABLE "item_definitions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"description" varchar(200) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"effect" jsonb NOT NULL,
	"max_stack" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"item_id" varchar(64) NOT NULL,
	"delta" integer NOT NULL,
	"reason" "item_ledger_reason" NOT NULL,
	"play_id" uuid,
	"note" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_items" (
	"user_id" varchar(64) NOT NULL,
	"item_id" varchar(64) NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_items_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "plays" ADD COLUMN "used_item_id" varchar(64);--> statement-breakpoint
ALTER TABLE "item_ledger" ADD CONSTRAINT "item_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_ledger" ADD CONSTRAINT "item_ledger_item_id_item_definitions_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_ledger" ADD CONSTRAINT "item_ledger_play_id_plays_id_fk" FOREIGN KEY ("play_id") REFERENCES "public"."plays"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_items" ADD CONSTRAINT "user_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_items" ADD CONSTRAINT "user_items_item_id_item_definitions_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_ledger_user_idx" ON "item_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "plays" ADD CONSTRAINT "plays_used_item_id_item_definitions_id_fk" FOREIGN KEY ("used_item_id") REFERENCES "public"."item_definitions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- ===== da 0009_dati_oggetti =====
-- Catalogo iniziale degli oggetti e passaggio dal vecchio contatore `profiles.helps` al nuovo modello.
INSERT INTO "item_definitions" ("id", "name", "description", "kind", "effect", "max_stack") VALUES
  ('aiuto-10s', 'Aiuto +10 s', 'Dieci secondi in più su una griglia. Massimo uno per partita.', 'aiuto', '{"type": "extra_time", "ms": 10000}', NULL);
--> statement-breakpoint
-- Saldo e storico di chi aveva già degli aiuti (a sinistra la riga di saldo, a destra il movimento nel registro)
INSERT INTO "user_items" ("user_id", "item_id", "quantity")
  SELECT "user_id", 'aiuto-10s', "helps" FROM "profiles" WHERE "helps" > 0;
--> statement-breakpoint
INSERT INTO "item_ledger" ("user_id", "item_id", "delta", "reason", "note")
  SELECT "user_id", 'aiuto-10s', "helps", 'migration', 'Saldo iniziale dal vecchio contatore' FROM "profiles" WHERE "helps" > 0;
--> statement-breakpoint
UPDATE "plays" SET "used_item_id" = 'aiuto-10s' WHERE "help_used" = true;
--> statement-breakpoint
-- ===== da 0010_rimuovi_contatori_aiuti =====
ALTER TABLE "plays" DROP COLUMN "help_used";--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "helps";
--> statement-breakpoint
-- ===== da 0011_partita_libera_novanta_secondi =====
-- La partita libera dura un minuto e mezzo (prima 2 minuti): decisione di prodotto del 2026-11-13.
UPDATE "game_presets" SET "duration_ms" = 90000, "description" = 'Griglia 5×5, un minuto e mezzo, una griglia nuova ogni volta.' WHERE "slug" = 'gioca';
--> statement-breakpoint
-- ===== da 0012_preset_punteggio_e_posizione =====
ALTER TABLE "game_presets" ALTER COLUMN "min_words" SET DEFAULT 80;--> statement-breakpoint
ALTER TABLE "game_presets" ADD COLUMN "point_mode" varchar(12) DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_presets" ADD COLUMN "position_bonus" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- ===== da 0013_giornate_della_settimana =====
-- Le giornate della Settimana (decisione di prodotto del 2026-11-13) e almeno 80 parole per ogni griglia.
-- lunedì Classica 4×4 · martedì Lunghe 4×4 (4+ lettere) · mercoledì Speciale 5×5 · giovedì Posizione 6×6 ·
-- venerdì Combo 5×5 · sabato Misto 5×5 (speciale + posizione) · domenica Finale 6×6 (speciale + posizione + combo, 2 min).
-- Tutte da 1:30 tranne la domenica. Le griglie già create restano come sono (sono congelate).
UPDATE "game_presets" SET "min_words" = 80;
--> statement-breakpoint
UPDATE "game_presets" SET "size" = 4, "duration_ms" = 90000, "min_word_length" = 3,
  "description" = 'Regola classica: 1 punto per 3 lettere, +1 per ogni lettera in più.' WHERE "slug" = 'classica';
--> statement-breakpoint
UPDATE "game_presets" SET "size" = 4, "duration_ms" = 90000, "min_word_length" = 4,
  "description" = 'Valgono solo parole di almeno 4 lettere.' WHERE "slug" = 'lunghe';
--> statement-breakpoint
UPDATE "game_presets" SET "size" = 5, "duration_ms" = 90000,
  "description" = 'Trova una parola entro 5 secondi dalla precedente: la combo sale e ogni parola vale +1 per livello.' WHERE "slug" = 'combo';
--> statement-breakpoint
UPDATE "game_presets" SET "name" = 'Finale', "size" = 6, "duration_ms" = 120000, "point_mode" = 'speciale', "position_bonus" = true, "combo" = true,
  "description" = 'La più ricca della settimana: ogni lettera ha il suo valore, i bordi valgono di più e la combo moltiplica. 6×6, 2 minuti.' WHERE "slug" = 'domenica';
--> statement-breakpoint
INSERT INTO "game_presets" ("slug", "name", "description", "size", "duration_ms", "min_word_length", "min_words", "bonus_cells", "combo", "point_mode", "position_bonus") VALUES
  ('speciale', 'Speciale', 'Ogni lettera ha il suo valore in punti: le più rare valgono di più.', 5, 90000, 3, 80, '[]', false, 'speciale', false),
  ('posizione', 'Posizione', 'Le lettere sui lati e agli angoli valgono di più.', 6, 90000, 3, 80, '[]', false, 'standard', true),
  ('misto', 'Misto', 'Il valore delle lettere e il bonus posizione insieme.', 5, 90000, 3, 80, '[]', false, 'speciale', true);
--> statement-breakpoint
UPDATE "week_plan" SET "preset_id" = (SELECT "id" FROM "game_presets" WHERE "slug" = 'classica') WHERE "day_index" = 0;
--> statement-breakpoint
UPDATE "week_plan" SET "preset_id" = (SELECT "id" FROM "game_presets" WHERE "slug" = 'lunghe') WHERE "day_index" = 1;
--> statement-breakpoint
UPDATE "week_plan" SET "preset_id" = (SELECT "id" FROM "game_presets" WHERE "slug" = 'speciale') WHERE "day_index" = 2;
--> statement-breakpoint
UPDATE "week_plan" SET "preset_id" = (SELECT "id" FROM "game_presets" WHERE "slug" = 'posizione') WHERE "day_index" = 3;
--> statement-breakpoint
UPDATE "week_plan" SET "preset_id" = (SELECT "id" FROM "game_presets" WHERE "slug" = 'combo') WHERE "day_index" = 4;
--> statement-breakpoint
UPDATE "week_plan" SET "preset_id" = (SELECT "id" FROM "game_presets" WHERE "slug" = 'misto') WHERE "day_index" = 5;
--> statement-breakpoint
UPDATE "week_plan" SET "preset_id" = (SELECT "id" FROM "game_presets" WHERE "slug" = 'domenica') WHERE "day_index" = 6;
