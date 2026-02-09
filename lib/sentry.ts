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
// ERROR BOUNDARY WRAPPER (Use in React Components)
// ============================================
// Note: DefaultErrorFallback component should be in a .tsx file
// For now, use a simple error handler
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>
) {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return Sentry.withErrorBoundary(Component, {
      showDialog: true,
    });
  }
  return Component;
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
