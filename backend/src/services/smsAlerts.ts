import { getDb } from '../db';

export interface SmsAlert {
  id: number;
  type: string;
  severity: string;
  message: string;
  timestamp: string;
  appliance_name?: string;
  source: string;
}

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_DLT_SENDER_ID && process.env.TWILIO_DLT_ENTITY_ID &&
    process.env.TWILIO_DLT_TEMPLATE_ID,
  );
}

export function isIndiaPhoneNumber(value: string): boolean {
  return /^\+91[6-9]\d{9}$/.test(value);
}

async function sendTwilioSms(to: string, alertSummary: string): Promise<string | null> {
  const {
    TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token,
    TWILIO_DLT_SENDER_ID: from, TWILIO_DLT_ENTITY_ID: entityId,
    TWILIO_DLT_TEMPLATE_ID: templateId,
  } = process.env;
  if (!sid || !token || !from || !entityId || !templateId) throw new Error('India DLT SMS provider is not configured');
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    // Keep fixed text identical to the DLT-approved template. Only its one
    // registered variable slot contains alert-specific text.
    body: new URLSearchParams({
      To: to, From: from,
      Body: `Smart Energy Monitor alert: ${alertSummary}. Review the Alerts page in your account.`,
      DltPEId: entityId, DltTemplateId: templateId,
    }),
  });
  const result = await response.json().catch(() => ({})) as { sid?: string };
  if (!response.ok) throw new Error(`SMS provider returned HTTP ${response.status}`);
  return result.sid || null;
}

/** Only explicitly opted-in users receive real hardware alerts by SMS. */
export async function notifyUsersOfHardwareAlert(alert: SmsAlert): Promise<void> {
  if (alert.source !== 'hardware' || !['critical', 'warning'].includes(alert.severity) || !isSmsConfigured()) return;
  const db = getDb();
  const recipients = await db.all('SELECT id, phone_number FROM users WHERE sms_alerts_enabled = 1 AND phone_number IS NOT NULL');
  const details = `${alert.severity.toUpperCase()} ${alert.type}${alert.appliance_name ? ` ${alert.appliance_name}` : ''}: ${alert.message}`
    .replace(/\s+/g, ' ').trim().slice(0, 40);

  for (const recipient of recipients as Array<{ id: number; phone_number: string }>) {
    if (!isIndiaPhoneNumber(recipient.phone_number)) continue;
    const claimed = await db.run(`INSERT INTO alert_sms_deliveries(alert_id, user_id, status)
      VALUES(?, ?, 'pending') ON CONFLICT(alert_id, user_id) DO UPDATE SET status = 'pending', updated_at = CURRENT_TIMESTAMP
      WHERE alert_sms_deliveries.status != 'sent'`, [alert.id, recipient.id]);
    if (!claimed.changes) continue;
    try {
      const providerMessageId = await sendTwilioSms(recipient.phone_number, details);
      await db.run(`UPDATE alert_sms_deliveries SET status = 'sent', provider_message_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE alert_id = ? AND user_id = ?`, [providerMessageId, alert.id, recipient.id]);
    } catch {
      await db.run(`UPDATE alert_sms_deliveries SET status = 'failed', updated_at = CURRENT_TIMESTAMP
        WHERE alert_id = ? AND user_id = ?`, [alert.id, recipient.id]);
      // Never log phone numbers, alert contents, or provider credentials.
      console.error('SMS alert delivery failed; check provider configuration and delivery status.');
    }
  }
}
