import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { FILE_LIMITS, VALIDATION_MESSAGES } from '@/config/constants';
import { generateUniqueFilename, createErrorResponse, createSuccessResponse } from '@/utils/helpers';
import { AppError, ErrorCode, UploadStatus } from '@/types';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/upload
 * Handle document upload
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimit = checkRateLimit(`upload:${ip}`, RATE_LIMITS.upload);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.RATE_LIMIT, 'Too many upload requests. Please try again later.', 429)),
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.upload.maxRequests.toString(),
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          }
        }
      );
    }
    
    const supabase = createServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('[AUTH] Upload request without authentication');
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.UNAUTHORIZED, 'Not authenticated', 401)),
        { status: 401 }
      );
    }
    
    console.log(`[UPLOAD] User ${user.id} (${user.email}) uploading document`);  

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 'No file provided', 400)),
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > FILE_LIMITS.MAX_SIZE_BYTES) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.VALIDATION_ERROR, VALIDATION_MESSAGES.FILE_TOO_LARGE, 400)),
        { status: 400 }
      );
    }

    // Validate file type
    if (!FILE_LIMITS.ALLOWED_MIME_TYPES.includes(file.type as any)) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.VALIDATION_ERROR, VALIDATION_MESSAGES.INVALID_FILE_TYPE, 400)),
        { status: 400 }
      );
    }

    // Check usage limit (compute from processed results for current month)
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .limit(1);

    const isPaid = Array.isArray(subscription) && subscription.length > 0;
    const limit = isPaid ? 999999 : 3;

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const { count: usedCount, error: countError } = await supabase
      .from('document_results')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', nextMonth.toISOString());

    if (countError) {
      console.error('Usage count error:', countError);
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.SERVER_ERROR, 'Failed to check usage limits', 500)),
        { status: 500 }
      );
    }

    const used = usedCount || 0;
    if (used >= limit) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.LIMIT_EXCEEDED, VALIDATION_MESSAGES.LIMIT_EXCEEDED, 429)),
        { status: 429 }
      );
    }

    // Generate unique file path
    const storagePath = generateUniqueFilename(file.name, user.id);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      console.error('Error details:', JSON.stringify(uploadError, null, 2));
      throw new AppError(ErrorCode.UPLOAD_FAILED, `Failed to upload file: ${uploadError.message}`, 500);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath);

    // Calculate auto-expiry (if enabled)
    const { data: profileData } = await supabase
      .from('profiles')
      .select('auto_delete_days')
      .eq('id', user.id)
      .single();

    const profile: any = profileData;
    const expiresAt = profile?.auto_delete_days
      ? new Date(Date.now() + profile.auto_delete_days * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Create document record
    const { data: documentData, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        file_url: publicUrl,
        storage_path: storagePath,
        upload_status: UploadStatus.COMPLETED,
        encrypted: true,
        expires_at: expiresAt,
      } as any)
      .select()
      .single();

    const document: any = documentData;

    if (dbError || !documentData) {
      // Cleanup uploaded file
      await supabase.storage.from('documents').remove([storagePath]);
      throw new AppError(ErrorCode.SERVER_ERROR, 'Failed to create document record', 500);
    }

    return NextResponse.json(
      createSuccessResponse({
        documentId: document.id,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: document.created_at,
      }, 'File uploaded successfully')
    );

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}

/**
 * GET /api/upload
 * Get upload limits and status
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

    // Get subscription status
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .limit(1);

    const isPaid = Array.isArray(subscription) && subscription.length > 0;
    const limit = isPaid ? 999999 : 3;

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const { count: usedCount } = await supabase
      .from('document_results')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', nextMonth.toISOString());

    const used = usedCount || 0;
    const remaining = Math.max(0, limit - used);

    return NextResponse.json(
      createSuccessResponse({
        isPaid,
        limit,
        used,
        remaining,
        canUpload: remaining > 0,
        maxFileSize: FILE_LIMITS.MAX_SIZE_MB,
        allowedTypes: FILE_LIMITS.ALLOWED_TYPES,
      })
    );

  } catch (error) {
    console.error('Get upload status error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: 500 }
    );
  }
}
