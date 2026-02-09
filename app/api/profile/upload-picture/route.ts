import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createErrorResponse, createSuccessResponse } from '@/utils/helpers';
import { AppError, ErrorCode } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/profile/upload-picture
 * Upload profile picture
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

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 'No file provided', 400)),
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 'Only JPG, PNG, and WebP images allowed', 400)),
        { status: 400 }
      );
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 'File size must be less than 2MB', 400)),
        { status: 400 }
      );
    }

    // Upload to storage
    const fileName = `${user.id}/profile.${file.type.split('/')[1]}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profile-pictures')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: true, // Replace if exists
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.UPLOAD_FAILED, uploadError.message, 500)),
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(fileName);

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.SERVER_ERROR, 'Failed to update profile', 500)),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createSuccessResponse(
        { avatar_url: publicUrl },
        'Profile picture updated successfully'
      )
    );

  } catch (error) {
    console.error('Upload picture error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}
