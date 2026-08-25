import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackgroundBlurPipeline, enableBackgroundBlur, applyBackgroundBlur, toggleBlur } from '../backgroundBlur.js';

describe('WebRTC Background Blur Filter Pipeline Suite', () => {
  let mockRawTrack: any;
  let mockRawStream: any;
  let mockBlurredTrack: any;
  let mockBlurredStream: any;
  let mockSender: any;
  let mockPeerConnection: any;

  beforeEach(() => {
    mockRawTrack = {
      kind: 'video',
      stop: vi.fn()
    };

    mockRawStream = {
      getVideoTracks: vi.fn(() => [mockRawTrack]),
      getTracks: vi.fn(() => [mockRawTrack])
    };

    mockBlurredTrack = {
      kind: 'video',
      stop: vi.fn()
    };

    mockBlurredStream = {
      getVideoTracks: vi.fn(() => [mockBlurredTrack]),
      getTracks: vi.fn(() => [mockBlurredTrack])
    };

    mockSender = {
      track: mockRawTrack,
      replaceTrack: vi.fn().mockResolvedValue(undefined)
    };

    mockPeerConnection = {
      connectionState: 'connected',
      signalingState: 'stable',
      getSenders: vi.fn(() => [mockSender])
    };

    // Mock HTMLCanvasElement.captureStream
    HTMLCanvasElement.prototype.captureStream = vi.fn().mockReturnValue(mockBlurredStream);

    // Mock HTMLVideoElement methods
    HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    HTMLVideoElement.prototype.pause = vi.fn();

    // Mock CanvasRenderingContext2D
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      ellipse: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn(),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn()
      })),
      fillRect: vi.fn(),
      filter: ''
    };
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);

    // Mock requestAnimationFrame / cancelAnimationFrame
    globalThis.requestAnimationFrame = vi.fn((cb: any) => setTimeout(cb, 10) as any);
    globalThis.cancelAnimationFrame = vi.fn((id: any) => clearTimeout(id));
  });

  it('initializes BackgroundBlurPipeline and captures filtered stream via canvas', async () => {
    const pipeline = new BackgroundBlurPipeline(18, 30);
    const startPromise = pipeline.start(mockRawStream);

    // Trigger video metadata loaded event
    const video = (pipeline as any).video;
    video.onloadedmetadata?.();

    const stream = await startPromise;
    expect(stream).toBeDefined();
    expect(HTMLCanvasElement.prototype.captureStream).toHaveBeenCalledWith(30);

    pipeline.stop();
  });

  it('dynamically hot-swaps RTCRtpSender video track with blurred canvas track', async () => {
    const onStarted = vi.fn();
    const controller = await enableBackgroundBlur({
      peerConnection: mockPeerConnection,
      rawStream: mockRawStream,
      blurRadius: 20,
      onStarted
    });

    expect(controller).not.toBeNull();
    expect(mockSender.replaceTrack).toHaveBeenCalledWith(mockBlurredTrack);
    expect(onStarted).toHaveBeenCalled();

    // Stop and verify reversion to raw video track
    await controller?.stop();
    expect(mockSender.replaceTrack).toHaveBeenCalledWith(mockRawTrack);
  });

  it('allows dynamic adjustment of blur radius parameter', async () => {
    const pipeline = new BackgroundBlurPipeline(12);
    pipeline.setRadius(25);
    expect((pipeline as any).blurRadius).toBe(25);

    // Clamps to max 40
    pipeline.setRadius(100);
    expect((pipeline as any).blurRadius).toBe(40);
  });

  it('handles missing raw video track gracefully without throwing', async () => {
    const emptyStream = {
      getVideoTracks: vi.fn(() => []),
      getTracks: vi.fn(() => [])
    } as any;

    const onError = vi.fn();
    const controller = await enableBackgroundBlur({
      peerConnection: mockPeerConnection,
      rawStream: emptyStream,
      onError
    });

    expect(controller).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('applies and toggles blur using applyBackgroundBlur and toggleBlur functions', async () => {
    const mockVideo = {
      videoWidth: 640,
      videoHeight: 480,
      srcObject: mockRawStream
    } as any;

    const mockCanvas = document.createElement('canvas');

    const blurredTrack = applyBackgroundBlur(mockVideo, mockCanvas);
    expect(blurredTrack).toBeDefined();

    await toggleBlur(mockPeerConnection, mockVideo, mockCanvas, true);
    expect(mockSender.replaceTrack).toHaveBeenCalled();

    await toggleBlur(mockPeerConnection, mockVideo, mockCanvas, false);
    expect(mockSender.replaceTrack).toHaveBeenCalledWith(mockRawTrack);
  });
});
