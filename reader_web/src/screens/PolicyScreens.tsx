import { Link } from 'react-router'
import type { ReactNode } from 'react'

/**
 * The policy pages.
 *
 * They outlived the reason they were written — Facebook Login needed a privacy
 * policy URL — and an app that stores email addresses needs them anyway, along
 * with a deletion route people can actually follow. They live in the reader app
 * because it is the only one ordinary people sign in to; the studio has no
 * public accounts.
 *
 * They are written to be read, not to be defended. Everything here is checked
 * against the schema: what is listed as collected is what the tables hold, and
 * what deletion is said to remove is what the foreign keys actually do.
 */

const UPDATED = '22 September 2026'

/** Set VITE_CONTACT_EMAIL to a mailbox that is actually monitored. */
const CONTACT = import.meta.env.VITE_CONTACT_EMAIL ?? 'privacy@javuapps.com'

function Policy({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col px-[22px] pt-[calc(16px+env(safe-area-inset-top,0px))] pb-10">
      <Link to="/profile" className="text-sm text-body">
        ← Back
      </Link>
      <h1 className="mt-6 font-display text-[30px] leading-[1.15] text-ink">{title}</h1>
      <p className="mt-2 text-xs text-muted">Last updated {UPDATED}</p>
      <div className="mt-6 flex flex-col gap-5">{children}</div>
    </div>
  )
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-[19px] leading-snug text-ink">{heading}</h2>
      <div className="prose-story flex flex-col gap-2 text-[15px]">{children}</div>
    </section>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1.5 text-[15px] text-body">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function PrivacyScreen() {
  return (
    <Policy title="Privacy">
      <Section heading="The short version">
        <p>
          You can read every story here without an account and without telling us anything. If you
          sign in, we keep your email address, a name you choose, and the things you choose to do —
          saving a story, reacting to one, answering a question. Nothing else.
        </p>
      </Section>

      <Section heading="Reading without an account">
        <p>
          Stories are open. We count how many times each part is opened so the writer knows what is
          being read, but that count is a number per story per day — it is not attached to you, and
          there is no record anywhere of who read what.
        </p>
      </Section>

      <Section heading="What we keep when you sign in">
        <p>
          Signing in is an email address and a six-digit code we send to it. There is no password.
          We store:
        </p>
        <List
          items={[
            'Your email address, used to sign you in and for nothing else',
            'A name you choose, which is what other people see',
          ]}
        />
        <p>
          We never show your email address to anyone, and we do not send you anything other than
          the code you asked for.
        </p>
        <p>As you use the app we also keep:</p>
        <List
          items={[
            'Stories you save, and where you have read up to',
            'Topics you follow',
            'Stories you have reacted to',
            'Comments, questions and answers you post',
            'Questions you send to Amake Fe',
            'Poll votes',
          ]}
        />
      </Section>

      <Section heading="What other people can see">
        <p>
          The name you chose appears beside anything you post publicly — comments, and questions and
          answers on Community. Your email address never does.
        </p>
        <p>
          <strong>Questions you send to Amake Fe are published without your name.</strong> If she
          answers one publicly, it appears anonymously. She knows who asked; the page does not.
        </p>
        <p>
          Poll votes are counted but never shown individually. What you save, what you follow and
          where you have read up to are visible only to you.
        </p>
        <p>
          If you have never posted anything publicly, your profile is not visible to anyone else at
          all.
        </p>
      </Section>

      <Section heading="Whose stories these are">
        <p>
          The stories are real, and they are shared with Amake Fe privately — by phone call or
          WhatsApp — and written by her. This platform holds nothing about the people who share
          them: no names, no numbers, no recordings. Names inside a story are replaced before it is
          published.
        </p>
      </Section>

      <Section heading="Who else is involved">
        <List
          items={[
            'Supabase, which hosts the database, the app and the sign-in email',
          ]}
        />
        <p>We do not sell anything to anyone, and there is no advertising here.</p>
      </Section>

      <Section heading="Deleting what we hold">
        <p>
          You can delete your account at any time, from your profile. See{' '}
          <Link to="/data-deletion" className="text-accent">
            deleting your data
          </Link>{' '}
          for exactly what that removes.
        </p>
      </Section>

      <Section heading="Children">
        <p>This app is for adults and is not intended for anyone under 18.</p>
      </Section>

      <Section heading="Asking us something">
        <p>
          Write to <span className="text-ink">{CONTACT}</span> with any question about your
          information, or to ask for a copy of it.
        </p>
      </Section>
    </Policy>
  )
}

export function TermsScreen() {
  return (
    <Policy title="Terms of use">
      <Section heading="What this is">
        <p>
          Mindful Moments with Amake Fe is a place to read real stories about marriage, family and
          life, and to talk about them with other people. Reading is free and always will be.
        </p>
      </Section>

      <Section heading="This is not professional advice">
        <p>
          The stories, answers and discussions here are personal experience shared by ordinary
          people. They are not counselling, medical advice, legal advice or a substitute for any of
          those.
        </p>
        <p>
          If you are in danger, or if you need help beyond what a community can give, please contact
          a professional or the appropriate services where you live.
        </p>
      </Section>

      <Section heading="Using your account">
        <p>
          You sign in with your own email address, and you are responsible for what is posted from
          your account. Choose a name that is yours to use, and do not pretend to be someone else.
        </p>
      </Section>

      <Section heading="What not to post">
        <List
          items={[
            'Anything that identifies a person in a story — a name, a number, a place',
            'Abuse, harassment, threats or hatred towards anyone',
            'Someone else’s private information',
            'Advertising, selling or spam',
          ]}
        />
        <p>
          Comments and answers are moderated. Anything that breaks these terms can be hidden or
          removed, and an account that keeps breaking them can be closed.
        </p>
      </Section>

      <Section heading="What you post">
        <p>
          What you write stays yours. By posting it here you allow us to show it in the app and on
          the Facebook page. You can delete your account and what it holds at any time.
        </p>
      </Section>

      <Section heading="The stories">
        <p>
          The stories are written by Amake Fe and are not yours to republish. Share the link — that
          is what it is for.
        </p>
      </Section>

      <Section heading="If something goes wrong">
        <p>
          We look after this carefully, but we cannot promise the app is always available or free of
          mistakes, and we are not responsible for what other people post.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          If these terms change in a way that matters, we will say so in the app. Questions go to{' '}
          <span className="text-ink">{CONTACT}</span>.
        </p>
      </Section>
    </Policy>
  )
}

export function DataDeletionScreen() {
  return (
    <Policy title="Deleting your data">
      <Section heading="How to delete your account">
        <p>
          Open{' '}
          <Link to="/profile" className="text-accent">
            your profile
          </Link>
          , sign in if you are not already, and choose <strong>Delete my account</strong>. It
          happens straight away and cannot be undone.
        </p>
        <p>
          If you would rather we did it, write to <span className="text-ink">{CONTACT}</span> from
          the address you signed in with, and we will remove it within 30 days.
        </p>
      </Section>

      <Section heading="What is removed">
        <List
          items={[
            'Your account, your email address and the name you chose',
            'Stories you saved and where you had read up to',
            'Topics you followed',
            'Your reactions',
            'Your comments',
            'Your poll votes',
          ]}
        />
      </Section>

      <Section heading="What stays, without your name on it">
        <p>
          Questions and answers on Community, and questions you sent to Amake Fe, remain — but they
          stop being connected to you and no longer carry your name. A conversation other people are
          part of is not unpicked because one person leaves.
        </p>
        <p>
          If you want something you posted taken down as well, ask us before you delete your
          account, while we can still tell which posts are yours.
        </p>
      </Section>

      <Section heading="What was never yours to delete">
        <p>
          How many times a story has been opened is counted as a daily total per story. It has never
          been linked to any reader, so there is nothing in it to remove.
        </p>
      </Section>
    </Policy>
  )
}
