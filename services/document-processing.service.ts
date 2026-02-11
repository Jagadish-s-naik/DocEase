import { createServerClient } from '@/lib/supabase-server';
import { OCRService } from './ocr.service';
import { LLMService } from './llm.service';
import { sendNotification } from '@/lib/notifications';
import {
  Document,
  DocumentResult,
  SupportedLanguage,
  ProcessingStatus,
  AppError,
  ErrorCode,
} from '@/types';

/**
 * Document Processing Pipeline
 * Orchestrates: Upload → OCR → Classification → Simplification → Translation
 */

export class DocumentProcessingService {
  private ocrService: OCRService;
  private llmService: LLMService;

  constructor() {
    this.ocrService = new OCRService();
    this.llmService = new LLMService();
  }

  /**
   * Main processing pipeline
   */
  async processDocument(
    documentId: string,
    userId: string,
    targetLanguages: SupportedLanguage[] = [SupportedLanguage.ENGLISH]
  ): Promise<DocumentResult> {
    const supabase = createServerClient();
    const startTime = Date.now();

    try {
      // Step 1: Get document metadata
      const document = await this.getDocument(documentId, userId);
      
      // Step 2: Download file from storage
      const file = await this.downloadFile(document.storage_path);

      // Step 3: OCR - Extract text
      await this.updateProcessingStatus(documentId, ProcessingStatus.OCR_IN_PROGRESS);
      const ocrResult = await this.ocrService.extractText(file);
      
      await this.updateDocument(documentId, {
        ocr_confidence: ocrResult.confidence,
        language_detected: ocrResult.language,
        page_count: ocrResult.page_count,
      });

      // Step 4: Classification - Detect document type and intent
      await this.updateProcessingStatus(documentId, ProcessingStatus.CLASSIFICATION_IN_PROGRESS);
      const classification = await this.llmService.classifyDocument(ocrResult.text);

      await this.updateDocument(documentId, {
        document_type: classification.document_type,
      });

      // Step 5: Simplification - Simplify in primary language
      await this.updateProcessingStatus(documentId, ProcessingStatus.SIMPLIFICATION_IN_PROGRESS);
      const primaryLanguage = targetLanguages[0];
      const simplification = await this.llmService.simplifyDocument(
        ocrResult.text,
        classification.document_type,
        primaryLanguage
      );

      // Step 6: Translation - Translate to other languages
      await this.updateProcessingStatus(documentId, ProcessingStatus.TRANSLATION_IN_PROGRESS);
      const translations: any = {
        [primaryLanguage]: simplification.simplified_content,
      };

      for (const lang of targetLanguages.slice(1)) {
        try {
          const translated = await this.llmService.translateContent(
            simplification.simplified_content,
            lang
          );
          translations[lang] = translated;
        } catch (error) {
          console.error(`Translation to ${lang} failed:`, error);
        }
      }

      // Step 7: Save results
      const processingTime = Date.now() - startTime;
      
      const result = await this.saveResult({
        document_id: documentId,
        user_id: userId,
        extracted_text: ocrResult.text,
        document_type: classification.document_type,
        classification_confidence: classification.confidence,
        intent_analysis: classification.intent_analysis,
        simplified_content: simplification.simplified_content,
        translations,
        metadata: {
          processing_time_ms: processingTime,
          ocr_engine: 'tesseract',
          llm_model: simplification.model_used,
          classification_method: 'llm',
          warnings: [
            ...ocrResult.warnings,
            ...simplification.warnings,
          ],
          quality_score: this.calculateOverallQuality(ocrResult, classification, simplification),
        },
      });

      // Step 8: Mark as completed
      await this.updateProcessingStatus(documentId, ProcessingStatus.COMPLETED);

      // Step 9: Increment usage
      await this.incrementUsage(userId);

      // Step 10: Send success notification
      try {
        await this.sendSuccessNotification(userId, document.file_name, result.id);
      } catch (notifError) {
        console.warn('Failed to send notification:', notifError);
        // Don't fail the whole process if notification fails
      }

      return result;

    } catch (error) {
      // Mark as failed
      await this.updateProcessingStatus(documentId, ProcessingStatus.FAILED);
      
      // Send failure notification
      try {
        const document = await this.getDocument(documentId, userId).catch(() => null);
        if (document) {
          await this.sendFailureNotification(userId, document.file_name, error instanceof Error ? error.message : 'Unknown error');
        }
      } catch (notifError) {
        console.warn('Failed to send failure notification:', notifError);
      }
      
      throw new AppError(
        ErrorCode.SERVER_ERROR,
        `Document processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Get document from database
   */
  private async getDocument(documentId: string, userId: string): Promise<Document> {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Document not found', 404);
    }

    return data as Document;
  }

  /**
   * Download file from Supabase storage
   */
  private async downloadFile(storagePath: string): Promise<File> {
    const supabase = createServerClient();
    
    const { data, error } = await supabase.storage
      .from('documents')
      .download(storagePath);

    if (error || !data) {
      throw new AppError(ErrorCode.NOT_FOUND, 'File not found in storage', 404);
    }

    // Convert Blob to File
    const file = new File([data], storagePath.split('/').pop() || 'document', {
      type: data.type,
    });

    return file;
  }

  /**
   * Update processing status
   */
  private async updateProcessingStatus(documentId: string, status: ProcessingStatus) {
    const supabase = createServerClient();
    
    const documentsTable: any = supabase.from('documents');
    await documentsTable.update({ processing_status: status }).eq('id', documentId);
  }

  /**
   * Update document metadata
   */
  private async updateDocument(documentId: string, updates: Partial<Document>) {
    const supabase = createServerClient();
    
    const documentsTable: any = supabase.from('documents');
    await documentsTable.update(updates).eq('id', documentId);
  }

  /**
   * Save processing result
   */
  private async saveResult(result: Partial<DocumentResult>): Promise<DocumentResult> {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('document_results')
      .insert(result as any)
      .select()
      .single();

    if (error || !data) {
      throw new AppError(ErrorCode.SERVER_ERROR, 'Failed to save result', 500);
    }

    return data as DocumentResult;
  }

  /**
   * Increment user's usage count
   */
  private async incrementUsage(userId: string) {
    const supabase = createServerClient();
    
    await supabase.rpc('increment_usage', { p_user_id: userId } as any);
  }

  /**
   * Calculate overall quality score
   */
  private calculateOverallQuality(
    ocrResult: any,
    classification: any,
    simplification: any
  ): number {
    const ocrScore = ocrResult.confidence;
    const classificationScore = classification.confidence;
    const simplificationScore = simplification.simplified_content.confidence_score;

    // Weighted average
    const overallScore = (
      ocrScore * 0.3 +
      classificationScore * 0.3 +
      simplificationScore * 0.4
    );

    return Math.round(overallScore);
  }

  /**
   * Get processing result
   */
  async getResult(documentId: string, userId: string): Promise<DocumentResult | null> {
    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('document_results')
      .select('*')
      .eq('document_id', documentId)
      .eq('user_id', userId)
      .single();

    if (error) {
      return null;
    }

    return data as DocumentResult;
  }

  /**
   * Re-translate existing result to new language
   */
  async retranslate(
    resultId: string,
    userId: string,
    targetLanguage: SupportedLanguage
  ): Promise<DocumentResult> {
    const supabase = createServerClient();
    
    // Get existing result
    const { data: result, error } = await supabase
      .from('document_results')
      .select('*')
      .eq('id', resultId)
      .eq('user_id', userId)
      .single();

    if (error || !result) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Result not found', 404);
    }

    // Check if translation already exists
    if ((result as any).translations[targetLanguage]) {
      return result as DocumentResult;
    }

    // Translate
    const translated = await this.llmService.translateContent(
      (result as any).simplified_content,
      targetLanguage
    );

    // Update result
    const resultsTable: any = supabase.from('document_results');
    const { data: updated, error: updateError } = await resultsTable
      .update({
        translations: {
          ...(result as any).translations,
          [targetLanguage]: translated,
        },
      })
      .eq('id', resultId)
      .select()
      .single();

    if (updateError || !updated) {
      throw new AppError(ErrorCode.SERVER_ERROR, 'Failed to update translation', 500);
    }

    return updated as DocumentResult;
  }

  /**
   * Delete document and its results
   */
  async deleteDocument(documentId: string, userId: string) {
    const supabase = createServerClient();
    
    // Get document
    const document = await this.getDocument(documentId, userId);

    // Delete from storage
    await supabase.storage
      .from('documents')
      .remove([document.storage_path]);

    // Delete from database (cascade deletes results)
    await supabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', userId);
  }

  /**
   * Send success notification to user
   */
  private async sendSuccessNotification(userId: string, fileName: string, resultId: string) {
    const supabase = createServerClient();
    
    // Get user profile for email
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .single();

    // Get user email from auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;

    const resultUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/results/${resultId}`;

    // Send in-app notification
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'success',
        title: 'Document processed successfully',
        message: `Your document "${fileName}" has been processed and is ready to view.`,
        link: resultUrl,
        read: false,
      } as any);

    // Send email notification (if configured)
    await sendNotification({
      userId,
      email: user.email,
      title: 'Document processed successfully',
      message: `Your document "${fileName}" has been processed and is ready to view.`,
      templateName: 'processingComplete',
      templateData: { fileName, resultUrl },
      channels: ['in_app'],
    }).catch((err: any) => console.warn('Email notification failed:', err));
  }

  /**
   * Send failure notification to user
   */
  private async sendFailureNotification(userId: string, fileName: string, error: string) {
    const supabase = createServerClient();
    
    // Get user email from auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;

    // Send in-app notification
    await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'error',
        title: 'Document processing failed',
        message: `Failed to process "${fileName}": ${error}`,
        link: '/upload',
        read: false,
      } as any);

    // Send email notification (if configured)
    await sendNotification({
      userId,
      email: user.email,
      title: 'Document processing failed',
      message: `Failed to process "${fileName}": ${error}`,
      templateName: 'processingFailed',
      templateData: { fileName, error },
      channels: ['in_app'],
    }).catch((err: any) => console.warn('Email notification failed:', err));
  }
}

/**
 * Get processing service instance
 */
export function getProcessingService(): DocumentProcessingService {
  return new DocumentProcessingService();
}
