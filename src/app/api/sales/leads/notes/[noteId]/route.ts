import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/sales/leads/notes/[noteId] - Update a note
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const supabase = await createClient();
    const { noteId } = await params;
    const body = await request.json();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Update the note
    const { data: note, error } = await supabase
      .from("lead_notes")
      .update({
        content: body.content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", noteId)
      .select()
      .single();

    if (error) {
      console.error("Error updating note:", error);
      return NextResponse.json(
        { error: "Failed to update note" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error("Error updating note:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/sales/leads/notes/[noteId] - Delete a note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const supabase = await createClient();
    const { noteId } = await params;

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete the note
    const { error } = await supabase
      .from("lead_notes")
      .delete()
      .eq("id", noteId);

    if (error) {
      console.error("Error deleting note:", error);
      return NextResponse.json(
        { error: "Failed to delete note" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting note:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
