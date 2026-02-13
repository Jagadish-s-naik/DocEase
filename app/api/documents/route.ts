import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createErrorResponse } from '@/utils/helpers';
import { AppError, ErrorCode } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/documents
 * Get all documents for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    // Check authentication - CRITICAL: Must verify user before returning any documents
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.UNAUTHORIZED, 'Not authenticated', 401)),
        { status: 401 }
      );
    }

    console.log('Fetching documents for user:', user.id);

    // CRITICAL: Filter by user_id to prevent data leakage
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
        updated_at,
        user_id
      `)
      .eq('user_id', user.id)  // CRITICAL: Filter by current user only
      .order('created_at', { ascending: false });

    if (docsError) {
      console.error('Error fetching documents:', docsError);
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.SERVER_ERROR, 'Failed to fetch documents', 500)),
        { status: 500 }
      );
    }

    console.log(`Found ${documents?.length || 0} documents for user ${user.id}`);

    // Get results for each completed document
    const documentsWithResults = await Promise.all(
      (documents || []).map(async (doc: any) => {
        if (doc.processing_status === 'completed') {
          const { data: result } = await supabase
            .from('document_results')
            .select('id')
            .eq('document_id', doc.id)
            .eq('user_id', user.id)  // CRITICAL: Also filter results by user
            .single();

          return {
            ...doc,
            has_result: !!result,
            result_id: (result as any)?.id || null,
          };
        }
        return {
          ...doc,
          has_result: false,
          result_id: null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: documentsWithResults,
      count: documentsWithResults.length,
    });

  } catch (error) {
    console.error('Get documents error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}
