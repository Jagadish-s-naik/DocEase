import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createErrorResponse, createSuccessResponse } from '@/utils/helpers';
import { AppError, ErrorCode } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/feedback
 * Submit user feedback
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.UNAUTHORIZED, 'Not authenticated', 401)),
        { status: 401 }
      );
    }

    const body = await request.json();
    
    // Support two types of feedback:
    // 1. General feedback (from feedback form): { rating: number, comment: string, category: string }
    // 2. Document feedback: { document_id, rating: 'helpful'|'not_helpful', comment: string }
    
    const isDocumentFeedback = body.document_id !== undefined;
    
    if (isDocumentFeedback) {
      // Document-specific feedback
      const { document_id, rating, comment } = body;

      if (!rating) {
        return NextResponse.json(
          createErrorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 'Rating required', 400)),
          { status: 400 }
        );
      }

      // Validate rating
      if (!['helpful', 'not_helpful'].includes(rating)) {
        return NextResponse.json(
          createErrorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 'Invalid rating', 400)),
          { status: 400 }
        );
      }

      // Insert document feedback
      const { data: feedback, error: feedbackError } = await supabase
        .from('feedback')
        .insert({
          user_id: user.id,
          document_id,
          rating,
          comment: comment || null,
        } as any)
        .select()
        .single();

      if (feedbackError) {
        console.error('Feedback error:', feedbackError);
        return NextResponse.json(
          createErrorResponse(new AppError(ErrorCode.SERVER_ERROR, 'Failed to submit feedback', 500)),
          { status: 500 }
        );
      }

      return NextResponse.json(
        createSuccessResponse(feedback, 'Thank you for your feedback!')
      );
    } else {
      // General feedback (from feedback form)
      const { rating, comment, category } = body;

      if (!rating || !comment) {
        return NextResponse.json(
          createErrorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 'Rating and comment required', 400)),
          { status: 400 }
        );
      }

      // For general feedback, we'll store it in the feedback table without a document_id
      // Convert numeric rating (1-5) to helpful/not_helpful for database compatibility
      const dbRating = rating >= 4 ? 'helpful' : 'not_helpful';

      const { data: feedback, error: feedbackError } = await supabase
        .from('feedback')
        .insert({
          user_id: user.id,
          document_id: null,
          rating: dbRating,
          comment: `[${category}] ${comment}`,
        } as any)
        .select()
        .single();

      if (feedbackError) {
        console.error('Feedback error:', feedbackError);
        return NextResponse.json(
          createErrorResponse(new AppError(ErrorCode.SERVER_ERROR, 'Failed to submit feedback', 500)),
          { status: 500 }
        );
      }

      return NextResponse.json(
        createSuccessResponse(feedback, 'Thank you for your feedback!')
      );
    }

  } catch (error) {
    console.error('Submit feedback error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}

/**
 * GET /api/feedback
 * Get all feedback (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.UNAUTHORIZED, 'Not authenticated', 401)),
        { status: 401 }
      );
    }

    // Check if user is admin (simplified - should check roles table)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if ((profile as any)?.role !== 'admin') {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.UNAUTHORIZED, 'Admin access required', 403)),
        { status: 403 }
      );
    }

    // Get all feedback
    const { data: feedbackList, error: feedbackError } = await supabase
      .from('feedback')
      .select(`
        *,
        profiles:user_id (full_name, email),
        documents:document_id (file_name)
      `)
      .order('created_at', { ascending: false });

    if (feedbackError) {
      console.error('Fetch feedback error:', feedbackError);
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.SERVER_ERROR, 'Failed to fetch feedback', 500)),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createSuccessResponse(feedbackList, 'Feedback retrieved successfully')
    );

  } catch (error) {
    console.error('Get feedback error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}
