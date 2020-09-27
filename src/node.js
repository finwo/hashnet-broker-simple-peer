const bootstrap = require('simple-peer-bootstrap');

const broker = module.exports = {
  ...require('./common'),
  middleware(peer) {
    broker.apply(peer);
    return bootstrap.middleware(socket => {
      peer.addConnection(socket);
    });
  },
  server(peer) {
    broker.apply(peer);
    return bootstrap.server(socket => {
      peer.addConnection(socket);
    });
  },
};
