import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createErrorResponse, createSuccessResponse } from '@/utils/helpers';
import { AppError, ErrorCode } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics
 * Get user analytics and usage statistics
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

    // Get date range from query params
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get document statistics
    const { data: documents } = await supabase
      .from('documents')
      .select('id, processing_status, document_type, created_at')
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString());

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

    // Calculate statistics
    const totalDocuments = documents?.length || 0;
    const completedDocuments = documents?.filter(d => (d as any).processing_status === 'completed').length || 0;
    const failedDocuments = documents?.filter(d => (d as any).processing_status === 'failed').length || 0;
    const processingDocuments = documents?.filter(d => 
      ['queued', 'ocr_in_progress', 'classification_in_progress', 'simplification_in_progress', 'translation_in_progress']
        .includes((d as any).processing_status)
    ).length || 0;

    // Document types breakdown
    const documentTypes = documents?.reduce((acc, doc) => {
      const type = (doc as any).document_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Daily usage trend
    const dailyUsage = documents?.reduce((acc, doc) => {
      const date = new Date((doc as any).created_at).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Format for frontend (matching AnalyticsData interface)
    const analytics = {
      totalDocuments,
      completedDocuments,
      failedDocuments,
      processingDocuments,
      successRate: totalDocuments > 0 ? parseFloat(((completedDocuments / totalDocuments) * 100).toFixed(2)) : 0,
      documentTypes: Object.entries(documentTypes).map(([type, count]) => ({ type, count })),
      dailyUsage: Object.entries(dailyUsage).map(([date, count]) => ({ date, count })),
      usageLimit: {
        current: used,
        limit,
        percentage: limit > 0 ? (used / limit) * 100 : 0,
      },
    };

    return NextResponse.json({
      success: true,
      analytics,
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}
