"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function ConfirmationPage() {
  return (
    <div className="max-w-md mx-auto">
      <div className="space-y-6 text-center">
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
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

          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">
              Account Activated Successfully!
            </h1>
            <p className="text-gray-600 text-base mb-2">
              Welcome to SoftInterio! Your account has been activated.
            </p>
            <p className="text-gray-600 text-sm">
              You can now sign in to access your dashboard and start managing
              your interior design projects.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Link href="/auth/signin">
            <Button className="w-full" size="lg">
              Sign In to Your Account
            </Button>
          </Link>
          <p className="text-xs text-gray-500">
            You can now sign in with your email and password
          </p>
        </div>
      </div>
    </div>
  );
}
