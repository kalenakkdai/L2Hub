-- Align default L2 Hub committees with the Leadership 2 roster names.
--
-- Idempotent: inserts missing slugs, updates display names for known slugs.
-- Contact emails live in the app fixture until committees.contact_email lands.

insert into public.committees (slug, name)
values
    ('activities', 'Activities'),
    ('community', 'Community'),
    ('elections', 'Elections'),
    ('fundraising', 'Fundraising'),
    ('gtac', 'GTAC'),
    ('hcmc', 'HCMC'),
    ('publicity', 'Publicity'),
    ('student_store', 'Student Store'),
    ('star', 'STAR'),
    ('sports', 'Sports'),
    ('tech', 'Tech'),
    ('videography_photography', 'Videography/Photography')
on conflict (slug) do update
set name = excluded.name;
