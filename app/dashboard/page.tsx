'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { 
  FileText, 
  Upload, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Calendar,
  Search,
  Filter,
  MoreVertical,
  Download,
  Trash2,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Document, DocumentResult } from '@/types';
import { formatDate, formatFileSize } from '@/utils/helpers';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [results, setResults] = useState<Record<string, DocumentResult>>({});
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, failed: 0 });
  const [usageStats, setUsageStats] = useState({ used: 0, limit: 3 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      console.log('User found, fetching dashboard data');
      fetchDashboardData();
    } else if (!authLoading) {
      console.log('No user and not loading, should redirect');
      setLoading(false);
    }
  }, [user, authLoading]);

  const fetchDashboardData = async () => {
    if (!user) return;

    console.log('Fetching dashboard data for user:', user.id);

    try {
      // Fetch documents
      const { data: docsData, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (docsError) {
        console.error('Documents fetch error:', docsError);
        throw docsError;
      }
      
      console.log('Documents fetched:', docsData?.length || 0);
      setDocuments(docsData || []);

      // Fetch results for completed documents
      const completedIds = docsData
        ?.filter((d: any) => d.processing_status === 'completed')
        .map((d: any) => d.id) || [];

      if (completedIds.length > 0) {
        const { data: resultsData } = await supabase
          .from('document_results')
          .select('*')
          .in('document_id', completedIds);

        const resultsMap: Record<string, DocumentResult> = {};
        resultsData?.forEach((r: any) => {
          resultsMap[r.document_id] = r;
        });
        setResults(resultsMap);
      }

      // Calculate stats
      const total = docsData?.length || 0;
      const pending = docsData?.filter((d: any) => 
        ['queued', 'ocr_in_progress', 'classification_in_progress', 'simplification_in_progress', 'translation_in_progress'].includes(d.processing_status)
      ).length || 0;
      const completed = docsData?.filter((d: any) => d.processing_status === 'completed').length || 0;
      const failed = docsData?.filter((d: any) => d.processing_status === 'failed').length || 0;

      setStats({ total, pending, completed, failed });

      // Fetch usage stats
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const { data: usageData, error: usageError } = await supabase
        .from('usage_limits')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .single();

      if (usageData) {
        setUsageStats({
          used: (usageData as any).documents_processed || 0,
          limit: (usageData as any).limit_value || 3,
        });
      } else {
        // Create default usage limit for new users
        const usageLimitsTable: any = supabase.from('usage_limits');
        await usageLimitsTable.insert({
          user_id: user.id,
          month: currentMonth,
          plan_type: 'free',
          limit_value: 3,
          documents_processed: 0,
        });
        setUsageStats({ used: 0, limit: 3 });
      }

    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      toast.error('Failed to load dashboard data');
      // Set loading to false even on error so UI isn't stuck
    } finally {
      console.log('Dashboard data fetch complete');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      toast.success('Document deleted');
      fetchDashboardData();
    } catch (error: any) {
      toast.error('Failed to delete document');
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || doc.processing_status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'queued': return 'text-gray-600 bg-gray-50';
      default: return 'text-yellow-600 bg-yellow-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-primary-600">DocEase</h1>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload Document
              </Link>
              <span className="text-sm text-gray-600">
                {profile?.full_name || user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {profile?.full_name || 'User'}!
          </h2>
          <p className="text-gray-600">
            Manage your documents and view simplification results.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Documents</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileText className="w-12 h-12 text-primary-600 opacity-20" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completed</p>
                <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-600 opacity-20" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Processing</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="w-12 h-12 text-yellow-600 opacity-20" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Usage This Month</p>
                <p className="text-3xl font-bold text-primary-600">
                  {usageStats.used}/{usageStats.limit}
                </p>
              </div>
              <TrendingUp className="w-12 h-12 text-primary-600 opacity-20" />
            </div>
          </div>
        </div>

        {/* Usage Alert */}
        {usageStats.used >= usageStats.limit && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-1">Usage Limit Reached</h3>
                <p className="text-sm text-yellow-800 mb-3">
                  You've used all {usageStats.limit} free documents this month.
                  Upgrade to continue processing unlimited documents.
                </p>
                <button className="btn-primary text-sm py-2 px-4">
                  Upgrade to Paid Plan (₹99/month)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Link href="/upload" className="btn-primary flex items-center justify-center gap-2">
            <Upload className="w-5 h-5" />
            Upload New Document
          </Link>
        </div>

        {/* Documents List */}
        <div className="card">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h3 className="text-xl font-bold text-gray-900">Recent Documents</h3>
            
            <div className="flex gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search documents..."
                  className="input-field pl-10 w-full sm:w-64"
                />
              </div>

              {/* Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="input-field"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="queued">Queued</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Documents Table */}
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No documents yet</h3>
              <p className="text-gray-600 mb-6">Upload your first document to get started!</p>
              <Link href="/upload" className="btn-primary inline-flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Document
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Document</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{doc.file_name}</p>
                            <p className="text-sm text-gray-500">{formatFileSize(doc.file_size)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-600 capitalize">
                          {doc.document_type?.replace('_', ' ') || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(doc.processing_status)}`}>
                          {getStatusIcon(doc.processing_status)}
                          {doc.processing_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-600">
                          {formatDate(doc.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {doc.processing_status === 'completed' && (
                            <Link
                              href={`/results/${doc.id}`}
                              className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                              title="View Results"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                          )}
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
