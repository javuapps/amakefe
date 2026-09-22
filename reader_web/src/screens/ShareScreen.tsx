import { Link } from 'react-router'
import { telLink, waLink } from '@amakefe/core'
import { creator } from '../creator'

/**
 * Share Your Story. Per spec §14 this is deliberately not a submission form —
 * it opens a phone call or WhatsApp, because the conversation with her is the
 * part of this product that must stay human.
 *
 * The prototype's third option reads "Record a voice note here". It sends the
 * reader to WhatsApp instead: in-app recording would put source audio, consent
 * capture and a retention policy into the reader app, which §83 puts outside the
 * MVP and which needs a privacy decision before it is built. WhatsApp voice
 * notes are already how this community talks to her.
 */
export function ShareScreen() {
  const intro = 'Hello, I would like to share my story.'

  return (
    <div className="min-h-dvh bg-ink px-[22px] pt-[calc(16px+env(safe-area-inset-top,0px))] pb-16 lg:px-[max(24px,calc((100%-620px)/2))] lg:pt-12">
      <Link to="/" className="text-sm text-[#c9b6a4]">
        ← Close
      </Link>

      <h1 className="mt-9 font-display text-[32px] leading-[1.15] text-surface-warm">
        Your story matters.
      </h1>
      <p className="prose-story mt-[14px] text-base text-[#d9c7b6]">
        You don&rsquo;t have to type it. Call her, or send a voice note in the language you are most
        comfortable in. She listens first, asks questions, and writes the story with you — and
        nothing is published until you agree to it.
      </p>

      <div className="mt-7 flex flex-col gap-3">
        <a
          href={telLink(creator)}
          className="flex items-center gap-[14px] rounded-card bg-gold px-5 py-[17px]"
        >
          <span className="text-xl" aria-hidden>📞</span>
          <span className="flex flex-col">
            <span className="text-base font-bold text-ink">Call her</span>
            <span className="text-[13px] text-[#6b4a18]">{creator.phoneDisplay}</span>
          </span>
        </a>

        <a
          href={waLink(creator, intro)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-[14px] rounded-card bg-accent px-5 py-[17px]"
        >
          <span className="text-xl" aria-hidden>💬</span>
          <span className="flex flex-col">
            <span className="text-base font-bold text-[#fff6ea]">WhatsApp</span>
            <span className="text-[13px] text-[#ffe0cc]">Chat or send a voice note</span>
          </span>
        </a>

        <a
          href={waLink(creator, intro)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-[14px] rounded-card border border-surface-warm/30 px-5 py-[17px]"
        >
          <span className="text-xl" aria-hidden>🎙</span>
          <span className="flex flex-col">
            <span className="text-base font-bold text-surface-warm">Send a voice note</span>
            <span className="text-[13px] text-[#a89684]">
              English, Bemba, Nyanja, Tonga or Lozi
            </span>
          </span>
        </a>
      </div>

      <section className="mt-[26px] border-t border-surface-warm/20 pt-[18px]">
        <h2 className="text-[10px] uppercase tracking-label text-gold">How your privacy works</h2>
        <p className="mt-2 text-[13.5px] leading-[1.7] text-[#c9b6a4]">
          Your name and number are never published. Names, places and details that could identify
          you are changed. You confirm consent before publishing, and you can ask for the story to
          be withdrawn at any point before it goes out.
        </p>
      </section>
    </div>
  )
}
