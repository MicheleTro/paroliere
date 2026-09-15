CREATE TYPE "public"."point_mode" AS ENUM('standard', 'speciale');--> statement-breakpoint
ALTER TABLE "game_configs" ADD COLUMN "point_mode" "point_mode" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_configs" ADD COLUMN "position_bonus" boolean DEFAULT false NOT NULL;