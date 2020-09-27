const test   = require('tape');
const {Peer} = require('hashnet');
const broker = require('./common');
const full   = require('./node');
const opts   = { interval: 100 };

test('Basics', t => {
  t.plan(2);
  t.equal(typeof broker      , 'object'  , 'Broker is an object');
  t.equal(typeof broker.apply, 'function', 'Broker.apply is a function');
});

test('Basic apply', t => {
  t.plan(2);
  const peer = new Peer();
  broker.apply(peer);
  t.ok(Array.isArray(peer.procedures['broker.simple-peer']), 'Procedure was registered');
  t.ok(Array.isArray(peer.hooks['add-connection']), 'Broker attached to addConnection');
  peer.shutdown();
});

test('Broker connection', async t => {
  t.plan(2);

  // Setup server
  const serverPeer = new Peer(opts);
  const server     = full.server(serverPeer);
  server.listen(5000);

  // Setup client
  const clientPeer = new Peer(opts);
  broker.apply(clientPeer);

  // Connect client to the server
  await clientPeer.addConnection('wrtc://localhost:5000/bootstrap');

  // Let the connection identification settle
  await new Promise(r => setTimeout(r, opts.interval * 3));

  // Check the connection
  t.deepEqual(clientPeer.connections[0].id, serverPeer.id, 'clientPeer detected server\'s id');
  t.deepEqual(serverPeer.connections[0].id, clientPeer.id, 'serverPeer detected client\'s id');

  // Shutdown
  clientPeer.shutdown();
  serverPeer.shutdown();
  server.close();
});

test('Setup connection due to call', async t => {
  t.plan(5);

  // Setup server
  const serverPeer = new Peer(opts);
  const server     = full.server(serverPeer);
  server.listen(5000);

  // Setup clients
  const alice = new Peer(opts);
  const bob   = new Peer(opts);
  broker.apply(alice);
  broker.apply(bob);

  // Connect clients to the server
  await alice.addConnection('wrtc://localhost:5000/bootstrap');
  await bob.addConnection('wrtc://localhost:5000/bootstrap');

  // Add call to alice
  alice.addProcedure({
    name: 'test',
    handler() {
      // Hello World
    },
  });

  // Let the connection identification settle
  await new Promise(r => setTimeout(r, opts.interval * 3));

  // Check connections
  t.deepEqual(alice.connections[0].id, serverPeer.id, 'Alice detected server\'s id');
  t.deepEqual(bob.connections[0].id, serverPeer.id, 'Bob detected server\'s id');
  t.deepEqual(serverPeer.connections[0].id, alice.id, 'Server detected Alice\'s id');
  t.deepEqual(serverPeer.connections[1].id, bob.id, 'Server detected Bob\'s id');

  // Make bob call alice's procedure
  await bob.callProcedure({
    peerId   : alice.id,
    procedure: 'test',
  });

  // Let the connection identification settle
  await new Promise(r => setTimeout(r, opts.interval * 3));

  // Ensure bob is now directly connected to alice
  t.deepEqual(bob.connections[1].id, alice.id, 'Bob is now connected directly to alice');

  // Shutdown
  server.close();
  alice.shutdown();
  bob.shutdown();
  serverPeer.shutdown();
});
