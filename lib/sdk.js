const State = { // {{{1
  MATCHING: 1,
  RUNNING: 2,

  Matching: { handle: matchingHandle },
  Running: { handle: runningHandle },
}

const algorithm = { name: "Ed25519", } // {{{1
const base64ToUint8 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0))
const uint8ToBase64 = (arr) => Buffer.from(arr).toString('base64')
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
    case State.RUNNING: return Object.assign(context, { state: State.Running });
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
  console.log('Job actor', actor, 'opts', opts, 'job', job)

  return job;
}

function Jobs (actor, offers) { // Job Agent's offers {{{1
  return offers.map(offer => {
    Object.assign(offer, { job: Job(actor, offer) })
    return offer.job.promise;
  });
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

async function generate_keypair () { // {{{1
  const keypair = await this.generateKey(algorithm, true, ['sign', 'verify'])
  let pk = await this.exportKey('raw', keypair.publicKey)
  let sk = await this.exportKey('jwk', keypair.privateKey)
  pk = uint8ToBase64(new Uint8Array(pk))
  sk = JSON.stringify(sk)
  return Promise.resolve(`${sk} ${pk}`);
}

function matchingHandle (context, event) { // context.attachment.match = payload {{{1
  console.log('matchingHandle', context, event)

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

function pipe2child (context, indata) { // {{{1
  console.log('pipe2child indata', indata)

  if (!context.job) {
    let aud = context.opts.aud
    context.job = context.opts.spawn(
      `make`,
      [],
      {
        cwd: `jobs/${aud}`,
      }
    )
    context.job.
      on('error', err => console.error(`${aud}  pipe2child  E R R O R  ${err}`))
    context.job.stderr.
      on('data', data => console.log(`${aud} stderr`, data.toString()))
    context.job.stdout.
      on('data', data => new JWT(data.toString()).
        setIssuer(context.attachment.iss, context.attachment.sk).sign().
        then(t => context.ws.send(t)))
    context.job.
      on('close', code => new JWT(`${aud} EXIT CODE ${code}`).
        setIssuer(context.attachment.iss, context.attachment.sk).sign().
        then(t => {
          context.ws.send(t); context.ws.close()
        }))
    context.job.stdin.write(indata)
    !context.opts.indataEOD && context.job.stdin.end()
    return;
  }
  context.job.stdin.write(indata)
  context.opts.indataEOD && indata == 'context.job.stdin.end()' && context.job.stdin.end()
}

function runningHandle (context, event) { // {{{1
  console.log('runningHandle', context, event)

  if (context.attachment.iss.agent) {
    return runningHandleSpawn(context, event);
  } else { // browser
    return context.opts.Running.handle(context, event);
  }
}

function runningHandleSpawn (context, event) { // {{{1
  try {
    if (context.opts.prefix && !context.prefixDone) {
      context.prefixDone = true
      return pipe2child(context, context.opts.prefix(context));
    }
    if (event) {
      verifyPayload(event.message).
        then(payload => pipe2child(context, payload.sub))
    } else {
      console.log('runningHandleSpawn context', context)
    }
  } catch(err) { console.error('UNEXPECTED err', err) }
}

function verifyPayload (message) { // {{{1
  try {
    message = message.slice(1, -1)
    let [header64, payload64, sig64] = message.split('.')
    let payload = JSON.parse(b64_2s(payload64))
    //console.log('verifyPayload payload', payload)

    if (typeof payload.iss == 'string') {
      payload.iss = JSON.parse(payload.iss)
    }
    return crypto.subtle.importKey(
      'raw', base64ToUint8(payload.iss.pk).buffer, algorithm.name, true, ['verify']
    ).then(pk => crypto.subtle.verify(
      algorithm.name, pk, base64ToUint8(sig64), new TextEncoder().encode(payload64))
    ).then(verified => Promise.resolve(verified ? payload : null));
  } catch(err) {
    console.error(err)
  }
}

export { // {{{1
  Jobs, JWT, b64_2s, generate_keypair, verifyPayload,
}

