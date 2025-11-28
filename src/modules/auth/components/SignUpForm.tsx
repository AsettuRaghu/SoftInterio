"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  companyType: string;
  selectedPlan: string;
}

interface CompanyType {
  value: string;
  label: string;
  description: string;
  icon: string;
}

interface Plan {
  id: string;
  name: string;
  emoji: string;
  subtitle: string;
  description: string;
  price: string;
  period: string;
  features: string[];
  highlight: string;
  popular?: boolean;
}

const companyTypes: CompanyType[] = [
  {
    value: "interiors",
    label: "Interior Design Company",
    description: "Interior design companies and studios",
    icon: "",
  },
];

const plans: Plan[] = [
  {
    id: "classic",
    name: "Classic",
    emoji: "",
    subtitle: "Essential Features",
    description: "Perfect for solo designers & small studios.",
    price: "₹10,000",
    period: "per year",
    features: [
      "Project Management",
      "Client Portal",
      "Document Storage",
      "Basic Reporting",
      "Email Support",
    ],
    highlight: "Simple, powerful foundation for growing studios.",
  },
  {
    id: "signature",
    name: "Signature",
    emoji: "",
    subtitle: "Enhanced Collaboration",
    description: "For studios that need advanced workflow and team features.",
    price: "₹20,000",
    period: "per year",
    features: [
      "Everything in Classic",
      "Advanced Team Management",
      "Financial Reporting",
      "Vendor Management",
      "Custom Dashboards",
      "Priority Support",
    ],
    highlight: "Perfect balance of features and simplicity.",
    popular: true,
  },
  {
    id: "masterpiece",
    name: "Masterpiece",
    emoji: "",
    subtitle: "Complete Solution",
    description: "For large studios needing enterprise-level features.",
    price: "₹50,000",
    period: "per year",
    features: [
      "Everything in Signature",
      "Staff Management",
      "Sales & Marketing Tools",
      "Advanced Analytics",
      "White-label Options",
      "Dedicated Account Manager",
    ],
    highlight: "Complete business management solution.",
  },
];

export function SignUpForm() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    companyType: "interiors",
    selectedPlan: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.phone ||
      !formData.password ||
      !formData.companyName ||
      !formData.companyType
    ) {
      setError("Please fill in all required fields");
      return;
    }
    setStep(2);
  };

  const handlePlanSelection = (planId: string) => {
    setFormData((prev) => ({ ...prev, selectedPlan: planId }));
  };

  const handleFinalSubmit = async () => {
    if (!formData.selectedPlan) {
      setError("Please select a subscription plan");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      // Call signup API
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: `${formData.firstName} ${formData.lastName}`,
          company_name: formData.companyName,
          tenant_type: formData.companyType,
          phone: formData.phone,
          selected_plan: formData.selectedPlan,
        }),
      });
      // Log response status for debugging
      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers.get("content-type"));
      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        throw new Error("Server error. Please check the console for details.");
      }
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create account");
      }
      // Success! Redirect to activation page
      router.push("/auth/activate");
    } catch (error: any) {
      console.error("Signup error:", error);
      setError(error.message || "Failed to create account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Create Your Account
        </h1>
        <p className="text-gray-600 text-sm">
          Step 1 of 2: Personal & Company Details
        </p>
      </div>

      {/* Modal Popup for Error */}
      {error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setError("")}
          ></div>
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <p className="text-base text-gray-800 font-medium text-center mb-4">
              {error}
            </p>
            <Button onClick={() => setError("")} className="w-full" size="sm">
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleStep1Submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="First Name"
            id="firstName"
            value={formData.firstName}
            onChange={(e) => handleInputChange("firstName", e.target.value)}
            placeholder="First name"
            required
          />
          <FormField
            label="Last Name"
            id="lastName"
            value={formData.lastName}
            onChange={(e) => handleInputChange("lastName", e.target.value)}
            placeholder="Last name"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Email"
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            placeholder="Enter your email"
            required
          />
          <FormField
            label="Phone Number"
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => handleInputChange("phone", e.target.value)}
            placeholder="Enter your phone number"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Company Name"
            id="companyName"
            value={formData.companyName}
            onChange={(e) => handleInputChange("companyName", e.target.value)}
            placeholder="Your company name"
            required
          />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-900">
              Company Type <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.companyType}
              onChange={(e) => handleInputChange("companyType", e.target.value)}
              className="w-full h-11 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {companyTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Password"
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => handleInputChange("password", e.target.value)}
            placeholder="Create a password"
            required
          />
          <FormField
            label="Confirm Password"
            id="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={(e) =>
              handleInputChange("confirmPassword", e.target.value)
            }
            placeholder="Confirm your password"
            required
          />
        </div>

        <div className="pt-2">
          <Button type="submit" className="w-full" size="lg">
            Continue to Plans
          </Button>
        </div>
      </form>

      <div className="text-center mt-4">
        <p className="text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            href="/auth/signin"
            className="text-blue-600 hover:text-blue-500 font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="w-full max-w-5xl mx-auto px-4">
      <div className="text-center mb-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Choose Your Plan
        </h1>
        <p className="text-gray-600 text-sm">
          Step 2 of 2: Select a subscription plan
        </p>
      </div>

      {/* Modal Popup for Error */}
      {error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setError("")}
          ></div>
          <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <p className="text-base text-gray-800 font-medium text-center mb-4">
              {error}
            </p>
            <Button onClick={() => setError("")} className="w-full" size="sm">
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {plans.map((plan) => (
          <div
            key={plan.id}
            onClick={() => handlePlanSelection(plan.id)}
            className={`relative flex flex-col rounded-2xl border-2 p-6 cursor-pointer transition-all duration-300 ${
              formData.selectedPlan === plan.id
                ? "border-blue-500 bg-blue-50 shadow-xl scale-[1.02]"
                : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-lg"
            } ${plan.popular ? "ring-2 ring-blue-400" : ""}`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-4 py-1 rounded-full shadow">
                Most Popular
              </div>
            )}

            {/* Selection indicator */}
            <div className="absolute top-4 right-4">
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  formData.selectedPlan === plan.id
                    ? "border-blue-500 bg-blue-500"
                    : "border-gray-300"
                }`}
              >
                {formData.selectedPlan === plan.id && (
                  <svg
                    className="w-4 h-4 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </div>

            {/* Plan header */}
            <div className="text-center mb-4 pt-2">
              <h3 className="text-xl font-bold text-gray-900 mb-1">
                {plan.name}
              </h3>
              <p className="text-sm text-blue-600 font-medium">
                {plan.subtitle}
              </p>
            </div>

            {/* Price */}
            <div className="text-center mb-4">
              <span className="text-3xl font-bold text-gray-900">
                {plan.price}
              </span>
              <span className="text-gray-500 text-sm">
                /{plan.period.split(" ")[1]}
              </span>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-600 text-center mb-4">
              {plan.description}
            </p>

            {/* Features */}
            <div className="flex-1">
              <ul className="space-y-2">
                {plan.features.map((feature, idx) => (
                  <li
                    key={idx}
                    className="flex items-start text-sm text-gray-700"
                  >
                    <svg
                      className="w-4 h-4 text-green-500 mr-2 mt-0.5 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            {/* Highlight */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-blue-600 italic text-center">
                {plan.highlight}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-md mx-auto">
        <Button
          variant="outline"
          onClick={() => setStep(1)}
          className="w-full sm:w-auto px-8"
          size="lg"
        >
          Back
        </Button>
        <Button
          onClick={handleFinalSubmit}
          className="w-full sm:w-auto px-8"
          disabled={!formData.selectedPlan || isLoading}
          size="lg"
        >
          {isLoading ? (
            <>
              <LoadingSpinner />
              Creating account...
            </>
          ) : (
            "Create Account"
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 to-blue-50 px-4 py-6">
      {step === 1 ? renderStep1() : renderStep2()}
    </div>
  );
}
