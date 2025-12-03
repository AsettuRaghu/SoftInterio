"use client";

import { Suspense } from "react";
import { SignInForm } from "@/modules/auth/components/SignInForm";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[300px]">
          <LoadingSpinner />
          <p className="text-gray-600 mt-4">Loading...</p>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
