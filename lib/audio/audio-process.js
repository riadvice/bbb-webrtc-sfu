'use strict';

const Logger = require('../common/logger.js');
require('../common/error-tracking.js').init('bbb-webrtc-sfu', {
  logger: Logger, config: require('config').sentry,
});

const AudioReqHdlr = require('./audio-req-hdlr.js');
const BaseProcess = require('../common/base-process.js');
const C = require('../bbb/messages/Constants');

const AUDIO_PROCESS_PREFIX = '[audio-process]';
const AUDIO_REQ_HDLR_PREFIX = '[audio-req-hdlr]';

const manager = new AudioReqHdlr(
  C.TO_AUDIO,
  [C.FROM_AKKA_APPS, C.TO_SFU, C.FROM_VOICE_CONF],
  AUDIO_REQ_HDLR_PREFIX,
);
const newProcess = new BaseProcess(manager, AUDIO_PROCESS_PREFIX);

newProcess.start();
