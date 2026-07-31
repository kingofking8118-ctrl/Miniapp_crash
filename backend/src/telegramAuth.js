const crypto = require('crypto');

const MAX_AGE_SECONDS = parseInt(process.env.TELEGRAM_AUTH_MAX_AGE || '86400', 10);

/**
 * Verifies the `initData` string a Telegram Mini App client sends on launch.
 * See: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Returns the parsed, verified user object, or throws if invalid/expired.
 */
function verifyTelegramInitData(initData, botToken) {
  if (!initData || typeof initData !== 'string') {
    throw new Error('missing initData');
  }
  if (!botToken) {
    throw new Error('server missing TELEGRAM_BOT_TOKEN');
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new Error('initData missing hash');
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) {
    throw new Error('initData signature mismatch');
  }

  const authDate = parseInt(params.get('auth_date') || '0', 10);
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > MAX_AGE_SECONDS) {
    throw new Error('initData expired');
  }

  const userJson = params.get('user');
  if (!userJson) throw new Error('initData missing user');

  return JSON.parse(userJson);
}

module.exports = { verifyTelegramInitData };
