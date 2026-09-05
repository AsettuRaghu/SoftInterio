import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { protectApiRoute, createErrorResponse } from '@/lib/auth/api-guard';

// GET - Fetch all component types
export async function GET(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('component_types')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching component types:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in component-types GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new component type
export async function POST(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user!.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      description,
      is_active = true,
      applicable_space_types = null,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const { data, error } = await supabase
      .from('component_types')
      .insert({
        tenant_id: userData.tenant_id,
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        is_active,
        // Null means "suits any space". An empty array would read as "suits
        // nothing" and hide the component from every picker.
        applicable_space_types:
          Array.isArray(applicable_space_types) && applicable_space_types.length
            ? applicable_space_types
            : null,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      // 23505 is the (tenant_id, slug) unique index. The slug is derived from
      // the name, so this always means "that name is already taken" - which is
      // a correction the user can make, not a server fault.
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `A component type called "${name.trim()}" already exists` },
          { status: 409 }
        );
      }
      console.error('Error creating component type:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error in component-types POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH - Update a component type
export async function PATCH(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user!.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const body = await request.json();
    const { id, name, description, is_active, applicable_space_types } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) {
      updateData.name = name.trim();
      updateData.slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (is_active !== undefined) updateData.is_active = is_active;
    // An empty selection is stored as null, not an empty array: null means
    // "no restriction", whereas an empty array would read as "suits nothing"
    // and hide the component everywhere.
    if (applicable_space_types !== undefined) {
      updateData.applicable_space_types =
        Array.isArray(applicable_space_types) && applicable_space_types.length
          ? applicable_space_types
          : null;
    }

    const { data, error } = await supabase
      .from('component_types')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', userData.tenant_id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `Another component type already uses that name` },
          { status: 409 }
        );
      }
      console.error('Error updating component type:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in component-types PATCH:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete a component type
export async function DELETE(request: NextRequest) {
  try {
    // Protect API route
    const guard = await protectApiRoute(request);
    if (!guard.success) {
      return createErrorResponse(guard.error!, guard.statusCode!);
    }

    const { user } = guard;
    const supabase = await createClient();

    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user!.id)
      .single();

    if (!userData?.tenant_id) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Deleting a type that is in use does not fail - the foreign keys are
    // ON DELETE SET NULL, so quotations and scope rows silently lose their
    // classification and keep only a name. Refuse instead, and point at
    // deactivating, which hides it from pickers without rewriting history.
    const [{ count: usedInQuotations }, { count: usedInScope }] =
      await Promise.all([
        supabase
          .from('quotation_components')
          .select('*', { count: 'exact', head: true })
          .eq('component_type_id', id),
        supabase
          .from('property_scope_items')
          .select('*', { count: 'exact', head: true })
          .eq('component_type_id', id),
      ]);

    const inUse = (usedInQuotations || 0) + (usedInScope || 0);
    if (inUse > 0) {
      return NextResponse.json(
        {
          error: `This component is used in ${inUse} place${
            inUse === 1 ? '' : 's'
          } and cannot be deleted. Mark it inactive instead to hide it from new quotations.`,
        },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('component_types')
      .delete()
      .eq('id', id)
      .eq('tenant_id', userData.tenant_id);

    if (error) {
      console.error('Error deleting component type:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in component-types DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
