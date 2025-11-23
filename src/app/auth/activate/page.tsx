"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function ActivatePage() {
  return (
    <div className="max-w-md mx-auto">
      <div className="space-y-6 text-center">
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
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
                d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">
              Check Your Email
            </h1>
            <p className="text-gray-600 text-sm">
              Please check your inbox and click the activation link to complete
              your account setup and access your SoftInterio dashboard.
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex flex-col items-center text-center">
            <div className="shrink-0 mb-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Important:</p>
              <p>
                The activation link will expire in 24 hours. If you don't see
                the email, please check your spam folder.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-gray-600">Didn't receive the email?</p>

          <Button variant="outline" className="w-full" size="lg">
            Resend Activation Email
          </Button>

          <div className="flex flex-col space-y-2 text-xs text-gray-500">
            <Link
              href="/auth/signin"
              className="text-blue-600 hover:text-blue-500"
            >
              Back to Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="text-blue-600 hover:text-blue-500"
            >
              Create a Different Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
