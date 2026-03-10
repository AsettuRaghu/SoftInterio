-- Migration: Add subscription_payments table for Phase 4 payment processing
-- Created: 2026-02-26
-- Purpose: Store payment transaction records from Razorpay

-- Create the subscription_payments table
CREATE TABLE IF NOT EXISTS "public"."subscription_payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "currency" character(3) DEFAULT 'INR'::"bpchar" NOT NULL,
    "status" character varying(50) DEFAULT 'pending' NOT NULL,
    "external_id" character varying(255) NOT NULL,
    "billing_cycle" "public"."billing_cycle_enum" DEFAULT 'monthly'::"public"."billing_cycle_enum" NOT NULL,
    "description" "text",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- Set owner
ALTER TABLE "public"."subscription_payments" OWNER TO "postgres";

-- Add primary key constraint
ALTER TABLE ONLY "public"."subscription_payments"
    ADD CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id");

-- Create indexes for fast queries
CREATE UNIQUE INDEX "idx_subscription_payments_external_id" ON "public"."subscription_payments" USING "btree" ("external_id");
CREATE INDEX "idx_subscription_payments_tenant_id" ON "public"."subscription_payments" USING "btree" ("tenant_id");
CREATE INDEX "idx_subscription_payments_status" ON "public"."subscription_payments" USING "btree" ("status");

-- Grant permissions to all roles
GRANT ALL ON TABLE "public"."subscription_payments" TO "anon";
GRANT ALL ON TABLE "public"."subscription_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_payments" TO "service_role";

-- Add comments for documentation
COMMENT ON TABLE "public"."subscription_payments" IS 'Stores payment transaction records from Razorpay for subscription processing';
COMMENT ON COLUMN "public"."subscription_payments"."external_id" IS 'Razorpay order ID - unique identifier for each payment order';
COMMENT ON COLUMN "public"."subscription_payments"."status" IS 'Payment status: pending, success, or failed';
COMMENT ON COLUMN "public"."subscription_payments"."billing_cycle" IS 'Billing cycle type: monthly or yearly';
