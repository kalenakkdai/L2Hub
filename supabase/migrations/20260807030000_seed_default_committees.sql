-- Seed the default L2 Hub committees.
--
-- Idempotent: unique slug conflict leaves the existing row unchanged.
-- Safe to re-run after partial applies or local seed fixtures.

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
    ('videography_photography', 'Videography / Photography')
on conflict (slug) do nothing;
