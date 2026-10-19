-- =============================================================================
-- 0025_retro_section_notes
--
-- Per-section free-form rich-text note (HTML from Tiptap), shown under each
-- section's cards. NULL = no note. Idempotent.
-- =============================================================================

ALTER TABLE retro_sections ADD COLUMN IF NOT EXISTS notes text;
