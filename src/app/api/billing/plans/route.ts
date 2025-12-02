import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/billing/plans
// Returns all available subscription plans with features
export async function GET() {
  try {
    const supabase = await createClient();

    // Get all active plans for interiors tenant type
    const { data: plans, error: plansError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .eq("tenant_type", "interiors")
      .order("display_order", { ascending: true });

    if (plansError) {
      console.error("Error fetching plans:", plansError);
      return NextResponse.json(
        { error: "Failed to fetch plans" },
        { status: 500 }
      );
    }

    // Get features for all plans
    const planIds = plans?.map((p) => p.id) || [];

    const { data: features, error: featuresError } = await supabase
      .from("subscription_plan_features")
      .select("*")
      .in("plan_id", planIds);

    if (featuresError) {
      console.error("Error fetching features:", featuresError);
    }

    // Group features by plan
    const featuresByPlan: Record<string, NonNullable<typeof features>> = {};
    features?.forEach((f) => {
      if (!featuresByPlan[f.plan_id]) {
        featuresByPlan[f.plan_id] = [];
      }
      featuresByPlan[f.plan_id].push(f);
    });

    // Format response
    const formattedPlans = plans?.map((plan) => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      priceMonthly: plan.price_monthly,
      priceYearly: plan.price_yearly,
      maxUsers: plan.max_users,
      maxProjects: plan.max_projects,
      maxStorageGb: plan.max_storage_gb,
      isFeatured: plan.is_featured,
      displayOrder: plan.display_order,
      features: (featuresByPlan[plan.id] || []).map((f) => ({
        key: f.feature_key,
        name: f.feature_name,
        included: f.included,
        limit: f.limit_value,
      })),
    }));

    return NextResponse.json({
      plans: formattedPlans || [],
    });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
