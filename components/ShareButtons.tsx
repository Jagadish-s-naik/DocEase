'use client';

// ============================================
// SHARE BUTTONS COMPONENT
// UI for sharing results via multiple channels
// ============================================

import { useState } from 'react';
import {
  shareViaWhatsApp,
  shareViaEmail,
  printContent,
  copyToClipboard,
  downloadAsTextFile,
  nativeShare,
} from '@/lib/sharing';

interface ShareButtonsProps {
  resultId: string;
  fileName: string;
  simplifiedText: string;
  summary?: string;
}

export default function ShareButtons({
  resultId,
  fileName,
  simplifiedText,
  summary,
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const resultUrl = `${window.location.origin}/results/${resultId}`;

  const handleWhatsAppShare = () => {
    const message = `📄 ${fileName}\n\n${summary || simplifiedText.slice(0, 200)}...\n\nView full result:`;
    shareViaWhatsApp(message, resultUrl);
  };

  const handleEmailShare = () => {
    const subject = `DocEase Result: ${fileName}`;
    const body = `Hi,\n\nHere's a simplified document I processed with DocEase:\n\n${summary || simplifiedText.slice(0, 300)}...\n\nView the full result here: ${resultUrl}\n\nBest regards`;
    shareViaEmail(subject, body);
  };

  const handlePrint = () => {
    printContent('result-content');
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(simplifiedText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    downloadAsTextFile(
      `${fileName}\n\nSimplified Text:\n${simplifiedText}\n\n${summary ? `Summary:\n${summary}` : ''}`,
      `${fileName.replace(/\.[^/.]+$/, '')}-simplified.txt`
    );
  };

  const handleNativeShare = async () => {
    const success = await nativeShare({
      title: `DocEase: ${fileName}`,
      text: summary || simplifiedText.slice(0, 200),
      url: resultUrl,
    });

    if (!success) {
      // Fallback to custom share menu
      setShowMenu(true);
    }
  };

  return (
    <div className="relative">
      {/* Main Share Button */}
      <button
        onClick={handleNativeShare}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Share
      </button>

      {/* Share Menu */}
      {showMenu && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border z-10">
          <div className="p-2">
            {/* WhatsApp */}
            <button
              onClick={() => {
                handleWhatsAppShare();
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 rounded-lg transition"
            >
              <span className="text-2xl">💬</span>
              <span className="font-medium">Share via WhatsApp</span>
            </button>

            {/* Email */}
            <button
              onClick={() => {
                handleEmailShare();
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 rounded-lg transition"
            >
              <span className="text-2xl">📧</span>
              <span className="font-medium">Share via Email</span>
            </button>

            {/* Copy */}
            <button
              onClick={() => {
                handleCopy();
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 rounded-lg transition"
            >
              <span className="text-2xl">{copied ? '✅' : '📋'}</span>
              <span className="font-medium">{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>

            {/* Download */}
            <button
              onClick={() => {
                handleDownload();
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 rounded-lg transition"
            >
              <span className="text-2xl">💾</span>
              <span className="font-medium">Download as TXT</span>
            </button>

            {/* Print */}
            <button
              onClick={() => {
                handlePrint();
                setShowMenu(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 rounded-lg transition"
            >
              <span className="text-2xl">🖨️</span>
              <span className="font-medium">Print</span>
            </button>
          </div>

          {/* Close Button */}
          <div className="border-t p-2">
            <button
              onClick={() => setShowMenu(false)}
              className="w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}
