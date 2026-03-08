
-- Fix overly permissive audit log insert policy
DROP POLICY "System can insert audit log" ON public.audit_log;
CREATE POLICY "Authenticated users can insert audit log" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
