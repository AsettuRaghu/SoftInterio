"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { authLogger } from "@/lib/logger";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for error params from middleware redirects
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "account_deactivated") {
      setError(
        "Your account has been deactivated. Please contact your administrator."
      );
    } else if (errorParam === "access_revoked") {
      setError(
        "Your access to this organization has been revoked. Please contact your administrator."
      );
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    authLogger.info("Sign in attempt", { action: "SIGNIN", email });

    try {
      // Call signin API
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to sign in");
      }

      authLogger.info("Sign in successful, redirecting to dashboard", {
        action: "SIGNIN",
      });

      // Success! Redirect to dashboard
      // Keep isLoading true - the component will unmount during redirect
      router.push("/dashboard");
      router.refresh(); // Refresh to update auth state
    } catch (error: any) {
      authLogger.error("Sign in failed", error, { action: "SIGNIN", email });
      setError(
        error.message || "Failed to sign in. Please check your credentials."
      );
      // Only reset loading on error - not on success (redirect will unmount)
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">
            Welcome Back
          </h1>
          <p className="text-slate-700 text-sm">Sign in to your account</p>
        </div>

        {/* Custom error message box */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between mb-2">
            <div>
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="ml-4 px-3 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 text-xs font-semibold transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="Email"
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />

          <FormField
            label="Password"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="ml-2 text-slate-700">Remember me</span>
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-blue-600 hover:text-blue-500"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
            size="lg"
          >
            {isLoading ? (
              <>
                <LoadingSpinner />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-sm text-slate-600">
            Don't have an account?{" "}
            <Link
              href="/auth/signup"
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
