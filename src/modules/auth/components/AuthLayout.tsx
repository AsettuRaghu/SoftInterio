"use client";

import { Logo } from "@/components/ui/Logo";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-screen">
        {/* Left Side - Simple Branding */}
        <div className="hidden lg:flex lg:w-1/4 bg-white border-r border-gray-200">
          <div className="flex items-center justify-center w-full h-full">
            <div className="text-center px-8">
              <div className="mb-8 flex justify-center">
                <Logo size="xl" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                SoftInterio
              </h2>
              <p className="text-gray-600 text-base max-w-sm mx-auto">
                Modern interior design project management made simple
              </p>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-full lg:w-3/4 flex items-center justify-center p-6 lg:p-8">
          <div className="w-full">
            <div className="lg:hidden text-center mb-8">
              <Logo size="lg" />
              <h2 className="text-xl font-semibold text-gray-900 mt-4 mb-2">
                SoftInterio
              </h2>
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
