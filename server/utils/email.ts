import * as brevo from '@getbrevo/brevo';

const apiInstance = new brevo.TransactionalEmailsApi();
const config = useRuntimeConfig();

// Set API key
apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  config.brevoApiKey || process.env.BREVO_API_KEY || ''
);

interface SendEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  senderName?: string;
  senderEmail?: string;
}

export async function sendEmail(options: SendEmailOptions) {
  const {
    to,
    subject,
    htmlContent,
    textContent,
    senderName = 'Markdown Notes',
    senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@markdownnotes.app'
  } = options;

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = htmlContent;
  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: to }];
  
  if (textContent) {
    sendSmtpEmail.textContent = textContent;
  }

  try {
    const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Email sent successfully:', response);
    return { success: true, messageId: response.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
}

export async function sendPasswordResetEmail(email: string, temporaryPassword: string) {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Password Reset</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                      Hello,
                    </p>
                    <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                      We received a request to reset your password. Use the temporary password below to log in to your account:
                    </p>
                    
                    <!-- Temporary Password Box -->
                    <div style="background-color: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
                      <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                        Temporary Password
                      </p>
                      <p style="margin: 0; color: #1f2937; font-size: 24px; font-weight: 700; font-family: 'Courier New', monospace; letter-spacing: 2px;">
                        ${temporaryPassword}
                      </p>
                    </div>
                    
                    <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                      <strong>Important:</strong> After logging in with this temporary password, please change it immediately in your account settings for security purposes.
                    </p>
                    
                    <p style="margin: 0 0 30px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                      If you didn't request a password reset, please ignore this email or contact support if you have concerns.
                    </p>
                    
                    <!-- CTA Button -->
                    <div style="text-align: center;">
                      <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                        Sign In Now
                      </a>
                    </div>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px 40px; background-color: #f9fafb; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center; line-height: 1.6;">
                      © ${new Date().getFullYear()} Markdown Notes. All rights reserved.
                    </p>
                    <p style="margin: 10px 0 0; color: #9ca3af; font-size: 12px; text-align: center;">
                      This is an automated message, please do not reply.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const textContent = `
Password Reset

Hello,

We received a request to reset your password. Use the temporary password below to log in to your account:

Temporary Password: ${temporaryPassword}

Important: After logging in with this temporary password, please change it immediately in your account settings for security purposes.

If you didn't request a password reset, please ignore this email or contact support if you have concerns.

Sign in at: ${process.env.APP_URL || 'http://localhost:3000'}/login

© ${new Date().getFullYear()} Markdown Notes. All rights reserved.
  `;

  return sendEmail({
    to: email,
    subject: '🔐 Password Reset - Markdown Notes',
    htmlContent,
    textContent
  });
}

