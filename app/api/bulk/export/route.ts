// ============================================
// BULK EXPORT API
// Export all results as JSON, CSV, or PDF
// ============================================

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// ============================================
// GET /api/bulk/export - Export all results
// ============================================
export async function GET(request: NextRequest) {
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

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'json'; // json, csv, pdf
    const documentIds = searchParams.get('documentIds')?.split(',');

    // Build query
    let query = supabase
      .from('document_results')
      .select(`
        id,
        simplified_text,
        original_language,
        translated_language,
        key_points,
        summary,
        created_at,
        documents (
          id,
          file_name,
          document_type,
          processing_status
        )
      `)
      .eq('documents.user_id', user.id)
      .order('created_at', { ascending: false });

    // Filter by document IDs if provided
    if (documentIds && documentIds.length > 0) {
      query = query.in('document_id', documentIds);
    }

    const { data: results, error } = await query;

    if (error) {
      throw error;
    }

    if (!results || results.length === 0) {
      return NextResponse.json(
        { error: 'No results found' },
        { status: 404 }
      );
    }

    // Format based on requested type
    switch (format.toLowerCase()) {
      case 'csv':
        return exportAsCSV(results);
      
      case 'json':
      default:
        return NextResponse.json({
          success: true,
          count: results.length,
          exportedAt: new Date().toISOString(),
          results,
        });
    }
  } catch (error: any) {
    console.error('❌ Export error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export results' },
      { status: 500 }
    );
  }
}

// ============================================
// EXPORT AS CSV
// ============================================
function exportAsCSV(results: any[]) {
  // CSV Headers
  const headers = [
    'Document Name',
    'Document Type',
    'Status',
    'Simplified Text',
    'Summary',
    'Key Points',
    'Original Language',
    'Translated Language',
    'Created At',
  ];

  // CSV Rows
  const rows = results.map((result) => {
    const doc = result.documents;
    return [
      doc?.file_name || 'N/A',
      doc?.document_type || 'N/A',
      doc?.processing_status || 'N/A',
      (result.simplified_text || '').replace(/"/g, '""'), // Escape quotes
      (result.summary || '').replace(/"/g, '""'),
      (Array.isArray(result.key_points) ? result.key_points.join('; ') : '').replace(/"/g, '""'),
      result.original_language || 'N/A',
      result.translated_language || 'N/A',
      result.created_at || 'N/A',
    ].map((cell) => `"${cell}"`).join(',');
  });

  // Combine headers and rows
  const csv = [headers.join(','), ...rows].join('\n');

  // Return as downloadable file
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="docease-export-${Date.now()}.csv"`,
    },
  });
}

// ============================================
// POST /api/bulk/export - Export specific documents
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

    const { documentIds, format = 'json' }: { documentIds: string[]; format?: string } = await request.json();

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'Document IDs array is required' },
        { status: 400 }
      );
    }

    // Get results for specified documents
    const { data: results, error } = await supabase
      .from('document_results')
      .select(`
        id,
        simplified_text,
        original_language,
        translated_language,
        key_points,
        summary,
        created_at,
        documents (
          id,
          file_name,
          document_type,
          processing_status,
          user_id
        )
      `)
      .in('document_id', documentIds);

    if (error) {
      throw error;
    }

    // Filter to only include user's documents
    const userResults = results?.filter((r: any) => r.documents?.user_id === user.id);

    if (!userResults || userResults.length === 0) {
      return NextResponse.json(
        { error: 'No results found or access denied' },
        { status: 404 }
      );
    }

    // Format based on requested type
    switch (format.toLowerCase()) {
      case 'csv':
        return exportAsCSV(userResults);
      
      case 'json':
      default:
        return NextResponse.json({
          success: true,
          count: userResults.length,
          exportedAt: new Date().toISOString(),
          results: userResults,
        });
    }
  } catch (error: any) {
    console.error('❌ Export error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export results' },
      { status: 500 }
    );
  }
}
