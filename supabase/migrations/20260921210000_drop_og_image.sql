-- The Open Graph card goes.
--
-- `og_image_path` was written and read by one panel in the studio and by
-- nothing else: not the reader, not the poster, not the Edge Function. It
-- described a link post's card, and these go out as photo posts — the picture
-- is the post, and Facebook never scrapes anything. No story ever had one set.
--
-- The public SEO website will need Open Graph tags when it is built, but it
-- will render them server-side from the story's own cover; a stored, separately
-- composed card is not the shape that job takes.

alter table public.cnt_stories drop column og_image_path;
