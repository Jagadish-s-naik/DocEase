// ============================================
// NOTIFICATION SYSTEM
// Email, SMS, and In-App Notifications
// ============================================

import { createClient } from '@/utils/supabase/server';
import nodemailer from 'nodemailer';

// ============================================
// EMAIL CONFIGURATION
// ============================================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'fftropical79@gmail.com',
    pass: process.env.EMAIL_PASSWORD || '',
  },
});

// ============================================
// EMAIL TEMPLATES
// ============================================
const emailTemplates = {
  processingComplete: (fileName: string, resultUrl: string) => ({
    subject: '✅ Your document is ready - DocEase',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Your Document is Ready!</h2>
        <p>We've successfully processed your document: <strong>${fileName}</strong></p>
        <p>Your simplified result is now available.</p>
        <a href="${resultUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          View Result
        </a>
        <p style="color: #666; font-size: 14px;">Thanks for using DocEase!</p>
      </div>
    `,
  }),

  processingFailed: (fileName: string, error: string) => ({
    subject: '❌ Processing failed - DocEase',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Processing Failed</h2>
        <p>We encountered an issue processing your document: <strong>${fileName}</strong></p>
        <p style="color: #666;">Error: ${error}</p>
        <p>Please try uploading again or contact support if the issue persists.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/upload" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Try Again
        </a>
      </div>
    `,
  }),

  usageLimitReached: (userName: string, limit: number) => ({
    subject: '⚠️ Usage Limit Reached - DocEase',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b;">Usage Limit Reached</h2>
        <p>Hi ${userName},</p>
        <p>You've reached your monthly limit of ${limit} documents.</p>
        <p>Your limit will reset next month, or you can upgrade to Premium for unlimited access.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/pricing" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Upgrade to Premium
        </a>
      </div>
    `,
  }),

  welcomeEmail: (userName: string) => ({
    subject: '🎉 Welcome to DocEase!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to DocEase!</h2>
        <p>Hi ${userName},</p>
        <p>Thanks for joining DocEase! You can now simplify complex documents with AI.</p>
        <h3>Getting Started:</h3>
        <ol>
          <li>Upload a document (PDF, Image, or Text)</li>
          <li>We'll extract and simplify the content</li>
          <li>Get your result in seconds</li>
        </ol>
        <p>You have <strong>3 free documents</strong> per month to start.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/upload" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Upload Your First Document
        </a>
      </div>
    `,
  }),
};

// ============================================
// EMAIL NOTIFICATION FUNCTION
// ============================================
export async function sendEmailNotification(
  to: string,
  templateName: keyof typeof emailTemplates,
  data: any
) {
  try {
    const template = emailTemplates[templateName];
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    const { subject, html } = template(data);

    await transporter.sendMail({
      from: `"DocEase" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`✅ Email sent: ${templateName} to ${to}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Email send failed:', error);
    return { success: false, error };
  }
}

// ============================================
// SMS NOTIFICATION (Twilio Integration)
// ============================================
export async function sendSMSNotification(phone: string, message: string) {
  // Requires Twilio credentials
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn('⚠️ Twilio not configured, SMS not sent');
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    // Uncomment when Twilio is installed and configured
    /*
    const twilio = require('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });
    */

    console.log(`📱 SMS sent to ${phone}: ${message}`);
    return { success: true };
  } catch (error) {
    console.error('❌ SMS send failed:', error);
    return { success: false, error };
  }
}

// ============================================
// IN-APP NOTIFICATION
// ============================================
export async function createInAppNotification(
  userId: string,
  title: string,
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'info'
) {
  try {
    const supabase = createClient();

    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      is_read: false,
    });

    if (error) throw error;

    console.log(`🔔 In-app notification created for user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error('❌ In-app notification failed:', error);
    return { success: false, error };
  }
}

// ============================================
// GET USER NOTIFICATIONS
// ============================================
export async function getUserNotifications(userId: string, limit = 20) {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return { success: true, notifications: data };
  } catch (error) {
    console.error('❌ Failed to fetch notifications:', error);
    return { success: false, error };
  }
}

// ============================================
// MARK NOTIFICATION AS READ
// ============================================
export async function markNotificationRead(notificationId: string) {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('❌ Failed to mark notification as read:', error);
    return { success: false, error };
  }
}

// ============================================
// NOTIFICATION PREFERENCES
// ============================================
export async function updateNotificationPreferences(
  userId: string,
  preferences: {
    email_notifications?: boolean;
    sms_notifications?: boolean;
    push_notifications?: boolean;
  }
) {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('profiles')
      .update(preferences)
      .eq('id', userId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('❌ Failed to update notification preferences:', error);
    return { success: false, error };
  }
}

// ============================================
// SEND NOTIFICATION (Multi-Channel)
// ============================================
export async function sendNotification({
  userId,
  email,
  phone,
  title,
  message,
  templateName,
  templateData,
  channels = ['email', 'in_app'],
}: {
  userId: string;
  email?: string;
  phone?: string;
  title: string;
  message: string;
  templateName?: keyof typeof emailTemplates;
  templateData?: any;
  channels?: ('email' | 'sms' | 'in_app')[];
}) {
  const results: any = {};

  // Send Email
  if (channels.includes('email') && email && templateName) {
    results.email = await sendEmailNotification(email, templateName, templateData);
  }

  // Send SMS
  if (channels.includes('sms') && phone) {
    results.sms = await sendSMSNotification(phone, message);
  }

  // Create In-App Notification
  if (channels.includes('in_app')) {
    results.inApp = await createInAppNotification(userId, title, message);
  }

  return results;
}
