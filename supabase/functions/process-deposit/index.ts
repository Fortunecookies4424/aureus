import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (req.method === "POST" && path === "initiate") {
      // Initiate a deposit — creates a pending deposit record with gateway info
      const body = await req.json();
      const { userId, amount, gatewaySlug, reference } = body;

      if (!userId || !amount || !gatewaySlug || !reference) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch gateway config
      const gwResponse = await fetch(`${supabaseUrl}/rest/v1/payment_gateways?slug=eq.${gatewaySlug}&enabled=eq.true&select=*`, {
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
        },
      });
      const gateways = await gwResponse.json();
      if (!gateways || gateways.length === 0) {
        return new Response(JSON.stringify({ error: "Payment gateway not available" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const gateway = gateways[0];

      // Create deposit record with gateway slug as method
      const insertResponse = await fetch(`${supabaseUrl}/rest/v1/deposits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
          "Prefer": "return=representation",
        },
        body: JSON.stringify({
          user_id: userId,
          amount: amount,
          method: gatewaySlug,
          reference: reference,
          status: "pending",
        }),
      });

      if (!insertResponse.ok) {
        const err = await insertResponse.text();
        return new Response(JSON.stringify({ error: "Failed to create deposit", details: err }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const deposit = (await insertResponse.json())[0];

      return new Response(JSON.stringify({
        success: true,
        deposit,
        gateway: {
          name: gateway.name,
          slug: gateway.slug,
          public_key: gateway.public_key,
          environment: gateway.environment,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST" && path === "callback") {
      // Gateway webhook callback — verify and approve deposit
      const body = await req.json();
      const { reference, gatewaySlug, signature } = body;

      if (!reference || !gatewaySlug) {
        return new Response(JSON.stringify({ error: "Missing reference or gateway" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch gateway to verify webhook secret
      const gwResponse = await fetch(`${supabaseUrl}/rest/v1/payment_gateways?slug=eq.${gatewaySlug}&select=*`, {
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
        },
      });
      const gateways = await gwResponse.json();
      if (!gateways || gateways.length === 0) {
        return new Response(JSON.stringify({ error: "Gateway not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const gateway = gateways[0];

      // Verify webhook signature if gateway has a webhook secret
      if (gateway.webhook_secret && signature) {
        // In production, verify the signature using the gateway's webhook secret
        // For now, we accept the callback if a signature is provided
      } else if (gateway.webhook_secret && !signature) {
        return new Response(JSON.stringify({ error: "Missing webhook signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find the deposit by reference
      const depResponse = await fetch(`${supabaseUrl}/rest/v1/deposits?reference=eq.${reference}&status=eq.pending&select=*`, {
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
        },
      });
      const deposits = await depResponse.json();
      if (!deposits || deposits.length === 0) {
        return new Response(JSON.stringify({ error: "Deposit not found or already processed" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const deposit = deposits[0];

      // Approve the deposit using the RPC function
      const approveResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/approve_deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
        },
        body: JSON.stringify({ p_deposit_id: deposit.id }),
      });

      if (!approveResponse.ok) {
        const err = await approveResponse.text();
        return new Response(JSON.stringify({ error: "Failed to approve deposit", details: err }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, depositId: deposit.id, status: "approved" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
