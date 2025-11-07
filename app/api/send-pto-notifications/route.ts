// app/api/send-pto-emails/route.js
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { supabase } from "@/lib/supabase"; // Assuming you have this client configured

// Helper function to get Gmail credentials (Copied from your reminder email code)
async function getGmailCredentials(userId) {
  try {
    const { data, error } = await supabase
      .from('gmail_settings')
      .select('gmail_email, gmail_password')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Supabase error fetching credentials:', error);
      return null;
    }

    if (data) {
      return {
        email: data.gmail_email,
        password: data.gmail_password,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching Gmail credentials:', error);
    return null;
  }
}

export async function POST(request) {
  try {
    const { userId, subject, body, recipients } = await request.json();

    if (!userId || !subject || !body || !recipients || recipients.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch Gmail credentials for the user
    const gmailCredentials = await getGmailCredentials(userId);
    
    if (!gmailCredentials) {
      return NextResponse.json(
        { success: false, message: 'Gmail credentials not found or not connected' },
        { status: 400 }
      );
    }
    
    // Use Nodemailer with SMTP login
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailCredentials.email,
        pass: gmailCredentials.password,
      },
    });

    let emailsSent = 0;
    const failedEmails = [];

    // Send emails to all recipients
    for (const recipient of recipients) {
      try {
        const personalizedBody = body.replace(/{name}/g, recipient.name || 'Employee');
        
        const mailOptions = {
          from: gmailCredentials.email,
          to: recipient.email,
          subject: subject,
          text: personalizedBody,
          html: personalizedBody.replace(/\n/g, '<br>'),
        };

        await transporter.sendMail(mailOptions);
        emailsSent++;
        
        console.log(`PTO alert sent to ${recipient.name} (${recipient.email})`);
        
      } catch (emailError) {
        console.error(`Failed to send PTO alert to ${recipient.name} (${recipient.email}):`, emailError);
        failedEmails.push({
          name: recipient.name,
          email: recipient.email,
          error: emailError.message,
        });
      }
    }

    const response = {
      success: true,
      emailsSent,
      totalRecipients: recipients.length,
      message: `Successfully sent ${emailsSent} out of ${recipients.length} emails`,
    };

    if (failedEmails.length > 0) {
      response.failedEmails = failedEmails;
      response.message += `. ${failedEmails.length} emails failed to send.`;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error sending PTO emails:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to send emails',
        error: error.message,
      },
      { status: 500 }
    );
  }
}