import { spawn } from 'node:child_process' // {{{1

const Demo = { // {{{1
  aud: 'demo',
  onclose: data => {
    let context = Demo.job.context
    Demo.job.resolve(`- ${context.attachment.iss.name}: Demo DONE`)
  },
  onerror: null, // is never called
  onmessage:  data => {
    let context = Demo.job.context
    context.state.handle(context, data)
  },
  prefix: context => `- ${context.attachment.iss.name}: mocking Demo job<br/>`,
  spawn,
}

const IssuerSign = { // {{{1
  aud: 'demo/sign',
  indataEOD: true,
  onclose: data => {
    let context = IssuerSign.job.context
    IssuerSign.job.resolve(`- ${context.attachment.iss.name}: IssuerSign DONE`)
  },
  onerror: null, // is never called
  onmessage:  data => {
    let context = IssuerSign.job.context
    context.state.handle(context, data)
  },
  prefix: context => `<br/>- ${context.attachment.iss.name}: mocking IssuerSign job<br/>`,
  spawn,
}

const State = { // {{{1
  MATCHING: 1,
  RUNNING: 2,

  Matching: { handle: matchingHandle },
  Running: { handle: runningHandle },
}

const algorithm = { name: "Ed25519", } // {{{1
const base64ToUint8 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0))
const uint8ToBase64 = (arr) => Buffer.from(arr).toString('base64')
// HUGE thanks to:
// - https://1loc.dev/string/convert-an-uint8-array-to-a-base64-encoded-string/
  
const b64_2s = b64 => base64ToUint8(b64).toString().split(',').reduce((s, c) => s + String.fromCodePoint(c), '')

class JWT { // {{{1
  constructor (sub) { // {{{2
    this.header = { alg: algorithm.name, typ: 'JWT' }
    this.payload = { sub }
  }

  setAudience (aud) { // {{{2
    this.payload.aud = aud
    return this;
  }

  setIssuer (iss, sk) { // {{{2
    this.sk = sk
    this.payload.iss = iss
    return this;
  }

  sign () { // {{{2
    let header64 = uint8ToBase64(JSON.stringify(this.header))
    let payload64 = uint8ToBase64(JSON.stringify(this.payload))

    return crypto.subtle.importKey(
      'jwk', JSON.parse(this.sk), algorithm.name, true, ['sign']
    ).then(sk => crypto.subtle.sign(
      algorithm.name, sk, new TextEncoder().encode(payload64))
    ).then(signature => Promise.resolve(
      `${header64}.${payload64}.${uint8ToBase64(new Uint8Array(signature))}`
    )).catch(e => console.error(e));
  }

  // }}}2
}

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

function Job (actor, opts) { // {{{1
  let wsURL = new URL(actor.wsArgs[0])
  let params = new URLSearchParams(`iss=${encodeURIComponent(JSON.stringify(actor.iss))}`)
  params.append('aud', encodeURIComponent(opts.aud))
  wsURL.search = params
  let job = Object.assign({ context: null }, Promise.withResolvers()), state = State.Matching
  new JWT(actor.app).setIssuer(actor.iss, actor.sk).setAudience(opts.aud).sign().then(jwt => {
    const ws = connection(new actor.WebSocket(...[wsURL, actor.wsArgs[1]])).
      on('close', opts.onclose).
      on('error', opts.onerror).
      on('message', opts.onmessage).
      send(jwt)
    job.context = { ws, opts, state, attachment: { iss: actor.iss, sk: actor.sk, state: State.MATCHING } }
  })
  //console.log('Job actor', actor, 'opts', opts, 'job', job)

  return job;
}

function Jobs (actor, offers) { // Job Agent's offers {{{1
  return offers.map(offer => {
    Object.assign(offer, { job: Job(actor, offer) })
    return offer.job.promise;
  });
}

function Offers (aud) { // {{{1
  return aud.map(a => {
    switch (a) {
      case 'issuer/sign': return Object.assign(IssuerSign, { aud: a });
      case 'demo': return Object.assign(Demo, { aud: a });
      default: throw Error('UNEXPECTED aud', aud);
    }
  });
}

function audience (name) { // {{{1
  switch (name) {
    case 'Bob': return ['demo', 'issuer/sign'];
    case 'Cyn': return ['demo'];
    default: throw Error('UNEXPECTED name', name);
  }
}

function connection (ws2use) { // {{{1
  let browser = true // {{{2
  try {
    browser = Object.is(global, undefined)
  } catch(err) { err instanceof ReferenceError || console.error(err) }

  let ws, closeAfterSend = 0, queue = [], filters = [], events = {} // {{{2
  let onmessage = arg => {
      let parsed = browser ? JSON.parse(arg.data) : JSON.parse(arg.toString())
      let payload = parsed?.message
      let eventPayload = {
        ...payload?.[0] == null && payload,
        ...parsed
      }

      events[parsed?.type ?? payload?.type]?.map((listener) => listener(eventPayload))
      if (!parsed?.type) events.message?.map((listener) => listener(eventPayload))
      filters.map(([filter, listener]) => filter(eventPayload) && listener(eventPayload))
    }
  let onopen = _ => (queue.splice(0).map((m) => ws?.send(m)), events.open?.map((listener) => listener()), closeAfterSend && ws?.close())
  let onclose = data => (closeAfterSend = 0, ws = null, events.close?.map((listener) => listener(data)))
  let onerror = err => (events.close?.map((listener) => listener(err)), ws?.readyState == 1 ? ws.close() : closeAfterSend = 1)

  let open = () => { // {{{2
    if (ws) return socket;
    ws = ws2use
    if (browser) {
      ws.onmessage = onmessage; ws.onopen = onopen; ws.onclose = onclose; ws.onerror = onerror
    } else { // Node JS
      ws.on('message', onmessage); ws.on('open', onopen); ws.on('close', onclose); ws.on('error', onerror)
    }
    return socket;
  };
  let socket = new Proxy(open, {
    get: (_, key) => ({
      open,
      close: () => (ws?.readyState == 1 ? ws.close() : closeAfterSend = 1, socket),
      push: (message, recipient) => (closeAfterSend = 1, socket.send(message, recipient)),
      send: (message, recipient) => (
        message = JSON.stringify(message), 
        message = recipient ? "" + recipient + "" + message : message,
        ws?.readyState == 1 ? (ws.send(message), socket) : (queue.push(message), open())
      ),
      on: (type, listener) => (listener && (type?.[0] ? (events[type] ??= []).push(listener) : filters.push([type, listener])), open()),
      remove: (type, listener, listeners = events[type], i = listeners?.indexOf(listener) ?? -1) => (~i && listeners?.splice(i, 1), open())
    })[key]
  });
  return socket // }}}2
}
/** Thanks to:
 * https://ittysockets.com/
 **/

function matchingHandle (context, event) { // context.attachment.match = payload {{{1
  try {
    context.attachment.state = State.RUNNING
    context.state = State.Running
    return verifyPayload(event.message).then(payload => {
      //console.log('matchingHandle payload', payload)

      context.attachment.match = payload
      context.state.handle(context)
    })
  } catch(err) { console.error('UNEXPECTED err', err) }
}

function runningHandle (context, event) { // {{{1
  if (context.attachment.iss.agent) {
    return runningHandleSpawn(context, event);
  } else { // browser
    return context.opts.Running.handle(context, event);
  }
}

export { // {{{1
  Jobs, Offers, audience,
}

