CREATE TABLE "player_word_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"grid_size" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"total_words" integer DEFAULT 0 NOT NULL,
	"total_word_length_sum" bigint DEFAULT 0 NOT NULL,
	"longest_word" varchar(64),
	"longest_word_length" integer DEFAULT 0 NOT NULL,
	"last_played_at" timestamp with time zone,
	CONSTRAINT "player_word_stats_user_id_grid_size_duration_ms_unique" UNIQUE("user_id","grid_size","duration_ms")
);
--> statement-breakpoint
ALTER TABLE "player_word_stats" ADD CONSTRAINT "player_word_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;