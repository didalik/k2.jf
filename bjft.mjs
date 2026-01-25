import { // {{{1
  Context,
  JobRequest, configuration, bjft_onmessage, confirmingHandle, matchingHandle,
} from '../local/lib/util.mjs' 
import { put, reset, } from './lib/util.mjs'
import { JWT, generate_keypair, verifyPayload, } from '../lib/util.mjs'
import { connection, } from '../../lib/util.mjs'

const State = { // {{{1
  MATCHING: 1,
  CONFIRMING: 2,
  CLOSING: 3,

  Matching: { handle: matchingHandle },
  Confirming: { handle: confirmingHandle },
  Closing: { // {{{2 
    handle: (context, event) => {
      try {
      } catch(err) { throw Error('UNEXPECTED err', err) }
    }
  }, // }}}2
}
const wsURL = new URL(location.toString().replace('http', 'ws')) // {{{1
const out = m => typeof m == 'string' ? put(
  `<h4 style='text-align: right'>${m}</h4>`
) : put(m.message)

reset({ content: document.getElementById('content1'), }) // {{{1
put(`Delivered ${location} on ${Date()} to YOUR_IP_ADDRESS`, '<hr/>')
  
configuration.me = 'Ann' // {{{1
generate_keypair.call(crypto.subtle).then(keys => { // {{{2
  const aud = 'bjft/echo'
  const [sk, pk] = keys.split(' ')
  const iss = { name: configuration.me, pk, uuid: 'UUID', }
  configuration.attachment = { iss, sk, state: State.MATCHING }
  let params = new URLSearchParams(`aud=${aud}`)
  params.append('iss', encodeURIComponent(JSON.stringify(iss)))
  params.append('sk', encodeURIComponent(sk))
  wsURL.search = params
  console.log('wsURL', wsURL)

  return JobRequest(JSON.stringify(iss), aud, sk);
}).then(jr => { // JobRequest {{{2
  const ws = connection(new WebSocket(wsURL)).
    on('error', console.error).
    on('message', mobj => bjft_onmessage(
      ws, mobj, Context(ws, configuration.attachment)
    )).
    on('close', data => {
      console.log(configuration.me, 'close data', data)
      put("<h3 style='text-align: center'>Test PASSED</h3>")
    }).send(jr)

  setInterval(ws.open, 10000)                // auto-reconnect every 10s
}) // }}}2

