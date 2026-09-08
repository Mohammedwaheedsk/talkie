function getIceConfiguration(env = process.env) {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];
  const urls = (env.TURN_URLS || '').split(',').map(value => value.trim()).filter(Boolean);
  const hasCredentials = Boolean(env.TURN_USERNAME && env.TURN_CREDENTIAL);
  if (urls.length && (!hasCredentials || urls.some(url => !/^turns?:[^\s/]+(?::\d+)?(?:\?transport=(udp|tcp))?$/.test(url)))) {
    throw new Error('Configure valid TURN_URLS, TURN_USERNAME and TURN_CREDENTIAL.');
  }
  if (!urls.length && (env.TURN_USERNAME || env.TURN_CREDENTIAL)) {
    throw new Error('TURN_URLS is required when TURN credentials are set.');
  }
  const iceTransportPolicy = env.TURN_RELAY_ONLY === 'true' ? 'relay' : 'all';
  if (iceTransportPolicy === 'relay' && !urls.length) {
    throw new Error('Relay-only mode requires a TURN server.');
  }
  if (urls.length) iceServers.push({ urls, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL });
  return { iceServers, iceTransportPolicy, turnConfigured: urls.length > 0 };
}

module.exports = { getIceConfiguration };