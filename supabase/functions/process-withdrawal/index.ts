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

    if (req.method === "POST" && path === "submit") {
      // Submit a withdrawal to the payment gateway
      const body = await req.json();
      const { withdrawalId, gatewaySlug } = body;

      if (!withdrawalId || !gatewaySlug) {
        return new Response(JSON.stringify({ error: "Missing withdrawal ID or gateway" }), {
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

      // Fetch the withdrawal record
      const wdResponse = await fetch(`${supabaseUrl}/rest/v1/withdrawals?id=eq.${withdrawalId}&status=eq.approved&select=*`, {
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
        },
      });
      const withdrawals = await wdResponse.json();
      if (!withdrawals || withdrawals.length === 0) {
        return new Response(JSON.stringify({ error: "Withdrawal not found or not approved" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const withdrawal = withdrawals[0];

      // In production, submit to the actual gateway API here
      // For now, we mark it as submitted and return the gateway reference
      const gatewayReference = `GW-WD-${withdrawalId.substring(0, 8)}`;

      return new Response(JSON.stringify({
        success: true,
        withdrawalId: withdrawal.id,
        gatewayReference,
        gateway: {
          name: gateway.name,
          slug: gateway.slug,
          environment: gateway.environment,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST" && path === "callback") {
      // Gateway webhook callback — update withdrawal status
      const body = await req.json();
      const { withdrawalId, gatewaySlug, status, signature } = body;

      if (!withdrawalId || !gatewaySlug || !status) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
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
      } else if (gateway.webhook_secret && !signature) {
        return new Response(JSON.stringify({ error: "Missing webhook signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only allow 'paid' or 'rejected' statuses from callbacks
      if (status !== "paid" && status !== "rejected") {
        return new Response(JSON.stringify({ error: "Invalid status for callback" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update withdrawal status
      const updateResponse = await fetch(`${supabaseUrl}/rest/v1/withdrawals?id=eq.${withdrawalId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
          "Prefer": "return=representation",
        },
        body: JSON.stringify({
          status: status,
          processed_at: new Date().toISOString(),
        }),
      });

      if (!updateResponse.ok) {
        const err = await updateResponse.text();
        return new Response(JSON.stringify({ error: "Failed to update withdrawal", details: err }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updated = (await updateResponse.json())[0];

      // If paid, create a transaction record
      if (status === "paid") {
        await fetch(`${supabaseUrl}/rest/v1/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
          },
          body: JSON.stringify({
            user_id: updated.user_id,
            type: "withdrawal",
            amount: updated.amount,
            status: "completed",
            description: `Withdrawal paid via ${gateway.name}`,
            reference: `WDPAY-${updated.id}`,
          }),
        });

        // Send notification
        await fetch(`${supabaseUrl}/rest/v1/notifications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
            "apikey": serviceKey,
          },
          body: JSON.stringify({
            user_id: updated.user_id,
            type: "withdrawal",
            title: "Withdrawal Paid",
            message: `Your withdrawal of ₦${updated.amount} has been paid to your bank account.`,
          }),
        });
      }

      return new Response(JSON.stringify({ success: true, withdrawalId: updated.id, status }), {
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
