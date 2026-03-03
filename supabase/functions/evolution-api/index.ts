import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, instanceName } = await req.json();

    // Get user's Evolution API config
    const { data: config } = await supabase
      .from("configuracoes")
      .select("evolution_api_url, evolution_api_key")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!config?.evolution_api_url || !config?.evolution_api_key) {
      return new Response(
        JSON.stringify({ error: "Configure a URL e API Key da Evolution API nas Configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const evoUrl = config.evolution_api_url.replace(/\/$/, "");
    const evoKey = config.evolution_api_key;

    if (action === "create") {
      // Create instance on Evolution API
      const createRes = await fetch(`${evoUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({
          instanceName,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        }),
      });

      const createData = await createRes.json();

      if (!createRes.ok) {
        return new Response(JSON.stringify({ error: createData.message || "Erro ao criar instância" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save instance in DB
      const evolutionInstanceId = createData.instance?.instanceName || instanceName;
      await supabase.from("instancias").insert({
        user_id: user.id,
        nome: instanceName,
        evolution_instance_id: evolutionInstanceId,
        status: "aguardando_qrcode",
      });

      return new Response(JSON.stringify({
        qrcode: createData.qrcode,
        instance: createData.instance,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const statusRes = await fetch(`${evoUrl}/instance/connectionState/${instanceName}`, {
        headers: { apikey: evoKey },
      });
      const statusData = await statusRes.json();

      // Update DB status
      const newStatus = statusData.instance?.state === "open" ? "conectado" : "desconectado";
      await supabase
        .from("instancias")
        .update({ status: newStatus })
        .eq("evolution_instance_id", instanceName)
        .eq("user_id", user.id);

      return new Response(JSON.stringify(statusData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "qrcode") {
      const qrRes = await fetch(`${evoUrl}/instance/connect/${instanceName}`, {
        headers: { apikey: evoKey },
      });
      const qrData = await qrRes.json();

      return new Response(JSON.stringify(qrData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
