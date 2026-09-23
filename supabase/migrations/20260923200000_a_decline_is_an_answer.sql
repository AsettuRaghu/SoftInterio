-- "We asked, they said no" is not the same as "nobody has asked yet".
--
-- The room sheet is a questionnaire, and both of those looked identical: a
-- question with nothing picked. "Not needed" and "No" cleared the picks and
-- left no trace, so a wardrobe nobody had discussed read exactly like one
-- whose customer wanted no lighting - and the quotation came out a line
-- short with nothing on any screen saying so.
--
-- A decline is now stored on the component row as the key of the question
-- declined - `group_key ?? cost_item_id`, the same key the sheet groups by
-- and `scope_item_group_key()` computes, so a decision shared by two
-- categories ("How do the doors open?") is declined once.
--
-- It is text, not a foreign key, for the reason hold_reason_code is: a
-- category that is later retired must not erase the record that somebody
-- was asked about it and said no.

ALTER TABLE property_scope_items
  ADD COLUMN IF NOT EXISTS declined_decisions text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN property_scope_items.declined_decisions IS
  'Questions this component was asked and declined - group_key ?? cost_item_id. A declined question counts as answered; an empty one has not been asked.';
