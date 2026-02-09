// ============================================
// SENTRY ERROR MONITORING CONFIGURATION
// Production-ready error tracking
// ============================================

import * as Sentry from '@sentry/nextjs';

// Initialize Sentry only in production
if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 1.0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Environment
    environment: process.env.NODE_ENV,

    // Release tracking
    release: process.env.NEXT_PUBLIC_APP_VERSION || 'development',

    // Integrations
    integrations: [
      new Sentry.BrowserTracing({
        tracePropagationTargets: ['localhost', /^https:\/\/yourserver\.io\/api/],
      }),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Ignore specific errors
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],

    // Before send hook to filter/modify events
    beforeSend(event, hint) {
      // Don't send events in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Sentry Event (Dev):', event);
        return null;
      }

      // Filter out sensitive data
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
      }

      return event;
    },
  });
}

// ============================================
// ERROR TRACKING UTILITIES
// ============================================

export function captureError(error: Error, context?: Record<string, any>) {
  console.error('❌ Error captured:', error);

  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  console.log(`📝 Message: ${message}`);

  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  }
}

export function setUserContext(userId: string, email?: string, username?: string) {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.setUser({
      id: userId,
      email,
      username,
    });
  }
}

export function clearUserContext() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.setUser(null);
  }
}

export function addBreadcrumb(message: string, category?: string, data?: Record<string, any>) {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
      timestamp: Date.now() / 1000,
    });
  }
}

// ============================================
// ERROR BOUNDARY WRAPPER
// ============================================
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>
) {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return Sentry.withErrorBoundary(Component, {
      fallback: fallback || DefaultErrorFallback,
      showDialog: true,
    });
  }
  return Component;
}

function DefaultErrorFallback({ error, resetError }: { error: Error; resetError: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
        <p className="text-gray-600 mb-4">
          We're sorry, but something unexpected happened. Our team has been notified.
        </p>
        <details className="mb-4">
          <summary className="cursor-pointer text-sm text-gray-500">Error details</summary>
          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
            {error.message}
          </pre>
        </details>
        <button
          onClick={resetError}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// ============================================
// PERFORMANCE MONITORING
// ============================================
export function startTransaction(name: string, op: string) {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return Sentry.startTransaction({
      name,
      op,
    });
  }
  return null;
}

export function measurePerformance(name: string, fn: () => Promise<any>) {
  return async () => {
    const transaction = startTransaction(name, 'function');
    try {
      const result = await fn();
      transaction?.setStatus('ok');
      return result;
    } catch (error) {
      transaction?.setStatus('internal_error');
      throw error;
    } finally {
      transaction?.finish();
    }
  };
}
