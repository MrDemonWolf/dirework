-- Backfill the owner's missing custom Twitch ID from Better Auth's durable
-- provider account. The account ID is Twitch's numeric user ID (the same value
-- carried by IRC's user-id tag).
UPDATE `user`
SET `twitch_id` = (
  SELECT `account`.`account_id`
  FROM `account`
  WHERE `account`.`user_id` = `user`.`id`
    AND `account`.`provider_id` = 'twitch'
    AND `account`.`account_id` <> ''
  ORDER BY `account`.`created_at` ASC, `account`.`id` ASC
  LIMIT 1
)
WHERE `is_owner` = true
  AND (`twitch_id` IS NULL OR `twitch_id` = '')
  AND EXISTS (
    SELECT 1
    FROM `account`
    WHERE `account`.`user_id` = `user`.`id`
      AND `account`.`provider_id` = 'twitch'
      AND `account`.`account_id` <> ''
  );
--> statement-breakpoint
-- Older dashboard builds could save the owner under an empty author ID; an
-- intermediate build used Better Auth's internal user ID. Each alias could
-- have its own active task. Keep the oldest active task before merging so the
-- partial unique index on active author IDs remains valid and the user's
-- current focus does not unexpectedly jump to a newly-created task.
UPDATE `task`
SET `status` = 'pending'
WHERE `id` IN (
  SELECT `candidate`.`id`
  FROM `task` AS `candidate`
  JOIN `user` AS `owner` ON `owner`.`is_owner` = true
  WHERE `candidate`.`status` = 'active'
    AND (
      `candidate`.`author_twitch_id` = ''
      OR `candidate`.`author_twitch_id` = `owner`.`id`
      OR `candidate`.`author_twitch_id` = `owner`.`twitch_id`
    )
    AND `candidate`.`id` <> (
      SELECT `keeper`.`id`
      FROM `task` AS `keeper`
      WHERE `keeper`.`status` = 'active'
        AND (
          `keeper`.`author_twitch_id` = ''
          OR `keeper`.`author_twitch_id` = `owner`.`id`
          OR `keeper`.`author_twitch_id` = `owner`.`twitch_id`
        )
      ORDER BY `keeper`.`created_at` ASC, `keeper`.`id` ASC
      LIMIT 1
    )
);
--> statement-breakpoint
-- Repair only the known empty, internal, and canonical owner ID aliases.
-- Mutable username and display-name snapshots are deliberately excluded.
-- Twitch-backed owners use the numeric Twitch ID; dev-only owners without a
-- linked Twitch account use Better Auth's internal user ID.
UPDATE `task`
SET
  `author_twitch_id` = (
    SELECT COALESCE(NULLIF(`owner`.`twitch_id`, ''), `owner`.`id`)
    FROM `user` AS `owner`
    WHERE `owner`.`is_owner` = true
    LIMIT 1
  ),
  `priority` = 0
WHERE EXISTS (
  SELECT 1
  FROM `user` AS `owner`
  WHERE `owner`.`is_owner` = true
    AND (
      `task`.`author_twitch_id` = ''
      OR `task`.`author_twitch_id` = `owner`.`id`
      OR `task`.`author_twitch_id` = `owner`.`twitch_id`
    )
);
