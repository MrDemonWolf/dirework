ALTER TABLE "timer_config" ALTER COLUMN "label_idle" SET DEFAULT 'Resting';--> statement-breakpoint
ALTER TABLE "timer_config" ALTER COLUMN "label_starting" SET DEFAULT 'Gathering the Pack';--> statement-breakpoint
ALTER TABLE "timer_config" ALTER COLUMN "label_work" SET DEFAULT 'On the Hunt';--> statement-breakpoint
ALTER TABLE "timer_config" ALTER COLUMN "label_break" SET DEFAULT 'Den Rest';--> statement-breakpoint
ALTER TABLE "timer_config" ALTER COLUMN "label_long_break" SET DEFAULT 'Pack Slumber';--> statement-breakpoint
ALTER TABLE "timer_config" ALTER COLUMN "label_paused" SET DEFAULT 'Paws''d';--> statement-breakpoint
ALTER TABLE "timer_config" ALTER COLUMN "label_finished" SET DEFAULT 'Hunt Complete';--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_overlay_timer_token_unique" UNIQUE("overlay_timer_token");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_overlay_tasks_token_unique" UNIQUE("overlay_tasks_token");