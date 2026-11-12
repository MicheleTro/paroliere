CREATE TYPE "public"."challenge_mode" AS ENUM('individual', 'team');--> statement-breakpoint
CREATE TYPE "public"."challenge_status" AS ENUM('open', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."game_source" AS ENUM('local', 'challenge');--> statement-breakpoint
CREATE TYPE "public"."point_mode" AS ENUM('standard', 'speciale');--> statement-breakpoint
CREATE TYPE "public"."reported_word_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."scoring" AS ENUM('classic', 'versus');--> statement-breakpoint
CREATE TABLE "challenge_match_starts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_match_id" uuid NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_match_starts_challenge_match_id_user_id_unique" UNIQUE("challenge_match_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "challenge_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"match_index" integer NOT NULL,
	"seed" bigint NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "challenge_matches_challenge_id_match_index_unique" UNIQUE("challenge_id","match_index")
);
--> statement-breakpoint
CREATE TABLE "challenge_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"team_id" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_participants_challenge_id_user_id_unique" UNIQUE("challenge_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_user_id" varchar(64) NOT NULL,
	"config_id" uuid NOT NULL,
	"mode" "challenge_mode" NOT NULL,
	"max_participants" integer,
	"players_per_team" integer,
	"best_of" integer NOT NULL,
	"status" "challenge_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"size" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"min_word_length" integer NOT NULL,
	"min_words" integer NOT NULL,
	"scoring" "scoring" NOT NULL,
	"point_mode" "point_mode" DEFAULT 'standard' NOT NULL,
	"position_bonus" boolean DEFAULT false NOT NULL,
	"generator_version" integer NOT NULL,
	"dictionary_version" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"config_id" uuid NOT NULL,
	"seed" bigint NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"score" integer NOT NULL,
	"words" jsonb NOT NULL,
	"source" "game_source" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_match_id" uuid NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"paths" jsonb NOT NULL,
	"score" integer,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_results_challenge_match_id_user_id_unique" UNIQUE("challenge_match_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "player_word_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"grid_size" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"total_words" integer DEFAULT 0 NOT NULL,
	"total_word_length_sum" bigint DEFAULT 0 NOT NULL,
	"longest_word" varchar(64),
	"longest_word_length" integer DEFAULT 0 NOT NULL,
	"max_words_in_game" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp with time zone,
	CONSTRAINT "player_word_stats_user_id_grid_size_duration_ms_unique" UNIQUE("user_id","grid_size","duration_ms")
);
--> statement-breakpoint
CREATE TABLE "reported_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"word" varchar(64) NOT NULL,
	"status" "reported_word_status" DEFAULT 'pending' NOT NULL,
	"report_count" integer DEFAULT 1 NOT NULL,
	"first_reported_by_user_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "reported_words_word_unique" UNIQUE("word")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenge_match_starts" ADD CONSTRAINT "challenge_match_starts_challenge_match_id_challenge_matches_id_fk" FOREIGN KEY ("challenge_match_id") REFERENCES "public"."challenge_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_match_starts" ADD CONSTRAINT "challenge_match_starts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_matches" ADD CONSTRAINT "challenge_matches_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_config_id_game_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."game_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_config_id_game_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."game_configs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_challenge_match_id_challenge_matches_id_fk" FOREIGN KEY ("challenge_match_id") REFERENCES "public"."challenge_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_word_stats" ADD CONSTRAINT "player_word_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reported_words" ADD CONSTRAINT "reported_words_first_reported_by_user_id_users_id_fk" FOREIGN KEY ("first_reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;