import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { protectApiRoute, createErrorResponse } from "@/lib/auth/api-guard";

/**
 * Generate a shareable client access link for a quotation
 * POST /api/quotations/[id]/share
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
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
    const { id } = await params;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

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
    const { id } = await params;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

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
