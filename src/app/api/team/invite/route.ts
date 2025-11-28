/**
 * Team Invite API Route
 * POST /api/team/invite
 * Creates a user invitation for a team member
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  console.log("[INVITE API] POST /api/team/invite - Request received");

  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.error("[INVITE API] Not authenticated:", authError);
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get user's tenant and permissions - simplified query to avoid RLS issues
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("id, tenant_id, is_super_admin")
      .eq("id", authUser.id)
      .single();

    if (userError || !currentUser) {
      console.error("[INVITE API] Failed to get user:", userError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to get user details",
          details: userError?.message,
        },
        { status: 400 }
      );
    }

    if (!currentUser.tenant_id) {
      console.error("[INVITE API] User has no tenant");
      return NextResponse.json(
        {
          success: false,
          error: "User is not associated with any organization",
        },
        { status: 400 }
      );
    }

    // Check if user has permission to invite (owner, admin, or super_admin)
    if (!currentUser.is_super_admin) {
      // Check user's role
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role:roles(slug, hierarchy_level)")
        .eq("user_id", authUser.id);

      const hasPermission = userRoles?.some(
        (ur: any) => ur.role?.hierarchy_level <= 1 // Owner (0) or Admin (1)
      );

      if (!hasPermission) {
        console.error("[INVITE API] User doesn't have permission to invite");
        return NextResponse.json(
          {
            success: false,
            error: "You don't have permission to invite team members",
          },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    console.log("[INVITE API] Request body:", {
      email: body.email,
      firstName: body.firstName,
      lastName: body.lastName,
      designation: body.designation,
      roleIds: body.roleIds,
    });

    // Validate required fields
    // Support both roleId (legacy) and roleIds (new multi-select)
    const roleIds = body.roleIds || (body.roleId ? [body.roleId] : []);

    if (
      !body.email ||
      !body.firstName ||
      !body.lastName ||
      roleIds.length === 0
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS for validation checks
    const adminClient = createAdminClient();

    // Check if user already exists in the tenant (active or invited)
    const { data: existingUser } = await adminClient
      .from("users")
      .select("id, email, status")
      .eq("tenant_id", currentUser.tenant_id)
      .ilike("email", body.email.toLowerCase())
      .single();

    if (existingUser) {
      const statusMessage =
        existingUser.status === "invited"
          ? "This user has already been invited and is pending acceptance"
          : "A user with this email already exists in your organization";

      console.log(
        "[INVITE API] User already exists:",
        existingUser.email,
        "status:",
        existingUser.status
      );
      return NextResponse.json(
        {
          success: false,
          error: statusMessage,
        },
        { status: 409 }
      );
    }

    // Check if there's already a pending invitation
    const { data: existingInvite } = await adminClient
      .from("user_invitations")
      .select("id, email, status")
      .eq("tenant_id", currentUser.tenant_id)
      .ilike("email", body.email.toLowerCase())
      .eq("status", "pending")
      .single();

    if (existingInvite) {
      console.log(
        "[INVITE API] Pending invitation exists:",
        existingInvite.email
      );
      return NextResponse.json(
        {
          success: false,
          error: "An invitation has already been sent to this email",
        },
        { status: 409 }
      );
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    // For multi-role support, store primary role in role_id and all roles in metadata
    const primaryRoleId = roleIds[0];

    // Create the invitation with metadata for multi-role support
    const { data: invitation, error: inviteError } = await adminClient
      .from("user_invitations")
      .insert({
        tenant_id: currentUser.tenant_id,
        email: body.email.toLowerCase(),
        invited_by_user_id: authUser.id,
        role_id: primaryRoleId,
        token: token,
        status: "pending",
        expires_at: expiresAt.toISOString(),
        metadata: {
          first_name: body.firstName,
          last_name: body.lastName,
          designation: body.designation || null,
          role_ids: roleIds,
        },
      })
      .select(
        `
        *,
        role:roles(name, slug),
        invited_by:users!invited_by_user_id(name, email)
      `
      )
      .single();

    if (inviteError) {
      console.error("[INVITE API] Failed to create invitation:", inviteError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create invitation: " + inviteError.message,
        },
        { status: 500 }
      );
    }

    console.log("[INVITE API] Invitation created:", invitation.id);

    // Get all role names for multi-role display
    let roleNames: string[] = [];
    if (roleIds.length > 0) {
      const { data: rolesData } = await adminClient
        .from("roles")
        .select("id, name")
        .in("id", roleIds);
      roleNames = rolesData?.map((r) => r.name) || [];
    }

    // Send invitation email using Supabase Auth
    // Supabase will redirect to this URL after email confirmation, with tokens in hash
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/setup-password`;
    console.log("[INVITE API] Using redirect URL:", redirectUrl);
    console.log(
      "[INVITE API] NEXT_PUBLIC_APP_URL:",
      process.env.NEXT_PUBLIC_APP_URL
    );

    // Check if this specific user already exists in auth
    const { data: existingAuthUsers } =
      await adminClient.auth.admin.listUsers();
    const existingAuthUser = existingAuthUsers?.users?.find(
      (u) => u.email?.toLowerCase() === body.email.toLowerCase()
    );

    let authInviteError: any = null;
    let authInvite: any = null;

    if (existingAuthUser) {
      console.log(
        "[INVITE API] User already exists in auth:",
        existingAuthUser.id
      );
      console.log(
        "[INVITE API] Email confirmed at:",
        existingAuthUser.email_confirmed_at
      );

      // If user hasn't confirmed their email, they're from a previous cancelled invite
      // Delete this specific user and re-invite fresh
      if (!existingAuthUser.email_confirmed_at) {
        console.log(
          "[INVITE API] This user has not confirmed email, deleting to re-invite..."
        );
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(
          existingAuthUser.id
        );

        if (deleteError) {
          console.error(
            "[INVITE API] Failed to delete unconfirmed user:",
            deleteError
          );
          authInviteError = deleteError;
        } else {
          // Also clean up existing user record and roles
          await adminClient
            .from("user_roles")
            .delete()
            .eq("user_id", existingAuthUser.id);
          await adminClient
            .from("users")
            .delete()
            .eq("id", existingAuthUser.id);

          console.log(
            "[INVITE API] Deleted unconfirmed user, now sending fresh invite..."
          );
          // Now invite as a new user
          const result = await adminClient.auth.admin.inviteUserByEmail(
            body.email.toLowerCase(),
            {
              redirectTo: redirectUrl,
              data: {
                first_name: body.firstName,
                last_name: body.lastName,
                full_name: `${body.firstName} ${body.lastName}`,
                designation: body.designation || null,
                tenant_id: currentUser.tenant_id,
                invitation_id: invitation.id,
                role_ids: roleIds,
              },
            }
          );
          authInvite = result.data;
          authInviteError = result.error;

          if (authInviteError) {
            console.error(
              "[INVITE API] inviteUserByEmail after delete failed:",
              authInviteError.message
            );
          } else {
            console.log("[INVITE API] inviteUserByEmail succeeded!");
            console.log(
              "[INVITE API] Auth user created:",
              authInvite?.user?.id
            );

            // Create user record in users table with status 'invited'
            if (authInvite?.user?.id) {
              const newUserId = authInvite.user.id;

              const { error: userInsertError } = await adminClient
                .from("users")
                .insert({
                  id: newUserId,
                  email: body.email.toLowerCase(),
                  name: `${body.firstName} ${body.lastName}`.trim(),
                  tenant_id: currentUser.tenant_id,
                  status: "invited",
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                });

              if (userInsertError) {
                console.error(
                  "[INVITE API] Failed to create user record:",
                  userInsertError
                );
              } else {
                console.log(
                  "[INVITE API] User record created with status 'invited'"
                );
              }

              // Assign roles
              if (roleIds.length > 0) {
                const roleInserts = roleIds.map((roleId: string) => ({
                  user_id: newUserId,
                  role_id: roleId,
                  assigned_at: new Date().toISOString(),
                }));

                const { error: rolesInsertError } = await adminClient
                  .from("user_roles")
                  .insert(roleInserts);

                if (rolesInsertError) {
                  console.error(
                    "[INVITE API] Failed to assign roles:",
                    rolesInsertError
                  );
                } else {
                  console.log("[INVITE API] Roles assigned:", roleIds);
                }
              }
            }
          }
        }
      } else {
        // User has already confirmed their email - they're an existing user
        console.log("[INVITE API] User already has a confirmed account");

        // Check if they're already in our users table with this tenant
        const { data: existingDbUser } = await adminClient
          .from("users")
          .select("id, tenant_id")
          .eq("id", existingAuthUser.id)
          .single();

        if (existingDbUser?.tenant_id === currentUser.tenant_id) {
          // Already in this tenant
          authInviteError = {
            message: "This user is already a member of your team.",
          };
        } else {
          // User exists but in different tenant or no tenant
          // Use admin API to generate and send invite link (bypasses rate limits)
          console.log(
            "[INVITE API] Generating invite link for existing user..."
          );

          const { data: linkData, error: linkError } =
            await adminClient.auth.admin.generateLink({
              type: "invite",
              email: body.email.toLowerCase(),
              options: {
                redirectTo: redirectUrl,
                data: {
                  first_name: body.firstName,
                  last_name: body.lastName,
                  full_name: `${body.firstName} ${body.lastName}`,
                  designation: body.designation || null,
                  tenant_id: currentUser.tenant_id,
                  invitation_id: invitation.id,
                  role_ids: roleIds,
                },
              },
            });

          if (linkError) {
            console.error("[INVITE API] generateLink failed:", linkError);
            // Try magiclink as fallback
            const { data: magicLinkData, error: magicLinkError } =
              await adminClient.auth.admin.generateLink({
                type: "magiclink",
                email: body.email.toLowerCase(),
                options: {
                  redirectTo: redirectUrl,
                },
              });

            if (magicLinkError) {
              console.error(
                "[INVITE API] magiclink also failed:",
                magicLinkError
              );
              authInviteError = magicLinkError;
            } else {
              // Log the link for manual testing (in production, you'd send this via email service)
              console.log(
                "[INVITE API] Magic link generated (manual send required):",
                magicLinkData?.properties?.action_link
              );
              console.log(
                "[INVITE API] NOTE: Supabase generateLink doesn't auto-send emails."
              );
              console.log(
                "[INVITE API] For production, integrate with an email service like Resend, SendGrid, etc."
              );
              // Set error to inform user
              authInviteError = {
                message:
                  "User already has an account. Please ask them to sign in, or delete their auth account from Supabase dashboard to re-invite.",
              };
            }
          } else {
            console.log(
              "[INVITE API] Invite link generated:",
              linkData?.properties?.action_link
            );
            console.log(
              "[INVITE API] NOTE: generateLink doesn't auto-send. Need email service for production."
            );
            authInviteError = {
              message:
                "User already has an account. Please ask them to sign in, or delete their auth account from Supabase dashboard to re-invite.",
            };
          }
        }
      }
    } else {
      // New user - use inviteUserByEmail
      console.log("[INVITE API] Inviting new user via email...");
      console.log("[INVITE API] Email:", body.email.toLowerCase());
      console.log("[INVITE API] Redirect URL:", redirectUrl);

      const result = await adminClient.auth.admin.inviteUserByEmail(
        body.email.toLowerCase(),
        {
          redirectTo: redirectUrl,
          data: {
            first_name: body.firstName,
            last_name: body.lastName,
            full_name: `${body.firstName} ${body.lastName}`,
            designation: body.designation || null,
            tenant_id: currentUser.tenant_id,
            invitation_id: invitation.id,
            role_ids: roleIds,
          },
        }
      );

      console.log(
        "[INVITE API] inviteUserByEmail result:",
        JSON.stringify(result, null, 2)
      );

      authInvite = result.data;
      authInviteError = result.error;

      if (authInviteError) {
        console.error("[INVITE API] inviteUserByEmail FAILED!");
        console.error("[INVITE API] Error message:", authInviteError.message);
        console.error("[INVITE API] Error code:", authInviteError.code);
        console.error("[INVITE API] Error status:", authInviteError.status);
        console.error(
          "[INVITE API] Full error:",
          JSON.stringify(authInviteError, null, 2)
        );
      } else {
        console.log("[INVITE API] inviteUserByEmail SUCCEEDED!");
        console.log(
          "[INVITE API] Auth user created with ID:",
          authInvite?.user?.id
        );
        console.log("[INVITE API] Auth user email:", authInvite?.user?.email);

        // Create user record in users table with status 'invited'
        if (authInvite?.user?.id) {
          const newUserId = authInvite.user.id;

          // Create user record
          const { error: userInsertError } = await adminClient
            .from("users")
            .insert({
              id: newUserId,
              email: body.email.toLowerCase(),
              name: `${body.firstName} ${body.lastName}`.trim(),
              tenant_id: currentUser.tenant_id,
              status: "invited",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (userInsertError) {
            console.error(
              "[INVITE API] Failed to create user record:",
              userInsertError
            );
          } else {
            console.log(
              "[INVITE API] User record created with status 'invited'"
            );
          }

          // Assign roles to the user
          if (roleIds.length > 0) {
            const roleInserts = roleIds.map((roleId: string) => ({
              user_id: newUserId,
              role_id: roleId,
              assigned_at: new Date().toISOString(),
            }));

            const { error: rolesInsertError } = await adminClient
              .from("user_roles")
              .insert(roleInserts);

            if (rolesInsertError) {
              console.error(
                "[INVITE API] Failed to assign roles:",
                rolesInsertError
              );
            } else {
              console.log("[INVITE API] Roles assigned:", roleIds);
            }
          }
        }
      }
    }

    if (authInviteError) {
      console.log(
        "[INVITE API] Invitation created but email failed. Error:",
        authInviteError.message
      );
    } else {
      console.log("[INVITE API] Auth invite sent successfully to:", body.email);
    }

    return NextResponse.json(
      {
        success: true,
        message: authInviteError
          ? "Invitation created but email could not be sent. Please try resending."
          : "Invitation sent successfully",
        data: {
          invitation: {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            roles: roleNames,
            expires_at: invitation.expires_at,
            status: invitation.status,
          },
          emailSent: !authInviteError,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[INVITE API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send invitation" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/team/invite
 * Get all invitations for the current tenant
 */
export async function GET(request: NextRequest) {
  console.log("[INVITE API] GET /api/team/invite - Request received");

  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get user's tenant
    const { data: currentUser } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", authUser.id)
      .single();

    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Get all invitations for the tenant
    const { data: invitations, error: inviteError } = await supabase
      .from("user_invitations")
      .select(
        `
        *,
        role:roles(id, name, slug),
        invited_by:users!invited_by_user_id(id, name, email)
      `
      )
      .eq("tenant_id", currentUser.tenant_id)
      .order("created_at", { ascending: false });

    if (inviteError) {
      console.error("[INVITE API] Failed to get invitations:", inviteError);
      return NextResponse.json(
        { success: false, error: "Failed to get invitations" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: invitations,
    });
  } catch (error: any) {
    console.error("[INVITE API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to get invitations" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/team/invite
 * Resend an invitation email
 */
export async function PATCH(request: NextRequest) {
  console.log("[INVITE API] PATCH /api/team/invite - Resend invitation");

  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get user's tenant
    const { data: currentUser } = await supabase
      .from("users")
      .select("id, tenant_id, is_super_admin")
      .eq("id", authUser.id)
      .single();

    if (!currentUser?.tenant_id) {
      return NextResponse.json(
        { success: false, error: "User not found or no tenant" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { invitationId } = body;

    if (!invitationId) {
      return NextResponse.json(
        { success: false, error: "Invitation ID is required" },
        { status: 400 }
      );
    }

    // Get the invitation - allow resend for pending or expired
    const adminClient = createAdminClient();
    const { data: invitation, error: inviteError } = await adminClient
      .from("user_invitations")
      .select("*, metadata")
      .eq("id", invitationId)
      .eq("tenant_id", currentUser.tenant_id)
      .in("status", ["pending", "expired"])
      .single();

    if (inviteError || !invitation) {
      console.log("[INVITE API] Invitation lookup failed:", inviteError);
      return NextResponse.json(
        {
          success: false,
          error: "Invitation not found, already accepted, or cancelled",
        },
        { status: 404 }
      );
    }

    console.log(
      "[INVITE API] Found invitation:",
      invitation.id,
      invitation.email,
      invitation.status
    );

    // Get metadata or use defaults
    const metadata = invitation.metadata || {};
    const firstName = metadata.first_name || "Team Member";
    const lastName = metadata.last_name || "";
    const roleIds = metadata.role_ids || [invitation.role_id];

    // Generate new token and extend expiry
    const newToken = crypto.randomBytes(32).toString("hex");
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7);

    // Update the invitation with new token and reset status to pending
    const { error: updateError } = await adminClient
      .from("user_invitations")
      .update({
        token: newToken,
        status: "pending", // Reset to pending in case it was expired
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitationId);

    if (updateError) {
      console.error("[INVITE API] Failed to update invitation:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update invitation" },
        { status: 500 }
      );
    }

    console.log(
      "[INVITE API] Invitation updated, checking for existing auth user..."
    );

    // Check if user already exists in Supabase Auth
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingAuthUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === invitation.email.toLowerCase()
    );

    console.log("[INVITE API] Existing auth user found:", !!existingAuthUser);

    if (existingAuthUser) {
      // User already clicked the link and has an auth account
      // Use password reset flow instead of invite
      const { error: resetError } = await adminClient.auth.admin.generateLink({
        type: "recovery",
        email: invitation.email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/setup-password`,
        },
      });

      if (resetError) {
        console.error(
          "[INVITE API] Failed to send recovery email:",
          resetError
        );
        return NextResponse.json(
          {
            success: false,
            error:
              "User already registered. Please ask them to use 'Forgot Password' to set up their account.",
          },
          { status: 400 }
        );
      }

      console.log(
        "[INVITE API] Recovery link sent to existing user:",
        invitation.email
      );
      return NextResponse.json({
        success: true,
        message:
          "User already has an account. A password reset link has been sent.",
        data: {
          email: invitation.email,
          expires_at: newExpiresAt.toISOString(),
          existingUser: true,
        },
      });
    }

    // Resend invitation email using Supabase Auth
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/setup-password`;

    const { error: authInviteError } =
      await adminClient.auth.admin.inviteUserByEmail(invitation.email, {
        redirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          designation: metadata.designation || null,
          tenant_id: currentUser.tenant_id,
          invitation_id: invitation.id,
          role_ids: roleIds,
        },
      });

    if (authInviteError) {
      console.error("[INVITE API] Failed to resend email:", authInviteError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send email: " + authInviteError.message,
        },
        { status: 500 }
      );
    }

    console.log("[INVITE API] Invitation resent to:", invitation.email);

    return NextResponse.json({
      success: true,
      message: "Invitation resent successfully",
      data: {
        email: invitation.email,
        expires_at: newExpiresAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[INVITE API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to resend invitation" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team/invite
 * Cancel/delete a pending invitation
 */
export async function DELETE(request: NextRequest) {
  console.log("[INVITE API] DELETE /api/team/invite - Request received");

  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get user's tenant
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("id, tenant_id, is_super_admin")
      .eq("id", authUser.id)
      .single();

    if (userError || !currentUser?.tenant_id) {
      return NextResponse.json(
        { success: false, error: "Failed to get user details" },
        { status: 400 }
      );
    }

    // Check if user has permission to manage invitations
    if (!currentUser.is_super_admin) {
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role:roles(slug, hierarchy_level)")
        .eq("user_id", authUser.id);

      const hasPermission = userRoles?.some(
        (ur: any) => ur.role?.hierarchy_level <= 1
      );

      if (!hasPermission) {
        return NextResponse.json(
          {
            success: false,
            error: "You don't have permission to cancel invitations",
          },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get("id");

    if (!invitationId) {
      return NextResponse.json(
        { success: false, error: "Invitation ID is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Get the invitation first to verify it belongs to the tenant
    const { data: invitation, error: getError } = await adminClient
      .from("user_invitations")
      .select("id, email, status")
      .eq("id", invitationId)
      .eq("tenant_id", currentUser.tenant_id)
      .single();

    if (getError || !invitation) {
      return NextResponse.json(
        { success: false, error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.status === "accepted") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot cancel an already accepted invitation",
        },
        { status: 400 }
      );
    }

    console.log(
      "[INVITE API] Cancelling invitation:",
      invitationId,
      "current status:",
      invitation.status
    );

    // First, delete any existing cancelled invitations for this email/tenant to avoid unique constraint violation
    const { error: deleteError } = await adminClient
      .from("user_invitations")
      .delete()
      .eq("tenant_id", currentUser.tenant_id)
      .eq("email", invitation.email)
      .eq("status", "cancelled");

    if (deleteError) {
      console.log(
        "[INVITE API] Note: Could not delete old cancelled invitations:",
        deleteError.message
      );
      // Continue anyway - might not exist
    }

    // Update invitation status to cancelled
    const { data: updateData, error: updateError } = await adminClient
      .from("user_invitations")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitationId)
      .select();

    console.log("[INVITE API] Update result:", { updateData, updateError });

    if (updateError) {
      console.error("[INVITE API] Failed to cancel invitation:", updateError);
      console.error(
        "[INVITE API] Error details:",
        JSON.stringify(updateError, null, 2)
      );
      return NextResponse.json(
        {
          success: false,
          error: "Failed to cancel invitation: " + updateError.message,
        },
        { status: 500 }
      );
    }

    if (!updateData || updateData.length === 0) {
      console.error("[INVITE API] No rows updated - possible RLS issue");
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update invitation - no rows affected",
        },
        { status: 500 }
      );
    }

    // Also delete the user from Supabase Auth and users table if they were created but never confirmed
    // This allows the email to be re-invited later
    try {
      const { data: authUsers } = await adminClient.auth.admin.listUsers();
      const cancelledAuthUser = authUsers?.users?.find(
        (u) => u.email?.toLowerCase() === invitation.email.toLowerCase()
      );

      if (cancelledAuthUser) {
        // Only delete if user hasn't confirmed their email (hasn't set up their account)
        if (!cancelledAuthUser.email_confirmed_at) {
          console.log(
            "[INVITE API] Deleting unconfirmed auth user:",
            cancelledAuthUser.id
          );

          // First delete from user_roles table
          const { error: deleteRolesError } = await adminClient
            .from("user_roles")
            .delete()
            .eq("user_id", cancelledAuthUser.id);

          if (deleteRolesError) {
            console.log(
              "[INVITE API] Note: Could not delete user_roles:",
              deleteRolesError.message
            );
          } else {
            console.log("[INVITE API] User roles deleted");
          }

          // Then delete from users table
          const { error: deleteUserError } = await adminClient
            .from("users")
            .delete()
            .eq("id", cancelledAuthUser.id);

          if (deleteUserError) {
            console.log(
              "[INVITE API] Note: Could not delete from users table:",
              deleteUserError.message
            );
          } else {
            console.log("[INVITE API] User deleted from users table");
          }

          // Finally delete from auth
          const { error: deleteAuthError } =
            await adminClient.auth.admin.deleteUser(cancelledAuthUser.id);

          if (deleteAuthError) {
            console.error(
              "[INVITE API] Failed to delete auth user:",
              deleteAuthError
            );
            // Don't fail the request - the invitation was still cancelled
          } else {
            console.log("[INVITE API] Auth user deleted successfully");
          }
        } else {
          console.log(
            "[INVITE API] Auth user has confirmed email, not deleting:",
            cancelledAuthUser.id
          );
        }
      }
    } catch (authErr) {
      console.error("[INVITE API] Error checking/deleting auth user:", authErr);
      // Don't fail the request
    }

    console.log("[INVITE API] Invitation cancelled:", invitationId);

    return NextResponse.json({
      success: true,
      message: "Invitation cancelled successfully",
      data: { id: invitationId, email: invitation.email },
    });
  } catch (error: any) {
    console.error("[INVITE API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to cancel invitation" },
      { status: 500 }
    );
  }
}
