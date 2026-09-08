const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getIceConfiguration } = require('../ice-servers');

test('STUN-only configuration explicitly reports missing TURN', () => {
  const config = getIceConfiguration({});
  assert.equal(config.turnConfigured, false);
  assert.equal(config.iceTransportPolicy, 'all');
  assert.equal(config.iceServers.length, 2);
});

test('TURN supplies UDP, TCP and TLS relay candidates with credentials', () => {
  const config = getIceConfiguration({
    TURN_URLS: 'turn:relay.example.com:3478?transport=udp, turn:relay.example.com:3478?transport=tcp,turns:relay.example.com:443?transport=tcp',
    TURN_USERNAME: 'test-user',
    TURN_CREDENTIAL: 'test-password',
    TURN_RELAY_ONLY: 'true'
  });
  assert.equal(config.turnConfigured, true);
  assert.equal(config.iceTransportPolicy, 'relay');
  assert.deepEqual(config.iceServers[2], {
    urls: ['turn:relay.example.com:3478?transport=udp', 'turn:relay.example.com:3478?transport=tcp', 'turns:relay.example.com:443?transport=tcp'],
    username: 'test-user', credential: 'test-password'
  });
});

test('incomplete, invalid and relay-only-without-TURN configurations fail', () => {
  for (const env of [
    { TURN_URLS: 'turn:relay.example.com' },
    { TURN_USERNAME: 'test-user' },
    { TURN_RELAY_ONLY: 'true' },
    { TURN_URLS: 'https://relay.example.com', TURN_USERNAME: 'test-user', TURN_CREDENTIAL: 'test-password' }
  ]) assert.throws(() => getIceConfiguration(env), /TURN/);
});