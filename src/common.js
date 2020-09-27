const SimplePeer = require('simple-peer');
const bootstrap  = require('simple-peer-bootstrap');
const urlParse   = require('url-parse');
const opts       = { trickle: false };

const protomap = {
  'wrtc:' : 'http:',
  'wrtcs:': 'https:',
};

if (!SimplePeer.WEBRTC_SUPPORT) {
  opts.wrtc = require('wrtc');
}

function distance(a, b) {
  let dist = 0;

  a = a && a.id || a;
  b = b && b.id || b;

  if ('string' === typeof a) a = Buffer.from(a, 'hex');
  if ('string' === typeof b) b = Buffer.from(b, 'hex');

  if (a.length !== b.length) throw new Error("IDs aren't the same length");

  for(const idx in a) {
    dist += Math.abs(a[idx] - b[idx]);
  }

  return dist;
};

module.exports = {
  apply(peer) {
    if (!peer) return;
    if ('Peer' !== peer.constructor.name) return;
    if ('function' !== typeof peer.on) return;
    if ('function' !== typeof peer.addHook) return;
    if ('function' !== typeof peer.addConnection) return;

    // Handle connect to wrtc(s): urls
    peer.addHook({
      name: 'add-connection',
      handler(identifier) {
        if ('string' !== typeof identifier) return identifier;
        let   target = urlParse(identifier);
        if (!protomap[target.protocol]) return identifier;
        target.protocol = protomap[target.protocol];
        const peer = bootstrap.connect(target.toString());
        return new Promise(resolve => {
          peer.on('connect', () => {
            resolve(peer);
          });
        });
      },
    });

    // Add offer handler
    peer.addProcedure({
      name: 'broker.simple-peer',
      handler(offer) {
        return new Promise(resolve => {
          const socket = new SimplePeer({
            ...opts,
            initiator : false,
          });

          // Handle response
          socket.on('signal', response => {
            resolve(response);
          });

          // Register socket
          socket.on('connect', async () => {
            const error = await peer.addConnection(socket);
            if (error) socket.destroy();
          });

          // Trigger socket init
          socket.signal(offer);
        });
      },
    });

    // Remove far simple-peer connection if no slots are free
    peer.on('tick', () => {
      if (peer.connections.length < peer.maxConnections) return;

      // Find farthest peer
      const found = peer.connections
        .filter(connection => connection.socket instanceof SimplePeer)
        .reduce((r, connection) => {
          const dist = distance(connection, peer);
          if (dist < r.distance) {
            r.connection = connection;
            r.distance   = dist;
          }
          return r;
        }, {connection:null,distance:Infinity})

      // No far simple-peer connections
      if (!found.connection) return;

      // Kill the connection
      found.connection.socket.destroy();
    });

    // Setup direct connection on peer discovery
    // 99% certain the connection will be used later
    peer.addHook({
      name: 'find-peer',
      handler(target) {
        if (peer.connections.length >= peer.maxConnections) return;
        return new Promise(resolve => {
          const socket = new SimplePeer({
            ...opts,
            initiator : true,
          });

          // Handle outgoing signalling
          socket.on('signal', async offer => {
            const answer = await peer._callProcedure({
              ...target,
              procedure: 'broker.simple-peer',
              data     : offer,
            });

            if (!answer) {
              socket.destroy();
              return resolve(target);
            }
            socket.signal(answer);
          });

          // Register socket upon connect
          socket.on('connect', async () => {
            const err = await peer.addConnection(socket, target.id);
            if (err) {
              socket.destroy();
              return resolve(target);
            }

            // Use new connection
            target.socket     = socket;
            target.routeLabel = '';
            resolve(target);
          });

        });
      },
    });

  },
};
