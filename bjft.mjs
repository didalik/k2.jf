import { JobRequest, configuration, bjft_onmessage, } from '../local/lib/util.mjs' // {{{1
import { put, reset, } from './lib/util.mjs'
import { generate_keypair, } from '../lib/util.mjs'
import { connection, } from '../../lib/util.mjs'

const wsURL = new URL(location.toString().replace('http', 'ws'))
const out = m => typeof m == 'string' ? put(`<h4 style='text-align: right'>${m}</h4>`)
  : put(m.message)

reset({ content: document.getElementById('content1'), }) // {{{1
put(`Delivered ${location} on ${Date()} to YOUR_IP_ADDRESS`, '<hr/>')
  
configuration.me = 'Ann' // {{{1
generate_keypair.call(crypto.subtle).then(keys => {
  const iss = {
    name: configuration.me,
    uuid: 'UUID',
  }
  const aud = 'bjft/echo'
  const sk = keys.split(' ')[0]
  let params = new URLSearchParams(`aud=${aud}`)
  params.append('iss', encodeURIComponent(JSON.stringify(iss)))
  params.append('sk', encodeURIComponent(sk))
  wsURL.search = params
  console.log('wsURL', wsURL)

  return JobRequest(JSON.stringify(iss), aud, sk);
}).then(jr => {
  const ws = connection(new WebSocket(wsURL)).
    on('error', console.error).
    on('message', mobj => bjft_onmessage(ws, mobj, out)).
    on('close', data => {
      console.log(configuration.me, 'close data', data)
      put("<h3 style='text-align: center'>Test PASSED</h3>")
    }).send(jr)

  setInterval(ws.open, 10000)                // auto-reconnect every 10s
})

//put(`<h4 style='text-align: right'>${msg}</h4>`)
