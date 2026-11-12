CREATE TYPE "public"."duel_status" AS ENUM('invited', 'in_progress', 'completed', 'declined', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "duel_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"duel_id" uuid NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"paths" jsonb NOT NULL,
	"score" integer,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "duel_results_duel_id_user_id_unique" UNIQUE("duel_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "duel_starts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"duel_id" uuid NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "duel_starts_duel_id_user_id_unique" UNIQUE("duel_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "duels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenger_id" varchar(64) NOT NULL,
	"opponent_id" varchar(64) NOT NULL,
	"config_id" uuid NOT NULL,
	"seed" bigint NOT NULL,
	"status" "duel_status" DEFAULT 'invited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "duel_results" ADD CONSTRAINT "duel_results_duel_id_duels_id_fk" FOREIGN KEY ("duel_id") REFERENCES "public"."duels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duel_results" ADD CONSTRAINT "duel_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duel_starts" ADD CONSTRAINT "duel_starts_duel_id_duels_id_fk" FOREIGN KEY ("duel_id") REFERENCES "public"."duels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duel_starts" ADD CONSTRAINT "duel_starts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duels" ADD CONSTRAINT "duels_challenger_id_users_id_fk" FOREIGN KEY ("challenger_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duels" ADD CONSTRAINT "duels_opponent_id_users_id_fk" FOREIGN KEY ("opponent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duels" ADD CONSTRAINT "duels_config_id_game_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."game_configs"("id") ON DELETE no action ON UPDATE no action;