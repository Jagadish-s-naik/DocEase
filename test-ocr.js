#!/usr/bin/env node

/**
 * Quick OCR test - Verify the cloud OCR fallback works
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testOCRService() {
  console.log('🧪 Testing OCR.space Cloud API...\n');

  // Create a simple test image buffer (1x1 transparent PNG)
  const testImageBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
  ]);

  const testImagePath = path.join(__dirname, 'test-image.png');
  fs.writeFileSync(testImagePath, testImageBuffer);
  console.log('✓ Created test image:', testImagePath);

  try {
    // Test OCR.space API
    const formData = new FormData();
    formData.append('filename', 'test.png');
    formData.append('apikey', 'K87899142372222');
    formData.append('isOverlayRequired', 'false');
    formData.append('file', fs.createReadStream(testImagePath));

    console.log('\n📤 Sending image to OCR.space API...');
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.error('❌ API returned status:', response.status);
      process.exit(1);
    }

    const data = await response.json();
    console.log('✓ API Response received');

    if (data.IsErroredOnProcessing) {
      console.log('⚠️  OCR.space error:', data.ErrorMessage);
    } else {
      console.log('✓ OCR.space API working');
      console.log('  - Parsed Text:', data.ParsedText ? data.ParsedText.substring(0, 100) : '(empty)');
      console.log('  - Language:', data.DetectedLanguage || 'unknown');
    }

    // Cleanup
    fs.unlinkSync(testImagePath);
    console.log('\n✅ OCR.space cloud API test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    process.exit(1);
  }
}

testOCRService();
