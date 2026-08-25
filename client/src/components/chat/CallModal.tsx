import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, MonitorUp, MonitorOff, Phone, PhoneOff, Sparkles, Video, VideoOff, X } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { callsApi, IceConfiguration } from '../../api/calls.api.js';
import { startScreenSharing, ScreenShareController } from '../../utils/screenShare.js';
import { enableBackgroundBlur, BackgroundBlurController } from '../../utils/backgroundBlur.js';
import { ringtoneAudio } from '../../utils/ringtoneAudio.js';
import { createTelemetryMonitor, WebRtcStreamMetrics } from '../../utils/webrtcTelemetry.js';
import { User } from '../../types/index.js';
import { Avatar } from '../ui/Avatar.js';

type CallStatus = 'preparing' | 'ringing' | 'incoming' | 'connecting' | 'connected' | 'unavailable' | 'error';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: User;
  callType: 'audio' | 'video';
  direction?: 'outgoing' | 'incoming';
  initialCallId?: string;
  socket?: Socket | null;
}

interface AckResponse {
  success: boolean;
  error?: string;
}

interface CandidatePayload {
  callId: string;
  candidate: RTCIceCandidateInit;
}

function createCallId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export const CallModal: React.FC<CallModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  callType,
  direction = 'outgoing',
  initialCallId,
  socket
}) => {
  const [status, setStatus] = useState<CallStatus>(direction === 'incoming' ? 'incoming' : 'preparing');
  const [errorMessage, setErrorMessage] = useState('');
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(callType === 'video');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isBackgroundBlurred, setIsBackgroundBlurred] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [streamMetrics, setStreamMetrics] = useState<WebRtcStreamMetrics | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenShareControllerRef = useRef<ScreenShareController | null>(null);
  const backgroundBlurControllerRef = useRef<BackgroundBlurController | null>(null);
  const telemetryMonitorRef = useRef<ReturnType<typeof createTelemetryMonitor> | null>(null);
  const iceConfigurationRef = useRef<IceConfiguration | null>(null);
  const callIdRef = useRef(initialCallId || createCallId());
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const acceptedRef = useRef(false);
  const remoteEndedRef = useRef(false);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!isOpen) return;
    callIdRef.current = initialCallId || createCallId();
    acceptedRef.current = false;
    remoteEndedRef.current = false;
    pendingCandidatesRef.current = [];
    setStatus(direction === 'incoming' ? 'incoming' : 'preparing');
    setErrorMessage('');
    setMicrophoneEnabled(true);
    setCameraEnabled(callType === 'video');

    if (!socket) {
      setStatus('error');
      setErrorMessage('Realtime connection is not ready. Please try again.');
      return;
    }

    const callId = callIdRef.current;

    const fail = (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to start the call';
      setStatus(message.toLowerCase().includes('configured') ? 'unavailable' : 'error');
      setErrorMessage(message);
    };

    const getConfiguration = async (): Promise<IceConfiguration> => {
      if (iceConfigurationRef.current) return iceConfigurationRef.current;
      const configuration = await callsApi.getIceConfiguration();
      if (!configuration.enabled || configuration.iceServers.length === 0) {
        throw new Error(configuration.reason || 'Calling is not configured');
      }
      iceConfigurationRef.current = configuration;
      return configuration;
    };

    const flushCandidates = async () => {
      const peer = peerRef.current;
      if (!peer?.remoteDescription) return;
      const candidates = pendingCandidatesRef.current.splice(0);
      for (const candidate of candidates) await peer.addIceCandidate(candidate);
    };

    const initializePeer = async (): Promise<RTCPeerConnection> => {
      if (peerRef.current) return peerRef.current;
      const configuration = await getConfiguration();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
          ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
          : false
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const peer = new RTCPeerConnection({ iceServers: configuration.iceServers });
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('call:ice-candidate', {
            callId,
            targetUserId: targetUser.userId,
            candidate: event.candidate.toJSON()
          });
        }
      };
      peer.ontrack = (event) => {
        setRemoteStream(event.streams[0] || new MediaStream([event.track]));
      };
      const isRestartingIceRef = { current: false };

      const handleIceRestart = async () => {
        if (isRestartingIceRef.current || !peer || peer.connectionState === 'closed') return;
        isRestartingIceRef.current = true;
        setStatus('connecting');
        try {
          if (typeof peer.restartIce === 'function') {
            peer.restartIce();
          }
          if (direction === 'outgoing' || acceptedRef.current) {
            const offer = await peer.createOffer({ iceRestart: true });
            await peer.setLocalDescription(offer);
            socket.emit('call:offer', {
              callId,
              targetUserId: targetUser.userId,
              sdp: offer.sdp
            });
          }
        } catch (iceErr) {
          console.warn('[WebRTC] ICE restart attempt failed:', iceErr);
        } finally {
          setTimeout(() => {
            isRestartingIceRef.current = false;
          }, 3000);
        }
      };

      peer.oniceconnectionstatechange = () => {
        if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') {
          setStatus('connected');
        } else if (peer.iceConnectionState === 'disconnected' || peer.iceConnectionState === 'failed') {
          void handleIceRestart();
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') {
          setStatus('connected');
        } else if (peer.connectionState === 'failed') {
          void handleIceRestart();
        } else if (peer.connectionState === 'disconnected') {
          setStatus('connecting');
        }
      };
      peerRef.current = peer;
      return peer;
    };

    const startOutgoingCall = async () => {
      try {
        await initializePeer();
        socket.emit('call:invite', {
          callId,
          targetUserId: targetUser.userId,
          callType
        }, (response: AckResponse) => {
          if (response?.success) setStatus('ringing');
          else fail(new Error(response?.error || 'The call could not be placed'));
        });
      } catch (error) {
        fail(error);
      }
    };

    const handleAccepted = async (payload: { callId: string }) => {
      if (payload.callId !== callId) return;
      try {
        acceptedRef.current = true;
        setStatus('connecting');
        const peer = await initializePeer();
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit('call:offer', {
          callId,
          targetUserId: targetUser.userId,
          sdp: offer.sdp
        });
      } catch (error) {
        fail(error);
      }
    };

    const handleOffer = async (payload: { callId: string; sdp: string }) => {
      if (payload.callId !== callId) return;
      try {
        const peer = await initializePeer();
        await peer.setRemoteDescription({ type: 'offer', sdp: payload.sdp });
        await flushCandidates();
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit('call:answer', {
          callId,
          targetUserId: targetUser.userId,
          sdp: answer.sdp
        });
        setStatus('connecting');
      } catch (error) {
        fail(error);
      }
    };

    const handleAnswer = async (payload: { callId: string; sdp: string }) => {
      if (payload.callId !== callId || !peerRef.current) return;
      try {
        await peerRef.current.setRemoteDescription({ type: 'answer', sdp: payload.sdp });
        await flushCandidates();
      } catch (error) {
        fail(error);
      }
    };

    const handleCandidate = async (payload: CandidatePayload) => {
      if (payload.callId !== callId || !payload.candidate) return;
      try {
        if (peerRef.current?.remoteDescription) await peerRef.current.addIceCandidate(payload.candidate);
        else pendingCandidatesRef.current.push(payload.candidate);
      } catch (error) {
        fail(error);
      }
    };

    const handleRejected = (payload: { callId: string; reason?: string }) => {
      if (payload.callId !== callId) return;
      remoteEndedRef.current = true;
      setStatus('error');
      setErrorMessage(payload.reason === 'busy' ? 'User is busy' : 'Call declined');
    };

    const handleEnded = (payload: { callId: string; reason?: string }) => {
      if (payload.callId !== callId) return;
      remoteEndedRef.current = true;
      setStatus('error');
      setErrorMessage(payload.reason === 'disconnected' ? 'User disconnected' : 'Call ended');
    };

    socket.on('call:accepted', handleAccepted);
    socket.on('call:offer', handleOffer);
    socket.on('call:answer', handleAnswer);
    socket.on('call:ice-candidate', handleCandidate);
    socket.on('call:rejected', handleRejected);
    socket.on('call:ended', handleEnded);

    if (direction === 'outgoing') void startOutgoingCall();

    return () => {
      socket.off('call:accepted', handleAccepted);
      socket.off('call:offer', handleOffer);
      socket.off('call:answer', handleAnswer);
      socket.off('call:ice-candidate', handleCandidate);
      socket.off('call:rejected', handleRejected);
      socket.off('call:ended', handleEnded);
      void screenShareControllerRef.current?.stop();
      screenShareControllerRef.current = null;
      setIsScreenSharing(false);
      void backgroundBlurControllerRef.current?.stop();
      backgroundBlurControllerRef.current = null;
      setIsBackgroundBlurred(false);
      peerRef.current?.close();
      peerRef.current = null;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      iceConfigurationRef.current = null;
      setRemoteStream(null);
    };
  }, [callType, direction, initialCallId, isOpen, socket, targetUser.userId]);

  const acceptIncoming = async () => {
    if (!socket) return;
    setStatus('preparing');
    try {
      const configuration = await callsApi.getIceConfiguration();
      if (!configuration.enabled || configuration.iceServers.length === 0) {
        throw new Error(configuration.reason || 'Calling is not configured');
      }
      iceConfigurationRef.current = configuration;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === 'video' });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      const peer = new RTCPeerConnection({ iceServers: configuration.iceServers });
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      peer.onicecandidate = (event) => {
        if (event.candidate) socket.emit('call:ice-candidate', {
          callId: callIdRef.current,
          targetUserId: targetUser.userId,
          candidate: event.candidate.toJSON()
        });
      };
      peer.ontrack = (event) => setRemoteStream(event.streams[0] || new MediaStream([event.track]));
      
      peer.oniceconnectionstatechange = () => {
        if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') {
          setStatus('connected');
        } else if (peer.iceConnectionState === 'disconnected' || peer.iceConnectionState === 'failed') {
          if (typeof peer.restartIce === 'function') {
            peer.restartIce();
          }
          setStatus('connecting');
        }
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === 'connected') setStatus('connected');
        else if (peer.connectionState === 'failed') {
          if (typeof peer.restartIce === 'function') peer.restartIce();
          setStatus('connecting');
        }
      };
      peerRef.current = peer;
      socket.emit('call:accept', {
        callId: callIdRef.current,
        targetUserId: targetUser.userId
      }, (response: AckResponse) => {
        if (response?.success) {
          acceptedRef.current = true;
          setStatus('connecting');
        } else {
          setStatus('error');
          setErrorMessage(response?.error || 'Unable to accept the call');
        }
      });
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to accept the call');
    }
  };

  const closeCall = (decline = false) => {
    void screenShareControllerRef.current?.stop();
    screenShareControllerRef.current = null;
    setIsScreenSharing(false);
    void backgroundBlurControllerRef.current?.stop();
    backgroundBlurControllerRef.current = null;
    setIsBackgroundBlurred(false);
    if (socket && !remoteEndedRef.current) {
      if (direction === 'incoming' && !acceptedRef.current) {
        socket.emit('call:reject', {
          callId: callIdRef.current,
          targetUserId: targetUser.userId,
          reason: decline ? 'declined' : 'dismissed'
        });
      } else {
        socket.emit('call:end', {
          callId: callIdRef.current,
          targetUserId: targetUser.userId,
          reason: 'ended'
        });
      }
    }
    onClose();
  };

  const toggleMicrophone = () => {
    const next = !microphoneEnabled;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = next; });
    setMicrophoneEnabled(next);
  };

  const toggleCamera = () => {
    const next = !cameraEnabled;
    localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = next; });
    setCameraEnabled(next);
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await screenShareControllerRef.current?.stop();
      screenShareControllerRef.current = null;
      setIsScreenSharing(false);
      return;
    }

    const controller = await startScreenSharing({
      peerConnection: peerRef.current,
      cameraStream: localStreamRef.current,
      onStarted: (screenStream) => {
        setIsScreenSharing(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
      },
      onStopped: () => {
        setIsScreenSharing(false);
        screenShareControllerRef.current = null;
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = isBackgroundBlurred && backgroundBlurControllerRef.current
            ? backgroundBlurControllerRef.current.blurredStream
            : localStreamRef.current;
        }
      },
      onError: (err, code) => {
        if (code === 'PERMISSION_DENIED') {
          return;
        }
        setErrorMessage(err.message || 'Screen sharing failed');
      }
    });

    if (controller) {
      screenShareControllerRef.current = controller;
    }
  };

  const toggleBackgroundBlur = async () => {
    if (isBackgroundBlurred) {
      await backgroundBlurControllerRef.current?.stop();
      backgroundBlurControllerRef.current = null;
      setIsBackgroundBlurred(false);
      if (localVideoRef.current && localStreamRef.current && !isScreenSharing) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      return;
    }

    const controller = await enableBackgroundBlur({
      peerConnection: peerRef.current,
      rawStream: localStreamRef.current,
      blurRadius: 18,
      onStarted: (blurredStream) => {
        setIsBackgroundBlurred(true);
        if (localVideoRef.current && !isScreenSharing) {
          localVideoRef.current.srcObject = blurredStream;
        }
      },
      onStopped: () => {
        setIsBackgroundBlurred(false);
        backgroundBlurControllerRef.current = null;
        if (localVideoRef.current && localStreamRef.current && !isScreenSharing) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      },
      onError: (err) => {
        setErrorMessage(err.message || 'Background blur filter failed');
      }
    });

    if (controller) {
      backgroundBlurControllerRef.current = controller;
    }
  };

  useEffect(() => {
    if (isOpen && (status === 'ringing' || status === 'incoming')) {
      ringtoneAudio.play();
    } else {
      ringtoneAudio.stop();
    }
    return () => {
      ringtoneAudio.stop();
    };
  }, [isOpen, status]);

  useEffect(() => {
    if (status === 'connected' && peerRef.current) {
      const monitor = createTelemetryMonitor({
        pollIntervalMs: 3000,
        packetLossThresholdPercent: 5.0,
        onMetricsUpdate: (metrics) => {
          setStreamMetrics(metrics);
        }
      });
      monitor.start(peerRef.current);
      telemetryMonitorRef.current = monitor;
    } else {
      telemetryMonitorRef.current?.stop();
      telemetryMonitorRef.current = null;
      setStreamMetrics(null);
    }
    return () => {
      telemetryMonitorRef.current?.stop();
      telemetryMonitorRef.current = null;
    };
  }, [status]);

  if (!isOpen) return null;

  const statusText: Record<CallStatus, string> = {
    preparing: 'Preparing secure media…',
    ringing: 'Ringing…',
    incoming: `Incoming ${callType === 'video' ? 'video' : 'voice'} call`,
    connecting: 'Connecting…',
    connected: isScreenSharing ? 'Connected (Sharing Screen)' : isBackgroundBlurred ? 'Connected (Blurred)' : 'Connected',
    unavailable: 'Calling unavailable',
    error: errorMessage || 'Call failed'
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="call-modal-title" className="fixed inset-0 z-50 bg-slate-950/95 flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl overflow-hidden bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl">
        {callType === 'audio' && <audio ref={remoteAudioRef} autoPlay />}
        <button type="button" onClick={() => closeCall()} aria-label="Close call" className="absolute z-20 top-4 right-4 p-2 bg-slate-950/70 text-white rounded-full"><X className="w-5 h-5" /></button>
        <div className="relative min-h-[360px] bg-slate-950 flex items-center justify-center overflow-hidden">
          {callType === 'video' && remoteStream ? (
            <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="relative flex flex-col items-center justify-center p-8">
              {/* Glowing Radar Pulse Wave Rings */}
              {status !== 'connected' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="absolute w-28 h-28 rounded-full border border-teal-400/40 bg-teal-400/10 animate-radar-pulse-1" />
                  <div className="absolute w-28 h-28 rounded-full border border-indigo-500/40 bg-indigo-500/10 animate-radar-pulse-2" />
                  <div className="absolute w-28 h-28 rounded-full border border-indigo-400/30 bg-indigo-400/5 animate-radar-pulse-3" />
                </div>
              )}
              
              <div className="avatar-container relative z-10">
                {status !== 'connected' && <div className="avatar-pulse" />}
                <Avatar src={targetUser.profileImageUrl} name={targetUser.displayName} size="xl" className="ring-4 ring-slate-800 shadow-2xl relative z-10" />
              </div>
              <div className="relative z-10 text-center mt-4">
                <h3 id="call-modal-title" className="text-xl font-bold text-white">{targetUser.displayName}</h3>
                <p className="text-sm text-slate-400">@{targetUser.username}</p>
              </div>
            </div>
          )}
          {callType === 'video' && <video ref={localVideoRef} autoPlay muted playsInline className="absolute bottom-4 right-4 w-28 sm:w-40 aspect-video object-cover bg-slate-800 border border-slate-600 rounded-xl shadow-xl" />}
          <div className="absolute left-4 top-4 rounded-full bg-slate-950/70 px-3 py-1.5 text-xs font-semibold text-white flex items-center gap-2">
            {statusText[status]}
            {isScreenSharing && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/80 text-white font-medium">SCREEN</span>}
            {isBackgroundBlurred && !isScreenSharing && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/80 text-white font-medium">BLUR</span>}
            {status === 'connected' && streamMetrics && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                streamMetrics.qualityLevel === 'optimal' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                streamMetrics.qualityLevel === 'moderate' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  streamMetrics.qualityLevel === 'optimal' ? 'bg-emerald-400' :
                  streamMetrics.qualityLevel === 'moderate' ? 'bg-amber-400' :
                  'bg-rose-400'
                }`} />
                {streamMetrics.qualityLevel === 'optimal' ? 'HD' : `${streamMetrics.packetLossRate}% Loss`}
              </span>
            )}
          </div>
        </div>
        <div className="p-5 flex items-center justify-center gap-3">
          {direction === 'incoming' && status === 'incoming' ? (
            <>
              <button type="button" onClick={() => closeCall(true)} className="p-4 rounded-full bg-rose-600 text-white shadow-lg" aria-label="Decline call"><PhoneOff className="w-5 h-5" /></button>
              <button type="button" onClick={() => void acceptIncoming()} className="p-4 rounded-full bg-emerald-500 text-white shadow-lg ring-4 ring-emerald-500/30" aria-label="Accept call"><Phone className="w-5 h-5" /></button>
            </>
          ) : (
            <>
              <button type="button" onClick={toggleMicrophone} disabled={!localStreamRef.current} className="p-3 rounded-full bg-slate-800 disabled:opacity-40 text-white" aria-label={microphoneEnabled ? 'Mute microphone' : 'Unmute microphone'}>{microphoneEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}</button>
              {callType === 'video' && <button type="button" onClick={toggleCamera} disabled={!localStreamRef.current} className="p-3 rounded-full bg-slate-800 disabled:opacity-40 text-white" aria-label={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}>{cameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}</button>}
              {callType === 'video' && (
                <button
                  type="button"
                  onClick={() => void toggleBackgroundBlur()}
                  disabled={!localStreamRef.current || isScreenSharing}
                  className={`p-3 rounded-full text-white transition-colors ${isBackgroundBlurred ? 'bg-cyan-600 hover:bg-cyan-500 ring-2 ring-cyan-400' : 'bg-slate-800 hover:bg-slate-700 disabled:opacity-40'}`}
                  aria-label={isBackgroundBlurred ? 'Disable background blur' : 'Enable background blur'}
                  title={isBackgroundBlurred ? 'Disable background blur' : 'Enable background blur'}
                >
                  <Sparkles className="w-5 h-5" />
                </button>
              )}
              <button type="button" onClick={() => void toggleScreenShare()} disabled={!peerRef.current} className={`p-3 rounded-full text-white transition-colors ${isScreenSharing ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-800 hover:bg-slate-700 disabled:opacity-40'}`} aria-label={isScreenSharing ? 'Stop screen sharing' : 'Share screen'}>{isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}</button>
              <button type="button" onClick={() => closeCall()} className="p-4 rounded-full bg-rose-600 text-white" aria-label="End call"><PhoneOff className="w-5 h-5" /></button>
            </>
          )}
        </div>
        {(status === 'unavailable' || status === 'error') && <p className="px-6 pb-5 text-center text-sm text-rose-300">{errorMessage || statusText[status]}</p>}
      </div>
    </div>
  );
};
