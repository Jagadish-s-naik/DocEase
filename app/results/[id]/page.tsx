'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase';
import { Document, DocumentResult, SimplifiedContent } from '@/types';
import { 
  ArrowLeft, 
  FileText, 
  Calendar, 
  DollarSign, 
  AlertTriangle,
  CheckCircle,
  Languages,
  Download,
  Share2,
  Copy,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { formatDate } from '@/utils/helpers';

export default function ResultsPage({ params }: { params: { id: string } }) {
  const { user, loading: authLoading } = useAuth();
  const [document, setDocument] = useState<Document | null>(null);
  const [result, setResult] = useState<DocumentResult | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchDocumentAndResult();
    }
  }, [user, params.id]);

  const fetchDocumentAndResult = async () => {
    if (!user) return;

    try {
      // Fetch document
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single();

      if (docError) throw docError;
      setDocument(docData);

      // Fetch result if completed
      if ((docData as any).processing_status === 'completed') {
        const { data: resultData, error: resultError } = await supabase
          .from('document_results')
          .select('*')
          .eq('document_id', params.id)
          .single();

        if (resultError) throw resultError;
        setResult(resultData);
      }
    } catch (error: any) {
      console.error('Error fetching document:', error);
      toast.error('Failed to load document');
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleDownload = () => {
    if (!result || !simplified) {
      toast.error('No results to download');
      return;
    }

    try {
      // Create downloadable content
      let content = `Document: ${document?.file_name}\n`;
      content += `Processed: ${formatDate(result.created_at)}\n`;
      content += `Document Type: ${result.document_type}\n\n`;
      content += `=== SIMPLIFIED VERSION ===\n\n`;
      
      if (simplified.sections.what_is_this) {
        content += `What is this?\n${simplified.sections.what_is_this}\n\n`;
      }
      
      if (simplified.sections.action_required) {
        content += `Action Required:\n${simplified.sections.action_required}\n\n`;
      }
      
      if (simplified.sections.deadlines) {
        content += `Important Deadlines:\n${simplified.sections.deadlines}\n\n`;
      }
      
      if (simplified.sections.money_matters) {
        content += `Money Matters:\n${simplified.sections.money_matters}\n\n`;
      }
      
      if (simplified.sections.risks_penalties) {
        content += `Risks & Penalties:\n${simplified.sections.risks_penalties}\n\n`;
      }
      
      // Use bullet_points instead of key_points
      if (simplified.sections.bullet_points && simplified.sections.bullet_points.length > 0) {
        content += `Key Points:\n`;
        simplified.sections.bullet_points.forEach((point: string, i: number) => {
          content += `${i + 1}. ${point}\n`;
        });
        content += `\n`;
      }
      
      // Use examples instead of what_to_do_next
      if (simplified.sections.examples && simplified.sections.examples.length > 0) {
        content += `Examples:\n`;
        simplified.sections.examples.forEach((step: string, i: number) => {
          content += `${i + 1}. ${step}\n`;
        });
      }

      // Create blob and download
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      if (typeof window !== 'undefined' && window.document) {
        const a = window.document.createElement('a');
        a.href = url;
        a.download = `${document?.file_name.replace(/\.[^/.]+$/, '')}_simplified.txt`;
        window.document.body.appendChild(a);
        a.click();
        window.document.body.removeChild(a);
      }
      
      URL.revokeObjectURL(url);
      
      toast.success('Downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download');
    }
  };

  const handleShare = () => {
    // TODO: Implement WhatsApp/Email share
    toast.success('Share feature coming soon!');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Document not found</h3>
          <Link href="/dashboard" className="text-primary-600 hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const simplified = result?.simplified_content as SimplifiedContent || null;
  const translations = result?.translations as Record<string, any> || {};
  const currentContent = selectedLanguage === 'en' ? simplified : translations[selectedLanguage];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </Link>
            <h1 className="text-xl font-bold text-primary-600">DocEase</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Document Info */}
        <div className="card mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">{document.file_name}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="capitalize">{document.document_type?.replace('_', ' ')}</span>
                  <span>•</span>
                  <span>{formatDate(document.created_at)}</span>
                  {document.ocr_confidence && (
                    <>
                      <span>•</span>
                      <span>OCR Confidence: {document.ocr_confidence}%</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Download PDF"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={handleShare}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Share"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Status */}
          {document.processing_status !== 'completed' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-yellow-600 animate-spin" />
                <div>
                  <p className="font-semibold text-yellow-900">Processing...</p>
                  <p className="text-sm text-yellow-800">
                    Status: {document.processing_status.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {result && simplified && (
          <>
            {/* Language Selector */}
            <div className="card mb-6">
              <div className="flex items-center gap-4">
                <Languages className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Select Language:</span>
                <div className="flex gap-2 flex-wrap">
                  {['en', 'hi', 'ta', 'te', 'kn', 'mr'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSelectedLanguage(lang)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedLanguage === lang
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {lang === 'en' ? 'English' : 
                       lang === 'hi' ? 'हिंदी' :
                       lang === 'ta' ? 'தமிழ்' :
                       lang === 'te' ? 'తెలుగు' :
                       lang === 'kn' ? 'ಕನ್ನಡ' : 'मराठी'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Intent Analysis Cards */}
            {result.intent_analysis && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="card">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className={`w-5 h-5 ${
                      result.intent_analysis.urgency === 'high' ? 'text-red-600' :
                      result.intent_analysis.urgency === 'medium' ? 'text-yellow-600' : 'text-green-600'
                    }`} />
                    <span className="text-sm font-medium text-gray-700">Urgency</span>
                  </div>
                  <p className="text-2xl font-bold capitalize">
                    {result.intent_analysis.urgency || 'Low'}
                  </p>
                </div>

                <div className="card">
                  <div className="flex items-center gap-3 mb-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-700">Money Involved</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {(result.intent_analysis as any).money_amount || 'None'}
                  </p>
                </div>

                <div className="card">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-5 h-5 text-primary-600" />
                    <span className="text-sm font-medium text-gray-700">Deadline</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {result.intent_analysis.deadline || 'No deadline'}
                  </p>
                </div>
              </div>
            )}

            {/* Simplified Content */}
            <div className="space-y-6">
              {/* What is this about */}
              {currentContent?.what_is_this_about && (
                <div className="card">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-primary-600" />
                      What is this about?
                    </h3>
                    <button
                      onClick={() => handleCopyText(currentContent.what_is_this_about)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-gray-700 text-base-accessible leading-relaxed">
                    {currentContent.what_is_this_about}
                  </p>
                </div>
              )}

              {/* Action Required */}
              {currentContent?.action_required && (
                <div className="card bg-blue-50 border border-blue-200">
                  <h3 className="text-lg font-bold text-blue-900 mb-3">Action Required</h3>
                  <p className="text-blue-800 text-base-accessible leading-relaxed">
                    {currentContent.action_required}
                  </p>
                </div>
              )}

              {/* Important Deadlines */}
              {currentContent?.important_deadlines && (
                <div className="card bg-yellow-50 border border-yellow-200">
                  <h3 className="text-lg font-bold text-yellow-900 mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Important Deadlines
                  </h3>
                  <p className="text-yellow-800 text-base-accessible leading-relaxed">
                    {currentContent.important_deadlines}
                  </p>
                </div>
              )}

              {/* Money Involved */}
              {currentContent?.money_involved && (
                <div className="card bg-green-50 border border-green-200">
                  <h3 className="text-lg font-bold text-green-900 mb-3 flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Money Involved
                  </h3>
                  <p className="text-green-800 text-base-accessible leading-relaxed">
                    {currentContent.money_involved}
                  </p>
                </div>
              )}

              {/* Risks */}
              {currentContent?.risks_if_ignored && (
                <div className="card bg-red-50 border border-red-200">
                  <h3 className="text-lg font-bold text-red-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    What Happens If You Ignore This?
                  </h3>
                  <p className="text-red-800 text-base-accessible leading-relaxed">
                    {currentContent.risks_if_ignored}
                  </p>
                </div>
              )}

              {/* Simple Explanation */}
              {currentContent?.simple_explanation && (
                <div className="card">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Simple Explanation</h3>
                  <p className="text-gray-700 text-base-accessible leading-relaxed whitespace-pre-line">
                    {currentContent.simple_explanation}
                  </p>
                </div>
              )}

              {/* Key Bullet Points */}
              {currentContent?.key_points && currentContent.key_points.length > 0 && (
                <div className="card">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Key Points</h3>
                  <ul className="space-y-2">
                    {currentContent.key_points.map((point: string, index: number) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 text-base-accessible">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Examples */}
              {currentContent?.examples && (
                <div className="card bg-purple-50 border border-purple-200">
                  <h3 className="text-lg font-bold text-purple-900 mb-3">Examples</h3>
                  <p className="text-purple-800 text-base-accessible leading-relaxed whitespace-pre-line">
                    {currentContent.examples}
                  </p>
                </div>
              )}

              {/* Disclaimer */}
              <div className="card bg-gray-50 border border-gray-300">
                <p className="text-sm text-gray-600">
                  <strong>Disclaimer:</strong> This is an AI-generated simplification for educational purposes.
                  For legal or financial decisions, please consult a qualified professional.
                  Always refer to the original document for official information.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Back Button */}
        <div className="mt-8">
          <Link
            href="/dashboard"
            className="btn-secondary inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
