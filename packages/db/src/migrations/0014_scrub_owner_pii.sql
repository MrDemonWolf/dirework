-- Owner sign-in no longer requests the email scope or keeps the owner's own
-- Twitch OAuth tokens, and sessions no longer record IP or user agent. Scrub
-- what earlier builds stored so existing instances match. Bot credentials live
-- in `bot_account` and are untouched.
UPDATE `account`
SET `access_token` = NULL, `refresh_token` = NULL, `id_token` = NULL
WHERE `provider_id` = 'twitch';
--> statement-breakpoint
-- Replace the real email with the same `<twitch id>@users.twitch.invalid`
-- placeholder new sign-ins get. Sign-in matches on the Twitch account row, not
-- the email, so this cannot lock the owner out. Users with no Twitch identity
-- (dev-only logins) are left alone.
UPDATE `user`
SET
  `email` = COALESCE(
    NULLIF(`twitch_id`, ''),
    (
      SELECT `account`.`account_id`
      FROM `account`
      WHERE `account`.`user_id` = `user`.`id`
        AND `account`.`provider_id` = 'twitch'
        AND `account`.`account_id` <> ''
      ORDER BY `account`.`created_at` ASC, `account`.`id` ASC
      LIMIT 1
    )
  ) || '@users.twitch.invalid',
  `email_verified` = false
WHERE COALESCE(
  NULLIF(`twitch_id`, ''),
  (
    SELECT `account`.`account_id`
    FROM `account`
    WHERE `account`.`user_id` = `user`.`id`
      AND `account`.`provider_id` = 'twitch'
      AND `account`.`account_id` <> ''
    ORDER BY `account`.`created_at` ASC, `account`.`id` ASC
    LIMIT 1
  )
) IS NOT NULL;
--> statement-breakpoint
UPDATE `session` SET `ip_address` = NULL, `user_agent` = NULL;
