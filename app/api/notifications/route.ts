import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response';
import { AppError, ErrorCode } from '@/lib/errors';

/**
 * GET /api/notifications
 * Get all notifications for current user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.UNAUTHORIZED, 'Authentication required', 401)),
        { status: 401 }
      );
    }

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new AppError(ErrorCode.SERVER_ERROR, 'Failed to fetch notifications', 500);
    }

    return NextResponse.json(createSuccessResponse(notifications));
  } catch (error: any) {
    console.error('Notifications fetch error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error.statusCode || 500 }
    );
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
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.UNAUTHORIZED, 'Authentication required', 401)),
        { status: 401 }
      );
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
        throw new AppError(ErrorCode.SERVER_ERROR, 'Failed to mark all as read', 500);
      }

      return NextResponse.json(createSuccessResponse({ message: 'All notifications marked as read' }));
    }

    if (!notification_id) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 'notification_id required', 400)),
        { status: 400 }
      );
    }

    // Mark specific notification as read
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification_id)
      .eq('user_id', user.id);

    if (error) {
      throw new AppError(ErrorCode.SERVER_ERROR, 'Failed to mark notification as read', 500);
    }

    return NextResponse.json(createSuccessResponse({ message: 'Notification marked as read' }));
  } catch (error: any) {
    console.error('Notification update error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error.statusCode || 500 }
    );
  }
}
