const config = require('config');
const { otlpMetricsEnabled: OTLP_ENABLED } = require('../../common/telemetry.js');
const PrometheusAgent = require('../../common/prometheus-agent.js');

const {
  enabled: METRICS_ENABLED = false,
  screenshare: SCREEN_METRICS_CONFIG = {},
} = config.has('prometheus') ? config.get('prometheus') : { enabled: false, screenshare: {} };
const {
  host: METRICS_HOST = 'localhost',
  port: METRICS_PORT = '3022',
  path: METRICS_PATH = '/metrics',
  collectDefaultMetrics: COLLECT_DEFAULT_METRICS,
} = SCREEN_METRICS_CONFIG;

const ScreensharePrometheusAgent = new PrometheusAgent(METRICS_HOST, METRICS_PORT, {
  expose: METRICS_ENABLED,
  path: METRICS_PATH,
  prefix: 'sfu_screenshare_',
  collectDefaultMetrics: COLLECT_DEFAULT_METRICS,
});

const injectMetrics = (metricsDictionary) => {
  if (METRICS_ENABLED || OTLP_ENABLED) {
    ScreensharePrometheusAgent.injectMetrics(metricsDictionary);
    return true;
  }

  return false;
}

ScreensharePrometheusAgent.start();

module.exports = {
  PrometheusAgent,
  ScreensharePrometheusAgent,
  injectMetrics,
};
