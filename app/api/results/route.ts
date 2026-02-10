import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createErrorResponse } from '@/utils/helpers';
import { AppError, ErrorCode } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/results
 * Get all document results for the authenticated user
 */
export async function GET(request: NextRequest) {
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

    // Get all completed documents with their results
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select(`
        id,
        file_name,
        file_type,
        file_size,
        document_type,
        processing_status,
        created_at,
        updated_at
      `)
      .eq('user_id', user.id)
      .eq('processing_status', 'completed')
      .order('created_at', { ascending: false });

    if (docsError) {
      console.error('Error fetching documents:', docsError);
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.SERVER_ERROR, 'Failed to fetch documents', 500)),
        { status: 500 }
      );
    }

    // Get results for each document
    const documentsWithResults = await Promise.all(
      (documents || []).map(async (doc: any) => {
        const { data: result } = await supabase
          .from('document_results')
          .select('id, document_type, created_at')
          .eq('document_id', doc.id)
          .single();

        return {
          ...doc,
          has_result: !!result,
          result_id: (result as any)?.id || null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: documentsWithResults,
      count: documentsWithResults.length,
    });

  } catch (error) {
    console.error('Get results error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}
