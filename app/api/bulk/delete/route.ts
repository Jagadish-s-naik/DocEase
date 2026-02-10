// ============================================
// BULK OPERATIONS API
// Bulk delete, export, and batch actions
// ============================================

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// ============================================
// POST /api/bulk/delete - Bulk delete documents
// ============================================
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { documentIds }: { documentIds: string[] } = await request.json();

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'Document IDs array is required' },
        { status: 400 }
      );
    }

    // Validate max batch size
    if (documentIds.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 documents per batch' },
        { status: 400 }
      );
    }

    // Get documents to verify ownership
    const { data: documents, error: fetchError } = await supabase
      .from('documents')
      .select('id, storage_path')
      .eq('user_id', user.id)
      .in('id', documentIds);

    if (fetchError) {
      throw fetchError;
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: 'No documents found or access denied' },
        { status: 404 }
      );
    }

    const deletedIds: string[] = [];
    const failedIds: string[] = [];

    // Delete each document
    for (const doc of documents) {
      try {
        // Delete from storage if exists
        if (doc.storage_path) {
          const { error: storageError } = await supabase.storage
            .from('documents')
            .remove([doc.storage_path]);

          if (storageError) {
            console.error(`Failed to delete storage for ${doc.id}:`, storageError);
          }
        }

        // Delete document results first (foreign key)
        await supabase.from('document_results').delete().eq('document_id', doc.id);

        // Delete processing logs
        await supabase.from('processing_logs').delete().eq('document_id', doc.id);

        // Delete document record
        const { error: deleteError } = await supabase
          .from('documents')
          .delete()
          .eq('id', doc.id)
          .eq('user_id', user.id);

        if (deleteError) {
          throw deleteError;
        }

        deletedIds.push(doc.id);
      } catch (error) {
        console.error(`Failed to delete document ${doc.id}:`, error);
        failedIds.push(doc.id);
      }
    }

    return NextResponse.json({
      success: true,
      deleted: deletedIds.length,
      failed: failedIds.length,
      deletedIds,
      failedIds,
    });
  } catch (error: any) {
    console.error('❌ Bulk delete error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete documents' },
      { status: 500 }
    );
  }
}
