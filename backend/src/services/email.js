import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

let resend;
if (resendApiKey) {
  resend = new Resend(resendApiKey);
}

/**
 * Sends credentials to a new administrator via email
 * @param {string} to - Recipient email address
 * @param {string} name - Recipient name
 * @param {string} password - The generated temporary password
 */
export const sendCredentials = async (to, name, password) => {
  if (!resend) {
    console.warn(`[MOCK EMAIL] To: ${to}, Name: ${name}, Temporary Password: ${password}`);
    return { success: true, message: 'Mock email logged successfully' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: 'Your Account Credentials for the Dialpad Dashboard',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Welcome, ${name}</h2>
          <p>An administrator account has been created for you on the Dialpad Dashboard.</p>
          <p><strong>Login Email:</strong> ${to}</p>
          <p><strong>Temporary Password:</strong> ${password}</p>
          <p>Please log in and change your password immediately.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
             style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
             Login to Dashboard
          </a>
        </div>
      `
    });

    if (error) {
      console.error('Failed to send email via Resend:', error);
      throw error;
    }

    return { success: true, data };
  } catch (err) {
    console.error('Email service exception:', err);
    throw err;
  }
};
