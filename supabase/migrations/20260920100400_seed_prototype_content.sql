-- Development seed: the categories, stories and community content from the
-- prototypes in docs/screens, so the reader app renders real data end to end.
-- Idempotent, and safe to drop wholesale once real content is loaded.

insert into public.cnt_categories (slug, name, sort_order) values
  ('marriage',       'Marriage',       1),
  ('trust',          'Trust',          2),
  ('money',          'Money',          3),
  ('in-laws',        'In-Laws',        4),
  ('parenting',      'Parenting',      5),
  ('family',         'Family',         6),
  ('reconciliation', 'Reconciliation', 7)
on conflict (slug) do nothing;

with story_seed (slug, title, summary, category_slug, author_alias, planned_part_count, published_on, creator_note, part_body) as (
  values
    (
      'the-number-i-kept-calling',
      'The Number I Kept Calling',
      'A wife finds a number she does not recognise, and spends three weeks deciding whether to dial it.',
      'trust', 'Anonymous Wife', 5::smallint, '2026-09-18'::date,
      'What she is describing is not weakness. It is the long pause many women take before they ask a question they cannot unask. I asked her, in our third call, what she was protecting during those three weeks. She said: the version of him I still loved. That is worth sitting with before we judge anyone for waiting.',
      E'The number was saved under a name that meant nothing to me. Not a woman’s name. Not a name at all, really — two letters and a full stop.\n\nI want to be honest about what I did next, because I have read enough of these stories to know that we all pretend we were calmer than we were. I did not confront him. I wrote the number on the back of a receipt and put the receipt in my handbag, and for three weeks I carried it around Lusaka like a stone in my shoe.\n\nI called it for the first time on a Tuesday, from the car park at work. It rang four times and I ended the call. The next day I called again and a woman answered. I said nothing. She said hello twice, and then, "Bwanji?" and I put the phone down and sat with my hands on the steering wheel for a long time.\n\nWhat I have not told anyone until now is that part of me did not want to know. Our marriage was eleven years old. We had built something — two children, a house that was still being finished one room at a time, a Sunday routine. Knowing would mean choosing, and I was not ready to choose.\n\nWhen I finally asked him, I did not ask the question I had been rehearsing. I asked him something smaller. I asked him if he was happy.'
    ),
    (
      'the-money-we-never-talked-about',
      'The Money We Never Talked About',
      'Two salaries, one household, and a silence about money that lasted six years.',
      'money', 'Anonymous Wife', 4::smallint, '2026-09-11'::date,
      'Money silence is rarely about money. It is usually about what we were taught money means — control, shame, respect, or love. When couples tell me they "just never discussed it", I ask them what they were each afraid the conversation would reveal.',
      E'We were married for six years before either of us said out loud how much we earned.\n\nIt started as politeness. In my family, money was not discussed at the table. In his family, it was discussed constantly and loudly, and he hated it. So we agreed without ever agreeing: he paid the rent and the school fees, I paid for food, and everything else was handled by whoever noticed it first.\n\nThe problem with a system like that is that it works until it doesn’t. When his contract ended, we had no idea what we had between us, because we had never put the two halves together.\n\nThe first time we sat down with a notebook and wrote everything down, I cried. Not because the number was bad. Because it took us six years to look at it together.'
    ),
    (
      'my-mother-in-law-moved-in',
      'My Mother-in-Law Moved In For Three Months',
      'She came to help after the baby. She stayed, and the house slowly stopped being mine.',
      'in-laws', 'Anonymous Wife', 3::smallint, '2026-09-04'::date,
      'Help and authority are not the same thing, and in many of our homes they arrive in the same person. The question I put to her husband, when he eventually joined one of our calls, was simple: who does your wife go to when she needs something in her own house?',
      E'She arrived two days after I came home from the hospital, with three bags and a plan.\n\nFor the first two weeks I was grateful in a way I could not explain. I had a baby who would not sleep and a body that did not feel like mine, and there was a woman in my kitchen who knew what she was doing.\n\nBy the sixth week I had stopped cooking in my own house. By the tenth I was asking permission to move a chair.\n\nMy husband did not see it. That was the hardest part — not what she did, but that he could not see it happening.'
    ),
    (
      'he-came-back-after-two-years',
      'He Came Back After Two Years',
      'A man writes about the marriage he left, and the wife who did not wait for him the way he expected.',
      'reconciliation', 'Anonymous Husband', 4::smallint, '2026-08-28'::date,
      'I publish very few stories from men, not because they are not sent to me, but because most are not ready to be told without blame. This one arrived after four long phone calls, and what changed was that he stopped explaining and started remembering.',
      E'I left in 2023. I am not going to tell the story in a way that makes me look better than I was.\n\nWhen I came back I expected one of two things: a closed door, or a crying woman. What I got was a polite woman who offered me tea and asked me how long I was staying.\n\nShe had rebuilt the house around my absence. The children had a routine I did not know. There was a shelf where my things used to be.\n\nReconciliation, I have learned, is not returning to what was. It is asking to be let into something that carried on without you.'
    ),
    (
      'nothing-prepared-me-for-twins',
      'Nothing Prepared Me For Twins',
      'On the first year with two babies, a husband on night shift, and a version of herself she had to let go of.',
      'parenting', 'Anonymous Mother', 2::smallint, '2026-08-21'::date,
      'She asked me to publish this one quickly, because she wanted someone in the middle of that year to read it this week. That is often why people call me — not to be heard, but to reach the person three steps behind them.',
      E'People kept saying "double blessing" and I kept smiling and thinking: you have no idea.\n\nMy husband worked nights. From seven in the evening until six in the morning, it was me and two babies and a paraffin lamp for when the power went.\n\nI want to say something to the women who are in that year right now: the person you were before is not gone. She is just standing outside the door waiting for you to have a free hand.'
    ),
    (
      'we-married-without-telling-my-father',
      'We Married Without Telling My Father',
      'A quiet civil ceremony, a family that found out later, and four years of repair.',
      'family', 'Anonymous Sister', 3::smallint, '2026-08-14'::date,
      'Elopement stories in our community are rarely about romance. They are almost always about a family decision that someone felt they could not survive. Repair is possible, but it is slower than people expect.',
      E'We signed the papers on a Thursday morning with two witnesses we barely knew.\n\nMy father heard about it from a cousin. I have never been able to forget the way he said my name on the phone that evening.\n\nIt took four years, one funeral and one grandchild before we sat in the same room comfortably again.'
    )
),
inserted as (
  insert into public.cnt_stories (
    slug, title, summary, category_id, author_alias, status,
    planned_part_count, creator_note, published_at
  )
  select
    s.slug, s.title, s.summary, c.id, s.author_alias, 'published',
    s.planned_part_count, s.creator_note, s.published_on::timestamptz
  from story_seed s
  join public.cnt_categories c on c.slug = s.category_slug
  on conflict (slug) do nothing
  returning id, slug, published_at
)
insert into public.cnt_story_parts (story_id, part_number, body, read_minutes, published_at)
select
  i.id,
  1,
  s.part_body,
  greatest(1, (length(s.part_body) / 900))::smallint,
  i.published_at
from inserted i
join story_seed s on s.slug = i.slug
on conflict (story_id, part_number) do nothing;

-- Ask Her: answered questions the community can read.
insert into public.com_ask_questions (user_id, body, answer, answered_at, is_published)
select
  null::uuid, q.body, q.answer, now() - q.age, true
from (values
  (
    'My husband’s family calls every problem "just marriage". How do I know what is normal?',
    'Normal is a word families use to end a conversation. Ask yourself a better question: can you say what is wrong out loud, to him, without being punished for it? That is the line.',
    interval '2 days'
  ),
  (
    'Is it wrong to keep some savings he does not know about?',
    'Not wrong. But ask yourself what the savings are for. Security is one answer. An exit is another. Both are valid, and they need different conversations.',
    interval '5 days'
  ),
  (
    'We have not spoken properly in two months. Where do I start?',
    'Start with something small and true, not something big and fair. Fairness is a longer conversation and it will not survive two months of silence.',
    interval '8 days'
  )
) as q (body, answer, age)
where not exists (select 1 from public.com_ask_questions existing where existing.body = q.body);

-- An open poll for the community screen.
with poll as (
  insert into public.com_polls (question)
  select 'Should couples tell each other everything?'
  where not exists (
    select 1 from public.com_polls p where p.question = 'Should couples tell each other everything?'
  )
  returning id
)
insert into public.com_poll_options (poll_id, label, sort_order)
select poll.id, o.label, o.sort_order
from poll, (values
  ('Yes, always', 1::smallint),
  ('No, everything shared', 2::smallint),
  ('Depends on the couple', 3::smallint)
) as o (label, sort_order);
