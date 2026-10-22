const config = require('config');
const { otlpMetricsEnabled: OTLP_ENABLED } = require('../../common/telemetry.js');
const PrometheusAgent = require('../../common/prometheus-agent.js');

const {
  enabled: METRICS_ENABLED = false,
  video: VIDEO_METRICS_CONFIG = {},
} = config.has('prometheus') ? config.get('prometheus') : { enabled: false, video: {} };
const {
  host: METRICS_HOST = 'localhost',
  port: METRICS_PORT = '3026',
  path: METRICS_PATH = '/metrics',
  collectDefaultMetrics: COLLECT_DEFAULT_METRICS,
} = VIDEO_METRICS_CONFIG;

const VideoPrometheusAgent = new PrometheusAgent(METRICS_HOST, METRICS_PORT, {
  expose: METRICS_ENABLED,
  path: METRICS_PATH,
  prefix: 'sfu_video_',
  collectDefaultMetrics: COLLECT_DEFAULT_METRICS,
});

const injectMetrics = (metricsDictionary) => {
  if (METRICS_ENABLED || OTLP_ENABLED) {
    VideoPrometheusAgent.injectMetrics(metricsDictionary);
    return true;
  }

  return false;
}

VideoPrometheusAgent.start();

module.exports = {
  PrometheusAgent,
  VideoPrometheusAgent,
  injectMetrics,
};
