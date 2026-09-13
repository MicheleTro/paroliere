ALTER TABLE "challenge_match_starts" DROP CONSTRAINT "challenge_match_starts_challenge_match_id_challenge_matches_id_fk";
--> statement-breakpoint
ALTER TABLE "challenge_match_starts" DROP CONSTRAINT "challenge_match_starts_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "challenge_matches" DROP CONSTRAINT "challenge_matches_challenge_id_challenges_id_fk";
--> statement-breakpoint
ALTER TABLE "challenge_participants" DROP CONSTRAINT "challenge_participants_challenge_id_challenges_id_fk";
--> statement-breakpoint
ALTER TABLE "challenge_participants" DROP CONSTRAINT "challenge_participants_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "challenge_participants" DROP CONSTRAINT "challenge_participants_team_id_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "challenges" DROP CONSTRAINT "challenges_creator_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "games" DROP CONSTRAINT "games_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "match_results" DROP CONSTRAINT "match_results_challenge_match_id_challenge_matches_id_fk";
--> statement-breakpoint
ALTER TABLE "match_results" DROP CONSTRAINT "match_results_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "teams" DROP CONSTRAINT "teams_challenge_id_challenges_id_fk";
--> statement-breakpoint
ALTER TABLE "challenge_match_starts" ADD CONSTRAINT "challenge_match_starts_challenge_match_id_challenge_matches_id_fk" FOREIGN KEY ("challenge_match_id") REFERENCES "public"."challenge_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_match_starts" ADD CONSTRAINT "challenge_match_starts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_matches" ADD CONSTRAINT "challenge_matches_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_challenge_match_id_challenge_matches_id_fk" FOREIGN KEY ("challenge_match_id") REFERENCES "public"."challenge_matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;