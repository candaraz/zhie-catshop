// Supabase Edge Function: manage-users
// Deploy via: supabase functions deploy manage-users
// Menggunakan SUPABASE_SERVICE_ROLE_KEY di sisi server (TIDAK PERNAH di frontend)
// Hanya pengguna dengan role = 'owner' yang dapat memanggil endpoint ini.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Token otorisasi tidak ditemukan.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verifikasi pemanggil adalah OWNER aktif
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData.user) {
      return new Response(JSON.stringify({ error: 'Sesi tidak valid.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile } = await adminClient
      .from('users')
      .select('id, full_name, role, is_active')
      .eq('id', authData.user.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'owner' || !callerProfile.is_active) {
      return new Response(JSON.stringify({ error: 'Hanya Pemilik (Owner) yang berhak mengelola akun.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'create') {
      const { email, password, full_name, role, permissions } = body;
      if (!email || !password || !full_name) {
        return new Response(JSON.stringify({ error: 'Email, password, dan nama lengkap wajib diisi.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role: role || 'cashier' },
      });

      if (createErr || !created.user) {
        return new Response(JSON.stringify({ error: createErr?.message || 'Gagal membuat akun auth.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: profile, error: profErr } = await adminClient
        .from('users')
        .insert({
          id: created.user.id,
          email,
          full_name,
          role: role === 'owner' ? 'owner' : 'cashier',
          is_active: true,
          permissions: permissions || {
            can_view_cost_price: false,
            can_record_expense: false,
            can_manage_customers: true,
            can_receive_receivable_payment: true,
          },
        })
        .select()
        .single();

      if (profErr) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        return new Response(JSON.stringify({ error: profErr.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await adminClient.from('audit_logs').insert({
        user_id: callerProfile.id,
        user_name: callerProfile.full_name,
        user_role: callerProfile.role,
        action: 'CREATE_USER',
        entity_type: 'users',
        entity_id: profile.id,
        details: { email, full_name, role: profile.role },
      });

      return new Response(JSON.stringify({ user: profile }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update_password') {
      const { user_id, new_password } = body;
      const { error } = await adminClient.auth.admin.updateUserById(user_id, {
        password: new_password,
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Aksi tidak dikenali.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
