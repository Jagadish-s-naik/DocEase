import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getProcessingService } from '@/services/document-processing.service';
import { createErrorResponse, createSuccessResponse } from '@/utils/helpers';
import { AppError, ErrorCode, SupportedLanguage } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds for processing

/**
 * POST /api/process
 * Trigger document processing pipeline
 */
export async function POST(request: NextRequest) {
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
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.NOT_FOUND, 'Document not found', 404)),
        { status: 404 }
      );
    }

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
            resultId: existingResult.id,
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
      .catch(error => {
        console.error('Processing failed:', error);
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
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        createErrorResponse(new AppError(ErrorCode.NOT_FOUND, 'Document not found', 404)),
        { status: 404 }
      );
    }

    // Get result if completed
    let result = null;
    if (document.processing_status === 'completed') {
      const { data: resultData } = await supabase
        .from('document_results')
        .select('*')
        .eq('document_id', documentId)
        .single();

      result = resultData;
    }

    return NextResponse.json(
      createSuccessResponse({
        documentId: document.id,
        status: document.processing_status,
        ocrConfidence: document.ocr_confidence,
        documentType: document.document_type,
        languageDetected: document.language_detected,
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
