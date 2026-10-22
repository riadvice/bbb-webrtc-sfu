const config = require('config');
const { otlpMetricsEnabled: OTLP_ENABLED } = require('../../common/telemetry.js');
const PrometheusAgent = require('../../common/prometheus-agent.js');

const {
  enabled: METRICS_ENABLED = false,
  audio: AUDIO_METRICS_CONFIG = {},
} = config.has('prometheus') ? config.get('prometheus') : { enabled: false, audio: {} };
const {
  host: METRICS_HOST = 'localhost',
  port: METRICS_PORT = '3024',
  path: METRICS_PATH = '/metrics',
  collectDefaultMetrics: COLLECT_DEFAULT_METRICS,
} = AUDIO_METRICS_CONFIG;

const AudioPrometheusAgent = new PrometheusAgent(METRICS_HOST, METRICS_PORT, {
  expose: METRICS_ENABLED,
  path: METRICS_PATH,
  prefix: 'sfu_audio_',
  collectDefaultMetrics: COLLECT_DEFAULT_METRICS,
});

const injectMetrics = (metricsDictionary) => {
  if (METRICS_ENABLED || OTLP_ENABLED) {
    AudioPrometheusAgent.injectMetrics(metricsDictionary);
    return true;
  }

  return false;
}

AudioPrometheusAgent.start();

module.exports = {
  PrometheusAgent,
  AudioPrometheusAgent,
  injectMetrics,
};
