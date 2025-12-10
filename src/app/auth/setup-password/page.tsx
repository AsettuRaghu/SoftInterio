"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function SetupPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Check if user has a valid session from the invite link
  useEffect(() => {
    const checkSession = async () => {
      try {
        console.log("[SetupPassword] Checking session...");
        console.log("[SetupPassword] Full URL:", window.location.href);
        console.log("[SetupPassword] Hash:", window.location.hash);
        console.log("[SetupPassword] Search:", window.location.search);

        // First, try to detect and refresh any existing session
        // This helps when Supabase has already set cookies but the client doesn't see them yet
        const { data: initialSession, error: initialError } =
          await supabase.auth.getSession();
        console.log("[SetupPassword] Initial session check:", {
          hasSession: !!initialSession?.session,
          error: initialError?.message,
        });

        // First, handle any hash fragments from the invite link (Supabase implicit flow)
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1)
        );
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const hashType = hashParams.get("type");
        const errorInHash = hashParams.get("error");
        const errorDescInHash = hashParams.get("error_description");

        console.log("[SetupPassword] Hash params:", {
          accessToken: !!accessToken,
          refreshToken: !!refreshToken,
          type: hashType,
          error: errorInHash,
        });

        // Handle error in hash
        if (errorInHash) {
          console.error(
            "[SetupPassword] Error in hash:",
            errorInHash,
            errorDescInHash
          );
          setError(
            errorDescInHash ||
              errorInHash ||
              "Authentication failed. Please try again."
          );
          setIsCheckingSession(false);
          return;
        }

        // If we have tokens in the hash, set the session
        if (accessToken && refreshToken) {
          console.log("[SetupPassword] Setting session from hash tokens...");
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error("[SetupPassword] Session error:", sessionError);
            setError(
              "Invalid or expired invitation link. Please request a new invite."
            );
            setIsCheckingSession(false);
            return;
          }

          if (data.user) {
            console.log("[SetupPassword] Session set for:", data.user.email);
            setUserEmail(data.user.email || null);
            // Clear the hash from URL for security
            window.history.replaceState(null, "", window.location.pathname);
            setIsCheckingSession(false);
            return;
          }
        }

        // Check for PKCE code in URL (callback might have redirected here)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");

        if (code) {
          console.log("[SetupPassword] Found PKCE code, exchanging...");
          const { data, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            console.error(
              "[SetupPassword] Code exchange error:",
              exchangeError
            );
            setError(
              "Invalid or expired invitation link. Please request a new invite."
            );
            setIsCheckingSession(false);
            return;
          }

          if (data.user) {
            console.log(
              "[SetupPassword] Session established for:",
              data.user.email
            );
            setUserEmail(data.user.email || null);
            // Clear the code from URL
            window.history.replaceState(null, "", window.location.pathname);
            setIsCheckingSession(false);
            return;
          }
        }

        // Check existing session (may have been set by callback route)
        const { data: sessionData } = await supabase.auth.getSession();

        if (sessionData?.session?.user) {
          console.log(
            "[SetupPassword] Found existing session:",
            sessionData.session.user.email
          );
          setUserEmail(sessionData.session.user.email || null);
          setIsCheckingSession(false);
          return;
        }

        // Last resort: check getUser
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          console.log("[SetupPassword] Found user via getUser:", user.email);
          setUserEmail(user.email || null);
          setIsCheckingSession(false);
          return;
        }

        // No session found
        console.log("[SetupPassword] No valid session found");
        setError(
          "No valid session found. Please click the invitation link from your email again."
        );
        setIsCheckingSession(false);
      } catch (err) {
        console.error("[SetupPassword] Error:", err);
        setError("Something went wrong. Please try again.");
        setIsCheckingSession(false);
      }
    };

    checkSession();
  }, [supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      // Update the user's password
      const { data: updateData, error: updateError } =
        await supabase.auth.updateUser({
          password: password,
          data: {
            password_set: true, // Mark that password has been set
          },
        });

      if (updateError) {
        console.error("[SetupPassword] Password update error:", updateError);
        throw updateError;
      }

      console.log("[SetupPassword] Password updated successfully");

      // Get the current user with metadata
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const metadata = user.user_metadata || {};
        console.log("[SetupPassword] User metadata:", metadata);

        // Call API to complete the user setup (create user record and assign roles)
        const setupResponse = await fetch("/api/auth/complete-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            email: user.email,
            firstName:
              metadata.first_name || metadata.name?.split(" ")[0] || "",
            lastName:
              metadata.last_name ||
              metadata.name?.split(" ").slice(1).join(" ") ||
              "",
            fullName:
              metadata.full_name ||
              metadata.name ||
              user.email?.split("@")[0] ||
              "",
            designation: metadata.designation || null,
            tenantId: metadata.tenant_id,
            invitationId: metadata.invitation_id,
            roleIds: metadata.role_ids || [],
          }),
        });

        const setupData = await setupResponse.json();
        console.log("[SetupPassword] Setup response:", setupData);

        if (!setupResponse.ok) {
          console.error("[SetupPassword] Setup failed:", setupData);
          // Don't block the user - they can still access with limited permissions
        }
      }

      setSuccess(true);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err: any) {
      console.error("[SetupPassword] Update error:", err);
      setError(err.message || "Failed to set password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="max-w-md mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
          <LoadingSpinner />
          <p className="text-gray-600">Verifying your invitation...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto">
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Account Setup Complete!
            </h1>
            <p className="text-gray-600 text-sm mt-2">
              Your password has been set successfully. Redirecting to
              dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !userEmail) {
    return (
      <div className="max-w-md mx-auto">
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Invalid Invitation
            </h1>
            <p className="text-gray-600 text-sm mt-2">{error}</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-medium text-amber-800 mb-2">
              What you can try:
            </h3>
            <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
              <li>Click the invitation link from your email again</li>
              <li>Ask your team admin to resend the invitation</li>
              <li>Make sure you&apos;re using the latest invitation email</li>
            </ul>
          </div>

          <div className="text-center">
            <a
              href="/auth/signin"
              className="text-blue-600 hover:text-blue-500 font-medium text-sm"
            >
              Go to Sign In
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="space-y-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Welcome to SoftInterio!
          </h1>
          <p className="text-gray-600 text-sm">
            Create a password to complete your account setup and get started.
          </p>
          {userEmail && (
            <p className="text-sm text-blue-600 mt-2 font-medium">
              {userEmail}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <FormField
            label="Password"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a strong password"
            required
            disabled={isLoading}
          />

          <FormField
            label="Confirm Password"
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            required
            disabled={isLoading}
          />

          <div className="text-xs text-gray-500">
            Password must be at least 8 characters long
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner />
                Setting Password...
              </span>
            ) : (
              "Complete Setup"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
