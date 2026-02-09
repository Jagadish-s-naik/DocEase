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

    // Get usage limits
    const { data: usageLimits } = await supabase
      .from('usage_limits')
      .select('*')
      .eq('user_id', user.id)
      .single();

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

    const analytics = {
      overview: {
        totalDocuments,
        completedDocuments,
        failedDocuments,
        processingDocuments,
        successRate: totalDocuments > 0 ? ((completedDocuments / totalDocuments) * 100).toFixed(2) : 0,
      },
      usage: {
        documentsProcessed: (usageLimits as any)?.documents_processed || 0,
        monthlyLimit: (usageLimits as any)?.monthly_limit || 3,
        remainingQuota: Math.max(0, ((usageLimits as any)?.monthly_limit || 3) - ((usageLimits as any)?.documents_processed || 0)),
      },
      documentTypes,
      dailyUsage,
      period: {
        days,
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    };

    return NextResponse.json(
      createSuccessResponse(analytics, 'Analytics retrieved successfully')
    );

  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}
