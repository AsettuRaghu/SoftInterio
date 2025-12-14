
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load env vars
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkProject() {
  console.log("Fetching a project...");
  
  // Get any project
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Error fetching projects:", error);
    return;
  }

  if (!projects || projects.length === 0) {
    console.log("No projects found.");
    return;
  }

  const project = projects[0];
  console.log("Project ID:", project.id);
  console.log("Project ID (client_id):", project.client_id);
  console.log("Project ID (property_id):", project.property_id);
  console.log("Project ID (converted_from_lead_id):", project.converted_from_lead_id);
  
  console.log("--- Checking Relations ---");

  if (project.client_id) {
    const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", project.client_id)
        .single();
    if (clientError) console.error("Error fetching client:", clientError);
    else console.log("Client found:", client ? "Yes" : "No", client?.name);
  } else {
      console.log("No client_id set on project.");
  }

  if (project.property_id) {
    const { data: prop, error: propError } = await supabase
        .from("properties")
        .select("*")
        .eq("id", project.property_id)
        .single();
    if (propError) console.error("Error fetching property:", propError);
    else console.log("Property found:", prop ? "Yes" : "No", prop?.property_name);
  } else {
      console.log("No property_id set on project.");
  }
}

checkProject().catch(console.error);
