ALTER TYPE "public"."challenge_status" ADD VALUE 'cancelled';--> statement-breakpoint
CREATE TABLE "challenge_match_starts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_match_starts_challenge_match_id_user_id_unique" UNIQUE("challenge_match_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "challenge_match_starts" ADD CONSTRAINT "challenge_match_starts_challenge_match_id_challenge_matches_id_fk" FOREIGN KEY ("challenge_match_id") REFERENCES "public"."challenge_matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_match_starts" ADD CONSTRAINT "challenge_match_starts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;