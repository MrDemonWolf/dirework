PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_timer_style` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`width` text DEFAULT '300px' NOT NULL,
	`height` text DEFAULT '300px' NOT NULL,
	`bg_color` text DEFAULT '#091533' NOT NULL,
	`bg_opacity` real DEFAULT 0.85 NOT NULL,
	`bg_border_radius` text DEFAULT '22%' NOT NULL,
	`ring_enabled` integer DEFAULT true NOT NULL,
	`ring_track_color` text DEFAULT '#ffffff' NOT NULL,
	`ring_track_opacity` real DEFAULT 0.18 NOT NULL,
	`ring_fill_color` text DEFAULT '#00aced' NOT NULL,
	`ring_fill_opacity` real DEFAULT 1 NOT NULL,
	`ring_width` integer DEFAULT 8 NOT NULL,
	`ring_gap` integer DEFAULT 6 NOT NULL,
	`text_color` text DEFAULT '#ffffff' NOT NULL,
	`text_outline_color` text DEFAULT '#000000' NOT NULL,
	`text_outline_size` text DEFAULT '0px' NOT NULL,
	`text_font_family` text DEFAULT 'Montserrat' NOT NULL,
	`font_size_label` text DEFAULT '18px' NOT NULL,
	`font_size_time` text DEFAULT '48px' NOT NULL,
	`font_size_cycle` text DEFAULT '16px' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_timer_style`("id", "width", "height", "bg_color", "bg_opacity", "bg_border_radius", "ring_enabled", "ring_track_color", "ring_track_opacity", "ring_fill_color", "ring_fill_opacity", "ring_width", "ring_gap", "text_color", "text_outline_color", "text_outline_size", "text_font_family", "font_size_label", "font_size_time", "font_size_cycle") SELECT "id", "width", "height", "bg_color", "bg_opacity", "bg_border_radius", "ring_enabled", "ring_track_color", "ring_track_opacity", "ring_fill_color", "ring_fill_opacity", "ring_width", "ring_gap", "text_color", "text_outline_color", "text_outline_size", "text_font_family", "font_size_label", "font_size_time", "font_size_cycle" FROM `timer_style`;--> statement-breakpoint
DROP TABLE `timer_style`;--> statement-breakpoint
ALTER TABLE `__new_timer_style` RENAME TO `timer_style`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
-- Bump instances still on the old 250px default up to the new 300px; a
-- deliberately-customized size is left untouched.
UPDATE `timer_style` SET `width` = '300px', `height` = '300px' WHERE `width` = '250px' AND `height` = '250px';
