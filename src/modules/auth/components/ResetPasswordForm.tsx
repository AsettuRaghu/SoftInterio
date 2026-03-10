"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import {
  validatePassword,
  DEFAULT_PASSWORD_POLICY,
} from "@/lib/auth/password-validation";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Check if we have either code or access token from the URL
  useEffect(() => {
    const code = searchParams.get("code");
    const accessToken = searchParams.get("access_token");

    if (!code && !accessToken) {
      setError(
        "Invalid or expired reset link. Please request a new password reset.",
      );
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    const passwordValidation = validatePassword(
      password,
      DEFAULT_PASSWORD_POLICY,
    );
    if (!passwordValidation.isValid) {
      setError(
        passwordValidation.errors[0]?.message ||
          "Password does not meet requirements",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const code = searchParams.get("code");
      const accessToken = searchParams.get("access_token");

      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
          code,
          accessToken,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to reset password");
      }

      setSuccess(true);

      // Redirect to signin after 2 seconds
      setTimeout(() => {
        router.push("/auth/signin");
      }, 2000);
    } catch (error: any) {
      setError(error.message || "Failed to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto">
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-green-600"
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
              Password Reset Successful
            </h1>
            <p className="text-gray-600 text-sm mt-2">
              Your password has been reset successfully. Redirecting to sign
              in...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Reset Your Password
          </h1>
          <p className="text-gray-600 text-sm">Enter your new password below</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <FormField
            label="New Password"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your new password"
            required
            disabled={isLoading}
          />

          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-600">
              Password must contain:
            </p>
            <ul className="text-xs text-gray-600 space-y-0.5">
              <li className="flex items-center gap-2">
                <span
                  className={`w-4 h-4 flex items-center justify-center rounded ${
                    password.length >= 8
                      ? "bg-green-100 text-green-600"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {password.length >= 8 ? "✓" : "•"}
                </span>
                At least 8 characters
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={`w-4 h-4 flex items-center justify-center rounded ${
                    /[a-zA-Z]/.test(password)
                      ? "bg-green-100 text-green-600"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {/[a-zA-Z]/.test(password) ? "✓" : "•"}
                </span>
                At least one letter (A-Z or a-z)
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={`w-4 h-4 flex items-center justify-center rounded ${
                    /\d/.test(password)
                      ? "bg-green-100 text-green-600"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {/\d/.test(password) ? "✓" : "•"}
                </span>
                At least one number (0-9)
              </li>
            </ul>
          </div>

          <FormField
            label="Confirm Password"
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your new password"
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
              <>
                <LoadingSpinner />
                Resetting Password...
              </>
            ) : (
              "Reset Password"
            )}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Remember your password?{" "}
            <Link
              href="/auth/signin"
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
