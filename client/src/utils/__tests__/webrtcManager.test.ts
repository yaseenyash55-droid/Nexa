import { describe, expect, it, vi } from 'vitest';
import { setupIceConnectionListeners, triggerIceRestart } from '../webrtcManager.js';

describe('WebRTC ICE Connection Manager', () => {
  it('registers listener and calls restartIce when state shifts to failed', () => {
    let listener: (() => void) | null = null;
    const mockRestartIce = vi.fn();
    const mockAddEventListener = vi.fn((event: string, cb: any) => {
      if (event === 'iceconnectionstatechange') listener = cb;
    });
    const mockRemoveEventListener = vi.fn();

    const mockPeer = {
      iceConnectionState: 'new',
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
      restartIce: mockRestartIce
    } as unknown as RTCPeerConnection;

    const stateChanges: string[] = [];
    const cleanup = setupIceConnectionListeners(mockPeer, (state) => {
      stateChanges.push(state);
    });

    expect(mockAddEventListener).toHaveBeenCalledWith('iceconnectionstatechange', expect.any(Function));

    // Simulate transient disconnection
    (mockPeer as any).iceConnectionState = 'disconnected';
    if (listener) (listener as () => void)();
    expect(mockRestartIce).not.toHaveBeenCalled();
    expect(stateChanges).toContain('disconnected');

    // Simulate failure -> triggers auto ICE restart
    (mockPeer as any).iceConnectionState = 'failed';
    if (listener) (listener as () => void)();
    expect(mockRestartIce).toHaveBeenCalledTimes(1);
    expect(stateChanges).toContain('failed');

    // Cleanup removes listener
    cleanup();
    expect(mockRemoveEventListener).toHaveBeenCalledWith('iceconnectionstatechange', expect.any(Function));
  });

  it('triggers ICE restart and creates renegotiation offer when requested', async () => {
    const mockRestartIce = vi.fn();
    const mockCreateOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'v=0\r\n...' });
    const mockSetLocalDescription = vi.fn().mockResolvedValue(undefined);

    const mockPeer = {
      restartIce: mockRestartIce,
      createOffer: mockCreateOffer,
      setLocalDescription: mockSetLocalDescription
    } as unknown as RTCPeerConnection;

    const offer = await triggerIceRestart(mockPeer, true);

    expect(mockRestartIce).toHaveBeenCalledTimes(1);
    expect(mockCreateOffer).toHaveBeenCalledWith({ iceRestart: true });
    expect(mockSetLocalDescription).toHaveBeenCalledWith(offer);
    expect(offer?.type).toBe('offer');
  });
});
