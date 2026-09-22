// delete-account — a reader removes themselves.
//
// Meta requires a route people can actually follow, and "email us" is not one
// when the app can do it directly. Deleting the `auth.users` row is the whole
// operation: the foreign keys decide the rest, and they were written before
// this function existed.
//
//   removed outright   profile, saved stories, reading progress, followed
//                      topics, reactions, poll votes, comments, sessions
//   kept, unlinked     Community questions and answers, questions to Amake Fe,
//                      support transactions — set null, because a conversation
//                      other people are part of is not unpicked when one person
//                      leaves, and a financial record is not deleted on request
//
// Only the account making the request is deleted. There is no id parameter, on
// purpose: the caller's own token is the only thing that decides who goes.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '')
  if (!jwt) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { data: auth } = await supabase.auth.getUser(jwt)
  if (!auth?.user) return json({ error: 'Unauthorized' }, 401)

  // An editorial account is a working account, not a reader's. Losing one to a
  // misplaced tap in the reader app would take the studio down with it.
  const { data: roles } = await supabase
    .from('usr_roles')
    .select('role')
    .eq('user_id', auth.user.id)
  if ((roles ?? []).length > 0) {
    return json({ error: 'Staff accounts are removed by an administrator.' }, 403)
  }

  const { error } = await supabase.auth.admin.deleteUser(auth.user.id)
  if (error) {
    console.error(`[delete-account:failed] ${JSON.stringify({ message: error.message })}`)
    return json({ error: error.message }, 500)
  }

  console.log(`[delete-account:done] ${JSON.stringify({ user_id: auth.user.id })}`)
  return json({ deleted: true })
})
