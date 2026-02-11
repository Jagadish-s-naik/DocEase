import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { errorResponse, successResponse } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users
 * Get all users with their stats (Admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return errorResponse('Not authenticated', 401);
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if ((profile as any)?.role !== 'admin') {
      return errorResponse('Admin access required', 403);
    }

    // Get all users with profile data and document counts
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        role,
        created_at,
        documents_processed_this_month,
        monthly_document_limit
      `)
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('Fetch profiles error:', profilesError);
      return errorResponse('Failed to fetch users', 500);
    }

    // Get email addresses from auth.users (need to use service role key)
    const { data: authUsers, error: authError2 } = await supabase.auth.admin.listUsers();

    // Combine profile data with auth data
    const users = profiles?.map((profile: any) => {
      const authUser = authUsers?.users.find(u => u.id === profile.id);
      return {
        id: profile.id,
        email: authUser?.email || 'N/A',
        full_name: profile.full_name,
        role: profile.role,
        created_at: profile.created_at,
        documents_processed: profile.documents_processed_this_month || 0,
        monthly_limit: profile.monthly_document_limit || 3,
      };
    }) || [];

    return successResponse({
      users,
      total: users.length,
    });

  } catch (error: any) {
    console.error('Admin users error:', error);
    return errorResponse(error.message || 'Server error', 500);
  }
}
