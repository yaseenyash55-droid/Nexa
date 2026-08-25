/**
 * WebRTC Connection & ICE State Management Utility
 *
 * Handles automatic ICE candidate gathering, state tracking, and seamless
 * ICE restarts during network handovers (e.g. Wi-Fi to cellular).
 */

export type IceStateCallback = (state: RTCIceConnectionState) => void;

/**
 * Attaches ICE connection state listeners to an active RTCPeerConnection.
 * Automatically triggers an ICE restart when state shifts to 'failed'.
 */
export function setupIceConnectionListeners(
  peerConnection: RTCPeerConnection,
  onStateChange?: IceStateCallback
): () => void {
  const handleIceConnectionStateChange = () => {
    const state = peerConnection.iceConnectionState;
    console.log(`ICE Connection State changed to: ${state}`);

    if (onStateChange) {
      onStateChange(state);
    }

    if (state === 'failed') {
      console.warn('ICE connection failed. Initiating ICE restart...');
      // Restarting ICE forces the client to gather new candidates via TURN
      if (typeof peerConnection.restartIce === 'function') {
        try {
          peerConnection.restartIce();
        } catch (err) {
          console.error('Failed to invoke peerConnection.restartIce():', err);
        }
      }
    } else if (state === 'disconnected') {
      console.log('ICE connection temporarily disconnected. Waiting for recovery...');
      // A transient state; wait to see if it recovers to 'connected' or drops to 'failed'
    }
  };

  peerConnection.addEventListener('iceconnectionstatechange', handleIceConnectionStateChange);

  // Return cleanup function to remove event listener
  return () => {
    peerConnection.removeEventListener('iceconnectionstatechange', handleIceConnectionStateChange);
  };
}

/**
 * Triggers an ICE restart and optionally generates a renegotiation offer SDP.
 */
export async function triggerIceRestart(
  peerConnection: RTCPeerConnection,
  createRenegotiationOffer = false
): Promise<RTCSessionDescriptionInit | null> {
  if (typeof peerConnection.restartIce === 'function') {
    peerConnection.restartIce();
  }

  if (createRenegotiationOffer) {
    const offer = await peerConnection.createOffer({ iceRestart: true });
    await peerConnection.setLocalDescription(offer);
    return offer;
  }

  return null;
}
