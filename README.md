# WalkieTalkie

Voice and video use WebRTC between room members. Socket.IO carries signaling,
not media. Walkie-talkie audio and video calls are separate room modes.
STUN alone cannot connect many mobile-carrier, symmetric-NAT and firewalled
networks. Configure a real TURN relay to support these connections.

## Deployment

1. Obtain TURN server URLs, a TURN username and a TURN credential from a managed
   TURN provider, or deploy coturn on a public host. The Render Express web
   service is not itself a TURN server. The Experiential Labs key is unrelated.
2. In Render, open the walkie-talkie service, then Environment, and add:

   | Variable | Value |
   | --- | --- |
   | `TURN_URLS` | Provider URLs, comma-separated, e.g. `turn:relay.example.com:3478?transport=udp,turn:relay.example.com:3478?transport=tcp,turns:relay.example.com:443?transport=tcp` |
   | `TURN_USERNAME` | TURN username from your provider |
   | `TURN_CREDENTIAL` | TURN password from your provider |
   | `TURN_RELAY_ONLY` | `false` normally; `true` to test mandatory relaying |

   Use actual provider endpoints, not the example hostname. Include UDP and
   TCP/TLS endpoints the provider supports. TLS on port 443 is particularly
   useful on restrictive networks. Do not put credentials in source control.
3. Deploy these code changes and save the environment changes in Render.
4. Open the same public HTTPS app URL on both devices and join the same 6-character room code.
   Remote microphone access requires HTTPS; localhost is a development exception.

## Audio and video rooms

Choose **Walkie-talkie** for push-to-talk audio or **Video call** for camera and
microphone calling. Both modes use six-character alphanumeric codes. The same
code can be used independently for one audio room and one video room; users in
different modes cannot see or signal each other.

`/api/ice-config` supplies browser-required TURN credentials with `no-store`.
These credentials are visible to app visitors, as required for browser TURN
authentication. Use dedicated, quota-limited credentials and rotate them. For
a public production service, add authenticated access and provider-issued
short-lived credentials before exposing an unrestricted paid relay account.

## Cross-network verification

1. Temporarily set `TURN_RELAY_ONLY=true` and redeploy. Rejoin on both devices.
2. Put one device on Wi-Fi and the other on cellular with Wi-Fi disabled.
3. Confirm both users become LINKED and test push-to-talk in both directions.
4. On desktop Chromium, open `chrome://webrtc-internals` before joining. The
   selected candidate pair should include a local candidate of type `relay`.
   In Firefox use `about:webrtc`.
5. Repeat with TCP/TLS-only provider URLs to verify the restrictive-network
   fallback. Restore the full URL list and `TURN_RELAY_ONLY=false` afterward.

The original offerer attempts at most two ICE restarts per peer connection.
Failed links display LINK FAILED. Signaling loss releases the microphone and
returns to the entry screen; rejoin once the server is reachable. Both devices
must remain online and allow microphone/audio playback. No implementation can
guarantee connectivity on every network, particularly networks blocking TURN.
Room membership is in memory: use one server instance unless you add shared
room storage and a Socket.IO adapter. Server restarts require rejoining.

## Local development

Install dependencies with `npm install`, then run `npm start`.
Run configuration tests with `node --test test/*.test.js`.