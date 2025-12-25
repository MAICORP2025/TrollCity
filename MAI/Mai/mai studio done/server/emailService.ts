import * as fs from 'fs';
import * as path from 'path';

const EMAILS_DIR = path.join(process.cwd(), 'emails');
const EMAILS_FILE = path.join(EMAILS_DIR, 'sent-emails.json');

const ensureEmailsDir = () => {
  if (!fs.existsSync(EMAILS_DIR)) {
    fs.mkdirSync(EMAILS_DIR, { recursive: true });
  }
};

const getSentEmails = (): any[] => {
  ensureEmailsDir();
  if (!fs.existsSync(EMAILS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(EMAILS_FILE, 'utf-8'));
  } catch {
    return [];
  }
};

const saveSentEmail = (emailData: any) => {
  ensureEmailsDir();
  const emails = getSentEmails();
  emails.push({
    ...emailData,
    sentAt: new Date().toISOString(),
  });
  fs.writeFileSync(EMAILS_FILE, JSON.stringify(emails, null, 2));
};

export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
  resetLink: string
): Promise<boolean> => {
  try {
    const emailContent = {
      to: email,
      subject: 'Reset Your Password - MAI Studios',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password. Click the link below to proceed:</p>
          <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #fbbf24; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">
            Reset Password
          </a>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetLink}</p>
          <p style="color: #999; font-size: 12px; margin-top: 30px;">
            This link will expire in 1 hour. If you didn't request this, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">
            &copy; 2025 MAI Studios. All rights reserved.
          </p>
        </div>
      `,
    };

    saveSentEmail(emailContent);
    console.log(`✉️  Password reset email for ${email}`);
    console.log(`📧 Emails saved to: ${EMAILS_FILE}`);
    console.log(`🔗 Reset link: ${resetLink}`);
    return true;
  } catch (error) {
    console.error('Failed to save password reset email:', error);
    return false;
  }
};

export const verifyEmailConfig = (): boolean => {
  return true;
};

export const getStoredEmails = (): any[] => {
  return getSentEmails();
};
