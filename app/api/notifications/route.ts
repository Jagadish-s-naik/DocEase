import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { errorResponse, successResponse } from '@/lib/api-response';

/**
 * GET /api/notifications
 * Get all notifications for current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return errorResponse('Failed to fetch notifications', 500);
    }

    return successResponse(notifications);
  } catch (error: any) {
    console.error('Notifications fetch error:', error);
    return errorResponse(error.message || 'Server error', 500);
  }
}

/**
 * PATCH /api/notifications
 * Mark notification(s) as read
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const body = await request.json();
    const { notification_id, mark_all_read } = body;

    if (mark_all_read) {
      // Mark all notifications as read
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        return errorResponse('Failed to mark all as read', 500);
      }

      return successResponse({ message: 'All notifications marked as read' });
    }

    if (!notification_id) {
      return errorResponse('notification_id required', 400);
    }

    // Mark specific notification as read
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification_id)
      .eq('user_id', user.id);

    if (error) {
      return errorResponse('Failed to mark notification as read', 500);
    }

    return successResponse({ message: 'Notification marked as read' });
  } catch (error: any) {
    console.error('Notification update error:', error);
    return errorResponse(error.message || 'Server error', 500);
  }
}
