import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createErrorResponse, createSuccessResponse } from '@/utils/helpers';
import { AppError, ErrorCode } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/reset-password
 * Reset user password with token
 */
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password || password.length < 8) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 'Password must be at least 8 characters', 400)),
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      console.error('Password update error:', error);
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.SERVER_ERROR, error.message, 500)),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createSuccessResponse(
        { message: 'Password updated successfully' },
        'You can now login with your new password'
      )
    );

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}
