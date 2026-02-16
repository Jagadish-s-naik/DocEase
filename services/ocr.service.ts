import Tesseract from 'tesseract.js';
import pdfParse from 'pdf-parse';
import {
  OCRConfig,
  OCRResult,
  OCRPageResult,
  AppError,
  ErrorCode,
} from '@/types';
import { OCR_CONFIG } from '@/config/constants';

/**
 * OCR Service - Abstracted layer for text extraction
 * Supports Tesseract.js with fallback to cloud OCR
 */

export class OCRService {
  private config: OCRConfig;

  constructor(config?: Partial<OCRConfig>) {
    this.config = {
      language: OCR_CONFIG.DEFAULT_LANGUAGE,
      quality_threshold: OCR_CONFIG.CONFIDENCE_THRESHOLD,
      preprocess: OCR_CONFIG.PREPROCESS,
      auto_rotate: OCR_CONFIG.AUTO_ROTATE,
      denoise: OCR_CONFIG.DENOISE,
      ...config,
    };
  }

  /**
   * Extract text from PDF or image file
   */
  async extractText(file: File): Promise<OCRResult> {
    const startTime = Date.now();
    
    // DEMO MODE: Return mock OCR result
    if (process.env.DEMO_MODE === 'true') {
      console.log('🎭 DEMO MODE: Using mock OCR result');
      return {
        text: `This is a demo document extracted from ${file.name}.\n\nThis document contains important information about your request.\n\nPlease review the simplified version below for better understanding.\n\nDemo OCR extraction - showing file processing capabilities.`,
        confidence: 0.95,
        language: 'en',
        page_count: 1,
        processing_time_ms: Date.now() - startTime,
        warnings: [],
        pages: [{
          page_number: 1,
          text: `Demo content from ${file.name}`,
          confidence: 0.95,
          rotation_applied: 0,
          quality_score: 0.95
        }]
      };
    }
    
    try {
      // Determine file type
      const fileType = file.type;
      
      if (fileType === 'application/pdf') {
        return await this.extractFromPDF(file);
      } else if (fileType.startsWith('image/')) {
        return await this.extractFromImage(file);
      } else {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Unsupported file type for OCR',
          400
        );
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.OCR_FAILED,
        `OCR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Extract text from PDF file
   */
  private async extractFromPDF(file: File): Promise<OCRResult> {
    const startTime = Date.now();
    const pages: OCRPageResult[] = [];
    let pageCount = 1;
    let totalText = '';
    let totalConfidence = 0;
    let warnings: string[] = [];

    try {
      // Try to extract embedded text first (fast and accurate for digital PDFs)
      const arrayBuffer = await file.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);
      const pdfData = await pdfParse(pdfBuffer);

      totalText = (pdfData.text || '').trim();
      pageCount = pdfData.numpages || 1;

      if (totalText.length > 20) {
        totalConfidence = 0.98;
        pages.push({
          page_number: 1,
          text: totalText,
          confidence: totalConfidence,
          rotation_applied: 0,
          quality_score: this.calculateQualityScore(totalConfidence, totalText.length),
        });
      } else {
        warnings.push('Low text content detected in PDF. Attempting OCR fallback.');

        // Fallback: attempt OCR directly on the PDF binary (best-effort)
        const imageResult = await this.extractFromImage(file);
        pages.push(imageResult.pages[0]);
        totalText = imageResult.text;
        totalConfidence = imageResult.confidence;
        pageCount = imageResult.page_count || pageCount;
        if (imageResult.warnings.length > 0) {
          warnings = [...warnings, ...imageResult.warnings];
        }
      }

    } catch (error) {
      warnings.push(`PDF processing error: ${error instanceof Error ? error.message : 'Unknown'}`);
      try {
        const imageResult = await this.extractFromImage(file);
        pages.push(imageResult.pages[0]);
        totalText = imageResult.text;
        totalConfidence = imageResult.confidence;
        pageCount = imageResult.page_count || pageCount;
        if (imageResult.warnings.length > 0) {
          warnings = [...warnings, ...imageResult.warnings];
        }
      } catch (fallbackError) {
        warnings.push(`PDF OCR fallback failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown'}`);
      }
    }

    const processingTime = Date.now() - startTime;

    return {
      text: totalText,
      confidence: totalConfidence,
      language: this.detectLanguage(totalText),
      page_count: pageCount,
      processing_time_ms: processingTime,
      warnings,
      pages,
    };
  }


  /**
   * Extract text from image file
   */
  private async extractFromImage(file: File): Promise<OCRResult> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Preprocess image if enabled
      const imageData = this.config.preprocess
        ? await this.preprocessImage(file)
        : file;

      // Create Tesseract worker with proper configuration for Next.js
      const worker = await Tesseract.createWorker(this.config.language, undefined, {
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd.wasm.js',
        logger: (m) => {
          // Optional: Log progress
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      // Run OCR
      const result = await worker.recognize(imageData);
      await worker.terminate();

      const confidence = result.data.confidence;
      const text = result.data.text.trim();

      // Check confidence threshold
      if (confidence < this.config.quality_threshold) {
        warnings.push(
          `Low OCR confidence: ${confidence.toFixed(2)}%. Results may be inaccurate.`
        );
      }

      // Detect if text is empty or too short
      if (text.length < 10) {
        warnings.push('Very little text detected. Document may be blank or low quality.');
      }

      const processingTime = Date.now() - startTime;
      const detectedLanguage = this.detectLanguage(text);

      const pageResult: OCRPageResult = {
        page_number: 1,
        text,
        confidence,
        rotation_applied: 0, // TODO: Implement rotation detection
        quality_score: this.calculateQualityScore(confidence, text.length),
      };

      return {
        text,
        confidence,
        language: detectedLanguage,
        page_count: 1,
        processing_time_ms: processingTime,
        warnings,
        pages: [pageResult],
      };
    } catch (error) {
      throw new AppError(
        ErrorCode.OCR_FAILED,
        `Image OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * Preprocess image for better OCR accuracy
   */
  private async preprocessImage(file: File): Promise<File> {
    // TODO: Implement image preprocessing
    // - Convert to grayscale
    // - Increase contrast
    // - Remove noise
    // - Deskew/rotate if needed
    // Use canvas API or sharp library
    
    return file; // Placeholder
  }

  /**
   * Detect language from text
   */
  private detectLanguage(text: string): string {
    // Simple heuristic-based language detection
    // For production, use a proper library like franc or langdetect
    
    const hindiRegex = /[\u0900-\u097F]/;
    const tamilRegex = /[\u0B80-\u0BFF]/;
    const teluguRegex = /[\u0C00-\u0C7F]/;
    const kannadaRegex = /[\u0C80-\u0CFF]/;
    const marathiRegex = /[\u0900-\u097F]/; // Same as Hindi

    if (hindiRegex.test(text)) return 'hin';
    if (tamilRegex.test(text)) return 'tam';
    if (teluguRegex.test(text)) return 'tel';
    if (kannadaRegex.test(text)) return 'kan';
    if (marathiRegex.test(text)) return 'mar';
    
    return 'eng'; // Default to English
  }

  /**
   * Calculate quality score based on confidence and text length
   */
  private calculateQualityScore(confidence: number, textLength: number): number {
    let score = confidence;

    // Penalize very short text
    if (textLength < 50) {
      score *= 0.7;
    } else if (textLength < 100) {
      score *= 0.85;
    }

    // Cap at 100
    return Math.min(Math.round(score), 100);
  }

  /**
   * Auto-detect and correct rotation
   */
  private async detectRotation(imageData: any): Promise<number> {
    // TODO: Implement rotation detection
    // Try OCR at 0, 90, 180, 270 degrees and pick best confidence
    return 0;
  }

  /**
   * Validate OCR result quality
   */
  validateQuality(result: OCRResult): boolean {
    return (
      result.confidence >= this.config.quality_threshold &&
      result.text.length >= 10
    );
  }

  /**
   * Clean extracted text
   */
  cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .replace(/\n{3,}/g, '\n\n') // Multiple newlines to double
      .trim();
  }
}

/**
 * Cloud OCR Service (Google Cloud Vision, AWS Textract, etc.)
 * Fallback for complex documents or when higher accuracy is needed
 */
export class CloudOCRService {
  private provider: 'google' | 'aws' | 'azure';

  constructor(provider: 'google' | 'aws' | 'azure' = 'google') {
    this.provider = provider;
  }

  async extractText(file: File): Promise<OCRResult> {
    // Placeholder for cloud OCR integration
    // Implement based on chosen provider
    
    throw new AppError(
      ErrorCode.SERVER_ERROR,
      'Cloud OCR not yet implemented',
      501
    );
  }

  /**
   * Google Cloud Vision API
   */
  private async googleVisionOCR(file: File): Promise<OCRResult> {
    // TODO: Implement Google Cloud Vision integration
    throw new Error('Not implemented');
  }

  /**
   * AWS Textract
   */
  private async awsTextractOCR(file: File): Promise<OCRResult> {
    // TODO: Implement AWS Textract integration
    throw new Error('Not implemented');
  }

  /**
   * Azure Computer Vision
   */
  private async azureOCR(file: File): Promise<OCRResult> {
    // TODO: Implement Azure Computer Vision integration
    throw new Error('Not implemented');
  }
}

/**
 * Factory function to get OCR service
 */
export function getOCRService(useCloud: boolean = false): OCRService | CloudOCRService {
  if (useCloud) {
    return new CloudOCRService();
  }
  return new OCRService();
}

/**
 * Helper: Extract text with retry logic
 */
export async function extractTextWithRetry(
  file: File,
  maxRetries: number = 2
): Promise<OCRResult> {
  const ocrService = new OCRService();
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await ocrService.extractText(file);
      
      // Validate quality
      if (!ocrService.validateQuality(result)) {
        throw new AppError(
          ErrorCode.OCR_FAILED,
          'OCR quality too low. Please upload a clearer image.',
          400
        );
      }

      // Clean text
      result.text = ocrService.cleanText(result.text);
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      // If last attempt, try cloud OCR as fallback
      if (i === maxRetries - 1) {
        try {
          // Attempt cloud OCR
          const cloudService = new CloudOCRService();
          return await cloudService.extractText(file);
        } catch {
          throw lastError;
        }
      }
    }
  }

  throw lastError!;
}
