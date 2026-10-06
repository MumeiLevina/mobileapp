import {
  MetricsService,
  MetricLogger,
} from "../apps/api/src/observability/metrics.service";

test("structured metrics contain operational fields without private content", () => {
  const logger: MetricLogger = {
    info: jest.fn(),
    warn: jest.fn(),
  };
  const metrics = new MetricsService(logger);

  metrics.request({
    request_id: "77777777-7777-4777-a777-777777777777",
    endpoint: "POST /conversations/:id/messages",
    status: 200,
    duration_ms: 42,
  });
  metrics.safetyDecision({
    safety_level: "elevated",
    classifier_status: "classified",
    requires_escalation: true,
  });
  metrics.outputGuardRejected("reviewer");

  const serialized = JSON.stringify([
    ...(logger.info as jest.Mock).mock.calls,
    ...(logger.warn as jest.Mock).mock.calls,
  ]);
  expect(serialized).toContain("request_id");
  expect(serialized).toContain("safety_level");
  expect(serialized).not.toMatch(
    /authorization|access_token|conversation_content|journal_content|memory_content/i,
  );
});
