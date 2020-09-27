# hashnet-broker-simple-peer

Hashnet broker, setting up simple-peer connections

## Usage

```js
const Peer   = require('hashnet');
const broker = require('hashnet-broker-simple-peer');

// Create new hashnet peer
const peer = new Peer();

// Attach this broker
broker.apply(peer);

// Connect to known server
peer.addConnection('wrtc://server/bootstrap');
```

## API

### broker.apply(peer)

Integrates the broker into the given peer

### broker.middleware(peer)

express middleware, attaches a listener on your server to bootstrap clients with

### broker.server(peer)

returns non-listening stand-alone http server to bootstrap clients with (/bootstrap)
