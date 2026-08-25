package com.nexa.social.ui

import android.Manifest
import android.app.PendingIntent
import android.app.PictureInPictureParams
import android.app.RemoteAction
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.drawable.Icon
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.util.Rational
import android.view.View
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.nexa.social.NexaApiClient
import com.nexa.social.R
import com.nexa.social.call.WebRtcCallManager
import com.nexa.social.data.models.IceServerConfiguration
import com.nexa.social.databinding.ActivityCallBinding
import com.nexa.social.utils.CallSignalListener
import com.nexa.social.utils.NotificationHelper
import com.nexa.social.utils.ProximitySensorManager
import com.nexa.social.utils.RemoteIceCandidate
import com.nexa.social.utils.SocketManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.webrtc.PeerConnection
import org.webrtc.SessionDescription
import java.util.UUID

class CallActivity : AppCompatActivity(), CallSignalListener, WebRtcCallManager.Listener {
    companion object {
        private const val EXTRA_CALL_ID = "extra_call_id"
        private const val EXTRA_TARGET_ID = "extra_target_id"
        private const val EXTRA_TARGET_NAME = "extra_target_name"
        private const val EXTRA_CALL_TYPE = "extra_call_type"
        private const val EXTRA_DIRECTION = "extra_direction"

        private const val ACTION_PIP_MUTE = "com.nexa.social.action.PIP_MUTE"
        private const val ACTION_PIP_CAMERA = "com.nexa.social.action.PIP_CAMERA"
        private const val ACTION_PIP_END = "com.nexa.social.action.PIP_END"

        private const val REQUEST_CODE_MUTE = 101
        private const val REQUEST_CODE_CAMERA = 102
        private const val REQUEST_CODE_END = 103

        fun outgoingIntent(context: Context, targetId: Int, targetName: String, callType: String) =
            Intent(context, CallActivity::class.java).apply {
                putExtra(EXTRA_CALL_ID, UUID.randomUUID().toString())
                putExtra(EXTRA_TARGET_ID, targetId)
                putExtra(EXTRA_TARGET_NAME, targetName)
                putExtra(EXTRA_CALL_TYPE, callType)
                putExtra(EXTRA_DIRECTION, "outgoing")
            }

        fun incomingIntent(
            context: Context,
            callId: String,
            callerId: Int,
            callerName: String,
            callType: String
        ) = Intent(context, CallActivity::class.java).apply {
            putExtra(EXTRA_CALL_ID, callId)
            putExtra(EXTRA_TARGET_ID, callerId)
            putExtra(EXTRA_TARGET_NAME, callerName)
            putExtra(EXTRA_CALL_TYPE, callType)
            putExtra(EXTRA_DIRECTION, "incoming")
        }
    }

    private lateinit var binding: ActivityCallBinding
    private lateinit var callId: String
    private var targetId = 0
    private var targetName = "Nexa user"
    private var callType = "audio"
    private var direction = "outgoing"
    private var callManager: WebRtcCallManager? = null
    private var ended = false
    private var accepted = false
    private var microphoneEnabled = true
    private var cameraEnabled = true
    private var pendingAction: (() -> Unit)? = null
    private var isReceiverRegistered = false
    private var proximitySensorManager: ProximitySensorManager? = null
    private var mediaPlayer: MediaPlayer? = null

    private var pendingRemoteOfferSdp: String? = null
    private var pendingRemoteAnswerSdp: String? = null
    private val pendingRemoteCandidates = mutableListOf<RemoteIceCandidate>()

    private val pipActionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                ACTION_PIP_MUTE -> {
                    microphoneEnabled = !microphoneEnabled
                    callManager?.setMicrophoneEnabled(microphoneEnabled)
                    binding.btnMute.text = if (microphoneEnabled) "Mute" else "Unmute"
                    updatePipParams()
                }
                ACTION_PIP_CAMERA -> {
                    if (callType == "video") {
                        cameraEnabled = !cameraEnabled
                        callManager?.setCameraEnabled(cameraEnabled)
                        binding.btnToggleVideo.text = if (cameraEnabled) "Camera" else "Camera off"
                        updatePipParams()
                    }
                }
                ACTION_PIP_END -> {
                    endCall("ended")
                }
            }
        }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val microphoneGranted = results[Manifest.permission.RECORD_AUDIO] == true ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        val cameraGranted = callType != "video" || results[Manifest.permission.CAMERA] == true ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        if (microphoneGranted && cameraGranted) pendingAction?.invoke()
        else showFailure("Microphone${if (callType == "video") " and camera" else ""} permission required")
        pendingAction = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCallBinding.inflate(layoutInflater)
        setContentView(binding.root)

        callId = intent.getStringExtra(EXTRA_CALL_ID).orEmpty()
        targetId = intent.getIntExtra(EXTRA_TARGET_ID, 0)
        targetName = intent.getStringExtra(EXTRA_TARGET_NAME) ?: "Nexa user"
        callType = intent.getStringExtra(EXTRA_CALL_TYPE).takeIf { it == "video" } ?: "audio"
        direction = intent.getStringExtra(EXTRA_DIRECTION).takeIf { it == "incoming" } ?: "outgoing"
        if (callId.isBlank() || targetId <= 0) {
            finish()
            return
        }

        binding.tvCallerName.text = targetName
        binding.localRenderer.visibility = if (callType == "video") View.VISIBLE else View.GONE
        binding.btnToggleVideo.visibility = if (callType == "video") View.VISIBLE else View.GONE
        binding.btnSwitchCamera.visibility = if (callType == "video") View.VISIBLE else View.GONE
        binding.incomingControls.visibility = if (direction == "incoming") View.VISIBLE else View.GONE
        binding.activeControls.visibility = if (direction == "incoming") View.GONE else View.VISIBLE
        binding.tvCallStatus.text = if (direction == "incoming") "Incoming ${if (callType == "video") "video" else "voice"} call" else "Preparing call…"

        setupControls()
        registerPipReceiver()
        updatePipParams()
        proximitySensorManager = ProximitySensorManager(this)
        SocketManager.registerCallSignalListener(this)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = endCall("ended")
        })

        NotificationHelper.cancelNotification(this)

        if (direction == "outgoing") {
            requestMediaPermissions { prepareAndPlaceCall() }
        } else if (intent.getBooleanExtra("extra_auto_accept", false)) {
            requestMediaPermissions { prepareAndAcceptCall() }
        } else {
            startRinging()
        }
    }

    private fun startRinging() {
        if (direction != "incoming" || accepted || ended) return
        try {
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            val ringerMode = audioManager?.ringerMode ?: AudioManager.RINGER_MODE_NORMAL

            // Respect device hardware silent switch
            if (ringerMode == AudioManager.RINGER_MODE_SILENT) {
                return
            }

            val customRingtoneUri = Uri.parse("android.resource://$packageName/${R.raw.ringtone}")

            mediaPlayer = MediaPlayer().apply {
                setDataSource(applicationContext, customRingtoneUri)
                isLooping = true // Ensure it keeps ringing until answered
                prepare()
                if (ringerMode == AudioManager.RINGER_MODE_NORMAL) {
                    start()
                }
            }
        } catch (e: Exception) {
            Log.w("CallActivity", "Failed to start custom ringtone MediaPlayer", e)
            try {
                val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                val r = RingtoneManager.getRingtone(applicationContext, ringtoneUri)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                    r?.isLooping = true
                }
                r?.play()
            } catch (fallbackError: Exception) {
                Log.w("CallActivity", "Failed to start fallback ringtone", fallbackError)
            }
        }
    }

    private fun stopRinging() {
        try {
            mediaPlayer?.let {
                if (it.isPlaying) {
                    it.stop()
                }
                it.release()
            }
        } catch (e: Exception) {
            Log.w("CallActivity", "Error stopping MediaPlayer ringtone", e)
        }
        mediaPlayer = null
    }

    private fun registerPipReceiver() {
        if (!isReceiverRegistered) {
            val filter = IntentFilter().apply {
                addAction(ACTION_PIP_MUTE)
                addAction(ACTION_PIP_CAMERA)
                addAction(ACTION_PIP_END)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(pipActionReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                registerReceiver(pipActionReceiver, filter)
            }
            isReceiverRegistered = true
        }
    }

    private fun setupControls() {
        binding.btnAccept.setOnClickListener {
            requestMediaPermissions { prepareAndAcceptCall() }
        }
        binding.btnDecline.setOnClickListener {
            SocketManager.emitCallReject(callId, targetId, "declined")
            ended = true
            finish()
        }
        binding.btnEndCall.setOnClickListener { endCall("ended") }
        binding.btnMute.setOnClickListener {
            microphoneEnabled = !microphoneEnabled
            callManager?.setMicrophoneEnabled(microphoneEnabled)
            binding.btnMute.text = if (microphoneEnabled) "Mute" else "Unmute"
            updatePipParams()
        }
        binding.btnToggleVideo.setOnClickListener {
            cameraEnabled = !cameraEnabled
            callManager?.setCameraEnabled(cameraEnabled)
            binding.btnToggleVideo.text = if (cameraEnabled) "Camera" else "Camera off"
            proximitySensorManager?.updateState(allowScreenOff = !cameraEnabled)
            updatePipParams()
        }
        binding.btnSwitchCamera.setOnClickListener { callManager?.switchCamera() }
    }

    private fun buildPipParams(): PictureInPictureParams? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null
        val builder = PictureInPictureParams.Builder()

        // Configure aspect ratio for video / audio calls (bounded between 1:2.39 and 2.39:1)
        val aspectRatio = if (callType == "video") Rational(9, 16) else Rational(16, 9)
        builder.setAspectRatio(aspectRatio)

        val actions = ArrayList<RemoteAction>()

        // 1. Mute Action
        val muteIcon = Icon.createWithResource(
            this,
            if (microphoneEnabled) R.drawable.ic_pip_mic else R.drawable.ic_pip_mic_off
        )
        val mutePendingIntent = PendingIntent.getBroadcast(
            this,
            REQUEST_CODE_MUTE,
            Intent(ACTION_PIP_MUTE).setPackage(packageName),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        actions.add(
            RemoteAction(
                muteIcon,
                if (microphoneEnabled) "Mute" else "Unmute",
                if (microphoneEnabled) "Mute microphone" else "Unmute microphone",
                mutePendingIntent
            )
        )

        // 2. Camera Toggle Action (for video calls)
        if (callType == "video") {
            val cameraIcon = Icon.createWithResource(
                this,
                if (cameraEnabled) R.drawable.ic_pip_video else R.drawable.ic_pip_video_off
            )
            val cameraPendingIntent = PendingIntent.getBroadcast(
                this,
                REQUEST_CODE_CAMERA,
                Intent(ACTION_PIP_CAMERA).setPackage(packageName),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            actions.add(
                RemoteAction(
                    cameraIcon,
                    if (cameraEnabled) "Camera off" else "Camera on",
                    if (cameraEnabled) "Turn off camera" else "Turn on camera",
                    cameraPendingIntent
                )
            )
        }

        // 3. End Call Action
        val endIcon = Icon.createWithResource(this, R.drawable.ic_pip_call_end)
        val endPendingIntent = PendingIntent.getBroadcast(
            this,
            REQUEST_CODE_END,
            Intent(ACTION_PIP_END).setPackage(packageName),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        actions.add(
            RemoteAction(
                endIcon,
                "End Call",
                "End ongoing call",
                endPendingIntent
            )
        )

        builder.setActions(actions)

        // Android 12+ (API 31) Auto-enter and seamless resizing
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setAutoEnterEnabled(accepted && !ended)
            builder.setSeamlessResizeEnabled(true)
        }

        return builder.build()
    }

    private fun updatePipParams() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val params = buildPipParams()
            if (params != null) {
                setPictureInPictureParams(params)
            }
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && accepted && !ended) {
            val params = buildPipParams()
            if (params != null) {
                enterPictureInPictureMode(params)
            } else {
                @Suppress("DEPRECATION")
                enterPictureInPictureMode()
            }
        }
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        if (isInPictureInPictureMode) {
            binding.activeControls.visibility = View.GONE
            binding.incomingControls.visibility = View.GONE
            binding.tvCallerName.visibility = View.GONE
            binding.tvCallStatus.visibility = View.GONE
            binding.btnSwitchCamera.visibility = View.GONE
        } else {
            if (!ended) {
                binding.activeControls.visibility = if (direction == "incoming" && !accepted) View.GONE else View.VISIBLE
                binding.incomingControls.visibility = if (direction == "incoming" && !accepted) View.VISIBLE else View.GONE
                binding.tvCallerName.visibility = View.VISIBLE
                binding.tvCallStatus.visibility = View.VISIBLE
                binding.btnSwitchCamera.visibility = if (callType == "video") View.VISIBLE else View.GONE
            }
        }
    }

    private fun requestMediaPermissions(action: () -> Unit) {
        val permissions = buildList {
            if (ContextCompat.checkSelfPermission(this@CallActivity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) add(Manifest.permission.RECORD_AUDIO)
            if (callType == "video" && ContextCompat.checkSelfPermission(this@CallActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) add(Manifest.permission.CAMERA)
        }
        if (permissions.isEmpty()) action()
        else {
            pendingAction = action
            permissionLauncher.launch(permissions.toTypedArray())
        }
    }

    private fun prepareManager(onReady: () -> Unit) {
        if (callManager != null) {
            onReady()
            return
        }
        binding.tvCallStatus.text = "Preparing secure media…"
        lifecycleScope.launch(Dispatchers.IO) {
            val fallbackIce = listOf(
                IceServerConfiguration(urls = listOf("stun:stun.l.google.com:19302")),
                IceServerConfiguration(urls = listOf("stun:stun1.l.google.com:19302")),
                IceServerConfiguration(urls = listOf("stun:stun2.l.google.com:19302"))
            )
            val iceServers = try {
                val response = NexaApiClient.callApi.getIceConfiguration()
                val config = response.body()?.data
                if (response.isSuccessful && config?.enabled == true && !config.iceServers.isNullOrEmpty()) {
                    config.iceServers
                } else {
                    fallbackIce
                }
            } catch (_: Exception) {
                fallbackIce
            }

            withContext(Dispatchers.Main) {
                try {
                    callManager = createManager(iceServers)
                    callManager?.startLocalMedia()
                    flushPendingSignals()
                    onReady()
                } catch (error: Exception) {
                    showFailure(error.message ?: "Unable to prepare call")
                }
            }
        }
    }

    private fun flushPendingSignals() {
        val manager = callManager ?: return
        if (accepted) {
            pendingRemoteOfferSdp?.let {
                manager.acceptOfferAndCreateAnswer(it)
                pendingRemoteOfferSdp = null
            }
        }
        pendingRemoteAnswerSdp?.let {
            manager.acceptAnswer(it)
            pendingRemoteAnswerSdp = null
        }
        if (pendingRemoteCandidates.isNotEmpty()) {
            val list = ArrayList(pendingRemoteCandidates)
            pendingRemoteCandidates.clear()
            list.forEach { manager.addRemoteIceCandidate(it) }
        }
    }

    private fun createManager(iceServers: List<IceServerConfiguration>) = WebRtcCallManager(
        context = this,
        localRenderer = binding.localRenderer,
        remoteRenderer = binding.remoteRenderer,
        videoEnabled = callType == "video",
        iceConfiguration = iceServers,
        listener = this
    )

    private fun prepareAndPlaceCall() {
        prepareManager {
            binding.tvCallStatus.text = "Calling…"
            proximitySensorManager?.start(allowScreenOff = callType == "audio" || !cameraEnabled)
            SocketManager.emitCallInvite(callId, targetId, callType) { success, error ->
                if (success) binding.tvCallStatus.text = "Ringing…"
                else showFailure(error ?: "Unable to place call")
            }
        }
    }

    private fun prepareAndAcceptCall() {
        stopRinging()
        binding.btnAccept.isEnabled = false
        accepted = true
        binding.incomingControls.visibility = View.GONE
        binding.activeControls.visibility = View.VISIBLE
        binding.tvCallStatus.text = "Connecting…"
        proximitySensorManager?.start(allowScreenOff = callType == "audio" || !cameraEnabled)
        updatePipParams()

        prepareManager {
            SocketManager.emitCallAccept(callId, targetId) { success, error ->
                if (success) {
                    flushPendingSignals()
                } else {
                    showFailure(error ?: "Unable to accept call")
                }
            }
        }
    }

    override fun onCallAccepted(callId: String) {
        if (callId != this.callId) return
        stopRinging()
        accepted = true
        binding.tvCallStatus.text = "Connecting…"
        proximitySensorManager?.start(allowScreenOff = callType == "audio" || !cameraEnabled)
        updatePipParams()
        if (callManager != null) {
            callManager?.createOffer()
        } else {
            prepareManager {
                callManager?.createOffer()
            }
        }
    }

    override fun onCallRejected(callId: String, reason: String) {
        if (callId != this.callId) return
        stopRinging()
        ended = true
        proximitySensorManager?.stop()
        updatePipParams()
        showFailure(if (reason == "busy") "User is busy" else "Call declined", finishAfter = true)
    }

    override fun onCallOffer(callId: String, sdp: String) {
        if (callId != this.callId || sdp.isBlank()) return
        pendingRemoteOfferSdp = sdp
        if (accepted && callManager != null) {
            callManager?.acceptOfferAndCreateAnswer(sdp)
            pendingRemoteOfferSdp = null
        }
    }

    override fun onCallAnswer(callId: String, sdp: String) {
        if (callId != this.callId || sdp.isBlank()) return
        if (callManager != null) {
            callManager?.acceptAnswer(sdp)
        } else {
            pendingRemoteAnswerSdp = sdp
        }
    }

    override fun onIceCandidate(callId: String, candidate: RemoteIceCandidate) {
        if (callId != this.callId) return
        if (callManager != null) {
            callManager?.addRemoteIceCandidate(candidate)
        } else {
            pendingRemoteCandidates.add(candidate)
        }
    }

    override fun onCallEnded(callId: String, reason: String) {
        if (callId != this.callId) return
        stopRinging()
        ended = true
        proximitySensorManager?.stop()
        updatePipParams()
        binding.tvCallStatus.text = if (reason == "disconnected") "User disconnected" else "Call ended"
        binding.root.postDelayed({ finish() }, 900)
    }

    override fun onLocalDescription(type: SessionDescription.Type, sdp: String) {
        if (type == SessionDescription.Type.OFFER) SocketManager.emitCallOffer(callId, targetId, sdp)
        else if (type == SessionDescription.Type.ANSWER) SocketManager.emitCallAnswer(callId, targetId, sdp)
    }

    override fun onLocalIceCandidate(candidate: RemoteIceCandidate) {
        SocketManager.emitIceCandidate(callId, targetId, candidate)
    }

    override fun onConnectionStateChanged(state: PeerConnection.PeerConnectionState) {
        runOnUiThread {
            binding.tvCallStatus.text = when (state) {
                PeerConnection.PeerConnectionState.CONNECTED -> "Connected"
                PeerConnection.PeerConnectionState.CONNECTING -> "Connecting…"
                PeerConnection.PeerConnectionState.FAILED -> "Connection failed"
                PeerConnection.PeerConnectionState.DISCONNECTED -> "Reconnecting…"
                PeerConnection.PeerConnectionState.CLOSED -> "Call ended"
                else -> binding.tvCallStatus.text
            }
            updatePipParams()
        }
    }

    override fun onError(message: String) {
        runOnUiThread { showFailure(message) }
    }

    private fun endCall(reason: String) {
        stopRinging()
        proximitySensorManager?.release()
        proximitySensorManager = null
        if (!ended) {
            if (direction == "incoming" && !accepted) SocketManager.emitCallReject(callId, targetId, "declined")
            else SocketManager.emitCallEnd(callId, targetId, reason)
            ended = true
            updatePipParams()
        }
        finish()
    }

    private fun showFailure(message: String, finishAfter: Boolean = false) {
        binding.tvCallStatus.text = message
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
        if (finishAfter) binding.root.postDelayed({ finish() }, 900)
    }

    override fun onResume() {
        super.onResume()
        if (accepted && !ended) {
            proximitySensorManager?.start(allowScreenOff = callType == "audio" || !cameraEnabled)
        }
    }

    override fun onPause() {
        super.onPause()
        proximitySensorManager?.stop()
    }

    override fun onDestroy() {
        stopRinging()
        proximitySensorManager?.release()
        proximitySensorManager = null
        if (isReceiverRegistered) {
            try {
                unregisterReceiver(pipActionReceiver)
            } catch (e: Exception) {
                // Ignore
            }
            isReceiverRegistered = false
        }
        SocketManager.unregisterCallSignalListener(this)
        if (!ended) {
            if (direction == "incoming" && !accepted) SocketManager.emitCallReject(callId, targetId, "dismissed")
            else SocketManager.emitCallEnd(callId, targetId, "ended")
        }
        callManager?.release()
        callManager = null
        super.onDestroy()
    }
}
