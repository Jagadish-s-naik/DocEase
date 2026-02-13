import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getProcessingService } from '@/services/document-processing.service';
import { createErrorResponse, createSuccessResponse } from '@/utils/helpers';
import { AppError, ErrorCode, SupportedLanguage } from '@/types';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max 60 seconds for processing

/**
 * POST /api/process
 * Trigger document processing pipeline
 */
export async function POST(request: NextRequest) {
  console.log('🚀 Processing API called');
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimit = checkRateLimit(`process:${ip}`, RATE_LIMITS.process);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.RATE_LIMIT, 'Too many processing requests. Please try again later.', 429)),
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.process.maxRequests.toString(),
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
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.UNAUTHORIZED, 'Not authenticated', 401)),
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { documentId, targetLanguages = [SupportedLanguage.ENGLISH] } = body;

    if (!documentId) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 'Document ID required', 400)),
        { status: 400 }
      );
    }

    // Verify document exists and belongs to user
    const { data: documentData, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !documentData) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.NOT_FOUND, 'Document not found', 404)),
        { status: 404 }
      );
    }

    const document: any = documentData;

    // Check if already processing or completed
    if (document.processing_status === 'completed') {
      // Return existing result
      const { data: existingResult } = await supabase
        .from('document_results')
        .select('*')
        .eq('document_id', documentId)
        .single();

      if (existingResult) {
        return NextResponse.json(
          createSuccessResponse({
            resultId: (existingResult as any).id,
            status: 'completed',
            result: existingResult,
          }, 'Document already processed')
        );
      }
    }

    if (document.processing_status !== 'queued' && document.processing_status !== 'failed') {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 'Document is currently being processed', 400)),
        { status: 400 }
      );
    }

    // Start processing in background
    // In production, use a queue (Bull, AWS SQS, etc.)
    const processingService = getProcessingService();
    
    // Process asynchronously (non-blocking)
    processingService.processDocument(documentId, user.id, targetLanguages)
      .then((result) => {
        console.log('✅ Processing completed successfully:', documentId);
      })
      .catch(error => {
        console.error('❌ Processing failed for document:', documentId);
        console.error('Error details:', error);
        console.error('Stack:', error.stack);
        // Log error to monitoring service
      });

    return NextResponse.json(
      createSuccessResponse({
        documentId,
        status: 'processing',
        estimatedTime: 30000, // 30 seconds estimate
      }, 'Document processing started')
    );

  } catch (error) {
    console.error('Process trigger error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: error instanceof AppError ? error.statusCode : 500 }
    );
  }
}

/**
 * GET /api/process?documentId=xxx
 * Get processing status and result
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

    const searchParams = request.nextUrl.searchParams;
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.VALIDATION_ERROR, 'Document ID required', 400)),
        { status: 400 }
      );
    }

    // Get document status
    const { data: documentData2, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !documentData2) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.NOT_FOUND, 'Document not found', 404)),
        { status: 404 }
      );
    }

    const document2: any = documentData2;

    // Get result if completed
    let result = null;
    if (document2.processing_status === 'completed') {
      const { data: resultData } = await supabase
        .from('document_results')
        .select('*')
        .eq('document_id', documentId)
        .single();

      result = resultData;
    }

    return NextResponse.json(
      createSuccessResponse({
        documentId: document2.id,
        status: document2.processing_status,
        ocrConfidence: document2.ocr_confidence,
        documentType: document2.document_type,
        languageDetected: document2.language_detected,
        result,
      })
    );

  } catch (error) {
    console.error('Get processing status error:', error);
    return NextResponse.json(
      createErrorResponse(error),
      { status: 500 }
    );
  }
}
