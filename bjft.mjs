import { JobRequest, configuration, bjft_onmessage, } from '../local/lib/util.mjs' // {{{1
import { put, reset, } from './lib/util.mjs'
import { generate_keypair, } from '../lib/util.mjs'
import { connection, } from '../../lib/util.mjs'

reset({ content: document.getElementById('content1'), }) // {{{1
put(`Delivered ${location} on ${Date()} to YOUR_IP_ADDRESS`, '<hr/>')
  
configuration.me = 'Ann' // {{{1
generate_keypair.call(crypto.subtle).then(keys => console.log(keys))

const out = m => typeof m == 'string' ? put(`<h4 style='text-align: right'>${m}</h4>`)
  : put(m.message)
const ws = connection(new WebSocket(location.toString().replace('http', 'ws'))).
  on('error', console.error).
  on('message', mobj => bjft_onmessage(ws, mobj, out)).
  on('close', data => {
    console.log(configuration.me, 'close data', data)
    put("<h3 style='text-align: center'>Test PASSED</h3>")
  }).send(JobRequest(`bjft/echo:${configuration.me}`))

setInterval(ws.open, 10000)                // auto-reconnect every 10s

//put(`<h4 style='text-align: right'>${msg}</h4>`)
