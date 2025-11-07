// app/api/send-reminder-emails/route.js
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { supabase } from "@/lib/supabase"

// GET: Fetch employees from Supabase (No changes needed)
export async function GET() {
  try {
    // Fetch all employees from the employees table
    const { data: employees, error } = await supabase
      .from('employees')
      .select('id, employee_id, name, email_id, created_at')
      .order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to fetch employees from database',
          error: error.message 
        },
        { status: 500 }
      )
    }

    // Transform data to match expected format
    const formattedEmployees = employees.map(emp => ({
      id: emp.id,
      employee_id: emp.employee_id,
      name: emp.name,
      email: emp.email_id, // Map email_id to email for compatibility
      email_id: emp.email_id,
      created_at: emp.created_at
    }))

    return NextResponse.json({
      success: true,
      employees: formattedEmployees,
      count: formattedEmployees.length
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error',
        error: error.message 
      },
      { status: 500 }
    )
  }
}

// POST: Send reminder emails (Updated)
export async function POST(request) {
  try {
    const { subject, body, userId, employees } = await request.json()

    if (!subject || !body || !userId) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    let employeeList = employees

    // If no employees provided, fetch from database
    if (!employeeList || employeeList.length === 0) {
      const { data: dbEmployees, error } = await supabase
        .from('employees')
        .select('id, employee_id, name, email_id')
        .order('name', { ascending: true })

      if (error) {
        return NextResponse.json(
          { success: false, message: 'Failed to fetch employees from database' },
          { status: 500 }
        )
      }

      employeeList = dbEmployees.map(emp => ({
        id: emp.id,
        employee_id: emp.employee_id,
        name: emp.name,
        email: emp.email_id,
        email_id: emp.email_id
      }))
    }

    if (employeeList.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No employees found' },
        { status: 400 }
      )
    }

    // Fetch Gmail credentials for the user
    // The getGmailCredentials helper has been updated to return the password
    const gmailCredentials = await getGmailCredentials(userId)
    
    if (!gmailCredentials) {
      return NextResponse.json(
        { success: false, message: 'Gmail credentials not found or not connected' },
        { status: 400 }
      )
    }
    
    // ⚠️ CRITICAL CHANGE: Use Nodemailer with SMTP login instead of OAuth2.
    // The `gmailCredentials` object now contains the password.
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailCredentials.email,
        pass: gmailCredentials.password, // Use the stored password
      },
    })
    
    // IMPORTANT: To use this, you must enable "Less secure app access" or
    // use an App Password in the user's Google Account settings.
    // 
    // The previous OAuth2 setup is more secure but requires a more complex
    // authentication flow than what your settings route provides.

    let emailsSent = 0
    const failedEmails = []

    // Send emails to all employees
    for (const employee of employeeList) {
      try {
        // Personalize the email body by replacing {name} placeholder
        const personalizedBody = body.replace(/{name}/g, employee.name || 'Employee')
        
        const mailOptions = {
          from: gmailCredentials.email,
          to: employee.email_id, // Use email_id from your Supabase table
          subject: subject,
          text: personalizedBody,
          html: personalizedBody.replace(/\n/g, '<br>'), // Convert line breaks to HTML
        }

        await transporter.sendMail(mailOptions)
        emailsSent++
        
        console.log(`Email sent successfully to ${employee.name} (${employee.email_id})`)
        
      } catch (emailError) {
        console.error(`Failed to send email to ${employee.name} (${employee.email_id}):`, emailError)
        failedEmails.push({
          name: employee.name,
          email: employee.email_id,
          error: emailError.message
        })
      }
    }

    // Log the email sending activity
    await logEmailActivity({
      userId,
      emailsSent,
      totalEmployees: employeeList.length,
      subject,
      failedEmails
    })

    const response = {
      success: true,
      emailsSent,
      totalEmployees: employeeList.length,
      message: `Successfully sent ${emailsSent} out of ${employeeList.length} emails`
    }

    if (failedEmails.length > 0) {
      response.failedEmails = failedEmails
      response.message += `. ${failedEmails.length} emails failed to send.`
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error sending reminder emails:', error)
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to send emails',
        error: error.message 
      },
      { status: 500 }
    )
  }
}

// Helper function to get Gmail credentials (Updated)
async function getGmailCredentials(userId) {
  try {
    // Fetch the credentials directly from the database to ensure we have the password
    const { data, error } = await supabase
      .from('gmail_settings')
      .select('gmail_email, gmail_password')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Supabase error fetching credentials:', error)
      return null
    }

    if (data) {
      return {
        email: data.gmail_email,
        password: data.gmail_password,
      }
    }

    return null
  } catch (error) {
    console.error('Error fetching Gmail credentials:', error)
    return null
  }
}

// Helper function to log email activity (No changes needed)
async function logEmailActivity({ userId, emailsSent, totalEmployees, subject, failedEmails }) {
  try {
    console.log('Email Activity:', {
      userId,
      emailsSent,
      totalEmployees,
      subject,
      failedCount: failedEmails.length,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error logging email activity:', error)
  }
}