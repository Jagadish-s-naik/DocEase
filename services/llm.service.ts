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
  private provider: 'openai' | 'anthropic' | 'google' | 'groq';

  constructor(provider: 'openai' | 'anthropic' | 'google' | 'groq' = 'groq') {
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
      case 'groq':
        this.apiKey = process.env.GROQ_API_KEY || '';
        this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
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
        case 'groq':
          return await this.groqComplete(prompt, systemPrompt);
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
   * Groq completion (Free, Fast AI)
   */
  private async groqComplete(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
      throw new Error(error.error?.message || 'Groq API request failed');
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
      // Strip markdown code blocks if present
      let jsonContent = response.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
      }
      
      const parsed = JSON.parse(jsonContent);
      
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
      console.log('📄 LLM Response Content:', response.content.substring(0, 500));
      console.log('📄 Full Response:', response.content);
      
      // Strip markdown code blocks if present
      let jsonContent = response.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
        console.log('📄 Stripped markdown, now parsing:', jsonContent.substring(0, 200));
      }
      
      const parsed = JSON.parse(jsonContent);
      
      const simplifiedContent: SimplifiedContent = {
        language,
        sections: {
          what_is_this: parsed.sections?.what_is_this || 'Unable to determine',
          action_required: parsed.sections?.action_required || 'Not specified',
          deadlines: parsed.sections?.deadlines || 'No deadlines mentioned',
          money_matters: parsed.sections?.money_matters || 'No money involved',
          risks_penalties: parsed.sections?.risks_penalties || 'Not mentioned',
          simple_explanation: parsed.sections?.simple_explanation || 'See original document',
          bullet_points: parsed.sections?.bullet_points || [],
          examples: parsed.sections?.examples || [],
        },
        confidence_score: parsed.confidence_score || 75,
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
      console.error('❌ JSON Parse Error:', error);
      console.error('Response content:', response.content);
      console.error('Response object:', JSON.stringify(response, null, 2));
      throw new AppError(
        ErrorCode.SIMPLIFICATION_FAILED,
        `Failed to parse simplification result: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      // Strip markdown code blocks if present
      let jsonContent = response.content;
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim();
      }
      
      const parsed = JSON.parse(jsonContent);
      
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
    [SupportedLanguage.TAMIL]: {
      system: `நீங்கள் இந்திய அரசு ஆவணங்களை எளிய சொற்களில் மக்களுக்காக சரிசெய்வதில் நிபுணர்.
எளிய தமிழ் பயன்படுத்தவும், முக்கிய சொற்களைத் தவிர்க்கவும்.
எதுவும் தெளிவாக இல்லை என்றால், "ஆவணத்தில் தெளிவாக குறிப்பிடப்படவில்லை" என்று சொல்லுங்கள்.
வெளிப்படையாக JSON மட்டுமே பதிலளிக்கவும்.`,
      user: `இந்த அரசு அறிவிப்பை எளிமையாக்குங்கள்:

{document_text}

JSON இல் பதிலளிக்கவும்`,
    },
    [SupportedLanguage.TELUGU]: {
      system: `మీరు ఇండియన్ ప్రభుత్వ ఆవశ్యకతలను సాధారణ వ్యక్తిలకు సరళం చేయడంలో నిపుణుడు.
సరళ తెలుగు ఉపయోగించండి, నిబంధన గ్రహణ నుండి తప్పుకోండి.
ఏదయినా స్పష్టం కాకపోతే, "ఆవశ్యకతలో స్పష్టంగా చెప్పబడలేదు" అని చెప్పండి.
కేవలం చెల్లుబాటు గల JSON మందుగా సమాధానమివ్వండి.`,
      user: `ఈ ప్రభుత్వ నోటీసుని సరళం చేయండి:

{document_text}

JSON లో సమాధానమివ్వండి`,
    },
    [SupportedLanguage.KANNADA]: {
      system: `ನೀವು ಭಾರತೀಯ ಸರ್ಕಾರಿ ದಸ್ತಾವೇಜುಗಳನ್ನು ಸಾಮಾನ್ಯ ಜನರಿಗೆ ಸರಳ ಪದಾಂಶಗಳಲ್ಲಿ ವಿವರಿಸುವಲ್ಲಿ ನಿಪುಣರು.
ಸರಳ ಕನ್ನಡ ಬಳಸಿ, ತಂತ್ರಞ್ಞಾನದಿಂದ ತಪ್ಪಿಸಲಾಗಿರುತ್ತದೆ.
ಏನೋ ಸ್ಪಷ್ಟವಾಗಿಲ್ಲದಿದ್ದರೆ, "ದಸ್ತಾವೇಜಿನಲ್ಲಿ ಸ್ಪಷ್ಟವಾಗಿ ಉಲ್ಲೇಖಿಸಿಲ್ಲ" ಎಂದು ಹೇಳಿ.
ಸರಿಯಾದ JSON ನಿಂದ ಸರಿಯಾಗಿ ಪ್ರತಿಕ್ರಿಯಿಸಿ.`,
      user: `ಈ ಸರ್ಕಾರಿ ನೋಟಿಸನ್ನು ಸರಳಗೊಳಿಸಿ:

{document_text}

JSON ನಲ್ಲಿ ಪ್ರತಿಕ್ರಿಯಿಸಿ`,
    },
    [SupportedLanguage.MARATHI]: {
      system: `आप भारतीय सरकारी दस्तऐवजांना सामान्य लोकांच्या दृष्टिकोनातून सोप्या शब्दांत समजावून देण्यात कुशल आहात.
सरल मराठी वापरा, तांत्रिक शब्दांचे टाळा.
काही स्पष्ट नसेल तर "दस्तऐवजात स्पष्टपणे नोंद नाही" असे सांगा.
केवळ वैध JSON मध्येच उत्तर द्या.`,
      user: `या सरकारी नोटिसाला सोपे करा:

{document_text}

JSON मध्ये उत्तर द्या`,
    },
  },
  [DocumentType.BANK_LETTER]: {
    [SupportedLanguage.ENGLISH]: {
      system: `You are an expert at explaining banking and financial documents in simple terms.
Focus on payment details, deadlines, and consequences.
Always respond with valid JSON only.`,
      user: `Simplify this bank letter:

{document_text}

Respond with JSON:
{
  "sections": {
    "what_is_this": "type of bank communication",
    "action_required": "what must be done",
    "deadlines": "payment deadlines",
    "money_matters": "amounts and fees",
    "risks_penalties": "consequences",
    "simple_explanation": "overall summary",
    "bullet_points": ["key point 1", "key point 2"],
    "examples": ["example if helpful"]
  },
  "confidence_score": 0-100,
  "source_references": [],
  "warnings": []
}`,
    },
    [SupportedLanguage.HINDI]: {
      system: `आप बैंकिंग और वित्तीय दस्तावेजों को सरल शब्दों में समझाने में विशेषज्ञ हैं।
भुगतान विवरण, समय सीमा, और परिणामों पर ध्यान दें।
केवल वैध JSON में जवाब दें।`,
      user: `इस बैंक पत्र को सरल बनाएं:

{document_text}

JSON में जवाब दें`,
    },
    [SupportedLanguage.TAMIL]: {
      system: `நீங்கள் வங்கி மற்றும் நிதி ஆவணங்களை எளிய சொற்களில் விளக்குவதில் சிறந்தவர்.
பணம் செலுத்துதல் விவரங்கள், கடைசி தேதி, மற்றும் பலன் பற்றி கவனம் செலுத்தவும்.
வெளிப்படையாக JSON மட்டுமே பதிலளிக்கவும்.`,
      user: `இந்த வங்கி கடிதத்தை எளிமையாக்குங்கள்:

{document_text}

JSON இல் பதிலளிக்கவும்`,
    },
    [SupportedLanguage.TELUGU]: {
      system: `మీరు బ్యాంకింగ్ మరియు ఆర్థిక ఆవశ్యకతలను సరళ పదాలలో వివరించడంలో నిపుణుడు.
భుగతాన విశదీకరణ, సమయ సీమ, మరియు పరిణామాలపై దృష్టి సారించండి.
కేవలం చెల్లుబాటు గల JSON మందుగా సమాధానమివ్వండి.`,
      user: `ఈ బ్యాంక్ లేఖను సరళం చేయండి:

{document_text}

JSON లో సమాధానమివ్వండి`,
    },
    [SupportedLanguage.KANNADA]: {
      system: `ನೀವು ಬ್ಯಾಂಕಿಂಗ್ ಮತ್ತು ಆರ್ಥಿಕ ಆವಶ್ಯಕತೆಗಳನ್ನು ಸರಳ ಪದಾಂಶಗಳಲ್ಲಿ ವಿವರಿಸುವಲ್ಲಿ ನಿಪುಣರು.
ಪಾವತಿ ವಿವರಗಳು, ಸಮಯ ಸೀಮೆ, ಮತ್ತು ಫಲಿತಾಂಶಗಳಿಗೆ ಗಮನ ಕೊಡಿ.
ಸರಿಯಾದ JSON ನಿಂದ ಸರಿಯಾಗಿ ಪ್ರತಿಕ್ರಿಯಿಸಿ.`,
      user: `ಈ ಬ್ಯಾಂಕ್ ಪತ್ರವನ್ನು ಸರಳಗೊಳಿಸಿ:

{document_text}

JSON ನಲ್ಲಿ ಪ್ರತಿಕ್ರಿಯಿಸಿ`,
    },
    [SupportedLanguage.MARATHI]: {
      system: `आप बँकिंग आणि आर्थिक दस्तऐवजांना सोप्या शब्दांत समजावून देण्यात कुशल आहात.
भुगतान विशिष्टता, मुदती, आणि परिणाम यांच्यावर लक्ष देणे.
केवळ वैध JSON मध्येच उत्तर द्या.`,
      user: `या बँक पत्राला सोपे करा:

{document_text}

JSON मध्ये उत्तर द्या`,
    },
  },
  // Add remaining document types...
  [DocumentType.LOAN_DOCUMENT]: {
    [SupportedLanguage.ENGLISH]: {
      system: `You are an expert at explaining loan and credit documents in simple terms.
Focus on loan amount, interest rate, repayment terms, and consequences of non-payment.
Identify risks and penalties clearly.
Always respond with valid JSON only.`,
      user: `Simplify this loan document:

{document_text}

Respond with JSON:
{
  "sections": {
    "what_is_this": "what type of loan",
    "action_required": "what must be done",
    "deadlines": "any important dates",
    "money_matters": "loan amount, interest, EMI, total amount",
    "risks_penalties": "what happens if you default",
    "simple_explanation": "overall summary",
    "bullet_points": ["key point 1", "key point 2"],
    "examples": ["example if helpful"]
  },
  "confidence_score": 0-100,
  "source_references": [],
  "warnings": []
}`,
    },
    [SupportedLanguage.HINDI]: {
      system: `आप लोन और क्रेडिट दस्तावेजों को सरल शब्दों में समझाने में विशेषज्ञ हैं।
ब्याज दर, पुनर्भुगतान अवधि, और गैर-भुगतान के परिणामों पर ध्यान दें।
जोखिम और दंड स्पष्ट रूप से पहचानें।
केवल वैध JSON में जवाब दें।`,
      user: `इस लोन दस्तावेज को सरल बनाएं:

{document_text}

JSON में जवाब दें (अंग्रेजी की तरह ही संरचना)`,
    },
    [SupportedLanguage.TAMIL]: {
      system: `நீங்கள் கடன் ஆவணங்களை எளிய சொற்களில் விளக்குவதில் சிறந்தவர்.
கடன் தொகை, வட்டி விகிதம், திரும்பிச் செலுத்தும் நிலைமை ஆகியவற்றில் கவனம் செலுத்தவும்.
ஆபத்து மற்றும் அபராதம் தெளிவாக விவரிக்கவும்.
வெளிப்படையாக JSON மட்டுமே பதிலளிக்கவும்.`,
      user: `இந்த கடன் ஆவணத்தை எளிமையாக்குங்கள்:

{document_text}

JSON இல் பதிலளிக்கவும்`,
    },
    [SupportedLanguage.TELUGU]: {
      system: `మీరు రుణ ఆవశ్యకతలను సరళ పదాలలో వివరించడంలో నిపుణుడు.
రుణ మొత్తం, వడ్డీ రేటు, తిరిగి చెల్లింపు నిబంధనలపై దృష్టి సారించండి.
ప్రమాదం మరియు జరిమానాలను స్పష్టంగా గుర్తించండి.
కేవలం చెల్లుబాటు గల JSON మందుగా సమాధానమివ్వండి.`,
      user: `ఈ రుణ ఆవశ్యకతను సరళం చేయండి:

{document_text}

JSON లో సమాధానమివ్వండి`,
    },
    [SupportedLanguage.KANNADA]: {
      system: `ನೀವು ಋಣ ದಸ್ತಾವೇಜುಗಳನ್ನು ಸರಳ ಪದಾಂಶಗಳಲ್ಲಿ ವಿವರಿಸುವಲ್ಲಿ ನಿಪುಣರು.
ಋಣದ ಮೊತ್ತ, ಬಡ್ಡಿ ದರ, ಮರುಪಾವತಿ ಷರತ್ತುಗಳಿಗೆ ಗಮನ ಕೊಡಿ.
ಅಪಾಯ ಮತ್ತು ದಂಡಗಳನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ಗುರುತಿಸಿ.
ಸರಿಯಾದ JSON ನಿಂದ ಸರಿಯಾಗಿ ಪ್ರತಿಕ್ರಿಯಿಸಿ.`,
      user: `ಈ ಋಣ ದಸ್ತಾವೇಜನ್ನು ಸರಳಗೊಳಿಸಿ:

{document_text}

JSON ನಲ್ಲಿ ಪ್ರತಿಕ್ರಿಯಿಸಿ`,
    },
    [SupportedLanguage.MARATHI]: {
      system: `आप कर्जाच्या दस्तऐवजांना सोप्या शब्दांत समजावून देण्यात कुशल आहात.
कर्जाची रक्कम, व्याजदर, परतफेड अटी यांच्यावर लक्ष देणे.
जोखीम आणि दंड स्पष्टपणे ओळखा.
केवळ वैध JSON मध्येच उत्तर द्या.`,
      user: `या कर्जाच्या दस्तऐवजाला सोपे करा:

{document_text}

JSON मध्ये उत्तर द्या`,
    },
  },
  [DocumentType.INSURANCE_DOCUMENT]: {
    [SupportedLanguage.ENGLISH]: {
      system: `You are an expert at explaining insurance policies in simple terms.
Focus on coverage, premiums, exclusions, and claims process.
Highlight what is and isn't covered clearly.
Always respond with valid JSON only.`,
      user: `Simplify this insurance document:

{document_text}

Respond with JSON:
{
  "sections": {
    "what_is_this": "type of insurance and coverage",
    "action_required": "what must be done",
    "deadlines": "premium payment dates or policy renewal",
    "money_matters": "premium amount and payment schedule",
    "risks_penalties": "consequences of non-payment or claim denial",
    "simple_explanation": "overall summary",
    "bullet_points": ["key point 1", "key point 2"],
    "examples": ["example if helpful"]
  },
  "confidence_score": 0-100,
  "source_references": [],
  "warnings": []
}`,
    },
    [SupportedLanguage.HINDI]: {
      system: `आप बीमा पॉलिसियों को सरल शब्दों में समझाने में विशेषज्ञ हैं।
कवरेज, प्रीमियम, बहिष्करण, और दावा प्रक्रिया पर ध्यान दें।
स्पष्ट करें कि क्या कवर है और क्या नहीं।
केवल वैध JSON में जवाब दें।`,
      user: `इस बीमा दस्तावेज को सरल बनाएं:

{document_text}

JSON में जवाब दें`,
    },
    [SupportedLanguage.TAMIL]: {
      system: `நீங்கள் காப்பீட்டு பாலிசிகளை எளிய சொற்களில் விளக்குவதில் சிறந்தவர்.
பாதுகாப்பு, பிரீமியம், விலக்குகள், மற்றும் கோரல் செயல்முறை பற்றி கவனம் செலுத்தவும்.
தெளிவாக சொல்லுங்கள் என்ன உள்ளடக்கம் மற்றும் என்ன இல்லை.
வெளிப்படையாக JSON மட்டுமே பதிலளிக்கவும்.`,
      user: `இந்த காப்பீட்டு ஆவணத்தை எளிமையாக்குங்கள்:

{document_text}

JSON இல் பதிலளிக்கவும்`,
    },
    [SupportedLanguage.TELUGU]: {
      system: `మీరు బీమా పాలసీలను సరళ పదాలలో వివరించడంలో నిపుణుడు.
కవరేజ్, ప్రీమియమ్, మినహాయింపులు, మరియు క్లెయిమ్ ప్రక్రియపై దృష్టి సారించండి.
స్పష్టంగా చెప్పండి ఏది కవర్ చేయబడింది మరియు ఏది కాదు.
కేవలం చెల్లుబాటు గల JSON మందుగా సమాధానమివ్వండి.`,
      user: `ఈ బీమా ఆవశ్యకతను సరళం చేయండి:

{document_text}

JSON లో సమాధానమివ్వండి`,
    },
    [SupportedLanguage.KANNADA]: {
      system: `ನೀವು ವಿಮೆ ನೀತಿಗಳನ್ನು ಸರಳ ಪದಾಂಶಗಳಲ್ಲಿ ವಿವರಿಸುವಲ್ಲಿ ನಿಪುಣರು.
ಕವರೇಜ್, ಪ್ರೀಮಿಯಮ್, ಹೊರತೆಗೆಮೆ, ಮತ್ತು ಹಕ್ಕು ಪ್ರಕ್ರಿಯೆಗೆ ಗಮನ ಕೊಡಿ.
ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳಿ ಏನು ಕವರ್ ಮಾಡಲಾಗಿದೆ ಮತ್ತು ಏನು ಇಲ್ಲ.
ಸರಿಯಾದ JSON ನಿಂದ ಸರಿಯಾಗಿ ಪ್ರತಿಕ್ರಿಯಿಸಿ.`,
      user: `ಈ ವಿಮೆ ಆವಶ್ಯಕತೆಯನ್ನು ಸರಳಗೊಳಿಸಿ:

{document_text}

JSON ನಲ್ಲಿ ಪ್ರತಿಕ್ರಿಯಿಸಿ`,
    },
    [SupportedLanguage.MARATHI]: {
      system: `आप विमा पॉलिसी दस्तऐवजांना सोप्या शब्दांत समजावून देण्यात कुशल आहात.
कव्हरेज, प्रिमियम, बहिष्करण, आणि दावा प्रक्रिया यांच्यावर लक्ष देणे.
स्पष्टपणे सांगा काय कव्हर केले आहे आणि काय नाही.
केवळ वैध JSON मध्येच उत्तर द्या.`,
      user: `या विमा दस्तऐवजाला सोपे करा:

{document_text}

JSON मध्ये उत्तर द्या`,
    },
  },
  [DocumentType.LEGAL_NOTICE]: {
    [SupportedLanguage.ENGLISH]: {
      system: `You are an expert at explaining legal notices in simple terms.
Focus on allegations, deadlines to respond, potential consequences, and required actions.
Identify legal terms and explain them in simple language.
Always respond with valid JSON only.`,
      user: `Simplify this legal notice:

{document_text}

Respond with JSON:
{
  "sections": {
    "what_is_this": "type of legal notice and allegations",
    "action_required": "what must be done",
    "deadlines": "deadline to respond",
    "money_matters": "any amount claimed or demanded",
    "risks_penalties": "potential legal consequences",
    "simple_explanation": "overall summary",
    "bullet_points": ["key point 1", "key point 2"],
    "examples": ["example if helpful"]
  },
  "confidence_score": 0-100,
  "source_references": [],
  "warnings": []
}`,
    },
    [SupportedLanguage.HINDI]: {
      system: `आप कानूनी नोटिस को सरल शब्दों में समझाने में विशेषज्ञ हैं।
आरोप, प्रतिक्रिया की समय सीमा, संभावित परिणाम, और आवश्यक कार्य पर ध्यान दें।
कानूनी शर्तों की पहचान करें और उन्हें सरल भाषा में समझाएं।
केवल वैध JSON में जवाब दें।`,
      user: `इस कानूनी नोटिस को सरल बनाएं:

{document_text}

JSON में जवाब दें`,
    },
    [SupportedLanguage.TAMIL]: {
      system: `நீங்கள் சட்ட அறிவிப்புகளை எளிய சொற்களில் விளக்குவதில் சிறந்தவர்.
குற்றச்சாட்டுகள், பதில் தரும் கடைசி தேதி, சாத்தியமான விளைவுகள், மற்றும் தேவையான நடவடிக்கை பற்றி கவனம் செலுத்தவும்.
சட்ட விதிகளை அடையாளம் கண்டு, எளிய மொழியில் விளக்குங்கள்.
வெளிப்படையாக JSON மட்டுமே பதிலளிக்கவும்.`,
      user: `இந்த சட்ட அறிவிப்பை எளிமையாக்குங்கள்:

{document_text}

JSON இல் பதிலளிக்கவும்`,
    },
    [SupportedLanguage.TELUGU]: {
      system: `మీరు చట్ట నోటీసులను సరళ పదాలలో వివరించడంలో నిపుణుడు.
ఆరోపణలు, జవాబు ఇవ్వడానికి సమయ సීమ, సంభావ్య పరిణామాలు, మరియు అవసరమైన చర్యలపై దృష్టి సారించండి.
చట్ట నిబంధనలను గుర్తించండి మరియు సరళ భాషలో వివరించండి.
కేవలం చెల్లుబాటు గల JSON మందుగా సమాధానమివ్వండి.`,
      user: `ఈ చట్ట నోటీసును సరళం చేయండి:

{document_text}

JSON లో సమాధానమివ్వండి`,
    },
    [SupportedLanguage.KANNADA]: {
      system: `ನೀವು ಕಾನೂನು ಬಿಡುವುಗಳನ್ನು ಸರಳ ಪದಾಂಶಗಳಲ್ಲಿ ವಿವರಿಸುವಲ್ಲಿ ನಿಪುಣರು.
ಆರೋಪಗಳು, ಪ್ರತಿಕ್ರಿಯೆ ನೀಡುವ ಅವಧಿ, ಸಂಭವನೀಯ ಫಲಿತಾಂಶಗಳು, ಮತ್ತು ಅವಶ್ಯಕ ಕಾರ್ಯಗಳಿಗೆ ಗಮನ ಕೊಡಿ.
ಕಾನೂನು ನಿಬಂಧನೆಗಳನ್ನು ಗುರುತಿಸಿ ಮತ್ತು ಸರಳ ಭಾಷೆಯಲ್ಲಿ ವಿವರಿಸಿ.
ಸರಿಯಾದ JSON ನಿಂದ ಸರಿಯಾಗಿ ಪ್ರತಿಕ್ರಿಯಿಸಿ.`,
      user: `ಈ ಕಾನೂನು ಬಿಡುವನ್ನು ಸರಳಗೊಳಿಸಿ:

{document_text}

JSON ನಲ್ಲಿ ಪ್ರತಿಕ್ರಿಯಿಸಿ`,
    },
    [SupportedLanguage.MARATHI]: {
      system: `आप कायदेशीर नोटिसांना सोप्या शब्दांत समजावून देण्यात कुशल आहात.
आरोप, प्रतिक्रिया देण्याची मुदत, संभावित परिणाम, आणि आवश्यक कार्य यांच्यावर लक्ष देणे.
कायदेशीर शर्तांची ओळख करा आणि सोप्या भाषेत विवरण द्या.
केवळ वैध JSON मध्येच उत्तर द्या.`,
      user: `या कायदेशीर नोटिसाला सोपे करा:

{document_text}

JSON मध्ये उत्तर द्या`,
    },
  },
  [DocumentType.ACADEMIC_DOCUMENT]: {
    [SupportedLanguage.ENGLISH]: {
      system: `You are an expert at explaining academic and educational documents.
Focus on course requirements, deadlines, grading, and key concepts.
Use simple language while maintaining accuracy.
Always respond with valid JSON only.`,
      user: `Simplify this academic document:

{document_text}

Respond with JSON:
{
  "sections": {
    "what_is_this": "course or document type",
    "action_required": "assignments or requirements",
    "deadlines": "submission dates or exam dates",
    "money_matters": "fees or charges if any",
    "risks_penalties": "consequences of not meeting requirements",
    "simple_explanation": "overall summary",
    "bullet_points": ["key point 1", "key point 2"],
    "examples": ["example if helpful"]
  },
  "confidence_score": 0-100,
  "source_references": [],
  "warnings": []
}`,
    },
    [SupportedLanguage.HINDI]: {
      system: `आप शैक्षणिक दस्तावेजों को समझाने में विशेषज्ञ हैं।
पाठ्यक्रम की आवश्यकताएं, समय सीमा, ग्रेडिंग, और मुख्य अवधारणाओं पर ध्यान दें।
सरल भाषा का उपयोग करते हुए सटीकता बनाए रखें।
केवल वैध JSON में जवाब दें।`,
      user: `इस शैक्षणिक दस्तावेज को सरल बनाएं:

{document_text}

JSON में जवाब दें`,
    },
    [SupportedLanguage.TAMIL]: {
      system: `நீங்கள் கல்வி ஆவணங்களை விளக்குவதில் சிறந்தவர்.
பாடநெறி தேவைகள், சமர்ப்பণ தேதிகள், மதிப்பெண்கள், மற்றும் முக்கிய கருத்துகள் பற்றி கவனம் செலுத்தவும்.
எளிய மொழிபயன்படுத்திக்கொண்டு துல்லியத்தை கொண்டு வாருங்கள்.
வெளிப்படையாக JSON மட்டுமே பதிலளிக்கவும்.`,
      user: `இந்த கல்வி ஆவணத்தை எளிமையாக்குங்கள்:

{document_text}

JSON இல் பதிலளிக்கவும்`,
    },
    [SupportedLanguage.TELUGU]: {
      system: `మీరు విద్యా ఆవశ్యకతలను వివరించడంలో నిపుణుడు.
కోర్సు అవసరాలు, విధానాల సమయ సీమ, శ్రేణీకరణ, మరియు ముఖ్య భావనలపై దృష్టి సారించండి.
సరళ భాష ఉపయోగించండి కానీ ఖచ్చితత్వాన్ని నిర్ధారించండి.
కేవలం చెల్లుబాటు గల JSON మందుగా సమాధానమివ్వండి.`,
      user: `ఈ విద్య ఆవశ్యకతను సరళం చేయండి:

{document_text}

JSON లో సమాధానమివ్వండి`,
    },
    [SupportedLanguage.KANNADA]: {
      system: `ನೀವು ಶೈಕ್ಷಣಿಕ ಆವಶ್ಯಕತೆಗಳನ್ನು ವಿವರಿಸುವಲ್ಲಿ ನಿಪುಣರು.
ಕೋರ್ಸ್ ಅವಶ್ಯಕತೆಗಳು, ಸಮಯ ಸೀಮೆ, ಗ್ರೇಡಿಂಗ್, ಮತ್ತು ಮುಖ್ಯ ಪರಿಕಲ್ಪನೆಗಳಿಗೆ ಗಮನ ಕೊಡಿ.
ಸರಳ ಭಾಷೆ ಬಳಸಿ ನಿಖುಂಜತೆ ಕಾಯ್ದಿರಿಸಿ.
ಸರಿಯಾದ JSON ನಿಂದ ಸರಿಯಾಗಿ ಪ್ರತಿಕ್ರಿಯಿಸಿ.`,
      user: `ಈ ಶೈಕ್ಷಣಿಕ ಆವಶ್ಯಕತೆಯನ್ನು ಸರಳಗೊಳಿಸಿ:

{document_text}

JSON ನಲ್ಲಿ ಪ್ರತಿಕ್ರಿಯಿಸಿ`,
    },
    [SupportedLanguage.MARATHI]: {
      system: `आप शैक्षणिक दस्तऐवजांची व्याख्या करण्यात कुशल आहात.
अभ्यासक्रम आवश्यकता, मुदती, ग्रेडिंग, आणि मुख्य संकल्पना यांच्यावर लक्ष देणे.
सोप्या भाषेचा उपयोग करा परंतु अचूकता कायम ठेवा.
केवळ वैध JSON मध्येच उत्तर द्या.`,
      user: `या शैक्षणिक दस्तऐवजाला सोपे करा:

{document_text}

JSON मध्ये उत्तर द्या`,
    },
  },
  [DocumentType.UNKNOWN]: {
    [SupportedLanguage.ENGLISH]: {
      system: `You are an expert document analyst.
Analyze this unknown document and extract key information.
Focus on deadlines, amounts, actions required, and risks.
If you cannot determine the document type, provide reasonable interpretation.
Always respond with valid JSON only.`,
      user: `Analyze and simplify this unknown document:

{document_text}

Respond with JSON:
{
  "sections": {
    "what_is_this": "what appears to be in this document",
    "action_required": "any actions that seem required",
    "deadlines": "any dates or deadlines mentioned",
    "money_matters": "any amounts or payments mentioned",
    "risks_penalties": "any risks or penalties mentioned",
    "simple_explanation": "overall summary of what this document is about",
    "bullet_points": ["key point 1", "key point 2"],
    "examples": ["example if helpful"]
  },
  "confidence_score": 0-100,
  "source_references": [],
  "warnings": ["Document type is unknown", "Interpretation may be incomplete"]
}`,
    },
    [SupportedLanguage.HINDI]: {
      system: `आप दस्तावेज विश्लेषण में विशेषज्ञ हैं।
इस अज्ञात दस्तावेज का विश्लेषण करें और मुख्य जानकारी निकालें।
समय सीमा, राशि, आवश्यक कार्य, और जोखिमों पर ध्यान दें।
यदि आप दस्तावेज का प्रकार निर्धारित नहीं कर सकते, तो उचित व्याख्या प्रदान करें।
केवल वैध JSON में जवाब दें।`,
      user: `इस अज्ञात दस्तावेज का विश्लेषण और सरलीकरण करें:

{document_text}

JSON में जवाब दें`,
    },
    [SupportedLanguage.TAMIL]: {
      system: `நீங்கள் ஆவணங்களை பகுப்பாய்வு செய்வதில் சிறந்தவர்.
இந்த தெரியாத ஆவணத்தை பகுப்பாய்வு செய்து முக்கிய தகவல்களை பிரித்தெடுக்கவும்.
தேதி, தொகை, தேவையான தொழிற்பாட்டு, மற்றும் ஆபத்து பற்றி கவனம் செலுத்தவும்.
ஆவணத்தின் வகை நிர்ணயிக்க முடியவில்லை என்றால், நியாயமான விளக்கம் அளிக்கவும்.
வெளிப்படையாக JSON மட்டுமே பதிலளிக்கவும்.`,
      user: `இந்த தெரியாத ஆவணத்தை பகுப்பாய்வு செய்து எளிமையாக்குங்கள்:

{document_text}

JSON இல் பதிலளிக்கவும்`,
    },
    [SupportedLanguage.TELUGU]: {
      system: `మీరు ఆవశ్యకతలను విశ్లేషించడంలో నిపుణుడు.
ఈ తెలియని ఆవశ్యకతను విశ్లేషించండి మరియు ముఖ్య సమాచారాన్ని సంగ్రహించండి.
సమయ సీమ, మొత్తాలు, అవసరమైన చర్యలు, మరియు ప్రమాదాలపై దృష్టి సారించండి.
ఆవశ్యక రకం నిర్ణయించలేకపోతే, సమంజసమైన వివరణ ప్రదానం చేయండి.
కేవలం చెల్లుబాటు గల JSON మందుగా సమాధానమివ్వండి.`,
      user: `ఈ తెలియని ఆవశ్యకతను విశ్లేషించండి:

{document_text}

JSON లో సమాధానమివ్వండి`,
    },
    [SupportedLanguage.KANNADA]: {
      system: `ನೀವು ಆವಶ್ಯಕತೆ ವಿಶ್ಲೇಷಣೆಯಲ್ಲಿ ನಿಪುಣರು.
ಈ ಅತ್ಯಕ್ಷ ಆವಶ್ಯಕತೆಯನ್ನು ವಿಶ್ಲೇಷಿಸಿ ಮತ್ತು ಮುಖ್ಯ ಮಾಹಿತಿಯನ್ನು ತೆಗೆದುಕೊಳ್ಳಿ.
ಸಮಯ ಸೀಮೆ, ಮೊತ್ತಗಳು, ಅವಶ್ಯಕ ಕಾರ್ಯಗಳು, ಮತ್ತು ಪ್ರಮಾದಗಳಿಗೆ ಗಮನ ಕೊಡಿ.
ಆವಶ್ಯಕತೆ ವಿಧಾನವನ್ನು ನಿರ್ಧರಿಸಲು ಸಾಧ್ಯವಾಗದಿದ್ದರೆ, ಸಮಂಜಸ ವ್ಯಾಖ್ಯಾನವನ್ನು ನೀಡಿ.
ಸರಿಯಾದ JSON ನಿಂದ ಸರಿಯಾಗಿ ಪ್ರತಿಕ್ರಿಯಿಸಿ.`,
      user: `ಈ ಅತ್ಯಕ್ಷ ಆವಶ್ಯಕತೆಯನ್ನು ವಿಶ್ಲೇಷಿಸಿ:

{document_text}

JSON ನಲ್ಲಿ ಪ್ರತಿಕ್ರಿಯಿಸಿ`,
    },
    [SupportedLanguage.MARATHI]: {
      system: `आप दस्तऐवज विश्लेषणात कुशल आहात.
या अज्ञात दस्तऐवजाचे विश्लेषण करा आणि मुख्य माहिती निर्माण करा.
मुदती, रक्कम, आवश्यक कार्य, आणि जोखीम यांच्यावर लक्ष देणे.
दस्तऐवजचा प्रकार ठरवू शकत नाहीत तर वाजवी व्याख्या द्या.
केवळ वैध JSON मध्येच उत्तर द्या.`,
      user: `या अज्ञात दस्तऐवजाचे विश्लेषण करा:

{document_text}

JSON मध्ये उत्तर द्या`,
    },
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
export function getLLMService(provider?: 'openai' | 'anthropic' | 'google' | 'groq'): LLMService {
  return new LLMService(provider);
}
