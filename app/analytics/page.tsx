'use client';

// ============================================
// ANALYTICS DASHBOARD PAGE
// Usage statistics, graphs, and insights
// ============================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

interface AnalyticsData {
  totalDocuments: number;
  completedDocuments: number;
  failedDocuments: number;
  processingDocuments: number;
  successRate: number;
  documentTypes: { type: string; count: number }[];
  dailyUsage: { date: string; count: number }[];
  usageLimit: {
    current: number;
    limit: number;
    percentage: number;
  };
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30'); // days

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/analytics?days=${timeRange}`);
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Failed to load analytics</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">Track your document processing statistics</p>
        </div>

        {/* Time Range Selector */}
        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700 mr-3">Time Range:</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Documents"
            value={analytics?.totalDocuments?.toString() || '0'}
            icon="📄"
            color="blue"
          />
          <StatsCard
            title="Completed"
            value={analytics?.completedDocuments || 0}
            icon="✅"
            color="green"
          />
          <StatsCard
            title="Failed"
            value={analytics?.failedDocuments || 0}
            icon="❌"
            color="red"
          />
          <StatsCard
            title="Success Rate"
            value={`${analytics?.successRate || 0}%`}
            icon="📊"
            color="purple"
          />
        </div>

        {/* Usage Limit Progress */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Monthly Usage</h2>
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600">
              {analytics?.usageLimit?.current || 0} / {analytics?.usageLimit?.limit || 0} documents
            </span>
            <span className="text-gray-600">{analytics.usageLimit.percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                analytics.usageLimit.percentage >= 90
                  ? 'bg-red-600'
                  : analytics.usageLimit.percentage >= 70
                  ? 'bg-yellow-600'
                  : 'bg-green-600'
              }`}
              style={{ width: `${Math.min(analytics.usageLimit.percentage, 100)}%` }}
            ></div>
          </div>
          {analytics.usageLimit.percentage >= 90 && (
            <p className="text-red-600 text-sm mt-2">
              ⚠️ You're approaching your monthly limit. Consider upgrading to Premium.
            </p>
          )}
        </div>

        {/* Document Types Chart */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Documents by Type</h2>
          <div className="space-y-4">
            {analytics.documentTypes.map((type) => {
              const percentage = (type.count / analytics.totalDocuments) * 100;
              return (
                <div key={type.type}>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium capitalize">{type.type}</span>
                    <span className="text-gray-600">{type.count} ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Usage Graph */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Daily Usage Trend</h2>
          <div className="flex items-end justify-between h-64 gap-2">
            {analytics.dailyUsage.map((day) => {
              const maxCount = Math.max(...analytics.dailyUsage.map((d) => d.count));
              const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
              
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center group">
                  <div className="relative flex-1 w-full flex items-end">
                    <div
                      className="w-full bg-blue-600 rounded-t hover:bg-blue-700 transition cursor-pointer"
                      style={{ height: `${height}%` }}
                      title={`${day.date}: ${day.count} documents`}
                    >
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        {day.count}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-top-left">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// STATS CARD COMPONENT
// ============================================
function StatsCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: string;
  color: 'blue' | 'green' | 'red' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
