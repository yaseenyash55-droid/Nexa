/**
 * Nexa WebRTC Screen Sharing & Dynamic Track Swapper Module
 * 
 * Manages display media capture, RTCRtpSender video track hot-swapping,
 * automatic reversion to webcam on browser "Stop Sharing", and graceful
 * fallback error handling for permission denial (NotAllowedError).
 */

export interface ScreenShareOptions {
  peerConnection: RTCPeerConnection | null;
  cameraStream: MediaStream | null;
  onStarted?: (screenStream: MediaStream) => void;
  onStopped?: () => void;
  onError?: (error: Error, code: 'PERMISSION_DENIED' | 'UNSUPPORTED' | 'SWAP_FAILED') => void;
}

export interface ScreenShareController {
  screenStream: MediaStream;
  stop: () => Promise<void>;
}

/**
 * Initiates screen sharing and swaps the active RTCPeerConnection video track.
 */
export async function startScreenSharing(
  options: ScreenShareOptions
): Promise<ScreenShareController | null> {
  const { peerConnection, cameraStream, onStarted, onStopped, onError } = options;

  // 1. Verify Browser Support
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
    const error = new Error('Screen sharing is not supported in this browser environment.');
    onError?.(error, 'UNSUPPORTED');
    return null;
  }

  let screenStream: MediaStream;

  // 2. Request Display Media
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        cursor: 'always',
        displaySurface: 'monitor'
      } as MediaTrackConstraints,
      audio: true
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error('Failed to acquire display media');
    // Handle user denial / cancel gracefully
    if (error.name === 'NotAllowedError' || error.message.includes('Permission denied')) {
      onError?.(error, 'PERMISSION_DENIED');
    } else {
      onError?.(error, 'SWAP_FAILED');
    }
    return null;
  }

  const screenVideoTrack = screenStream.getVideoTracks()[0];
  if (!screenVideoTrack) {
    screenStream.getTracks().forEach((track) => track.stop());
    const error = new Error('No video track available in captured screen stream.');
    onError?.(error, 'SWAP_FAILED');
    return null;
  }

  // 3. Locate Video RTCRtpSender on RTCPeerConnection & Hot-Swap Track
  const cameraVideoTrack = cameraStream?.getVideoTracks()[0] || null;

  if (peerConnection && peerConnection.connectionState !== 'closed') {
    try {
      const senders = peerConnection.getSenders();
      const videoSender = senders.find(
        (sender) => sender.track?.kind === 'video' || sender.track === cameraVideoTrack
      );

      if (videoSender) {
        await videoSender.replaceTrack(screenVideoTrack);
      } else if (peerConnection.signalingState !== 'closed') {
        // Fallback: If no prior video sender existed, add the track
        peerConnection.addTrack(screenVideoTrack, screenStream);
      }
    } catch (swapErr: unknown) {
      screenStream.getTracks().forEach((track) => track.stop());
      const error = swapErr instanceof Error ? swapErr : new Error('Failed to swap video track on peer connection');
      onError?.(error, 'SWAP_FAILED');
      return null;
    }
  }

  // 4. Reversion Routine (replaces screen track back with camera track)
  let isStopped = false;

  const stop = async () => {
    if (isStopped) return;
    isStopped = true;

    // Stop all screen media tracks
    screenStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // Ignore already stopped tracks
      }
    });

    // Revert peer connection video track to camera
    if (peerConnection && peerConnection.connectionState !== 'closed') {
      try {
        const senders = peerConnection.getSenders();
        const videoSender = senders.find(
          (sender) => sender.track === screenVideoTrack || sender.track?.kind === 'video'
        );
        if (videoSender) {
          await videoSender.replaceTrack(cameraVideoTrack);
        }
      } catch (revertErr) {
        console.warn('[ScreenShare] Reverting to camera track failed:', revertErr);
      }
    }

    onStopped?.();
  };

  // 5. Native Browser "Stop Sharing" UI listener
  screenVideoTrack.onended = () => {
    void stop();
  };

  onStarted?.(screenStream);

  return {
    screenStream,
    stop
  };
}

let activeScreenStream: MediaStream | null = null;
let activeOriginalCameraTrack: MediaStreamTrack | null = null;

/**
 * Convenience toggle function that swaps screen share with webcam on an RTCPeerConnection.
 */
export async function toggleScreenShare(
  peerConnection: RTCPeerConnection,
  localStream: MediaStream
): Promise<boolean> {
  const videoSender = peerConnection
    ?.getSenders()
    ?.find((sender) => sender.track && sender.track.kind === 'video');

  if (!videoSender) {
    throw new Error('No active video sender found on peer connection.');
  }

  // If already sharing, revert to webcam
  if (activeScreenStream) {
    await stopScreenShare(videoSender, localStream);
    return false;
  }

  try {
    activeScreenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: 'always' } as MediaTrackConstraints,
      audio: false
    });

    const screenTrack = activeScreenStream.getVideoTracks()[0];
    activeOriginalCameraTrack = localStream.getVideoTracks()[0] || null;

    // Swap camera track with screen share track
    await videoSender.replaceTrack(screenTrack);

    // Auto-revert when user clicks browser native "Stop sharing" bar
    screenTrack.onended = () => {
      void stopScreenShare(videoSender, localStream);
    };

    return true;
  } catch (err: unknown) {
    const error = err as { name?: string };
    if (error?.name !== 'NotAllowedError') {
      console.error('Error starting screen share:', err);
    }
    return false;
  }
}

/**
 * Stops active screen share and reverts to the original camera track.
 */
export async function stopScreenShare(
  videoSender?: RTCRtpSender | null,
  _localStream?: MediaStream | null
): Promise<void> {
  if (activeScreenStream) {
    activeScreenStream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // Safe ignore
      }
    });
    activeScreenStream = null;
  }
  if (activeOriginalCameraTrack && videoSender) {
    await videoSender.replaceTrack(activeOriginalCameraTrack);
    activeOriginalCameraTrack = null;
  }
}
