import { SupportedLanguage, DocumentType, PlanType } from '@/types';

// ============================================
// APPLICATION CONSTANTS
// ============================================

export const APP_NAME = 'DocEase';
export const APP_DESCRIPTION = 'AI Document Simplifier for Common People';
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ============================================
// FEATURE FLAGS
// ============================================

export const FEATURES = {
  GUEST_MODE: process.env.ENABLE_GUEST_MODE === 'true',
  AUTO_DELETE: process.env.ENABLE_AUTO_DELETE === 'true',
  ANALYTICS: process.env.ENABLE_ANALYTICS === 'true',
  MALWARE_SCAN: process.env.ENABLE_MALWARE_SCAN === 'true',
} as const;

// ============================================
// FILE UPLOAD LIMITS
// ============================================

export const FILE_LIMITS = {
  MAX_SIZE_BYTES: parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024,
  MAX_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || '10'),
  MAX_PAGES: parseInt(process.env.MAX_PAGES_PER_DOCUMENT || '50'),
  ALLOWED_TYPES: (process.env.ALLOWED_FILE_TYPES || 'pdf,jpg,jpeg,png').split(','),
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ],
} as const;

// ============================================
// USAGE LIMITS
// ============================================

export const USAGE_LIMITS = {
  FREE: parseInt(process.env.FREE_TIER_DOCUMENT_LIMIT || '3'),
  PAID: parseInt(process.env.PAID_TIER_DOCUMENT_LIMIT || '999999'),
} as const;

// ============================================
// RATE LIMITING
// ============================================

export const RATE_LIMITS = {
  PER_MINUTE: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '20'),
  WINDOW_MS: 60 * 1000, // 1 minute
} as const;

// ============================================
// SUPPORTED LANGUAGES
// ============================================

export const LANGUAGES = {
  [SupportedLanguage.ENGLISH]: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇬🇧',
  },
  [SupportedLanguage.HINDI]: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिंदी',
    flag: '🇮🇳',
  },
  [SupportedLanguage.TAMIL]: {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    flag: '🇮🇳',
  },
  [SupportedLanguage.TELUGU]: {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    flag: '🇮🇳',
  },
  [SupportedLanguage.KANNADA]: {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    flag: '🇮🇳',
  },
  [SupportedLanguage.MARATHI]: {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    flag: '🇮🇳',
  },
} as const;

// ============================================
// DOCUMENT TYPES
// ============================================

export const DOCUMENT_TYPES = {
  [DocumentType.GOVERNMENT_NOTICE]: {
    label: 'Government Notice',
    icon: '🏛️',
    color: 'blue',
  },
  [DocumentType.BANK_LETTER]: {
    label: 'Bank Letter',
    icon: '🏦',
    color: 'green',
  },
  [DocumentType.LOAN_DOCUMENT]: {
    label: 'Loan Document',
    icon: '💰',
    color: 'yellow',
  },
  [DocumentType.INSURANCE_DOCUMENT]: {
    label: 'Insurance Document',
    icon: '🛡️',
    color: 'purple',
  },
  [DocumentType.LEGAL_NOTICE]: {
    label: 'Legal Notice',
    icon: '⚖️',
    color: 'red',
  },
  [DocumentType.ACADEMIC_DOCUMENT]: {
    label: 'Academic Document',
    icon: '🎓',
    color: 'indigo',
  },
  [DocumentType.UNKNOWN]: {
    label: 'Unknown',
    icon: '📄',
    color: 'gray',
  },
} as const;

// ============================================
// SUBSCRIPTION PLANS
// ============================================

export const SUBSCRIPTION_PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    currency: 'INR',
    interval: 'month',
    features: [
      '3 documents per month',
      'All languages supported',
      'Basic explanations',
      'No history storage',
    ],
    limits: {
      documents: USAGE_LIMITS.FREE,
      history: false,
      priority: false,
    },
  },
  PAID: {
    name: 'Premium',
    price: 99,
    currency: 'INR',
    interval: 'month',
    features: [
      'Unlimited documents',
      'All languages supported',
      'Detailed explanations',
      'Full history & search',
      'Priority processing',
      'Download PDFs',
      'Share via WhatsApp/Email',
    ],
    limits: {
      documents: USAGE_LIMITS.PAID,
      history: true,
      priority: true,
    },
    stripePriceId: process.env.STRIPE_PRICE_ID_MONTHLY,
  },
} as const;

// ============================================
// OCR CONFIGURATION
// ============================================

export const OCR_CONFIG = {
  DEFAULT_LANGUAGE: 'eng',
  SUPPORTED_LANGUAGES: ['eng', 'hin', 'tam', 'tel', 'kan', 'mar'],
  CONFIDENCE_THRESHOLD: 60, // Minimum confidence %
  PREPROCESS: true,
  AUTO_ROTATE: true,
  DENOISE: true,
} as const;

// ============================================
// LLM CONFIGURATION
// ============================================

export const LLM_CONFIG = {
  PROVIDER: 'openai',
  MODEL: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
  TEMPERATURE: 0.3, // Lower for more consistent output
  TIMEOUT_MS: 30000, // 30 seconds
} as const;

// ============================================
// ENCRYPTION
// ============================================

export const ENCRYPTION = {
  ALGORITHM: 'aes-256-cbc',
  KEY: process.env.ENCRYPTION_KEY || '',
  IV: process.env.ENCRYPTION_IV || '',
} as const;

// ============================================
// VALIDATION MESSAGES
// ============================================

export const VALIDATION_MESSAGES = {
  FILE_TOO_LARGE: `File size must be less than ${FILE_LIMITS.MAX_SIZE_MB}MB`,
  INVALID_FILE_TYPE: `Only ${FILE_LIMITS.ALLOWED_TYPES.join(', ')} files are allowed`,
  TOO_MANY_PAGES: `Document must have less than ${FILE_LIMITS.MAX_PAGES} pages`,
  LIMIT_EXCEEDED: 'You have reached your monthly document limit',
  INVALID_DOCUMENT: 'Invalid or corrupted document',
  PROCESSING_FAILED: 'Failed to process document. Please try again.',
} as const;

// ============================================
// UI CONSTANTS
// ============================================

export const UI = {
  DEBOUNCE_DELAY: 300,
  TOAST_DURATION: 5000,
  ANIMATION_DURATION: 200,
  MAX_MOBILE_WIDTH: 768,
} as const;

// ============================================
// ADMIN
// ============================================

export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').filter(Boolean);

// ============================================
// GUEST MODE
// ============================================

export const GUEST_CONFIG = {
  ENABLED: FEATURES.GUEST_MODE,
  EXPIRY_DAYS: 7,
  DOCUMENT_LIMIT: 3,
} as const;

// ============================================
// EXPORT ALL
// ============================================

export const CONFIG = {
  APP_NAME,
  APP_DESCRIPTION,
  APP_URL,
  FEATURES,
  FILE_LIMITS,
  USAGE_LIMITS,
  RATE_LIMITS,
  LANGUAGES,
  DOCUMENT_TYPES,
  SUBSCRIPTION_PLANS,
  OCR_CONFIG,
  LLM_CONFIG,
  ENCRYPTION,
  VALIDATION_MESSAGES,
  UI,
  ADMIN_EMAILS,
  GUEST_CONFIG,
} as const;
