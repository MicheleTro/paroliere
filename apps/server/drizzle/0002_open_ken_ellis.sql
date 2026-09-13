ALTER TYPE "public"."challenge_status" ADD VALUE 'in_progress' BEFORE 'completed';--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "players_per_team" integer;