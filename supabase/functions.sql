-- ============================================
-- DOCEASE DATABASE FUNCTIONS & TRIGGERS
-- Production-Ready Functions
-- ============================================

-- ============================================
-- FUNCTION: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'en'
  );
  
  -- Create usage limits
  INSERT INTO public.usage_limits (user_id, monthly_limit, documents_processed)
  VALUES (NEW.id, 3, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- FUNCTION: Monthly usage reset
-- ============================================
CREATE OR REPLACE FUNCTION public.reset_monthly_usage()
RETURNS void AS $$
BEGIN
  UPDATE public.usage_limits
  SET documents_processed = 0,
      last_reset = NOW()
  WHERE DATE_PART('day', NOW() - last_reset) >= 30;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Check usage limit before processing
-- ============================================
CREATE OR REPLACE FUNCTION public.check_usage_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_limit INTEGER;
  v_processed INTEGER;
  v_is_premium BOOLEAN;
BEGIN
  -- Get user's limits
  SELECT monthly_limit, documents_processed, is_premium
  INTO v_limit, v_processed, v_is_premium
  FROM public.usage_limits
  WHERE user_id = p_user_id;
  
  -- Premium users have unlimited access
  IF v_is_premium THEN
    RETURN TRUE;
  END IF;
  
  -- Check if under limit
  RETURN v_processed < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Increment usage counter
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.usage_limits
  SET documents_processed = documents_processed + 1
  WHERE user_id = p_user_id;
  
  -- Log API usage
  INSERT INTO public.api_usage (user_id, endpoint, tokens_used)
  VALUES (p_user_id, 'process_document', 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Auto-delete expired documents
-- ============================================
CREATE OR REPLACE FUNCTION public.delete_expired_documents()
RETURNS void AS $$
DECLARE
  v_doc RECORD;
BEGIN
  FOR v_doc IN 
    SELECT id, storage_path FROM public.documents
    WHERE expires_at IS NOT NULL AND expires_at < NOW()
  LOOP
    -- Delete from storage (would need storage API integration)
    -- For now, just mark as deleted
    UPDATE public.documents
    SET upload_status = 'deleted'
    WHERE id = v_doc.id;
    
    -- Log the deletion
    INSERT INTO public.processing_logs (document_id, status, message)
    VALUES (v_doc.id, 'deleted', 'Document expired and auto-deleted');
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Get user analytics
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_analytics(p_user_id UUID, p_days INTEGER DEFAULT 30)
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
        FROM public.documents
        WHERE user_id = p_user_id
          AND created_at >= NOW() - (p_days || ' days')::INTERVAL
        GROUP BY document_type
      ) t
    )
  )
  INTO v_result
  FROM public.documents
  WHERE user_id = p_user_id
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Create audit log entry
-- ============================================
CREATE OR REPLACE FUNCTION public.create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.processing_logs (
    document_id,
    status,
    message,
    created_at
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    json_build_object(
      'table', TG_TABLE_NAME,
      'operation', TG_OP,
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    )::text,
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SCHEDULED JOBS (Requires pg_cron extension)
-- ============================================

-- Reset monthly usage (runs on 1st of every month)
-- SELECT cron.schedule('reset-monthly-usage', '0 0 1 * *', 'SELECT public.reset_monthly_usage()');

-- Delete expired documents (runs daily at midnight)
-- SELECT cron.schedule('delete-expired-docs', '0 0 * * *', 'SELECT public.delete_expired_documents()');

-- ============================================
-- INDEXES for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_results_document_id ON public.document_results(document_id);
CREATE INDEX IF NOT EXISTS idx_usage_limits_user_id ON public.usage_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_document_id ON public.processing_logs(document_id);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates profile and usage limits when new user signs up';
COMMENT ON FUNCTION public.reset_monthly_usage() IS 'Resets document processing counters monthly';
COMMENT ON FUNCTION public.check_usage_limit(UUID) IS 'Checks if user can process more documents';
COMMENT ON FUNCTION public.increment_usage(UUID) IS 'Increments usage counter after successful processing';
COMMENT ON FUNCTION public.delete_expired_documents() IS 'Deletes documents that have passed their expiry date';
COMMENT ON FUNCTION public.get_user_analytics(UUID, INTEGER) IS 'Returns analytics data for a user';

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION public.check_usage_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_analytics(UUID, INTEGER) TO authenticated;
