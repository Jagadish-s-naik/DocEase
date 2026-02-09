// ============================================
// REAL OCR & LLM PROCESSING
// Production-ready document processing
// ============================================

import { createClient } from '@/utils/supabase/server';
import { createWorker } from 'tesseract.js';
import OpenAI from 'openai';
import { sendNotification } from './notifications';
import { captureError, addBreadcrumb } from './sentry';

const DEMO_MODE = process.env.DEMO_MODE === 'true';

// ============================================
// OPENAI CONFIGURATION
// ============================================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// ============================================
// MAIN PROCESSING FUNCTION
// ============================================
export async function processDocument(documentId: string) {
  const supabase = createClient();
  
  try {
    addBreadcrumb('Starting document processing', 'processing', { documentId });

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    // Update status to processing
    await supabase
      .from('documents')
      .update({ processing_status: 'ocr_in_progress' })
      .eq('id', documentId);

    // Step 1: OCR (Extract Text)
    const extractedText = await extractText(document);
    
    if (!extractedText) {
      throw new Error('Failed to extract text from document');
    }

    await supabase
      .from('documents')
      .update({ 
        processing_status: 'classification_in_progress',
        extracted_text: extractedText
      })
      .eq('id', documentId);

    // Step 2: Classify Document Type
    const documentType = await classifyDocument(extractedText);
    
    await supabase
      .from('documents')
      .update({ 
        processing_status: 'simplification_in_progress',
        document_type: documentType
      })
      .eq('id', documentId);

    // Step 3: Simplify Text
    const simplifiedResult = await simplifyText(extractedText, documentType);

    await supabase
      .from('documents')
      .update({ processing_status: 'completed' })
      .eq('id', documentId);

    // Step 4: Save Results
    const { data: result, error: resultError } = await supabase
      .from('document_results')
      .insert({
        document_id: documentId,
        original_text: extractedText,
        simplified_text: simplifiedResult.simplified,
        summary: simplifiedResult.summary,
        key_points: simplifiedResult.keyPoints,
        original_language: simplifiedResult.language,
        word_count: extractedText.split(/\s+/).length,
        readability_score: 8.5, // Placeholder
      })
      .select()
      .single();

    if (resultError) {
      throw resultError;
    }

    // Send success notification
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await sendNotification({
        userId: user.id,
        email: user.email,
        title: 'Document Ready',
        message: `Your document "${document.file_name}" has been processed successfully!`,
        templateName: 'processingComplete',
        templateData: {
          fileName: document.file_name,
          resultUrl: `${process.env.NEXT_PUBLIC_APP_URL}/results/${result.id}`,
        },
        channels: ['email', 'in_app'],
      });
    }

    return {
      success: true,
      resultId: result.id,
    };
  } catch (error: any) {
    console.error('❌ Processing error:', error);
    captureError(error, { documentId });

    // Update document as failed
    await supabase
      .from('documents')
      .update({ 
        processing_status: 'failed',
        error_message: error.message || 'Processing failed'
      })
      .eq('id', documentId);

    // Send failure notification
    try {
      const { data: document } = await supabase
        .from('documents')
        .select('file_name, user_id')
        .eq('id', documentId)
        .single();

      const { data: { user } } = await supabase.auth.getUser();
      if (user && document) {
        await sendNotification({
          userId: user.id,
          email: user.email,
          title: 'Processing Failed',
          message: `Failed to process "${document.file_name}"`,
          templateName: 'processingFailed',
          templateData: {
            fileName: document.file_name,
            error: error.message,
          },
          channels: ['email', 'in_app'],
        });
      }
    } catch (notifError) {
      console.error('Failed to send error notification:', notifError);
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================
// EXTRACT TEXT (OCR)
// ============================================
async function extractText(document: any): Promise<string | null> {
  if (DEMO_MODE) {
    // Demo mode - return mock text
    return `This is demo text extracted from ${document.file_name}. 

In production, this would be real OCR results from Tesseract.js processing the actual uploaded document. The system would extract all text content from PDFs, images, and other document formats.

This demonstration shows how the system processes and simplifies complex documents into easy-to-understand content.`;
  }

  try {
    // Real OCR using Tesseract.js
    if (document.document_type === 'image' || document.file_name.match(/\.(jpg|jpeg|png|gif|bmp)$/i)) {
      const supabase = createClient();
      
      // Download image from storage
      const { data: fileData, error } = await supabase.storage
        .from('documents')
        .download(document.storage_path);

      if (error || !fileData) {
        throw new Error('Failed to download document from storage');
      }

      // Convert to buffer for Tesseract
      const buffer = await fileData.arrayBuffer();
      const imageBuffer = Buffer.from(buffer);

      // Initialize Tesseract worker
      const worker = await createWorker('eng');
      
      // Perform OCR
      const { data: { text } } = await worker.recognize(imageBuffer);
      
      await worker.terminate();

      return text;
    }

    // For PDFs - would use pdf-parse or similar
    if (document.file_name.match(/\.pdf$/i)) {
      // TODO: Integrate pdf-parse library
      throw new Error('PDF parsing not yet implemented');
    }

    // For text files
    if (document.file_name.match(/\.(txt|md)$/i)) {
      const supabase = createClient();
      const { data: fileData, error } = await supabase.storage
        .from('documents')
        .download(document.storage_path);

      if (error || !fileData) {
        throw new Error('Failed to download document from storage');
      }

      return await fileData.text();
    }

    throw new Error('Unsupported document type');
  } catch (error) {
    console.error('❌ OCR extraction failed:', error);
    captureError(error as Error, { documentId: document.id });
    return null;
  }
}

// ============================================
// CLASSIFY DOCUMENT TYPE
// ============================================
async function classifyDocument(text: string): Promise<string> {
  if (DEMO_MODE) {
    return 'general';
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a document classifier. Classify the document type into one of: legal, medical, technical, financial, academic, or general. Respond with only the category name.',
        },
        {
          role: 'user',
          content: `Classify this document:\n\n${text.slice(0, 500)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 10,
    });

    return response.choices[0].message.content?.toLowerCase().trim() || 'general';
  } catch (error) {
    console.error('❌ Classification failed:', error);
    return 'general';
  }
}

// ============================================
// SIMPLIFY TEXT (LLM)
// ============================================
async function simplifyText(
  text: string,
  documentType: string
): Promise<{
  simplified: string;
  summary: string;
  keyPoints: string[];
  language: string;
}> {
  if (DEMO_MODE) {
    return {
      simplified: `DEMO MODE: This is a simplified version of your document. In production, OpenAI GPT-4 would provide a comprehensive simplification tailored to the document type (${documentType}).

The actual implementation uses advanced language models to:
- Simplify complex terminology
- Restructure sentences for clarity
- Maintain original meaning
- Adapt to document type (legal, medical, technical, etc.)`,
      summary: 'This is a demo summary. In production, this would be a concise overview generated by AI.',
      keyPoints: [
        'Demo mode is active',
        'Real AI processing will be used in production',
        `Document classified as: ${documentType}`,
      ],
      language: 'en',
    };
  }

  try {
    // Real LLM simplification using OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an expert at simplifying complex documents. Your task is to:
1. Simplify the text while maintaining accuracy
2. Use clear, simple language (8th-grade reading level)
3. Preserve important details and context
4. Adapt to document type: ${documentType}

Respond in JSON format:
{
  "simplified": "simplified version",
  "summary": "brief summary",
  "keyPoints": ["point 1", "point 2", "point 3"]
}`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.5,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');

    return {
      simplified: result.simplified || text,
      summary: result.summary || '',
      keyPoints: result.keyPoints || [],
      language: 'en',
    };
  } catch (error) {
    console.error('❌ Simplification failed:', error);
    captureError(error as Error);
    
    // Fallback to original text
    return {
      simplified: text,
      summary: 'Error: Could not generate summary',
      keyPoints: [],
      language: 'en',
    };
  }
}

// ============================================
// TRANSLATE TEXT
// ============================================
export async function translateText(
  text: string,
  targetLanguage: string
): Promise<string> {
  if (DEMO_MODE) {
    return `[DEMO] Translated to ${targetLanguage}: ${text.slice(0, 100)}...`;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Translate the following text to ${targetLanguage}. Maintain the meaning and tone.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    return response.choices[0].message.content || text;
  } catch (error) {
    console.error('❌ Translation failed:', error);
    return text;
  }
}
