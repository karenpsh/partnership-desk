-- Rebrand: AEON Bank -> Anon in existing seeded data (prompt templates that
-- the AI copilot uses, and the seed lesson). Idempotent: "AEON Bank" collapses
-- to "Anon" first, then any remaining "AEON" becomes "Anon". Safe to re-run.

update prompt_templates
set template_body = replace(replace(template_body, 'AEON Bank', 'Anon'), 'AEON', 'Anon')
where template_body like '%AEON%';

update lessons
set what_worked = replace(replace(what_worked, 'AEON Bank', 'Anon'), 'AEON', 'Anon')
where what_worked like '%AEON%';
