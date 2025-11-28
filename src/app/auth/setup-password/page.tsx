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
        // First, handle any hash fragments from the invite link
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1)
        );
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        console.log("[SetupPassword] Hash params:", {
          accessToken: !!accessToken,
          type,
        });

        // If we have tokens in the hash, set the session
        if (accessToken && refreshToken) {
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
            setUserEmail(data.user.email || null);
            // Clear the hash from URL for security
            window.history.replaceState(null, "", window.location.pathname);
          }
        } else {
          // Check existing session
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            setError(
              "No valid session found. Please use the invitation link from your email."
            );
            setIsCheckingSession(false);
            return;
          }

          setUserEmail(user.email || null);
        }
      } catch (err) {
        console.error("[SetupPassword] Error:", err);
        setError("Something went wrong. Please try again.");
      } finally {
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
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

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
            Set Your Password
          </h1>
          <p className="text-gray-600 text-sm">
            Welcome to SoftInterio! Please create a password to complete your
            account setup.
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
