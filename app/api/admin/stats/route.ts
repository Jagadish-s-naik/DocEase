import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { errorResponse, successResponse } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/stats
 * Get system-wide statistics (Admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return errorResponse('Not authenticated', 401);
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if ((profile as any)?.role !== 'admin') {
      return errorResponse('Admin access required', 403);
    }

    // Get total users count
    const { count: totalUsers, error: usersError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Get total documents count
    const { count: totalDocuments, error: docsError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    // Get processing queue count (documents not completed)
    const { count: processingQueue, error: queueError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .in('processing_status', ['queued', 'ocr_in_progress', 'classification_in_progress', 'simplification_in_progress', 'translation_in_progress']);

    // Get failed documents count
    const { count: failedDocuments, error: failedError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('processing_status', 'failed');

    // Get completed documents count
    const { count: completedDocuments, error: completedError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('processing_status', 'completed');

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentDocuments, error: recentError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    const { count: recentUsers, error: recentUsersError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    const stats = {
      totalUsers: totalUsers || 0,
      totalDocuments: totalDocuments || 0,
      processingQueue: processingQueue || 0,
      failedDocuments: failedDocuments || 0,
      completedDocuments: completedDocuments || 0,
      successRate: totalDocuments! > 0 
        ? parseFloat(((completedDocuments! / totalDocuments!) * 100).toFixed(2))
        : 0,
      recentActivity: {
        newDocuments: recentDocuments || 0,
        newUsers: recentUsers || 0,
        period: '7 days',
      },
    };

    return successResponse(stats);

  } catch (error: any) {
    console.error('Admin stats error:', error);
    return errorResponse(error.message || 'Server error', 500);
  }
}
