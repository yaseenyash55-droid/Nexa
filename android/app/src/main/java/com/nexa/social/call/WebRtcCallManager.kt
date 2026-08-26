package com.nexa.social.call

import android.content.Context
import android.media.AudioManager
import android.util.Log
import com.nexa.social.data.models.IceServerConfiguration
import com.nexa.social.utils.RemoteIceCandidate
import org.webrtc.AudioSource
import org.webrtc.AudioTrack
import org.webrtc.Camera2Enumerator
import org.webrtc.CameraVideoCapturer
import org.webrtc.DataChannel
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RendererCommon
import org.webrtc.RtpReceiver
import org.webrtc.RtpTransceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoCapturer
import org.webrtc.VideoSource
import org.webrtc.VideoTrack

class WebRtcCallManager(
    context: Context,
    private val localRenderer: SurfaceViewRenderer,
    private val remoteRenderer: SurfaceViewRenderer,
    private val videoEnabled: Boolean,
    iceConfiguration: List<IceServerConfiguration>,
    private val listener: Listener
) {
    interface Listener {
        fun onLocalDescription(type: SessionDescription.Type, sdp: String)
        fun onLocalIceCandidate(candidate: RemoteIceCandidate)
        fun onConnectionStateChanged(state: PeerConnection.PeerConnectionState)
        fun onError(message: String)
    }

    private val appContext = context.applicationContext
    private val eglBase = EglBase.create()
    private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val previousAudioMode = audioManager.mode
    private val previousSpeakerphoneState = audioManager.isSpeakerphoneOn
    private val factory: PeerConnectionFactory
    private val peerConnection: PeerConnection
    private var audioSource: AudioSource? = null
    private var audioTrack: AudioTrack? = null
    private var videoSource: VideoSource? = null
    private var videoTrack: VideoTrack? = null
    private var remoteVideoTrack: VideoTrack? = null
    private var videoCapturer: VideoCapturer? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private val pendingCandidates = mutableListOf<IceCandidate>()
    private var remoteDescriptionSet = false
    private var isLocalRendererInitialized = false
    private var isRemoteRendererInitialized = false
    private var isCapturing = false

    private fun attachRemoteVideoTrack(track: VideoTrack?) {
        track ?: return
        if (remoteVideoTrack == track) return
        try {
            remoteVideoTrack?.removeSink(remoteRenderer)
        } catch (e: Exception) {
            Log.w("WebRtcCallManager", "Error detaching previous remote video sink", e)
        }
        remoteVideoTrack = track
        try {
            track.addSink(remoteRenderer)
            Log.i("WebRtcCallManager", "Attached remote video track sink successfully")
        } catch (e: Exception) {
            Log.e("WebRtcCallManager", "Failed to attach remote video sink", e)
        }
    }

    private val peerObserver = object : PeerConnection.Observer {
        override fun onSignalingChange(state: PeerConnection.SignalingState?) = Unit
        override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) = Unit
        override fun onIceConnectionReceivingChange(receiving: Boolean) = Unit
        override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) = Unit
        override fun onIceCandidate(candidate: IceCandidate?) {
            candidate ?: return
            listener.onLocalIceCandidate(
                RemoteIceCandidate(candidate.sdp, candidate.sdpMid, candidate.sdpMLineIndex)
            )
        }
        override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) = Unit
        override fun onAddStream(stream: MediaStream?) {
            stream?.videoTracks?.firstOrNull()?.let(::attachRemoteVideoTrack)
        }
        override fun onRemoveStream(stream: MediaStream?) {
            try {
                remoteVideoTrack?.removeSink(remoteRenderer)
                remoteVideoTrack = null
            } catch (_: Exception) {}
        }
        override fun onDataChannel(channel: DataChannel?) = Unit
        override fun onRenegotiationNeeded() = Unit
        override fun onAddTrack(receiver: RtpReceiver?, mediaStreams: Array<out MediaStream>?) {
            (receiver?.track() as? VideoTrack)?.let(::attachRemoteVideoTrack)
        }
        override fun onTrack(transceiver: RtpTransceiver?) {
            (transceiver?.receiver?.track() as? VideoTrack)?.let(::attachRemoteVideoTrack)
        }
        override fun onConnectionChange(newState: PeerConnection.PeerConnectionState?) {
            newState?.let(listener::onConnectionStateChanged)
        }
    }

    init {
        try {
            PeerConnectionFactory.initialize(
                PeerConnectionFactory.InitializationOptions.builder(appContext)
                    .setEnableInternalTracer(false)
                    .createInitializationOptions()
            )
        } catch (e: Exception) {
            Log.w("WebRtcCallManager", "PeerConnectionFactory.initialize warning", e)
        }

        // Initialize local Picture-in-Picture renderer with hardware overlay z-ordering
        if (!isLocalRendererInitialized) {
            try {
                localRenderer.setZOrderMediaOverlay(true)
                localRenderer.init(eglBase.eglBaseContext, null)
                localRenderer.setMirror(true)
                localRenderer.setEnableHardwareScaler(true)
                localRenderer.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL)
                isLocalRendererInitialized = true
            } catch (e: Exception) {
                Log.w("WebRtcCallManager", "localRenderer init warning", e)
            }
        }

        // Initialize full-screen remote renderer
        if (!isRemoteRendererInitialized) {
            try {
                remoteRenderer.init(eglBase.eglBaseContext, null)
                remoteRenderer.setEnableHardwareScaler(true)
                remoteRenderer.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL)
                isRemoteRendererInitialized = true
            } catch (e: Exception) {
                Log.w("WebRtcCallManager", "remoteRenderer init warning", e)
            }
        }

        factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true))
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase.eglBaseContext))
            .createPeerConnectionFactory()

        val rawServers = if (iceConfiguration.isEmpty()) {
            listOf(
                IceServerConfiguration(urls = listOf("stun:stun.l.google.com:19302")),
                IceServerConfiguration(urls = listOf("stun:stun1.l.google.com:19302")),
                IceServerConfiguration(urls = listOf("stun:stun2.l.google.com:19302"))
            )
        } else {
            iceConfiguration
        }

        val iceServers = rawServers.flatMap { server ->
            server.urls.map { url ->
                val builder = PeerConnection.IceServer.builder(url)
                server.username?.takeIf { it.isNotBlank() }?.let(builder::setUsername)
                server.credential?.takeIf { it.isNotBlank() }?.let(builder::setPassword)
                builder.createIceServer()
            }
        }
        val rtcConfiguration = PeerConnection.RTCConfiguration(iceServers).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }
        peerConnection = factory.createPeerConnection(rtcConfiguration, peerObserver)
            ?: throw IllegalStateException("Unable to initialize WebRTC peer connection")

        try {
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            audioManager.isSpeakerphoneOn = videoEnabled
        } catch (e: Exception) {
            Log.w("WebRtcCallManager", "AudioManager mode warning", e)
        }
    }

    fun startLocalMedia() {
        if (audioTrack != null) return
        try {
            val createdAudioSource = factory.createAudioSource(MediaConstraints())
            audioSource = createdAudioSource
            val createdAudioTrack = factory.createAudioTrack("NEXA_AUDIO", createdAudioSource).apply { setEnabled(true) }
            audioTrack = createdAudioTrack
            peerConnection.addTrack(createdAudioTrack, listOf("NEXA_STREAM"))
        } catch (e: Exception) {
            Log.e("WebRtcCallManager", "Failed to start local audio", e)
        }

        if (videoEnabled) {
            try {
                val createdVideoCapturer = createCameraCapturer()
                if (createdVideoCapturer != null) {
                    videoCapturer = createdVideoCapturer
                    val createdVideoSource = factory.createVideoSource(false)
                    videoSource = createdVideoSource
                    val createdSurfaceHelper = SurfaceTextureHelper.create("NexaCameraThread", eglBase.eglBaseContext)
                    surfaceTextureHelper = createdSurfaceHelper
                    createdVideoCapturer.initialize(createdSurfaceHelper, appContext, createdVideoSource.capturerObserver)
                    createdVideoCapturer.startCapture(1280, 720, 30)
                    isCapturing = true
                    val createdVideoTrack = factory.createVideoTrack("NEXA_VIDEO", createdVideoSource).apply {
                        setEnabled(true)
                        addSink(localRenderer)
                    }
                    videoTrack = createdVideoTrack
                    peerConnection.addTrack(createdVideoTrack, listOf("NEXA_STREAM"))
                }
            } catch (camErr: Exception) {
                Log.w("WebRtcCallManager", "Camera capture initialization fallback to audio", camErr)
            }
        }
    }

    fun pauseVideo() {
        if (!videoEnabled) return
        try {
            if (isCapturing) {
                videoCapturer?.stopCapture()
                isCapturing = false
            }
        } catch (e: Exception) {
            Log.w("WebRtcCallManager", "Error pausing video capture", e)
        }
    }

    fun resumeVideo() {
        if (!videoEnabled) return
        try {
            if (!isCapturing && videoCapturer != null) {
                videoCapturer?.startCapture(1280, 720, 30)
                isCapturing = true
            }
        } catch (e: Exception) {
            Log.w("WebRtcCallManager", "Error resuming video capture", e)
        }
    }

    fun createOffer() {
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", if (videoEnabled) "true" else "false"))
        }
        peerConnection.createOffer(descriptionObserver(setLocalAndNotify = true), constraints)
    }

    fun acceptOfferAndCreateAnswer(sdp: String) {
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", if (videoEnabled) "true" else "false"))
        }
        peerConnection.setRemoteDescription(object : SimpleSdpObserver() {
            override fun onSetSuccess() {
                remoteDescriptionSet = true
                flushPendingCandidates()
                peerConnection.createAnswer(descriptionObserver(setLocalAndNotify = true), constraints)
            }

            override fun onSetFailure(error: String?) {
                listener.onError(error ?: "Unable to accept call offer")
            }
        }, SessionDescription(SessionDescription.Type.OFFER, sdp))
    }

    fun acceptAnswer(sdp: String) {
        peerConnection.setRemoteDescription(object : SimpleSdpObserver() {
            override fun onSetSuccess() {
                remoteDescriptionSet = true
                flushPendingCandidates()
            }

            override fun onSetFailure(error: String?) {
                listener.onError(error ?: "Unable to accept call answer")
            }
        }, SessionDescription(SessionDescription.Type.ANSWER, sdp))
    }

    fun addRemoteIceCandidate(candidate: RemoteIceCandidate) {
        val iceCandidate = IceCandidate(candidate.sdpMid, candidate.sdpMLineIndex, candidate.candidate)
        if (remoteDescriptionSet) peerConnection.addIceCandidate(iceCandidate)
        else pendingCandidates += iceCandidate
    }

    fun setMicrophoneEnabled(enabled: Boolean) {
        try { audioTrack?.setEnabled(enabled) } catch (_: Exception) {}
    }

    fun setCameraEnabled(enabled: Boolean) {
        try { videoTrack?.setEnabled(enabled) } catch (_: Exception) {}
    }

    fun switchCamera() {
        try { (videoCapturer as? CameraVideoCapturer)?.switchCamera(null) } catch (_: Exception) {}
    }

    fun release() {
        try {
            if (isCapturing) {
                videoCapturer?.stopCapture()
                isCapturing = false
            }
        } catch (_: Exception) {}

        try { videoTrack?.removeSink(localRenderer) } catch (_: Exception) {}
        try {
            remoteVideoTrack?.removeSink(remoteRenderer)
            remoteVideoTrack = null
        } catch (_: Exception) {}

        try { videoCapturer?.dispose() } catch (_: Exception) {}
        try { surfaceTextureHelper?.dispose() } catch (_: Exception) {}
        try { videoSource?.dispose() } catch (_: Exception) {}
        try { audioSource?.dispose() } catch (_: Exception) {}
        try { peerConnection.close() } catch (_: Exception) {}
        try { peerConnection.dispose() } catch (_: Exception) {}
        try { factory.dispose() } catch (_: Exception) {}

        if (isLocalRendererInitialized) {
            try { localRenderer.release() } catch (_: Exception) {}
            isLocalRendererInitialized = false
        }

        if (isRemoteRendererInitialized) {
            try { remoteRenderer.release() } catch (_: Exception) {}
            isRemoteRendererInitialized = false
        }

        try { eglBase.release() } catch (_: Exception) {}
        try {
            audioManager.mode = previousAudioMode
            audioManager.isSpeakerphoneOn = previousSpeakerphoneState
        } catch (_: Exception) {}
    }

    private fun descriptionObserver(setLocalAndNotify: Boolean) = object : SimpleSdpObserver() {
        override fun onCreateSuccess(description: SessionDescription?) {
            if (description == null) {
                listener.onError("WebRTC returned an empty session description")
                return
            }
            if (!setLocalAndNotify) return
            peerConnection.setLocalDescription(object : SimpleSdpObserver() {
                override fun onSetSuccess() {
                    listener.onLocalDescription(description.type, description.description)
                }

                override fun onSetFailure(error: String?) {
                    listener.onError(error ?: "Unable to save local session description")
                }
            }, description)
        }

        override fun onCreateFailure(error: String?) {
            listener.onError(error ?: "Unable to create session description")
        }
    }

    private fun flushPendingCandidates() {
        try {
            pendingCandidates.forEach(peerConnection::addIceCandidate)
            pendingCandidates.clear()
        } catch (e: Exception) {
            Log.w("WebRtcCallManager", "Error flushing ICE candidates", e)
        }
    }

    private fun createCameraCapturer(): VideoCapturer? {
        return try {
            val enumerator = Camera2Enumerator(appContext)
            val frontCamera = enumerator.deviceNames.firstOrNull(enumerator::isFrontFacing)
            val fallbackCamera = enumerator.deviceNames.firstOrNull()
            listOfNotNull(frontCamera, fallbackCamera)
                .distinct()
                .firstNotNullOfOrNull { enumerator.createCapturer(it, null) }
        } catch (e: Exception) {
            Log.w("WebRtcCallManager", "Failed to create camera capturer", e)
            null
        }
    }
}

private open class SimpleSdpObserver : SdpObserver {
    override fun onCreateSuccess(description: SessionDescription?) = Unit
    override fun onSetSuccess() = Unit
    override fun onCreateFailure(error: String?) = Unit
    override fun onSetFailure(error: String?) = Unit
}
