import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";
import { canShareStatus } from "@/lib/quotations/client-link";

/**
 * The link a customer opens, issued, read and revoked.
 *
 *   POST   /api/quotations/[id]/share    issue a fresh token (revokes the old one)
 *   GET    /api/quotations/[id]/share    whether one is out, and whether it has been read
 *   DELETE /api/quotations/[id]/share    revoke it
 *
 * **Only a quotation that has been issued may be shared** - `sent` or
 * `approved`, per `canShareStatus`. A draft is a price nobody has agreed to
 * show, and one existed on this tenant with a live token valid for another
 * eleven days, which became publicly readable the moment the public path
 * opened. The gate behind the token refuses it too; this refuses it earlier,
 * where somebody can be told why.
 *
 * Revoking is how a link that reached the wrong person is dealt with, so it is
 * worth knowing this is the whole of the answer to that: there is no per-person
 * link and no way to tell who opened one. A link is a bearer token, and anybody
 * holding it is the customer as far as this route is concerned.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["quotations.create"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id } = await params;
    const supabase = await createClient();

    // Verify quotation exists and user has access
    const { data: quotation, error: quotationError } = await supabase
      .from("quotations")
      .select("id, tenant_id, quotation_number, status")
      .eq("id", id)
      .single();

    if (quotationError || !quotation) {
      return NextResponse.json(
        { success: false, error: "Quotation not found" },
        { status: 404 }
      );
    }

    if (!canShareStatus(quotation.status)) {
      return NextResponse.json(
        {
          success: false,
          error:
            quotation.status === "draft"
              ? "Mark this quotation as sent before sharing it - a draft is not a price anybody has agreed to show."
              : `A ${quotation.status} quotation cannot be shared. Revise it and share the new version.`,
          reason: "not_shareable",
        },
        { status: 409 }
      );
    }

    // Generate new access token
    const { data: tokenData, error: tokenError } = await supabase
      .rpc("generate_quotation_client_link", { p_quotation_id: id });

    if (tokenError) {
      // If function doesn't exist, generate token manually
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error: updateError } = await supabase
        .from("quotations")
        .update({
          client_access_token: token,
          client_access_expires_at: expiresAt.toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: "Failed to generate access link" },
          { status: 500 }
        );
      }

      // Build the share URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      const shareUrl = `${baseUrl}/quotation/${token}`;

      return NextResponse.json({
        success: true,
        data: {
          share_url: shareUrl,
          token: token,
          expires_at: expiresAt.toISOString(),
        },
      });
    }

    // Build the share URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const shareUrl = `${baseUrl}/quotation/${tokenData?.[0]?.token || tokenData?.token}`;

    return NextResponse.json({
      success: true,
      data: {
        share_url: shareUrl,
        token: tokenData?.[0]?.token || tokenData?.token,
        expires_at: tokenData?.[0]?.expires_at || tokenData?.expires_at,
      },
    });
  } catch (error) {
    console.error("Error generating share link:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate share link" },
      { status: 500 }
    );
  }
}

/**
 * Get existing share link status
 * GET /api/quotations/[id]/share
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // A session was the only check here, so anybody signed in to the tenant
    // could read out a live customer link for any quotation. Reading a share
    // link is reading the quotation.
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["quotations.view"],
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id } = await params;
    const supabase = await createClient();

    // Get quotation with share info
    const { data: quotation, error: quotationError } = await supabase
      .from("quotations")
      .select(`
        id,
        quotation_number,
        client_access_token,
        client_access_expires_at,
        client_view_count,
        last_client_view_at
      `)
      .eq("id", id)
      .single();

    if (quotationError || !quotation) {
      return NextResponse.json(
        { success: false, error: "Quotation not found" },
        { status: 404 }
      );
    }

    if (!quotation.client_access_token) {
      return NextResponse.json({
        success: true,
        data: {
          has_share_link: false,
        },
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const shareUrl = `${baseUrl}/quotation/${quotation.client_access_token}`;

    const isExpired = quotation.client_access_expires_at 
      ? new Date(quotation.client_access_expires_at) < new Date()
      : false;

    return NextResponse.json({
      success: true,
      data: {
        has_share_link: true,
        share_url: shareUrl,
        token: quotation.client_access_token,
        expires_at: quotation.client_access_expires_at,
        is_expired: isExpired,
        view_count: quotation.client_view_count || 0,
        last_viewed_at: quotation.last_client_view_at,
      },
    });
  } catch (error) {
    console.error("Error getting share link:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get share link" },
      { status: 500 }
    );
  }
}

/**
 * Revoke/delete share link
 * DELETE /api/quotations/[id]/share
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Revoking is the answer to a link that reached the wrong person, so it
    // needs to be available to whoever may edit the quotation - and to nobody
    // who merely holds a session.
    const guard = await protectApiRoute(request, {
      requiredPermissions: ["quotations.edit", "quotations.create"],
      requireAllPermissions: false,
    });
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { id } = await params;
    const supabase = await createClient();

    // Revoke access token
    const { error: updateError } = await supabase
      .from("quotations")
      .update({
        client_access_token: null,
        client_access_expires_at: null,
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Failed to revoke share link" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Share link revoked successfully",
    });
  } catch (error) {
    console.error("Error revoking share link:", error);
    return NextResponse.json(
      { success: false, error: "Failed to revoke share link" },
      { status: 500 }
    );
  }
}
