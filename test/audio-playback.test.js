const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function loadClient(audioElements) {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          listeners: {},
          classList: { add() {}, remove() {} },
          addEventListener(event, listener) { this.listeners[event] = listener; }
        });
      }
      return elements.get(id);
    },
    querySelectorAll(selector) { return selector === 'audio' ? audioElements : []; }
  };
  const html = readFileSync(require.resolve('../public/index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, {
    document,
    io: () => ({ on() {} }),
    navigator: {},
    window: { addEventListener() {} },
    setTimeout: () => 1,
    clearTimeout() {}
  });
  return elements;
}

for (const gesture of ['mousedown', 'touchstart']) {
  test(`${gesture} retries blocked incoming audio during the user gesture`, async () => {
    let playCalls = 0;
    const elements = loadClient([
      { srcObject: {}, paused: true, play() { playCalls++; return Promise.resolve(); } },
      { srcObject: {}, paused: false, play() { assert.fail('Already playing'); } },
      { srcObject: null, paused: true, play() { assert.fail('No stream'); } }
    ]);
    elements.get('ptt').listeners[gesture]({ preventDefault() {} });
    assert.equal(playCalls, 1);
    await Promise.resolve();
  });
}

test('a rejected playback retry reports the browser restriction', async () => {
  const elements = loadClient([
    { srcObject: {}, paused: true, play() { return Promise.reject(new Error('Blocked')); } }
  ]);
  elements.get('ptt').listeners.mousedown({ preventDefault() {} });
  await Promise.resolve();
  assert.equal(elements.get('toast').textContent, 'Incoming audio is blocked by your browser.');
});
