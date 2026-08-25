/**
 * Nexa WebRTC Production Telemetry & Adaptive Quality Engine
 *
 * Polls peerConnection.getStats() to monitor packet loss, jitter, RTT, and bitrate.
 * Dynamically adjusts video sender encoding parameters when packet loss exceeds threshold.
 */

export interface WebRtcStreamMetrics {
  timestamp: number;
  packetLossRate: number; // Percentage 0 - 100%
  packetsLost: number;
  packetsReceived: number;
  jitterMs: number;
  roundTripTimeMs: number;
  bitrateKbps: number;
  isDegraded: boolean;
  qualityLevel: 'optimal' | 'moderate' | 'degraded';
}

export interface TelemetryOptions {
  pollIntervalMs?: number;
  packetLossThresholdPercent?: number;
  recoveryLossThresholdPercent?: number;
  onMetricsUpdate?: (metrics: WebRtcStreamMetrics) => void;
  onDegradationChange?: (degraded: boolean, metrics: WebRtcStreamMetrics) => void;
}

export class WebRtcTelemetryMonitor {
  private peer: RTCPeerConnection | null = null;
  private intervalId: any = null;
  private prevBytesReceived = 0;
  private prevTimestamp = 0;
  private prevPacketsLost = 0;
  private prevPacketsReceived = 0;
  private isDegraded = false;

  constructor(private options: TelemetryOptions = {}) {}

  /**
   * Begins telemetry polling and automated quality adaptation on the peer connection.
   */
  public start(peer: RTCPeerConnection): void {
    this.stop();
    this.peer = peer;
    const interval = this.options.pollIntervalMs || 2500;

    this.intervalId = setInterval(() => {
      void this.pollStats();
    }, interval);
  }

  /**
   * Polls RTCStatsReport and calculates real-time network health metrics.
   */
  private async pollStats(): Promise<void> {
    if (!this.peer || this.peer.connectionState === 'closed') {
      this.stop();
      return;
    }

    try {
      const stats = await this.peer.getStats();
      let totalPacketsLost = 0;
      let totalPacketsReceived = 0;
      let jitter = 0;
      let rtt = 0;
      let currentBytesReceived = 0;

      stats.forEach((report) => {
        if (report.type === 'inbound-rtp' && (report.kind === 'video' || report.kind === 'audio')) {
          if (typeof report.packetsLost === 'number') {
            totalPacketsLost += Math.max(0, report.packetsLost);
          }
          if (typeof report.packetsReceived === 'number') {
            totalPacketsReceived += report.packetsReceived;
          }
          if (typeof report.jitter === 'number') {
            jitter = Math.max(jitter, report.jitter * 1000);
          }
          if (typeof report.bytesReceived === 'number') {
            currentBytesReceived += report.bytesReceived;
          }
        }

        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (typeof report.currentRoundTripTime === 'number') {
            rtt = report.currentRoundTripTime * 1000;
          }
        }
      });

      const now = performance.now();
      let bitrateKbps = 0;
      if (this.prevTimestamp > 0 && now > this.prevTimestamp) {
        const deltaBytes = Math.max(0, currentBytesReceived - this.prevBytesReceived);
        const deltaTimeSec = (now - this.prevTimestamp) / 1000;
        bitrateKbps = Math.round((deltaBytes * 8) / (deltaTimeSec * 1000));
      }

      const deltaLost = Math.max(0, totalPacketsLost - this.prevPacketsLost);
      const deltaReceived = Math.max(0, totalPacketsReceived - this.prevPacketsReceived);
      const totalDelta = deltaLost + deltaReceived;

      let packetLossRate = 0;
      if (totalDelta > 0) {
        packetLossRate = Number(((deltaLost / totalDelta) * 100).toFixed(2));
      }

      this.prevTimestamp = now;
      this.prevBytesReceived = currentBytesReceived;
      this.prevPacketsLost = totalPacketsLost;
      this.prevPacketsReceived = totalPacketsReceived;

      const lossThreshold = this.options.packetLossThresholdPercent ?? 5.0;
      const recoveryThreshold = this.options.recoveryLossThresholdPercent ?? 2.0;

      const shouldDegrade = packetLossRate > lossThreshold;
      const shouldRecover = packetLossRate <= recoveryThreshold && this.isDegraded;

      if (shouldDegrade && !this.isDegraded) {
        this.isDegraded = true;
        await this.adaptVideoEncoding(true);
      } else if (shouldRecover) {
        this.isDegraded = false;
        await this.adaptVideoEncoding(false);
      }

      const qualityLevel: 'optimal' | 'moderate' | 'degraded' =
        packetLossRate > 5.0 ? 'degraded' : packetLossRate > 2.0 ? 'moderate' : 'optimal';

      const metrics: WebRtcStreamMetrics = {
        timestamp: Date.now(),
        packetLossRate,
        packetsLost: totalPacketsLost,
        packetsReceived: totalPacketsReceived,
        jitterMs: Math.round(jitter),
        roundTripTimeMs: Math.round(rtt),
        bitrateKbps,
        isDegraded: this.isDegraded,
        qualityLevel
      };

      this.options.onMetricsUpdate?.(metrics);
      if (shouldDegrade || shouldRecover) {
        this.options.onDegradationChange?.(this.isDegraded, metrics);
      }
    } catch (err) {
      console.warn('WebRTC getStats() telemetry error:', err);
    }
  }

  /**
   * Dynamically adjusts video sender degradation and resolution scale.
   */
  private async adaptVideoEncoding(degrade: boolean): Promise<void> {
    if (!this.peer) return;

    try {
      const senders = this.peer.getSenders();
      for (const sender of senders) {
        if (sender.track?.kind === 'video') {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }

          if (degrade) {
            // Lower resolution scale and frame rate to protect audio channel
            params.encodings[0].scaleResolutionDownBy = 2.0;
            params.encodings[0].maxFramerate = 15;
            params.degradationPreference = 'maintain-framerate';
          } else {
            // Restore full HD resolution and frame rate
            params.encodings[0].scaleResolutionDownBy = 1.0;
            delete params.encodings[0].maxFramerate;
            params.degradationPreference = 'balanced';
          }

          await sender.setParameters(params);
        }
      }
    } catch (err) {
      console.warn('Failed to adapt WebRTC sender parameters:', err);
    }
  }

  /**
   * Stops polling and clears references.
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.peer = null;
    this.prevBytesReceived = 0;
    this.prevTimestamp = 0;
    this.prevPacketsLost = 0;
    this.prevPacketsReceived = 0;
    this.isDegraded = false;
  }
}

export const createTelemetryMonitor = (options?: TelemetryOptions): WebRtcTelemetryMonitor => {
  return new WebRtcTelemetryMonitor(options);
};
