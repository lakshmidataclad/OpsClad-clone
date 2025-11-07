import { supabase } from "@/lib/supabase"
import { NextRequest, NextResponse } from 'next/server';

// GET - Fetch notifications for a user
export async function GET(request: NextRequest) {
  const userName = request.nextUrl.searchParams.get('userEmail');
  const role = request.nextUrl.searchParams.get('role');

  try {
    let userEmail = null;

    if (userName) {
      // First, find the user's email based on the provided name
      const { data: user, error: userError } = await supabase
        .from('employees') // Assuming a 'users' table exists with a 'name' and 'email' column
        .select('email_id')
        .eq('name', userName)
        .single();
      
      if (userError) {
        console.error('Error fetching user email:', userError);
        return NextResponse.json({ success: false, error: 'User not found or internal error' }, { status: 500 });
      }

      userEmail = user.email_id;
    }

    let query = supabase
      .from('notifications')
      .select('*');

    // Dynamically build the 'or' condition based on provided parameters
    if (userEmail) {
      // If a user email is provided, show ONLY notifications for that user.
      query = query.eq('user_email', userEmail);
    } else if (role) {
      // If no user email is provided, but a role is, show notifications for that role
      // AND for all recipients.
      query = query.or(`recipient_role.eq.${role},recipient_role.eq.all`);
    } else {
      // If no parameters are provided, return an error.
      return NextResponse.json({ success: false, error: 'User email or role is required' }, { status: 400 });
    }

    const { data: notifications, error } = await query
      .order('timestamp', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      notifications: notifications || []
    });

  } catch (error) {
    console.error('Error in GET /api/notifications:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_email, type, title, message, recipient_role, action_url } = body;

    // We now only require title and message
    if (!title || !message) {
      return NextResponse.json({ 
        success: false, 
        error: 'title and message are required' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_email: user_email || null, // Insert user_email, or null if it's not provided
        type: type || 'general',
        title,
        message,
        recipient_role,
        action_url,
        read: false,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, notification: data });

  } catch (error) {
    console.error('Error in POST /api/notifications:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Mark notification as read
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId, userEmail } = body;

    if (!notificationId || !userEmail) {
      return NextResponse.json({ 
        success: false, 
        error: 'notificationId and userEmail are required' 
      }, { status: 400 });
    }

    const { error } = await supabase
      .from('notifications')
      .update({ 
        read: true, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', notificationId)
      .eq('user_email', userEmail);

    if (error) {
      console.error('Error marking notification as read:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in PUT /api/notifications:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Delete all unread notifications for a user (instead of marking as read)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail, role } = body;

    if (!userEmail) {
      return NextResponse.json({ 
        success: false, 
        error: 'userEmail is required' 
      }, { status: 400 });
    }

    // First, get the user's actual email from the employees table
    let actualUserEmail = userEmail;
    
    if (userEmail) {
      const { data: user, error: userError } = await supabase
        .from('employees')
        .select('email_id')
        .eq('name', userEmail)
        .single();
      
      if (!userError && user) {
        actualUserEmail = user.email_id;
      }
    }

    console.log('Deleting notifications for:', { actualUserEmail, role }); // Debug log

    // Delete all unread notifications for this user
    // We need to handle the case where notifications could be targeted to:
    // 1. Specific user email
    // 2. User's role
    // 3. All users
    const { data: deletedNotifications, error } = await supabase
      .from('notifications')
      .delete()
      .or(`user_email.eq.${actualUserEmail},recipient_role.eq.${role},recipient_role.eq.all`)
      .eq('read', false)
      .select(); // Select to see what was deleted

    console.log('Deleted notifications:', deletedNotifications); // Debug log

    if (error) {
      console.error('Error deleting all notifications:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      deletedCount: deletedNotifications?.length || 0 
    });

  } catch (error) {
    console.error('Error in PATCH /api/notifications:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove a notification
export async function DELETE(request: NextRequest) {
  const notificationId = request.nextUrl.searchParams.get('notificationId');
  const userEmail = request.nextUrl.searchParams.get('userEmail');

  if (!notificationId || !userEmail) {
    return NextResponse.json({ 
      success: false, 
      error: 'notificationId and userEmail are required' 
    }, { status: 400 });
  }

  try {
    // First, get the user's actual email from the employees table
    let actualUserEmail = userEmail;
    
    const { data: user, error: userError } = await supabase
      .from('employees')
      .select('email_id')
      .eq('name', userEmail)
      .single();
    
    if (!userError && user) {
      actualUserEmail = user.email_id;
    }

    console.log('Deleting notification:', { notificationId, actualUserEmail }); // Debug log

    const { data: deletedNotification, error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_email', actualUserEmail)
      .select(); // Select to see what was deleted

    console.log('Deleted notification:', deletedNotification); // Debug log

    if (error) {
      console.error('Error deleting notification:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in DELETE /api/notifications:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}