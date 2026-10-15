-- Backfill the owner's custom Twitch ID for instances claimed after 0011 ran:
-- Better Auth drops input:false fields returned by mapProfileToUser, so new
-- owners were created with a NULL twitch_id. The linked provider account's ID
-- is Twitch's numeric user ID. Idempotent — only fills an empty column.
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
