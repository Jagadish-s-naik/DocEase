import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createErrorResponse, createSuccessResponse } from '@/utils/helpers';
import { AppError, ErrorCode } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/documents/[id]
 * Get document status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.UNAUTHORIZED, 'Not authenticated', 401)),
        { status: 401 }
      );
    }

    const { id } = params;
    
    console.log(`[SECURITY] User ${user.id} requesting document ${id}`);

    // Get document - CRITICAL: Must verify user_id match
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)  // CRITICAL: Ensure document belongs to requesting user
      .single();
    
    // CRITICAL: Verify the document's user_id matches the authenticated user
    if (document && document.user_id !== user.id) {
      console.error(`[SECURITY] UNAUTHORIZED ACCESS ATTEMPT: User ${user.id} tried to access document ${id} owned by ${document.user_id}`);
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.UNAUTHORIZED, 'Document not found', 404)),
        { status: 404 }
      );
    }

    if (docError || !document) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.NOT_FOUND, 'Document not found', 404)),
        { status: 404 }
      );
    }

    return NextResponse.json(document);

  } catch (error) {
    console.error('Get document error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}

/**
 * PATCH /api/documents/[id]
 * Update document metadata
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.UNAUTHORIZED, 'Not authenticated', 401)),
        { status: 401 }
      );
    }

    const { id } = params;
    const updates = await request.json();
    
    console.log(`[SECURITY] User ${user.id} updating document ${id}`);

    // First verify document ownership
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('user_id')
      .eq('id', id)
      .single();
    
    if (docError || !document || (document as any).user_id !== user.id) {
      console.error(`[SECURITY] UNAUTHORIZED UPDATE ATTEMPT: User ${user.id} tried to update document ${id}`);
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.UNAUTHORIZED, 'Document not found', 404)),
        { status: 404 }
      );
    }

    // Validate allowed fields
    const allowedFields = ['file_name', 'document_type', 'expires_at'];
    const sanitizedUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updates[key];
        return obj;
      }, {} as any);

    if (Object.keys(sanitizedUpdates).length === 0) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 'No valid fields to update', 400)),
        { status: 400 }
      );
    }

    // Update document
    const { data: document, error: updateError } = await (supabase as any)
      .from('documents')
      .update(sanitizedUpdates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError || !document) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.NOT_FOUND, 'Document not found or update failed', 404)),
        { status: 404 }
      );
    }

    return NextResponse.json(
      createSuccessResponse(document, 'Document updated successfully')
    );

  } catch (error) {
    console.error('Update document error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}

/**
 * DELETE /api/documents/[id]
 * Delete a document (only the owner can delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.UNAUTHORIZED, 'Not authenticated', 401)),
        { status: 401 }
      );
    }

    const { id } = params;
    
    console.log(`[SECURITY] User ${user.id} attempting to delete document ${id}`);

    // First verify document ownership
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('user_id, storage_path')
      .eq('id', id)
      .single();

    if (docError || !document) {
      console.error(`[SECURITY] Delete failed - document not found: ${id}`);
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.NOT_FOUND, 'Document not found', 404)),
        { status: 404 }
      );
    }

    // CRITICAL: Verify ownership
    if ((document as any).user_id !== user.id) {
      console.error(`[SECURITY] UNAUTHORIZED DELETE ATTEMPT: User ${user.id} tried to delete document ${id} owned by ${(document as any).user_id}`);
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.UNAUTHORIZED, 'Cannot delete document', 403)),
        { status: 403 }
      );
    }

    // Delete from storage
    if ((document as any).storage_path) {
      await supabase.storage
        .from('documents')
        .remove([(document as any).storage_path]);
    }

    // Delete document record
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Delete document error:', deleteError);
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.SERVER_ERROR, 'Failed to delete document', 500)),
        { status: 500 }
      );
    }

    console.log(`[SECURITY] User ${user.id} successfully deleted document ${id}`);

    return NextResponse.json(
      createSuccessResponse({ deleted_id: id }, 'Document deleted successfully')
    );

  } catch (error) {
    console.error('Delete document error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}
