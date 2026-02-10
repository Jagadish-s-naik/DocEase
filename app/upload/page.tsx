'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { FileUpload } from '@/components/FileUpload';
import Navigation from '@/components/Navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function UploadPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    console.log('Upload page - Auth state:', { user: !!user, authLoading });
    
    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      setCheckingAuth(false);
    }, 3000);

    if (!authLoading) {
      setCheckingAuth(false);
      clearTimeout(timeout);
      
      if (!user) {
        toast.error('Please login to upload documents');
        router.push('/auth');
      }
    }

    return () => clearTimeout(timeout);
  }, [user, authLoading, router]);

  const handleFileSelect = async (file: File) => {
    if (!user) {
      toast.error('Please login to upload documents');
      router.push('/auth');
      return;
    }

    setUploading(true);

    try {
      // Upload file
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || 'Upload failed');
      }

      const { documentId } = await uploadResponse.json();
      toast.success('File uploaded successfully!');

      // Start processing
      setUploading(false);
      setProcessing(true);

      const processResponse = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        console.error('Processing API error:', errorData);
        throw new Error(errorData.error || 'Processing failed to start');
      }

      toast.success('Processing started! Redirecting to dashboard...');
      
      // Redirect to dashboard to see processing status
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);

    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload document');
      setUploading(false);
      setProcessing(false);
    }
  };

  // Show loading while checking auth
  if (authLoading && checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Don't render upload page if not authenticated (will redirect)
  if (!user && !authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      {/* Upload Section */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Upload Your Document
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Upload government forms, legal documents, insurance papers, or any complex document.
            We'll simplify it into easy-to-understand language in just a few seconds.
          </p>
        </div>

        {/* File Upload Component */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {uploading || processing ? (
            <div className="text-center py-16">
              <Loader2 className="w-16 h-16 text-primary-600 animate-spin mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">
                {uploading ? 'Uploading...' : 'Starting Processing...'}
              </h3>
              <p className="text-gray-600">
                {uploading 
                  ? 'Please wait while we upload your document' 
                  : 'Initializing AI processing pipeline'}
              </p>
            </div>
          ) : (
            <FileUpload onFileSelect={handleFileSelect} />
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="text-primary-600 font-semibold mb-2">✓ OCR Technology</div>
            <p className="text-sm text-gray-600">
              Automatically extract text from scanned documents and images
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="text-primary-600 font-semibold mb-2">✓ AI Simplification</div>
            <p className="text-sm text-gray-600">
              Complex legal jargon converted to simple, everyday language
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="text-primary-600 font-semibold mb-2">✓ Multi-Language</div>
            <p className="text-sm text-gray-600">
              Get translations in Hindi, Tamil, Telugu, Bengali, Marathi & Gujarati
            </p>
          </div>
        </div>

        {/* Supported Formats */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Supported formats: PDF, JPG, PNG • Maximum file size: 10MB</p>
        </div>
      </div>
    </div>
  );
}
