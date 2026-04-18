import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/getAuthUser";

const META_GRAPH_API = "https://graph.facebook.com/v18.0";

export async function GET(request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = process.env.META_ACCESS_TOKEN;
    const adAccountId = process.env.META_AD_ACCOUNT_ID;

    if (!token) {
      return NextResponse.json({
        connected: false,
        reason: "no_token",
        message: "META_ACCESS_TOKEN is not set.",
      });
    }

    // Verify the token by calling the Graph API `/me` endpoint.
    const debugRes = await fetch(
      `${META_GRAPH_API}/me?fields=id,name&access_token=${encodeURIComponent(token)}`,
      { cache: "no-store" }
    );

    const debugData = await debugRes.json();

    if (!debugRes.ok || debugData.error) {
      return NextResponse.json({
        connected: false,
        reason: "invalid_token",
        message: debugData.error?.message || "Meta token is not valid.",
        adAccountId: adAccountId || null,
      });
    }

    let adAccount = null;
    if (adAccountId) {
      try {
        const adRes = await fetch(
          `${META_GRAPH_API}/${adAccountId}?fields=id,name,account_status,currency,timezone_name&access_token=${encodeURIComponent(
            token
          )}`,
          { cache: "no-store" }
        );
        const adData = await adRes.json();
        if (adRes.ok && !adData.error) adAccount = adData;
      } catch (err) {
        // swallow — we still consider the user connected
      }
    }

    return NextResponse.json({
      connected: true,
      user: { id: debugData.id, name: debugData.name },
      adAccountId: adAccountId || null,
      adAccount,
    });
  } catch (error) {
    console.error("GET /api/meta/status error:", error);
    return NextResponse.json(
      { connected: false, reason: "server_error", message: error.message },
      { status: 500 }
    );
  }
}
