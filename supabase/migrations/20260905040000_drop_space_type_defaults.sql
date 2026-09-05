-- Remove the "typical components per space type" feature.
--
-- The idea was that adding four bedrooms would also add each one's usual
-- wardrobe and false ceiling. In practice the variance is at the wrong level:
-- a master bedroom, a child's room and a guest room share a space type but not
-- their contents, so one default per type over-applies in most rooms and the
-- seller ends up deleting more than they would have added.
--
-- The other half of the same relationship survives and is the useful one:
-- component_types.applicable_space_types filters the picker to components that
-- suit the space. Filtering costs the seller nothing and cannot over-apply -
-- the worst case is an unclassified component staying visible.
--
-- Dropped rather than left in place: the table was never populated, and a
-- table nothing reads or writes is the dead weight this codebase already has
-- too much of.

DROP TABLE IF EXISTS "public"."space_type_default_components";
