import { JobRequest, configuration, bjft_onmessage, } from '../local/lib/util.mjs' // {{{1
import { put, reset, } from './lib/util.mjs'
import { JWT, generate_keypair, verifyPayload, } from '../lib/util.mjs'
import { connection, } from '../../lib/util.mjs'

const State = { // {{{1
  MATCHING: 1,
  CONFIRMING: 2,
  CLOSING: 3,

  Matching: { // {{{2
    handle: (context, event) => {
      try {
        return verifyPayload(event.message).then(payload => {
          console.log(configuration.me, 'context', context, 'payload', payload)
          context.attachment.match = payload
          context.state = State.Confirming
          context.attachment.state = State.CONFIRMING
          if (payload.sub.endsWith(' CONFIRMED')) { // TODO ' DENIED'
            return Promise.resolve(null);
          }
          return new JWT(payload.sub + ' CONFIRMED').setIssuer(
            context.attachment.iss, context.attachment.sk
          ).sign();
        }).then(c => c && context.ws.send(c));
      } catch(err) { console.error('UNEXPECTED err', err) }
    }
  },
  Confirming: { // {{{2 
    handle: (context, event) => {
      try {
        return verifyPayload(event.message).then(payload => {
          console.log(configuration.me, 'context', context, 'payload', payload)
        });
      } catch(err) { throw Error('UNEXPECTED err', err) }
    }
  },
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

function Context (ws, attachment) { // {{{1
  let context = { ws, attachment }
  switch (attachment.state) {
    case State.MATCHING: return Object.assign(context, { state: State.Matching });
    case State.CONFIRMING: return Object.assign(context, { state: State.Confirming });
    case State.RUNNING: return Object.assign(context, { state: State.Running });
    case State.CLOSING: return Object.assign(context, { state: State.Closing });
    default: throw Error('UNEXPECTED')
  }
}

