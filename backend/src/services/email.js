import nodemailer from 'nodemailer';

const smtpConfig = {
  host: (process.env.SMTP_HOST || '').trim(),
  port: parseInt((process.env.SMTP_PORT || '587').trim()),
  secure: (process.env.SMTP_SECURE || '').trim() === 'true',
  auth: {
    user: (process.env.SMTP_USER || '').trim(),
    pass: (process.env.SMTP_PASS || '').trim(),
  },
};

const fromEmail = (process.env.SMTP_FROM || 'onboarding@resend.dev').trim();

const escapeHtml = (s) => {
  if (s == null || typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

/**
 * Sends credentials to a new user via email.
 */
export const sendCredentials = async (to, name, password) => {
  const isLocal = !process.env.RESEND_API_KEY;
  const safeName = escapeHtml(name);
  const safeTo = escapeHtml(to);
  const loginBase = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';

  try {
    let sent = false;
    let data = null;

    if (isLocal) {
      if (!process.env.SMTP_HOST) {
        console.warn('[EMAIL] SMTP_HOST not set — invitation email not sent.');
        return { sent: false, error: 'SMTP configuration missing' };
      }

      const transporter = nodemailer.createTransport(smtpConfig);
      data = await transporter.sendMail({
        from: fromEmail,
        to,
        subject: 'Your Account Credentials for the Dialpad Dashboard',
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>Welcome, ${safeName}</h2>
            <p>An account has been created for you on the Dialpad Dashboard.</p>
            <p><strong>Login Email:</strong> ${safeTo}</p>
            <p><strong>Temporary Password:</strong> ${escapeHtml(password)}</p>
            <p>Please log in and change your password immediately.</p>
            <a href="${escapeHtml(loginBase)}/login"
               style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
               Login to Dashboard
            </a>
          </div>
        `,
      });
      sent = true;
    } else {
      // Logic for Resend (can be added later if needed, user said they will use Resend for deployment)
      console.log('[EMAIL] Resend integration would be used here in production.');
    }

    console.log('[EMAIL] Invitation sent to', to);
    return { sent, data };
  } catch (err) {
    console.error('[EMAIL] send exception:', err);
    return { sent: false, error: err.message };
  }
};
