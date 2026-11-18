-- ECES Bayanihan: backup fingerprint.
-- Run this on the live database (Supabase > SQL Editor) and on the restored copy. The two results must match line for line.
-- It shows only counts and fingerprints, never names or file contents.
select 'school record' as part, count(*) as rows, md5(coalesce(string_agg(body::text, '' order by id), '')) as fingerprint from school
union all
select 'attachments', count(*), md5(coalesce(string_agg(id || ':' || md5(data), ',' order by id), '')) from files
union all
select 'attachment bytes', coalesce(sum(octet_length(data)), 0), null from files
union all
select 'sign-in records', count(*), md5(coalesce(string_agg(id || ':' || encode(digest, 'hex'), ',' order by id), '')) from auth
union all
select 'record history', count(*), null from school_history
order by part;
