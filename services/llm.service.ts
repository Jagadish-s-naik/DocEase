import {
  LLMPromptTemplate,
  LLMResponse,
  ClassificationResult,
  SimplificationResult,
  DocumentType,
  SupportedLanguage,
  IntentAnalysis,
  SimplifiedContent,
  AppError,
  ErrorCode,
} from '@/types';
import { LLM_CONFIG } from '@/config/constants';

/**
 * LLM Service - Abstracted layer for AI/LLM operations
 * Supports multiple providers (OpenAI, Anthropic, Google AI)
 */

export class LLMService {
  private apiKey: string;
  private model: string;
  private provider: 'openai' | 'anthropic' | 'google';

  constructor(provider: 'openai' | 'anthropic' | 'google' = 'openai') {
    this.provider = provider;
    this.model = LLM_CONFIG.MODEL;
    
    // Get API key based on provider
    switch (provider) {
      case 'openai':
        this.apiKey = process.env.OPENAI_API_KEY || '';
        break;
      case 'anthropic':
        this.apiKey = process.env.ANTHROPIC_API_KEY || '';
        this.model = process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229';
        break;
      case 'google':
        this.apiKey = process.env.GOOGLE_AI_API_KEY || '';
        this.model = process.env.GOOGLE_AI_MODEL || 'gemini-pro';
        break;
    }

    if (!this.apiKey && process.env.DEMO_MODE !== 'false') {
      throw new AppError(
        ErrorCode.SERVER_ERROR,
        `Missing API key for ${provider}`,
        500
      );
    }
  }

  /**
   * Generate completion from LLM
   */
  async complete(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    // DEMO MODE: Return mock response
    if (process.env.DEMO_MODE === 'true') {
      console.log('🎭 DEMO MODE: Using mock LLM response');
      return {
        content: 'This is a demo simplified version of your document. In production, this would contain AI-generated simplified content.',
        model: 'demo-model',
        tokens_used: 100,
        finish_reason: 'stop'
      };
    }
    
    try {
      switch (this.provider) {
        case 'openai':
          return await this.openAIComplete(prompt, systemPrompt);
        case 'anthropic':
          return await this.anthropicComplete(prompt, systemPrompt);
        case 'google':
          return await this.googleAIComplete(prompt, systemPrompt);
        default:
          throw new Error('Unsupported LLM provider');
      }
    } catch (error) {
      throw new AppError(
        ErrorCode.SERVER_ERROR,
        `LLM completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * OpenAI completion
   */
  private async openAIComplete(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: prompt },
        ],
        max_tokens: LLM_CONFIG.MAX_TOKENS,
        temperature: LLM_CONFIG.TEMPERATURE,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API request failed');
    }

    const data = await response.json();
    const choice = data.choices[0];

    return {
      content: choice.message.content,
      model: data.model,
      tokens_used: data.usage.total_tokens,
      finish_reason: choice.finish_reason,
    };
  }

  /**
   * Anthropic Claude completion
   */
  private async anthropicComplete(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: LLM_CONFIG.MAX_TOKENS,
        temperature: LLM_CONFIG.TEMPERATURE,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Anthropic API request failed');
    }

    const data = await response.json();

    return {
      content: data.content[0].text,
      model: data.model,
      tokens_used: data.usage.input_tokens + data.usage.output_tokens,
      finish_reason: data.stop_reason,
    };
  }

  /**
   * Google AI completion
   */
  private async googleAIComplete(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: fullPrompt }] }
          ],
          generationConfig: {
            temperature: LLM_CONFIG.TEMPERATURE,
            maxOutputTokens: LLM_CONFIG.MAX_TOKENS,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Google AI API request failed');
    }

    const data = await response.json();
    const candidate = data.candidates[0];

    return {
      content: candidate.content.parts[0].text,
      model: this.model,
      tokens_used: data.usageMetadata?.totalTokenCount || 0,
      finish_reason: candidate.finishReason,
    };
  }

  /**
   * Classify document type and extract intent
   */
  async classifyDocument(text: string): Promise<ClassificationResult> {
    // DEMO MODE: Return mock classification
    if (process.env.DEMO_MODE === 'true') {
      console.log('🎭 DEMO MODE: Using mock classification result');
      return {
        document_type: 'government_notice' as DocumentType,
        confidence: 0.92,
        intent_analysis: {
          action_required: true,
          deadline: '2026-03-01',
          money_involved: 0,
          currency: null,
          penalty_risk: 'none',
          urgency: 'medium',
          summary: 'This appears to be an official government notice requiring your attention.'
        },
        reasoning: 'Demo mode classification - document type detected based on mock analysis.'
      };
    }
    
    const systemPrompt = CLASSIFICATION_SYSTEM_PROMPT;
    const userPrompt = CLASSIFICATION_USER_PROMPT.replace('{document_text}', text);

    const response = await this.complete(userPrompt, systemPrompt);
    
    try {
      const parsed = JSON.parse(response.content);
      
      return {
        document_type: parsed.document_type as DocumentType,
        confidence: parsed.confidence,
        intent_analysis: {
          action_required: parsed.intent.action_required,
          deadline: parsed.intent.deadline,
          money_involved: parsed.intent.money_involved,
          currency: parsed.intent.currency,
          penalty_risk: parsed.intent.penalty_risk,
          urgency: parsed.intent.urgency,
          summary: parsed.intent.summary,
        },
        reasoning: parsed.reasoning,
      };
    } catch (error) {
      throw new AppError(
        ErrorCode.CLASSIFICATION_FAILED,
        'Failed to parse classification result',
        500
      );
    }
  }

  /**
   * Simplify document in target language
   */
  async simplifyDocument(
    text: string,
    documentType: DocumentType,
    language: SupportedLanguage
  ): Promise<SimplificationResult> {
    // DEMO MODE: Return mock simplification
    if (process.env.DEMO_MODE === 'true') {
      console.log('🎭 DEMO MODE: Using mock simplification result');
      const simplifiedContent: SimplifiedContent = {
        language,
        sections: {
          what_is_this: 'This is a demonstration of the document simplification feature. Your document has been analyzed.',
          action_required: 'In a real scenario, this section would tell you exactly what you need to do.',
          deadlines: 'Important dates and deadlines would be clearly highlighted here.',
          money_matters: 'Any financial implications would be explained in simple terms.',
          risks_penalties: 'Potential consequences and risks would be outlined clearly.',
          simple_explanation: 'Demo mode is active - using mock data. Your document was successfully uploaded and the processing pipeline is working correctly.',
          bullet_points: [
            'Demo mode is active - using mock data',
            'Your document was successfully uploaded',
            'Processing pipeline is working correctly',
            'Real AI would provide detailed simplification'
          ],
          examples: [
            'Review this simplified version',
            'Check the translations below',
            'Take any necessary actions',
            'Configure real API keys for production use'
          ]
        },
        confidence_score: 0.95,
        source_references: [],
        disclaimers: ['This is demo mode - real processing requires API keys']
      };

      return {
        simplified_content: simplifiedContent,
        model_used: 'demo-model',
        tokens_used: 150,
        warnings: []
      };
    }
    
    const template = SIMPLIFICATION_PROMPTS[documentType][language];
    const systemPrompt = template.system;
    const userPrompt = template.user.replace('{document_text}', text);

    const response = await this.complete(userPrompt, systemPrompt);
    
    try {
      const parsed = JSON.parse(response.content);
      
      const simplifiedContent: SimplifiedContent = {
        language,
        sections: {
          what_is_this: parsed.sections.what_is_this,
          action_required: parsed.sections.action_required,
          deadlines: parsed.sections.deadlines,
          money_matters: parsed.sections.money_matters,
          risks_penalties: parsed.sections.risks_penalties,
          simple_explanation: parsed.sections.simple_explanation,
          bullet_points: parsed.sections.bullet_points || [],
          examples: parsed.sections.examples || [],
        },
        confidence_score: parsed.confidence_score,
        source_references: parsed.source_references || [],
        disclaimers: [
          'This is a simplified explanation and not legal advice.',
          'Please consult a professional for important decisions.',
          'AI-generated content may contain errors.',
        ],
      };

      return {
        simplified_content: simplifiedContent,
        model_used: response.model,
        tokens_used: response.tokens_used,
        warnings: parsed.warnings || [],
      };
    } catch (error) {
      throw new AppError(
        ErrorCode.SIMPLIFICATION_FAILED,
        'Failed to parse simplification result',
        500
      );
    }
  }

  /**
   * Translate simplified content to target language
   */
  async translateContent(
    content: SimplifiedContent,
    targetLanguage: SupportedLanguage
  ): Promise<SimplifiedContent> {
    // DEMO MODE: Return mock translation
    if (process.env.DEMO_MODE === 'true') {
      console.log(`🎭 DEMO MODE: Using mock translation for ${targetLanguage}`);
      return {
        ...content,
        language: targetLanguage,
        sections: {
          ...content.sections,
          what_is_this: `[${targetLanguage.toUpperCase()}] Demo translation of document explanation`,
          action_required: `[${targetLanguage.toUpperCase()}] Demo translation of actions needed`,
          deadlines: `[${targetLanguage.toUpperCase()}] Demo translation of deadlines`,
        }
      };
    }
    
    const systemPrompt = TRANSLATION_SYSTEM_PROMPT;
    const userPrompt = TRANSLATION_USER_PROMPT
      .replace('{target_language}', targetLanguage)
      .replace('{content}', JSON.stringify(content.sections));

    const response = await this.complete(userPrompt, systemPrompt);
    
    try {
      const parsed = JSON.parse(response.content);
      
      return {
        ...content,
        language: targetLanguage,
        sections: parsed.sections,
      };
    } catch (error) {
      throw new AppError(
        ErrorCode.TRANSLATION_FAILED,
        'Failed to translate content',
        500
      );
    }
  }
}

// ============================================
// PROMPT TEMPLATES
// ============================================

const CLASSIFICATION_SYSTEM_PROMPT = `You are an expert document classifier for India. 
You specialize in identifying government, bank, legal, insurance, and academic documents.
You extract key information like deadlines, money involved, and required actions.
Always respond with valid JSON only, no additional text.`;

const CLASSIFICATION_USER_PROMPT = `Analyze this document and classify it:

Document Text:
{document_text}

Respond with JSON in this exact format:
{
  "document_type": "government_notice|bank_letter|loan_document|insurance_document|legal_notice|academic_document|unknown",
  "confidence": 0-100,
  "intent": {
    "action_required": true|false,
    "deadline": "YYYY-MM-DD or null",
    "money_involved": number or null,
    "currency": "INR|USD|etc or null",
    "penalty_risk": "none|low|medium|high",
    "urgency": "low|medium|high|critical",
    "summary": "brief summary"
  },
  "reasoning": "why you classified it this way"
}`;

const SIMPLIFICATION_PROMPTS: Record<DocumentType, Record<SupportedLanguage, { system: string; user: string }>> = {
  [DocumentType.GOVERNMENT_NOTICE]: {
    [SupportedLanguage.ENGLISH]: {
      system: `You are an expert at simplifying Indian government documents for common people. 
Use simple English, avoid jargon, and be clear about actions needed.
If something is not clear in the document, say "Not clearly mentioned in document".
Always respond with valid JSON only.`,
      user: `Simplify this government notice:

{document_text}

Respond with JSON:
{
  "sections": {
    "what_is_this": "simple explanation",
    "action_required": "what must be done",
    "deadlines": "any deadlines",
    "money_matters": "any payment/fine/fee",
    "risks_penalties": "what happens if ignored",
    "simple_explanation": "overall simple summary",
    "bullet_points": ["key point 1", "key point 2"],
    "examples": ["example if helpful"]
  },
  "confidence_score": 0-100,
  "source_references": [],
  "warnings": []
}`,
    },
    [SupportedLanguage.HINDI]: {
      system: `आप भारतीय सरकारी दस्तावेजों को आम लोगों के लिए सरल बनाने में विशेषज्ञ हैं।
सरल हिंदी का उपयोग करें, कठिन शब्दों से बचें।
यदि कुछ स्पष्ट नहीं है, तो कहें "दस्तावेज में स्पष्ट रूप से उल्लेख नहीं है"।
केवल वैध JSON में जवाब दें।`,
      user: `इस सरकारी नोटिस को सरल बनाएं:

{document_text}

JSON में जवाब दें (same structure as English)`,
    },
    // Add other languages...
    [SupportedLanguage.TAMIL]: { system: '', user: '' },
    [SupportedLanguage.TELUGU]: { system: '', user: '' },
    [SupportedLanguage.KANNADA]: { system: '', user: '' },
    [SupportedLanguage.MARATHI]: { system: '', user: '' },
  },
  [DocumentType.BANK_LETTER]: {
    [SupportedLanguage.ENGLISH]: {
      system: `You are an expert at explaining banking and financial documents in simple terms.
Focus on payment details, deadlines, and consequences.
Always respond with valid JSON only.`,
      user: `Simplify this bank letter:

{document_text}

Respond with JSON (same structure as government notice)`,
    },
    [SupportedLanguage.HINDI]: { system: '', user: '' },
    [SupportedLanguage.TAMIL]: { system: '', user: '' },
    [SupportedLanguage.TELUGU]: { system: '', user: '' },
    [SupportedLanguage.KANNADA]: { system: '', user: '' },
    [SupportedLanguage.MARATHI]: { system: '', user: '' },
  },
  // Add remaining document types...
  [DocumentType.LOAN_DOCUMENT]: {
    [SupportedLanguage.ENGLISH]: { system: '', user: '' },
    [SupportedLanguage.HINDI]: { system: '', user: '' },
    [SupportedLanguage.TAMIL]: { system: '', user: '' },
    [SupportedLanguage.TELUGU]: { system: '', user: '' },
    [SupportedLanguage.KANNADA]: { system: '', user: '' },
    [SupportedLanguage.MARATHI]: { system: '', user: '' },
  },
  [DocumentType.INSURANCE_DOCUMENT]: {
    [SupportedLanguage.ENGLISH]: { system: '', user: '' },
    [SupportedLanguage.HINDI]: { system: '', user: '' },
    [SupportedLanguage.TAMIL]: { system: '', user: '' },
    [SupportedLanguage.TELUGU]: { system: '', user: '' },
    [SupportedLanguage.KANNADA]: { system: '', user: '' },
    [SupportedLanguage.MARATHI]: { system: '', user: '' },
  },
  [DocumentType.LEGAL_NOTICE]: {
    [SupportedLanguage.ENGLISH]: { system: '', user: '' },
    [SupportedLanguage.HINDI]: { system: '', user: '' },
    [SupportedLanguage.TAMIL]: { system: '', user: '' },
    [SupportedLanguage.TELUGU]: { system: '', user: '' },
    [SupportedLanguage.KANNADA]: { system: '', user: '' },
    [SupportedLanguage.MARATHI]: { system: '', user: '' },
  },
  [DocumentType.ACADEMIC_DOCUMENT]: {
    [SupportedLanguage.ENGLISH]: { system: '', user: '' },
    [SupportedLanguage.HINDI]: { system: '', user: '' },
    [SupportedLanguage.TAMIL]: { system: '', user: '' },
    [SupportedLanguage.TELUGU]: { system: '', user: '' },
    [SupportedLanguage.KANNADA]: { system: '', user: '' },
    [SupportedLanguage.MARATHI]: { system: '', user: '' },
  },
  [DocumentType.UNKNOWN]: {
    [SupportedLanguage.ENGLISH]: { system: '', user: '' },
    [SupportedLanguage.HINDI]: { system: '', user: '' },
    [SupportedLanguage.TAMIL]: { system: '', user: '' },
    [SupportedLanguage.TELUGU]: { system: '', user: '' },
    [SupportedLanguage.KANNADA]: { system: '', user: '' },
    [SupportedLanguage.MARATHI]: { system: '', user: '' },
  },
};

const TRANSLATION_SYSTEM_PROMPT = `You are an expert translator for Indian languages.
Translate while preserving meaning and context.
Use culturally appropriate phrasing.
Always respond with valid JSON only.`;

const TRANSLATION_USER_PROMPT = `Translate this content to {target_language}:

{content}

Respond with JSON containing the translated sections.`;

/**
 * Get LLM service instance
 */
export function getLLMService(provider?: 'openai' | 'anthropic' | 'google'): LLMService {
  return new LLMService(provider);
}
