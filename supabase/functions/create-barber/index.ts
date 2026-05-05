import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Solo admins" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { email, password, full_name } = await req.json();
    if (!email || !password || !full_name) {
      return new Response(JSON.stringify({ error: "Faltan datos" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone: "" },
    });
    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Error creando usuario" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const newUserId = created.user.id;

    await admin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: roleErr } = await admin.from("user_roles").insert({ user_id: newUserId, role: "barber" });
    if (roleErr) {
      return new Response(JSON.stringify({ error: roleErr.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Crear el registro en la tabla barbers vinculado al usuario
    const { data: barberRow, error: barberErr } = await admin
      .from("barbers")
      .insert({ name: full_name, user_id: newUserId, active: true })
      .select()
      .single();
    if (barberErr) {
      return new Response(JSON.stringify({ error: barberErr.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ user_id: newUserId, barber: barberRow }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
