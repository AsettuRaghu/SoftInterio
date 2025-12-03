"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inviteData, setInviteData] = useState<{
    email: string;
    companyName: string;
    token: string;
  } | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Check for magic link tokens and validate invitation on mount
  useEffect(() => {
    const processInvitation = async () => {
      try {
        const token = searchParams.get("token");
        const email = searchParams.get("email");

        // First, check if there are tokens in the URL hash (from magic link)
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1)
        );
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          console.log(
            "[AcceptInvite] Magic link tokens found, setting session..."
          );

          // Set the session from magic link
          const { data: sessionData, error: sessionError } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

          if (sessionError) {
            console.error("[AcceptInvite] Session error:", sessionError);
            setError("Failed to verify your identity. Please try again.");
            setIsProcessing(false);
            return;
          }

          // Clear the hash from URL for security
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search
          );

          if (sessionData.user) {
            console.log(
              "[AcceptInvite] User authenticated via magic link:",
              sessionData.user.email
            );
            setIsAuthenticated(true);
          }
        } else {
          // Check if user already has a session
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            console.log(
              "[AcceptInvite] User already authenticated:",
              user.email
            );
            setIsAuthenticated(true);
          }
        }

        // Validate the invitation token
        if (!token || !email) {
          setError("Invalid invitation link. Missing required parameters.");
          setIsProcessing(false);
          return;
        }

        const response = await fetch(
          `/api/auth/validate-invite?token=${encodeURIComponent(
            token
          )}&email=${encodeURIComponent(email)}`
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          setError(
            data.error ||
              "Invalid or expired invitation. Please request a new one."
          );
          setIsProcessing(false);
          return;
        }

        setInviteData({
          email: data.data.email,
          companyName: data.data.companyName,
          token: token,
        });
      } catch (err) {
        console.error("[AcceptInvite] Error:", err);
        setError("Something went wrong. Please try again.");
      } finally {
        setIsProcessing(false);
      }
    };

    processInvitation();
  }, [searchParams, supabase.auth]);

  // Auto-accept if authenticated via magic link
  useEffect(() => {
    const autoAccept = async () => {
      if (isAuthenticated && inviteData && !success && !isLoading) {
        console.log(
          "[AcceptInvite] Auto-accepting invitation for authenticated user..."
        );
        await acceptInvitation();
      }
    };

    autoAccept();
  }, [isAuthenticated, inviteData]);

  const acceptInvitation = async () => {
    if (!inviteData) return;

    setIsLoading(true);
    setError("");

    try {
      const acceptResponse = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: inviteData.token,
          email: inviteData.email,
        }),
      });

      const acceptData = await acceptResponse.json();

      if (!acceptResponse.ok) {
        setError(acceptData.error || "Failed to accept invitation");
        setIsLoading(false);
        return;
      }

      setSuccess(true);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err: any) {
      console.error("[AcceptInvite] Error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password) {
      setError("Please enter your password");
      return;
    }

    if (!inviteData) {
      setError("Invalid invitation data");
      return;
    }

    setIsLoading(true);

    try {
      // Sign in with existing credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteData.email,
        password: password,
      });

      if (signInError) {
        if (signInError.message.includes("Invalid login credentials")) {
          setError("Incorrect password. Please try again.");
        } else {
          setError(signInError.message);
        }
        setIsLoading(false);
        return;
      }

      // Accept the invitation
      await acceptInvitation();
    } catch (err: any) {
      console.error("[AcceptInvite] Error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  if (isProcessing) {
    return (
      <div className="max-w-md mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
          <LoadingSpinner />
          <p className="text-gray-600">Validating your invitation...</p>
        </div>
      </div>
    );
  }

  // If authenticated via magic link and processing
  if (isAuthenticated && inviteData && isLoading) {
    return (
      <div className="max-w-md mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
          <LoadingSpinner />
          <p className="text-gray-600">Joining {inviteData.companyName}...</p>
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
              Invitation Accepted!
            </h1>
            <p className="text-gray-600 text-sm mt-2">
              You have joined <strong>{inviteData?.companyName}</strong>.
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !inviteData) {
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
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Join {inviteData?.companyName}
          </h1>
          <p className="text-gray-600 text-sm">
            You&apos;ve been invited to join{" "}
            <strong>{inviteData?.companyName}</strong>. Sign in with your
            existing password to accept.
          </p>
          {inviteData?.email && (
            <p className="text-sm text-blue-600 mt-2 font-medium">
              {inviteData.email}
            </p>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> You already have an account. Just enter your
            existing password to join this organization.
          </p>
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
            placeholder="Enter your existing password"
            required
            disabled={isLoading}
          />

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner />
                Joining...
              </span>
            ) : (
              "Accept Invitation"
            )}
          </Button>

          <div className="text-center">
            <a
              href="/auth/forgot-password"
              className="text-blue-600 hover:text-blue-500 font-medium text-sm"
            >
              Forgot your password?
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto">
          <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
            <LoadingSpinner />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
