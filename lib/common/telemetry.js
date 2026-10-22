'use strict';

const { context, metrics, propagation, trace, SpanKind } = require('@opentelemetry/api');

// Required first by the main and the forked module processes so http, redis and pino get patched before they load.
// It starts only when OTEL_EXPORTER_OTLP_ENDPOINT is set; the OTEL_* variables configure it.
const enabled = !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT && process.env.OTEL_SDK_DISABLED !== 'true';
const otlpMetricsEnabled = enabled && process.env.OTEL_METRICS_EXPORTER !== 'none';

// Pushes the prom-client metrics, including those registered later, through OTel observable instruments.
const exportPrometheusMetrics = () => {
  const { register, Counter, Gauge } = require('prom-client');
  const meter = metrics.getMeter('bbb-webrtc-sfu');
  const observe = (metric, instrument, metricName) => instrument.addCallback(async (result) => {
    for (const { value, labels, metricName: valueName = metric.name } of (await metric.get()).values) {
      if (valueName === metricName) result.observe(value, labels);
    }
  });
  const bridge = (metric) => {
    const { name, help: description } = metric;
    if (metric instanceof Counter) {
      observe(metric, meter.createObservableCounter(name, { description }), name);
    } else if (metric instanceof Gauge) {
      observe(metric, meter.createObservableGauge(name, { description }), name);
    } else {
      for (const suffix of ['_sum', '_count']) {
        observe(metric, meter.createObservableCounter(name + suffix, { description }), name + suffix);
      }
    }
  };
  const registerMetric = register.registerMetric.bind(register);
  register.registerMetric = (metric) => {
    registerMetric(metric);
    bridge(metric);
  };
  register.getMetricsAsArray().forEach(bridge);
};

if (enabled) {
  process.env.OTEL_SERVICE_NAME ??= 'bbb-webrtc-sfu';
  process.env.OTEL_LOGS_EXPORTER ??= 'none';
  const { NodeSDK } = require('@opentelemetry/sdk-node');
  const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
  const { RedisInstrumentation } = require('@opentelemetry/instrumentation-redis');
  const { PinoInstrumentation } = require('@opentelemetry/instrumentation-pino');
  new NodeSDK({
    instrumentations: [
      new HttpInstrumentation({ ignoreIncomingRequestHook: (req) => req.url?.startsWith('/metrics') }),
      new RedisInstrumentation(),
      new PinoInstrumentation(),
    ],
  }).start();
  if (otlpMetricsEnabled) exportPrometheusMetrics();
}

const USER_ID = /^[a-z]_[a-z0-9]+$/;
const tracer = trace.getTracer('bbb-webrtc-sfu');

// Starts the span of an SFU start request; the caller ends it. Other messages get none.
const startRequestSpan = (message) => {
  if (message?.id !== 'start') return null;
  const { meetingId, userId } = message.sfuUserHeader || {};
  return tracer.startSpan(`${message.type} start`, {
    kind: SpanKind.SERVER,
    attributes: {
      'bbb.meeting.id': typeof meetingId === 'string' ? meetingId : undefined,
      'bbb.user.id': USER_ID.test(userId) ? userId : undefined,
    },
  });
};

// Passes the trace context on in the Redis message routing.
const injectTraceContext = (routing) => {
  if (routing && typeof routing === 'object') propagation.inject(context.active(), routing);
};

module.exports = { otlpMetricsEnabled, startRequestSpan, injectTraceContext };
