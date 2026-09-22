// settlement-report — a settlement's PDF statement.
//
// Adapted from ginni's RenderSettlementReport, and the reason it is a function
// rather than a module in each app is ginni's reason: **one renderer for both
// sides.** The operator who recorded the payout and the creator who received it
// download the same bytes, so there is never a question of which of two
// statements is right. Two client-side renderers would be two programs that
// agree until one of them is changed.
//
// Nothing is stored. A settlement's row is a snapshot that never changes — the
// destination account is copied onto it at the moment of payment, precisely so
// a statement already issued cannot be rewritten — so the document can be drawn
// on demand and will be identical every time.
//
// **It holds no service-role key and re-checks no permissions.** It reads with
// the caller's own token, so RLS decides what a settlement is and who may see
// it, exactly as it does everywhere else: staff read their settlements,
// operators read all of them, and anybody else gets an empty result and a 404.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

const A4 = { width: 595.28, height: 841.89 }
const MARGIN = 48

const INK = rgb(0.18, 0.12, 0.17)
const BODY = rgb(0.36, 0.29, 0.25)
const MUTED = rgb(0.54, 0.47, 0.4)
const RULE = rgb(0.86, 0.81, 0.73)

/**
 * pdf-lib's standard fonts encode WinAnsi, and throw on anything outside it.
 *
 * Ginni met the same wall and solved it by embedding DejaVu Sans, because its
 * statements name parents and pupils and a name is not negotiable. This one
 * names nobody — see the note on the payments table — so the only characters at
 * risk are the typographic ones this project writes everywhere. They are folded
 * to their ASCII equivalents rather than allowed to abort a financial document.
 */
const ascii = (value: string): string =>
  value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/·/g, '-')
    .replace(/…/g, '...')
    // Anything still outside Latin-1 would throw; a box is better than no file.
    .replace(/[^\x20-\xFF]/g, '?')

// The same names the apps show. An Edge Function cannot import the workspace
// package, so this is the third copy — the other two are in core's support.ts
// and lenco-collect, and all three must move together.
const NETWORK_NAME: Record<string, string> = {
  mtn: 'MTN MoMo',
  airtel: 'Airtel Money',
  zamtel: 'Zamtel Kwacha',
}
const network = (value: string | null): string => (value ? NETWORK_NAME[value] ?? value : '-')

const kwacha = (minor: number): string =>
  `ZMW ${(minor / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const day = (value: string | null): string =>
  value
    ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authorization = req.headers.get('Authorization') ?? ''
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  })

  const body = await req.json().catch(() => ({}))
  const settlementId = String(body?.settlementId ?? '')
  if (!settlementId) return json({ error: 'Which settlement?' }, 400)

  const { data: s, error } = await supabase
    .from('sup_settlements')
    .select('*')
    .eq('id', settlementId)
    .maybeSingle()
  if (error) return json({ error: error.message }, 500)
  // Not found and not permitted are the same answer on purpose: a settlement
  // that is not yours should not be distinguishable from one that is not there.
  if (!s) return json({ error: 'No such settlement.' }, 404)

  const { data: payments, error: paymentsError } = await supabase
    .from('sup_transactions')
    .select('internal_reference, operator, amount_minor, commission_minor, net_minor, completed_at')
    .eq('settlement_id', settlementId)
    .order('completed_at', { ascending: true })
  if (paymentsError) return json({ error: paymentsError.message }, 500)

  const pdf = await PDFDocument.create()
  pdf.setTitle(`Settlement ${s.reference}`)
  pdf.setAuthor('Mindful Moments with Amake Fe')
  pdf.setSubject('Settlement statement')
  pdf.setProducer('Mindful Moments')
  pdf.setCreator('Mindful Moments')

  // Pinned to the settlement, not to the moment someone pressed download.
  //
  // pdf-lib stamps `now()` into CreationDate and ModDate by default, so two
  // renders of an unchanging settlement produced two different files — caught
  // by hashing the same request twice, and it would have quietly falsified the
  // claim this whole function is built on, that both sides hold the same
  // document. A statement's date is when the money moved anyway.
  const settledAt = new Date(s.settled_at)
  pdf.setCreationDate(settledAt)
  pdf.setModificationDate(settledAt)

  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  let page = pdf.addPage([A4.width, A4.height])
  let y = A4.height - MARGIN

  const text = (
    value: string,
    options: { x?: number; size?: number; font?: typeof regular; color?: typeof INK } = {},
  ) => {
    page.drawText(ascii(value), {
      x: options.x ?? MARGIN,
      y,
      size: options.size ?? 10,
      font: options.font ?? regular,
      color: options.color ?? INK,
    })
  }

  const right = (value: string, edge: number, options: { size?: number; font?: typeof regular; color?: typeof INK } = {}) => {
    const size = options.size ?? 10
    const font = options.font ?? regular
    const clean = ascii(value)
    page.drawText(clean, {
      x: edge - font.widthOfTextAtSize(clean, size),
      y,
      size,
      font,
      color: options.color ?? INK,
    })
  }

  // Two of them, because a rule at a fixed offset from the cursor lands
  // through the middle of whichever line of text shares that cursor — which is
  // exactly what the first draft did, striking out its own table header.
  const ruleAt = (offset: number) => {
    page.drawLine({
      start: { x: MARGIN, y: y + offset },
      end: { x: A4.width - MARGIN, y: y + offset },
      thickness: 0.5,
      color: RULE,
    })
  }
  /** A separator above the line about to be written. */
  const ruleAbove = () => ruleAt(14)
  /** An underline beneath the line just written, clear of its descenders. */
  const ruleBelow = () => ruleAt(-5)

  const heading = (title: string) => {
    y -= 22
    text(title.toUpperCase(), { size: 7.5, font: bold, color: MUTED })
    y -= 4
  }

  const fact = (label: string, value: string) => {
    y -= 15
    text(label, { size: 9, color: MUTED })
    text(value, { x: MARGIN + 150, size: 9 })
  }

  // ---------- header ----------
  text('SETTLEMENT STATEMENT', { size: 7.5, font: bold, color: MUTED })
  y -= 26
  text('Mindful Moments with Amake Fe', { size: 19, font: bold })
  y -= 16
  text(s.reference, { size: 10, color: BODY })

  // ---------- facts ----------
  heading('This settlement')
  fact('Period', `${day(s.period_from)} - ${day(s.period_to)}`)
  fact('Settled', day(s.settled_at))
  fact('Transfer reference', s.transfer_reference ?? '-')
  if (s.notes) fact('Notes', s.notes)

  // ---------- account ----------
  heading('Paid into')
  if (s.account_kind === 'bank') {
    fact('Bank', [s.bank_name, s.branch].filter(Boolean).join(', ') || '-')
    fact('Account name', s.account_name)
    fact('Account number', s.account_number ?? '-')
  } else {
    fact('Mobile money', network(s.mobile_operator))
    fact('Number', s.mobile_number ?? '-')
    fact('Name', s.account_name)
  }

  // ---------- totals ----------
  heading('Totals')
  fact('Payments', String(s.payment_count))
  fact('Given by supporters', kwacha(s.gross_minor))
  fact('Platform commission', kwacha(s.commission_minor))
  y -= 26
  ruleAbove()
  text('Settled to the creator', { size: 10.5, font: bold })
  right(kwacha(s.net_minor), A4.width - MARGIN, { size: 10.5, font: bold })

  // ---------- payments ----------
  //
  // No supporter is named here, and no number appears — a departure from
  // ginni, whose statements name the parent and the pupil because school fees
  // are per-child and that is what the statement is for. A contribution is not:
  // the reference reconciles it against the provider, and a phone number in a
  // file that gets emailed around would put supporters' numbers somewhere
  // nobody chose to put them. The operators have the console for that.
  const COLS = { date: MARGIN, ref: MARGIN + 86, network: MARGIN + 210 }
  const EDGE = { given: A4.width - MARGIN - 170, commission: A4.width - MARGIN - 85, net: A4.width - MARGIN }

  const tableHeader = () => {
    text('Cleared', { x: COLS.date, size: 7.5, font: bold, color: MUTED })
    text('Reference', { x: COLS.ref, size: 7.5, font: bold, color: MUTED })
    text('Network', { x: COLS.network, size: 7.5, font: bold, color: MUTED })
    right('Given', EDGE.given, { size: 7.5, font: bold, color: MUTED })
    right('Commission', EDGE.commission, { size: 7.5, font: bold, color: MUTED })
    right('Settled', EDGE.net, { size: 7.5, font: bold, color: MUTED })
    ruleBelow()
  }

  heading('Payments in this settlement')
  y -= 10
  tableHeader()

  for (const p of payments ?? []) {
    y -= 16
    // A page break repeats the header, so a second page is still a table
    // someone can read without turning back.
    if (y < MARGIN + 60) {
      page = pdf.addPage([A4.width, A4.height])
      y = A4.height - MARGIN
      tableHeader()
      y -= 16
    }
    text(day(p.completed_at), { x: COLS.date, size: 8 })
    text(p.internal_reference ?? '-', { x: COLS.ref, size: 8, color: BODY })
    text(network(p.operator), { x: COLS.network, size: 8, color: BODY })
    right(kwacha(p.amount_minor), EDGE.given, { size: 8 })
    right(kwacha(p.commission_minor), EDGE.commission, { size: 8, color: MUTED })
    right(kwacha(p.net_minor ?? 0), EDGE.net, { size: 8 })
  }

  y -= 24
  ruleAbove()
  text('Total', { size: 9, font: bold })
  right(kwacha(s.gross_minor), EDGE.given, { size: 9, font: bold })
  right(kwacha(s.commission_minor), EDGE.commission, { size: 9, font: bold, color: MUTED })
  right(kwacha(s.net_minor), EDGE.net, { size: 9, font: bold })

  y -= 28
  page.drawText(
    ascii(
      'Supporters gave the amounts above in full. The platform retains 20% to cover the payment ' +
        'rails, hosting and operations, and settles the remainder to the creator.',
    ),
    { x: MARGIN, y, size: 7.5, font: regular, color: MUTED, maxWidth: A4.width - MARGIN * 2, lineHeight: 11 },
  )

  const bytes = await pdf.save()
  return new Response(bytes, {
    headers: {
      ...CORS,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="settlement-${s.reference}.pdf"`,
    },
  })
})
