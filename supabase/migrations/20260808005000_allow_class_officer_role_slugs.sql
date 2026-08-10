-- Let the Class Officer roles exist.
--
-- 20260807020000 installed roles_slug_canonical, which permits only the five
-- roles that existed then: ac, president, asbo, committee_head, member. The
-- next migration, 20260808010000_class_officers_roles.sql, inserts
-- class_advisor and class_officer — and is rejected by that constraint. It has
-- therefore never applied to any database carrying it, which is every database
-- there is: neither the local stack nor the shared project lists 20260808010000
-- as applied.
--
-- This runs between the two and widens the constraint, so the Class Officers
-- migration can land. Nothing else changes; the roles themselves, and their
-- permission grants, still come from 20260808010000.
--
-- Filed at 005000 rather than alongside the newer work deliberately: a fix for
-- an ordering problem is only a fix if it is ordered correctly.

alter table public.roles
    drop constraint if exists roles_slug_canonical;

alter table public.roles
    add constraint roles_slug_canonical
    check (slug in (
        'ac',
        'president',
        'asbo',
        'committee_head',
        'class_officer',
        'class_advisor',
        'member'
    ));
