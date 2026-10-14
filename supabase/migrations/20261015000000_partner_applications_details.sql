-- Partnership applications, second version of the form:
--  * "Other" answers are now specified in words: the organization type, the
--    support type and the field of interest each get an optional text column,
--    required (by the server and by the constraints below) when "other" is
--    chosen.
--  * The approved list of fields of interest replaces the first short list.
--
-- Additive and idempotent: adds three nullable columns and replaces one check
-- constraint with a wider one. No row is changed or removed. The values of
-- the first list stay allowed, so rows stored before this migration remain
-- valid. The new "other" rules are added NOT VALID: they apply to new and
-- updated rows only and never reject existing ones.

alter table public.partner_applications
  add column if not exists organization_category_other text,
  add column if not exists support_other text,
  add column if not exists interest_other text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'partner_applications_other_texts_length') then
    alter table public.partner_applications
      add constraint partner_applications_other_texts_length check (
        (organization_category_other is null or char_length(trim(organization_category_other)) between 2 and 120)
        and (support_other is null or char_length(trim(support_other)) between 2 and 120)
        and (interest_other is null or char_length(trim(interest_other)) between 2 and 120)
      );
  end if;

  -- Fields of interest: the approved list (plus the first list's values, kept for old rows).
  alter table public.partner_applications drop constraint if exists partner_applications_interest_fields_check;
  alter table public.partner_applications
    add constraint partner_applications_interest_fields_check check (
      cardinality(interest_fields) between 1 and 25
      and interest_fields <@ array[
        'tech_software', 'ai', 'electronics', 'ai_ml', 'data_science', 'cybersecurity', 'software_apps',
        'web_mobile', 'software_engineering', 'cloud', 'networks', 'robotics_mechatronics', 'iot', 'drones',
        'games_xr', 'ux_ui', 'design_3d', 'smart_cities', 'entrepreneurship', 'product_management', 'other',
        -- first list (kept for existing rows; no longer offered by the form)
        'all', 'robotics', 'programming', 'research'
      ]::text[]
    );

  -- "Other" is specified in words exactly when it is chosen (new rows only).
  if not exists (select 1 from pg_constraint where conname = 'partner_applications_other_specified') then
    alter table public.partner_applications
      add constraint partner_applications_other_specified check (
        (organization_category is distinct from 'other' or organization_category_other is not null)
        and (organization_category = 'other' or organization_category_other is null)
        and (('other' = any(support_types)) = (support_other is not null))
        and (('other' = any(interest_fields)) = (interest_other is not null))
      ) not valid;
  end if;
end
$$;
