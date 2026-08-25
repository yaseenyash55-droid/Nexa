import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startScreenSharing, toggleScreenShare } from '../screenShare.js';

describe('WebRTC Screen Sharing Track Swapper Suite', () => {
  let mockTrack: any;
  let mockScreenStream: any;
  let mockCameraTrack: any;
  let mockCameraStream: any;
  let mockSender: any;
  let mockPeerConnection: any;

  beforeEach(() => {
    mockTrack = {
      kind: 'video',
      stop: vi.fn(),
      onended: null
    };

    mockScreenStream = {
      getVideoTracks: vi.fn(() => [mockTrack]),
      getTracks: vi.fn(() => [mockTrack])
    };

    mockCameraTrack = {
      kind: 'video',
      stop: vi.fn()
    };

    mockCameraStream = {
      getVideoTracks: vi.fn(() => [mockCameraTrack]),
      getTracks: vi.fn(() => [mockCameraTrack])
    };

    mockSender = {
      track: mockCameraTrack,
      replaceTrack: vi.fn().mockResolvedValue(undefined)
    };

    mockPeerConnection = {
      connectionState: 'connected',
      signalingState: 'stable',
      getSenders: vi.fn(() => [mockSender]),
      addTrack: vi.fn()
    };

    // Mock navigator.mediaDevices
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getDisplayMedia: vi.fn().mockResolvedValue(mockScreenStream)
        }
      },
      writable: true,
      configurable: true
    });
  });

  it('successfully captures screen stream and hot-swaps video RTCRtpSender', async () => {
    const onStarted = vi.fn();
    const controller = await startScreenSharing({
      peerConnection: mockPeerConnection,
      cameraStream: mockCameraStream,
      onStarted
    });

    expect(controller).not.toBeNull();
    expect(globalThis.navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith({
      video: {
        cursor: 'always',
        displaySurface: 'monitor'
      },
      audio: true
    });
    expect(mockSender.replaceTrack).toHaveBeenCalledWith(mockTrack);
    expect(onStarted).toHaveBeenCalledWith(mockScreenStream);
  });

  it('reverts to camera track when stop() is invoked', async () => {
    const onStopped = vi.fn();
    const controller = await startScreenSharing({
      peerConnection: mockPeerConnection,
      cameraStream: mockCameraStream,
      onStopped
    });

    expect(controller).not.toBeNull();
    await controller?.stop();

    expect(mockTrack.stop).toHaveBeenCalled();
    expect(mockSender.replaceTrack).toHaveBeenCalledWith(mockCameraTrack);
    expect(onStopped).toHaveBeenCalled();
  });

  it('automatically reverts to camera track on native browser onended event', async () => {
    const onStopped = vi.fn();
    await startScreenSharing({
      peerConnection: mockPeerConnection,
      cameraStream: mockCameraStream,
      onStopped
    });

    expect(mockTrack.onended).toBeTypeOf('function');
    // Simulate user clicking "Stop Sharing" on browser UI
    mockTrack.onended();

    expect(mockTrack.stop).toHaveBeenCalled();
    expect(mockSender.replaceTrack).toHaveBeenCalledWith(mockCameraTrack);
  });

  it('handles permission denial (NotAllowedError) gracefully without throwing', async () => {
    const permissionError = new Error('Permission denied');
    permissionError.name = 'NotAllowedError';
    globalThis.navigator.mediaDevices.getDisplayMedia = vi.fn().mockRejectedValue(permissionError);

    const onError = vi.fn();
    const controller = await startScreenSharing({
      peerConnection: mockPeerConnection,
      cameraStream: mockCameraStream,
      onError
    });

    expect(controller).toBeNull();
    expect(onError).toHaveBeenCalledWith(permissionError, 'PERMISSION_DENIED');
  });

  it('handles unsupported browser environments safely', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true
    });

    const onError = vi.fn();
    const controller = await startScreenSharing({
      peerConnection: mockPeerConnection,
      cameraStream: mockCameraStream,
      onError
    });

    expect(controller).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'UNSUPPORTED');
  });

  it('toggles screen share on and off with toggleScreenShare', async () => {
    const started = await toggleScreenShare(mockPeerConnection, mockCameraStream);
    expect(started).toBe(true);
    expect(mockSender.replaceTrack).toHaveBeenCalledWith(mockTrack);

    const stopped = await toggleScreenShare(mockPeerConnection, mockCameraStream);
    expect(stopped).toBe(false);
    expect(mockTrack.stop).toHaveBeenCalled();
  });
});
