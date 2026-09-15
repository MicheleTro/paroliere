CREATE TYPE "public"."reported_word_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "reported_words" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"word" varchar(64) NOT NULL,
	"status" "reported_word_status" DEFAULT 'pending' NOT NULL,
	"report_count" integer DEFAULT 1 NOT NULL,
	"first_reported_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "reported_words_word_unique" UNIQUE("word")
);
--> statement-breakpoint
ALTER TABLE "reported_words" ADD CONSTRAINT "reported_words_first_reported_by_user_id_users_id_fk" FOREIGN KEY ("first_reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;