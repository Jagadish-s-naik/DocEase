import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createErrorResponse, createSuccessResponse } from '@/utils/helpers';
import { AppError, ErrorCode } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/forgot-password
 * Send password reset email
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 'Email required', 400)),
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXTAUTH_URL}/auth/reset-password`,
    });

    if (error) {
      console.error('Password reset error:', error);
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.SERVER_ERROR, error.message, 500)),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createSuccessResponse(
        { message: 'Password reset email sent' },
        'Check your email for reset link'
      )
    );

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}
