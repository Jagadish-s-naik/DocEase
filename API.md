# DocEase API Documentation

## Overview

DocEase provides a RESTful API for document processing and management. All endpoints require authentication unless otherwise noted.

**Base URL:** `https://your-domain.com/api`

---

## Authentication

All authenticated endpoints require a valid session token from Supabase Auth.

### Headers
```
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

---

## Endpoints

### 1. Upload Document

Upload a new document for processing.

**Endpoint:** `POST /api/upload`

**Authentication:** Required

**Content-Type:** `multipart/form-data`

**Request:**
```
FormData:
  file: File (PDF, JPG, PNG)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "fileName": "document.pdf",
    "fileSize": 1024000,
    "uploadedAt": "2026-02-06T10:30:00Z"
  },
  "message": "File uploaded successfully"
}
```

**Errors:**
- `401` - Not authenticated
- `400` - Invalid file type/size
- `429` - Usage limit exceeded
- `500` - Upload failed

**Example:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

const result = await response.json();
```

---

### 2. Process Document

Trigger OCR and AI processing for an uploaded document.

**Endpoint:** `POST /api/process`

**Authentication:** Required

**Request:**
```json
{
  "documentId": "uuid",
  "targetLanguages": ["en", "hi", "ta"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "status": "processing",
    "estimatedTime": 30000
  },
  "message": "Document processing started"
}
```

**Errors:**
- `401` - Not authenticated
- `404` - Document not found
- `400` - Already processing or invalid request
- `500` - Processing failed

**Example:**
```javascript
const response = await fetch('/api/process', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    documentId: 'abc-123',
    targetLanguages: ['en', 'hi']
  })
});
```

---

### 3. Get Processing Status

Check the status of document processing.

**Endpoint:** `GET /api/process?documentId={id}`

**Authentication:** Required

**Parameters:**
- `documentId` (required): UUID of the document

**Response:**
```json
{
  "success": true,
  "data": {
    "documentId": "uuid",
    "status": "completed",
    "ocrConfidence": 95.5,
    "documentType": "government_notice",
    "languageDetected": "eng",
    "result": {
      "id": "result-uuid",
      "extractedText": "Full extracted text...",
      "documentType": "government_notice",
      "classificationConfidence": 98.2,
      "intentAnalysis": {
        "actionRequired": true,
        "deadline": "2026-03-01",
        "moneyInvolved": 1000,
        "currency": "INR",
        "penaltyRisk": "high",
        "urgency": "critical",
        "summary": "Tax payment due by March 1st"
      },
      "simplifiedContent": {
        "language": "en",
        "sections": {
          "whatIsThis": "This is a tax payment notice...",
          "actionRequired": "You must pay ₹1000 by March 1st...",
          "deadlines": "March 1, 2026",
          "moneyMatters": "₹1000 tax payment + ₹500 penalty if late",
          "risksPenalties": "Late payment penalty of ₹500...",
          "simpleExplanation": "You owe tax. Pay by March 1...",
          "bulletPoints": [
            "Tax amount: ₹1000",
            "Due date: March 1, 2026",
            "Late fee: ₹500"
          ],
          "examples": []
        },
        "confidenceScore": 92,
        "sourceReferences": [],
        "disclaimers": [
          "This is a simplified explanation and not legal advice."
        ]
      },
      "translations": {
        "hi": { /* Hindi translation */ },
        "ta": { /* Tamil translation */ }
      },
      "metadata": {
        "processingTimeMs": 25000,
        "ocrEngine": "tesseract",
        "llmModel": "gpt-4",
        "warnings": [],
        "qualityScore": 94
      }
    }
  }
}
```

**Processing Statuses:**
- `queued` - Waiting to process
- `ocr_in_progress` - Extracting text
- `classification_in_progress` - Detecting document type
- `simplification_in_progress` - Generating explanation
- `translation_in_progress` - Translating
- `completed` - Done
- `failed` - Error occurred

---

### 4. Get Upload Limits

Check current usage and limits.

**Endpoint:** `GET /api/upload`

**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "data": {
    "isPaid": false,
    "limit": 3,
    "used": 1,
    "remaining": 2,
    "canUpload": true,
    "maxFileSize": 10,
    "allowedTypes": ["pdf", "jpg", "jpeg", "png"]
  }
}
```

---

### 5. Stripe Webhook

Handle Stripe payment events (internal use).

**Endpoint:** `POST /api/webhooks/stripe`

**Authentication:** Stripe signature verification

**Headers:**
```
stripe-signature: t=timestamp,v1=signature
```

**Events Handled:**
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

**Response:**
```json
{
  "success": true,
  "data": {
    "received": true
  }
}
```

---

## Data Models

### Document
```typescript
{
  id: string;
  userId: string;
  fileName: string;
  fileSize: number; // bytes
  fileType: string; // mime type
  fileUrl: string;
  storagePath: string;
  encrypted: boolean;
  pageCount: number;
  uploadStatus: "pending" | "uploading" | "completed" | "failed";
  processingStatus: "queued" | "ocr_in_progress" | ... | "completed" | "failed";
  ocrConfidence: number | null; // 0-100
  documentType: "government_notice" | "bank_letter" | ... | null;
  languageDetected: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string;
  expiresAt: string | null;
}
```

### Intent Analysis
```typescript
{
  actionRequired: boolean;
  deadline: string | null; // YYYY-MM-DD
  moneyInvolved: number | null;
  currency: string | null; // INR, USD, etc.
  penaltyRisk: "none" | "low" | "medium" | "high";
  urgency: "low" | "medium" | "high" | "critical";
  summary: string;
}
```

### Simplified Content
```typescript
{
  language: "en" | "hi" | "ta" | "te" | "kn" | "mr";
  sections: {
    whatIsThis: string;
    actionRequired: string;
    deadlines: string;
    moneyMatters: string;
    risksPenalties: string;
    simpleExplanation: string;
    bulletPoints: string[];
    examples: string[];
  };
  confidenceScore: number; // 0-100
  sourceReferences: Array<{
    section: string;
    originalText: string;
    pageNumber: number | null;
    confidence: number;
  }>;
  disclaimers: string[];
}
```

---

## Error Codes

| Code | Error | Description |
|------|-------|-------------|
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Access denied |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input |
| `UPLOAD_FAILED` | 500 | File upload error |
| `OCR_FAILED` | 500 | Text extraction error |
| `CLASSIFICATION_FAILED` | 500 | Document type detection error |
| `SIMPLIFICATION_FAILED` | 500 | AI simplification error |
| `TRANSLATION_FAILED` | 500 | Translation error |
| `PAYMENT_FAILED` | 500 | Payment processing error |
| `LIMIT_EXCEEDED` | 429 | Usage quota exceeded |
| `SERVER_ERROR` | 500 | Internal server error |

**Error Response Format:**
```json
{
  "success": false,
  "error": "Error message here",
  "statusCode": 400
}
```

---

## Rate Limits

- **Authenticated users:** 20 requests/minute
- **Guest users:** 10 requests/minute
- **File uploads:** 5 files/minute
- **Processing:** 3 concurrent processes per user

Exceeding limits returns `429 Too Many Requests`.

---

## File Upload Limits

- **Max file size:** 10 MB
- **Max pages:** 50 pages per document
- **Allowed types:** PDF, JPG, JPEG, PNG
- **Free users:** 3 documents/month
- **Paid users:** Unlimited

---

## Processing Time

Typical processing times:
- **1-page document:** 10-20 seconds
- **5-page document:** 30-60 seconds
- **10-page document:** 60-120 seconds

Includes: OCR + Classification + Simplification + Translation

---

## Webhooks (Future)

DocEase can send webhooks for:
- Document processing completed
- Processing failed
- Subscription created/cancelled

**Format:**
```json
{
  "event": "document.processing.completed",
  "data": {
    "documentId": "uuid",
    "userId": "uuid",
    "timestamp": "2026-02-06T10:30:00Z"
  }
}
```

---

## SDK (Future)

JavaScript/TypeScript SDK coming soon:

```typescript
import { DocEase } from '@docease/sdk';

const docease = new DocEase(apiKey);

// Upload
const doc = await docease.upload(file);

// Process
await docease.process(doc.id, { languages: ['en', 'hi'] });

// Get result
const result = await docease.getResult(doc.id);
```

---

## Support

- **API Issues:** support@docease.com
- **Documentation:** https://docs.docease.com
- **Status:** https://status.docease.com

---

**Last Updated:** February 6, 2026
**API Version:** 1.0
