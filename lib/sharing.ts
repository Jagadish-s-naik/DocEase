// ============================================
// SHARING UTILITIES
// WhatsApp, Email, Print, Copy functions
// ============================================

// ============================================
// SHARE VIA WHATSAPP
// ============================================
export function shareViaWhatsApp(text: string, url?: string) {
  const message = url ? `${text}\n\n${url}` : text;
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
  
  window.open(whatsappUrl, '_blank');
}

// ============================================
// SHARE VIA EMAIL
// ============================================
export function shareViaEmail(subject: string, body: string, recipient?: string) {
  const mailtoUrl = `mailto:${recipient || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailtoUrl;
}

// ============================================
// PRINT DOCUMENT
// ============================================
export function printContent(elementId: string) {
  const printWindow = window.open('', '_blank');
  const element = document.getElementById(elementId);
  
  if (!element || !printWindow) {
    alert('Unable to print. Please try again.');
    return;
  }

  const styles = `
    <style>
      @media print {
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          padding: 20px;
        }
        h1, h2, h3 {
          color: #2563eb;
          margin-top: 20px;
        }
        .no-print {
          display: none !important;
        }
        @page {
          margin: 2cm;
        }
      }
    </style>
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>DocEase - Document Result</title>
        ${styles}
      </head>
      <body>
        ${element.innerHTML}
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
    </html>
  `);
  
  printWindow.document.close();
}

// ============================================
// COPY TO CLIPBOARD
// ============================================
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (err) {
      document.body.removeChild(textArea);
      return false;
    }
  }
}

// ============================================
// DOWNLOAD AS TEXT FILE
// ============================================
export function downloadAsTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================
// DOWNLOAD AS PDF
// ============================================
export function downloadAsPDF(elementId: string, filename: string) {
  // This requires a library like jsPDF or html2pdf.js
  // For now, use browser's print to PDF
  printContent(elementId);
  alert('Please use your browser\'s "Print to PDF" option to save as PDF');
}

// ============================================
// SHARE VIA NATIVE SHARE API
// ============================================
export async function nativeShare(data: ShareData): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share(data);
      return true;
    } catch (error) {
      console.error('Native share failed:', error);
      return false;
    }
  }
  return false;
}

// ============================================
// GENERATE SHAREABLE LINK
// ============================================
export async function generateShareableLink(documentId: string): Promise<string | null> {
  try {
    const response = await fetch('/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId }),
    });

    const data = await response.json();
    
    if (data.success) {
      return `${window.location.origin}/share/${data.shareToken}`;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to generate shareable link:', error);
    return null;
  }
}
