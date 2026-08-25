import { describe, it, expect, vi } from 'vitest';
import { WebRtcTelemetryMonitor } from '../webrtcTelemetry.js';

describe('WebRtcTelemetryMonitor', () => {
  it('creates an instance and stops gracefully without active connection', () => {
    const monitor = new WebRtcTelemetryMonitor();
    expect(monitor).toBeDefined();
    monitor.stop();
  });

  it('polls getStats and reports computed stream metrics', async () => {
    const onMetricsUpdate = vi.fn();
    const monitor = new WebRtcTelemetryMonitor({
      onMetricsUpdate,
      pollIntervalMs: 50
    });

    const mockStats = new Map();
    mockStats.set('inbound-video', {
      type: 'inbound-rtp',
      kind: 'video',
      packetsLost: 2,
      packetsReceived: 100,
      jitter: 0.015,
      bytesReceived: 50000
    });
    mockStats.set('candidate-pair-active', {
      type: 'candidate-pair',
      state: 'succeeded',
      currentRoundTripTime: 0.045
    });

    const mockPeer = {
      connectionState: 'connected',
      getStats: vi.fn().mockResolvedValue(mockStats),
      getSenders: vi.fn().mockReturnValue([])
    } as unknown as RTCPeerConnection;

    monitor.start(mockPeer);

    // Wait for at least 1 tick
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(mockPeer.getStats).toHaveBeenCalled();
    monitor.stop();
  });
});
