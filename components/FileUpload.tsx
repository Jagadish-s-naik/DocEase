'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, AlertCircle } from 'lucide-react';
import { FILE_LIMITS, VALIDATION_MESSAGES } from '@/config/constants';
import { formatFileSize, isValidFileType, isValidFileSize } from '@/utils/helpers';
import toast from 'react-hot-toast';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onUploadComplete?: (result: any) => void;
  accept?: string[];
  maxSize?: number;
  disabled?: boolean;
}

export function FileUpload({
  onFileSelect,
  onUploadComplete,
  accept = FILE_LIMITS.ALLOWED_TYPES,
  maxSize = FILE_LIMITS.MAX_SIZE_BYTES,
  disabled = false,
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);

    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError(VALIDATION_MESSAGES.FILE_TOO_LARGE);
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError(VALIDATION_MESSAGES.INVALID_FILE_TYPE);
      } else {
        setError('File upload failed. Please try again.');
      }
      toast.error(error || 'File upload failed');
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];

      // Additional validation
      if (!isValidFileType(file, accept)) {
        setError(VALIDATION_MESSAGES.INVALID_FILE_TYPE);
        toast.error(VALIDATION_MESSAGES.INVALID_FILE_TYPE);
        return;
      }

      if (!isValidFileSize(file, maxSize)) {
        setError(VALIDATION_MESSAGES.FILE_TOO_LARGE);
        toast.error(VALIDATION_MESSAGES.FILE_TOO_LARGE);
        return;
      }

      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [accept, maxSize, onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize,
    multiple: false,
    disabled: disabled || uploading,
  });

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadProgress(100);
      toast.success('File uploaded successfully!');
      
      if (onUploadComplete) {
        onUploadComplete(result.data);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setError(null);
    setUploadProgress(0);
  };

  return (
    <div className="w-full">
      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          <Upload className="h-16 w-16 mx-auto mb-4 text-gray-400" />
          {isDragActive ? (
            <p className="text-lg text-primary-600 font-semibold">Drop your document here...</p>
          ) : (
            <>
              <p className="text-lg font-semibold text-gray-700 mb-2">
                Drop your document here, or click to browse
              </p>
              <p className="text-sm text-gray-500 accessible-text">
                PDF, JPG, or PNG • Max {FILE_LIMITS.MAX_SIZE_MB}MB • Up to {FILE_LIMITS.MAX_PAGES} pages
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <File className="h-12 w-12 text-primary-600" />
              <div>
                <p className="font-semibold text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <button
              onClick={handleRemove}
              className="text-gray-400 hover:text-gray-600"
              disabled={uploading}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2">Uploading... {uploadProgress}%</p>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="btn-primary w-full"
          >
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-danger-50 border border-danger-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-danger-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-danger-700 accessible-text">{error}</p>
        </div>
      )}
    </div>
  );
}
