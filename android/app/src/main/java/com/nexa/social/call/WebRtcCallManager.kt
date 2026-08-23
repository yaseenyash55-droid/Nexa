package com.nexa.social.call

import android.content.Context
import android.media.AudioManager
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
    private var videoCapturer: VideoCapturer? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null
    private val pendingCandidates = mutableListOf<IceCandidate>()
    private var remoteDescriptionSet = false

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
            stream?.videoTracks?.firstOrNull()?.addSink(remoteRenderer)
        }
        override fun onRemoveStream(stream: MediaStream?) = Unit
        override fun onDataChannel(channel: DataChannel?) = Unit
        override fun onRenegotiationNeeded() = Unit
        override fun onAddTrack(receiver: RtpReceiver?, mediaStreams: Array<out MediaStream>?) {
            (receiver?.track() as? VideoTrack)?.addSink(remoteRenderer)
        }
        override fun onTrack(transceiver: RtpTransceiver?) {
            (transceiver?.receiver?.track() as? VideoTrack)?.addSink(remoteRenderer)
        }
        override fun onConnectionChange(newState: PeerConnection.PeerConnectionState?) {
            newState?.let(listener::onConnectionStateChanged)
        }
    }

    init {
        PeerConnectionFactory.initialize(
            PeerConnectionFactory.InitializationOptions.builder(appContext)
                .setEnableInternalTracer(false)
                .createInitializationOptions()
        )
        localRenderer.init(eglBase.eglBaseContext, null)
        localRenderer.setMirror(true)
        localRenderer.setEnableHardwareScaler(true)
        remoteRenderer.init(eglBase.eglBaseContext, null)
        remoteRenderer.setEnableHardwareScaler(true)

        factory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true))
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase.eglBaseContext))
            .createPeerConnectionFactory()

        val iceServers = iceConfiguration.flatMap { server ->
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

        audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
        audioManager.isSpeakerphoneOn = videoEnabled
    }

    fun startLocalMedia() {
        if (audioTrack != null) return
        val createdAudioSource = factory.createAudioSource(MediaConstraints())
        audioSource = createdAudioSource
        val createdAudioTrack = factory.createAudioTrack("NEXA_AUDIO", createdAudioSource).apply { setEnabled(true) }
        audioTrack = createdAudioTrack
        peerConnection.addTrack(createdAudioTrack, listOf("NEXA_STREAM"))

        if (videoEnabled) {
            val createdVideoCapturer = createCameraCapturer()
                ?: throw IllegalStateException("No usable camera is available")
            videoCapturer = createdVideoCapturer
            val createdVideoSource = factory.createVideoSource(false)
            videoSource = createdVideoSource
            val createdSurfaceHelper = SurfaceTextureHelper.create("NexaCameraThread", eglBase.eglBaseContext)
            surfaceTextureHelper = createdSurfaceHelper
            createdVideoCapturer.initialize(createdSurfaceHelper, appContext, createdVideoSource.capturerObserver)
            createdVideoCapturer.startCapture(1280, 720, 30)
            val createdVideoTrack = factory.createVideoTrack("NEXA_VIDEO", createdVideoSource).apply {
                setEnabled(true)
                addSink(localRenderer)
            }
            videoTrack = createdVideoTrack
            peerConnection.addTrack(createdVideoTrack, listOf("NEXA_STREAM"))
        }
    }

    fun createOffer() {
        peerConnection.createOffer(descriptionObserver(setLocalAndNotify = true), MediaConstraints())
    }

    fun acceptOfferAndCreateAnswer(sdp: String) {
        peerConnection.setRemoteDescription(object : SimpleSdpObserver() {
            override fun onSetSuccess() {
                remoteDescriptionSet = true
                flushPendingCandidates()
                peerConnection.createAnswer(descriptionObserver(setLocalAndNotify = true), MediaConstraints())
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
        audioTrack?.setEnabled(enabled)
    }

    fun setCameraEnabled(enabled: Boolean) {
        videoTrack?.setEnabled(enabled)
    }

    fun switchCamera() {
        (videoCapturer as? CameraVideoCapturer)?.switchCamera(null)
    }

    fun release() {
        try { videoCapturer?.stopCapture() } catch (_: InterruptedException) { Thread.currentThread().interrupt() }
        videoTrack?.removeSink(localRenderer)
        videoCapturer?.dispose()
        surfaceTextureHelper?.dispose()
        videoSource?.dispose()
        audioSource?.dispose()
        peerConnection.close()
        peerConnection.dispose()
        factory.dispose()
        localRenderer.release()
        remoteRenderer.release()
        eglBase.release()
        audioManager.mode = previousAudioMode
        audioManager.isSpeakerphoneOn = previousSpeakerphoneState
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
        pendingCandidates.forEach(peerConnection::addIceCandidate)
        pendingCandidates.clear()
    }

    private fun createCameraCapturer(): VideoCapturer? {
        val enumerator = Camera2Enumerator(appContext)
        val frontCamera = enumerator.deviceNames.firstOrNull(enumerator::isFrontFacing)
        val fallbackCamera = enumerator.deviceNames.firstOrNull()
        return listOfNotNull(frontCamera, fallbackCamera)
            .distinct()
            .firstNotNullOfOrNull { enumerator.createCapturer(it, null) }
    }
}

private open class SimpleSdpObserver : SdpObserver {
    override fun onCreateSuccess(description: SessionDescription?) = Unit
    override fun onSetSuccess() = Unit
    override fun onCreateFailure(error: String?) = Unit
    override fun onSetFailure(error: String?) = Unit
}
