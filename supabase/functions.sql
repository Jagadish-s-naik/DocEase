-- =====================================================
-- DocEase Additional Database Functions
-- =====================================================
-- Execute this AFTER running supabase/schema.sql
-- These are supplementary utility functions
-- =====================================================

-- Note: Core functions (handle_new_user, check_usage_limit, etc.)
-- are already defined in schema.sql. This file adds extra utilities.

-- =====================================================
-- FUNCTION: Get User Analytics (Enhanced)
-- =====================================================
-- Returns comprehensive analytics for a user
CREATE OR REPLACE FUNCTION get_user_analytics(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_documents', COUNT(*),
    'completed', COUNT(*) FILTER (WHERE processing_status = 'completed'),
    'failed', COUNT(*) FILTER (WHERE processing_status = 'failed'),
    'processing', COUNT(*) FILTER (WHERE processing_status IN ('queued', 'ocr_in_progress', 'classification_in_progress', 'simplification_in_progress', 'translation_in_progress')),
    'by_type', (
      SELECT json_object_agg(document_type, count)
      FROM (
        SELECT document_type, COUNT(*) as count
        FROM documents
        WHERE user_id = p_user_id
          AND created_at >= NOW() - (p_days || ' days')::INTERVAL
          AND document_type IS NOT NULL
        GROUP BY document_type
      ) t
    ),
    'daily_usage', (
      SELECT json_agg(json_build_object(
        'date', date,
        'count', count
      ))
      FROM (
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM documents
        WHERE user_id = p_user_id
          AND created_at >= NOW() - (p_days || ' days')::INTERVAL
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      ) d
    )
  )
  INTO v_result
  FROM documents
  WHERE user_id = p_user_id
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
  
  RETURN COALESCE(v_result, '{}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Get System Statistics (Admin Only)
-- =====================================================
-- Returns system-wide statistics
CREATE OR REPLACE FUNCTION get_system_stats()
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'total_documents', (SELECT COUNT(*) FROM documents),
    'completed_documents', (SELECT COUNT(*) FROM documents WHERE processing_status = 'completed'),
    'processing_documents', (SELECT COUNT(*) FROM documents WHERE processing_status IN ('queued', 'ocr_in_progress', 'classification_in_progress', 'simplification_in_progress', 'translation_in_progress')),
    'failed_documents', (SELECT COUNT(*) FROM documents WHERE processing_status = 'failed'),
    'documents_today', (SELECT COUNT(*) FROM documents WHERE DATE(created_at) = CURRENT_DATE),
    'success_rate', (
      CASE 
        WHEN (SELECT COUNT(*) FROM documents) = 0 THEN 0
        ELSE ROUND(
          (SELECT COUNT(*)::NUMERIC FROM documents WHERE processing_status = 'completed') / 
          (SELECT COUNT(*)::NUMERIC FROM documents) * 100, 
          2
        )
      END
    ),
    'active_subscriptions', (SELECT COUNT(*) FROM subscriptions WHERE status IN ('active', 'trialing')),
    'total_revenue', (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'succeeded')
  )
  INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Get Document Type Statistics
-- =====================================================
-- Returns count of documents by type (user or system-wide)
CREATE OR REPLACE FUNCTION get_document_type_stats(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  document_type document_type,
  count BIGINT
) AS $$
BEGIN
  IF p_user_id IS NULL THEN
    -- System-wide stats (admin)
    RETURN QUERY
    SELECT d.document_type, COUNT(*)::BIGINT
    FROM documents d
    WHERE d.document_type IS NOT NULL
    GROUP BY d.document_type
    ORDER BY COUNT(*) DESC;
  ELSE
    -- User-specific stats
    RETURN QUERY
    SELECT d.document_type, COUNT(*)::BIGINT
    FROM documents d
    WHERE d.user_id = p_user_id
      AND d.document_type IS NOT NULL
    GROUP BY d.document_type
    ORDER BY COUNT(*) DESC;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Log Admin Action
-- =====================================================
-- Creates an audit log entry for admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
  p_event_type TEXT,
  p_event_data JSONB,
  p_user_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO admin_logs (event_type, event_data, user_id, ip_address, user_agent)
  VALUES (p_event_type, p_event_data, p_user_id, p_ip_address, p_user_agent)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Clean Old Feedback
-- =====================================================
-- Deletes feedback older than specified days (default 365)
CREATE OR REPLACE FUNCTION clean_old_feedback(p_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM feedback
  WHERE created_at < NOW() - (p_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Get Processing Queue Status
-- =====================================================
-- Returns current processing queue information
CREATE OR REPLACE FUNCTION get_queue_status()
RETURNS TABLE (
  status processing_status,
  count BIGINT,
  oldest_timestamp TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.processing_status,
    COUNT(*)::BIGINT,
    MIN(d.created_at) as oldest_timestamp
  FROM documents d
  WHERE d.processing_status IN ('queued', 'ocr_in_progress', 'classification_in_progress', 'simplification_in_progress', 'translation_in_progress')
  GROUP BY d.processing_status
  ORDER BY oldest_timestamp ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: Get User's Current Month Usage
-- =====================================================
-- Returns usage info for the current month
CREATE OR REPLACE FUNCTION get_current_usage(p_user_id UUID)
RETURNS TABLE (
  documents_processed INTEGER,
  limit_value INTEGER,
  remaining INTEGER,
  plan_type plan_type,
  percentage_used NUMERIC
) AS $$
DECLARE
  v_current_month TEXT;
BEGIN
  v_current_month := TO_CHAR(NOW(), 'YYYY-MM');
  
  RETURN QUERY
  SELECT 
    ul.documents_processed,
    ul.limit_value,
    (ul.limit_value - ul.documents_processed) as remaining,
    ul.plan_type,
    ROUND((ul.documents_processed::NUMERIC / ul.limit_value::NUMERIC) * 100, 2) as percentage_used
  FROM usage_limits ul
  WHERE ul.user_id = p_user_id
    AND ul.month = v_current_month
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify functions were created successfully

SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_user_analytics',
    'get_system_stats',
    'get_document_type_stats',
    'log_admin_action',
    'clean_old_feedback',
    'get_queue_status',
    'get_current_usage'
  )
ORDER BY routine_name;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION get_user_analytics(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_document_type_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_usage(UUID) TO authenticated;

-- Admin-only functions (grant to specific admin role later)
-- GRANT EXECUTE ON FUNCTION get_system_stats() TO admin_role;
-- GRANT EXECUTE ON FUNCTION log_admin_action(...) TO admin_role;

-- =====================================================
-- SUCCESS!
-- =====================================================
-- All utility functions created successfully.
-- These supplement the core functions in schema.sql.
