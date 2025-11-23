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
  selectedPlan: string;
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
    selectedPlan: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords don't match");
      return;
    }

    if (
      !formData.firstName ||
      !formData.lastName ||
      !formData.email ||
      !formData.phone ||
      !formData.password ||
      !formData.companyName
    ) {
      alert("Please fill in all required fields");
      return;
    }

    setStep(2);
  };

  const handlePlanSelection = (planId: string) => {
    setFormData((prev) => ({ ...prev, selectedPlan: planId }));
  };

  const handleFinalSubmit = async () => {
    if (!formData.selectedPlan) {
      alert("Please select a subscription plan");
      return;
    }

    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      router.push("/auth/activate");
    }, 2000);
  };

  const renderStep1 = () => (
    <div className="max-w-md mx-auto">
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Create Your Account
          </h1>
          <p className="text-gray-600 text-sm">
            Step 1 of 2: Personal & Company Details
          </p>
        </div>

        <form onSubmit={handleStep1Submit} className="space-y-4">
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

          <FormField
            label="Registered Company Name"
            id="companyName"
            value={formData.companyName}
            onChange={(e) => handleInputChange("companyName", e.target.value)}
            placeholder="Your company name"
            required
          />

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

          <Button type="submit" className="w-full" size="lg">
            Continue to Plans
          </Button>
        </form>

        <div className="text-center">
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
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          Choose Your Plan
        </h1>
        <p className="text-gray-600 text-base">
          Step 2 of 2: Select the perfect plan for your studio
        </p>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative border-2 rounded-2xl p-8 cursor-pointer transition-all duration-300 hover:shadow-xl ${
                formData.selectedPlan === plan.id
                  ? "border-blue-500 bg-blue-50 shadow-lg scale-105"
                  : "border-gray-200 hover:border-blue-300 hover:shadow-md"
              } ${plan.popular ? "ring-2 ring-blue-200 shadow-lg" : ""}`}
              onClick={() => handlePlanSelection(plan.id)}
            >
              {plan.popular && (
                <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-linear-to-r from-blue-500 to-blue-600 text-white text-base font-semibold px-6 py-2.5 rounded-full shadow-lg">
                  ⭐ Most Popular
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-lg font-semibold text-blue-600 mb-3">
                  {plan.subtitle}
                </p>

                {/* Pricing */}
                <div className="mb-4">
                  <div className="flex items-baseline justify-center mb-1">
                    <span className="text-xl font-bold text-gray-900">
                      {plan.price}
                    </span>
                    <span className="text-lg text-gray-600 ml-1">
                      /{plan.period.split(" ")[1]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">{plan.period}</p>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed">
                  {plan.description}
                </p>
              </div>

              {/* Features List */}
              <div className="mb-6">
                <div className="text-sm font-semibold text-gray-800 mb-4">
                  What's included:
                </div>
                <div className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start">
                      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mr-3 mt-0.5 shrink-0">
                        <svg
                          className="w-3 h-3 text-green-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700 leading-relaxed">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Highlight */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm text-blue-600 font-medium text-center italic">
                  {plan.highlight}
                </p>
              </div>

              {/* Selection Indicator */}
              <div className="absolute top-6 right-6">
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    formData.selectedPlan === plan.id
                      ? "border-blue-500 bg-blue-500 shadow-md"
                      : "border-gray-300"
                  }`}
                >
                  {formData.selectedPlan === plan.id && (
                    <svg
                      className="w-3 h-3 text-white"
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
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-md mx-auto space-y-3">
        <Button
          onClick={handleFinalSubmit}
          className="w-full"
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

        <Button
          variant="outline"
          onClick={() => setStep(1)}
          className="w-full"
          size="lg"
        >
          Back to Details
        </Button>
      </div>

      <div className="text-xs text-gray-600 text-center">
        By creating an account, you agree to our{" "}
        <a href="#" className="text-blue-600 hover:text-blue-500">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="text-blue-600 hover:text-blue-500">
          Privacy Policy
        </a>
        .
      </div>
    </div>
  );

  return step === 1 ? renderStep1() : renderStep2();
}
