/**
 * WebRTC Connection, Device & ICE State Management Utility
 *
 * Handles safe media acquisition, error translation, ICE candidate gathering,
 * state tracking, and seamless ICE restarts during network handovers.
 */

export type IceStateCallback = (state: RTCIceConnectionState) => void;

/**
 * Translates low-level browser/Chromium/WebView exceptions into actionable, user-friendly messages.
 */
export function formatWebRtcError(error: unknown): string {
  if (!error) return 'An unexpected error occurred during the call.';

  if (typeof error === 'string') return error;

  if (error instanceof Error) {
    const name = error.name || '';
    const message = error.message || '';

    switch (name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Camera or microphone access was denied. Please allow permissions in your app or browser settings.';

      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'No camera or microphone was found on this device.';

      case 'NotReadableError':
      case 'TrackStartError':
        return 'Camera or microphone is currently in use by another application.';

      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return 'The camera does not support the requested video resolution.';

      case 'SecurityError':
        return 'Media access is blocked because the connection is not secure (HTTPS required).';

      case 'TypeError':
        if (message.includes('getUserMedia') || message.includes('mediaDevices') || message.includes('undefined')) {
          return 'Media devices are not supported or blocked in this environment (HTTPS required).';
        }
        return error.message;

      default:
        if (message.toLowerCase().includes('ice') || message.toLowerCase().includes('turn')) {
          return 'Network relay connection failed. Please check your internet connection.';
        }
        return error.message || 'Unable to establish call connection.';
    }
  }

  return 'Unable to establish call connection. Please try again.';
}

/**
 * Safely requests media stream with fallback constraints for mobile/Android WebViews.
 */
export async function safeGetUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
    throw new Error('Media devices are not supported in this environment or connection is not secure (HTTPS required).');
  }

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    // If high-resolution video constraints fail with OverconstrainedError, fall back to basic video
    if (err instanceof Error && (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError')) {
      console.warn('[WebRTC] High-res video constraints failed, retrying with standard video constraints...', err);
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: constraints.audio,
          video: constraints.video ? true : false
        });
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }
    throw err;
  }
}

/**
 * Validates that both STUN and TURN servers are present in the ICE server configuration.
 */
export function validateIceServers(iceServers: RTCIceServer[] = []): {
  hasStun: boolean;
  hasTurn: boolean;
  iceServers: RTCIceServer[];
} {
  let hasStun = false;
  let hasTurn = false;

  for (const server of iceServers) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    for (const url of urls) {
      if (typeof url === 'string') {
        if (url.startsWith('stun:')) hasStun = true;
        if (url.startsWith('turn:') || url.startsWith('turns:')) hasTurn = true;
      }
    }
  }

  if (!hasTurn) {
    console.warn('[WebRTC] Notice: No TURN relay server detected in ICE config. Connections across mobile cellular NATs may fail.');
  }

  return {
    hasStun,
    hasTurn,
    iceServers
  };
}

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
      if (typeof peerConnection.restartIce === 'function') {
        try {
          peerConnection.restartIce();
        } catch (err) {
          console.error('Failed to invoke peerConnection.restartIce():', err);
        }
      }
    } else if (state === 'disconnected') {
      console.log('ICE connection temporarily disconnected. Waiting for recovery...');
    }
  };

  peerConnection.addEventListener('iceconnectionstatechange', handleIceConnectionStateChange);

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
    try {
      peerConnection.restartIce();
    } catch (e) {
      console.warn('peerConnection.restartIce() failed:', e);
    }
  }

  if (createRenegotiationOffer) {
    try {
      const offer = await peerConnection.createOffer({ iceRestart: true });
      await peerConnection.setLocalDescription(offer);
      return offer;
    } catch (err) {
      console.error('Failed to create renegotiation offer during ICE restart:', err);
      return null;
    }
  }

  return null;
}
