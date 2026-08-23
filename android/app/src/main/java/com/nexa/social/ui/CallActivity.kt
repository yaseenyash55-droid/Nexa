package com.nexa.social.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.nexa.social.NexaApiClient
import com.nexa.social.call.WebRtcCallManager
import com.nexa.social.data.models.IceServerConfiguration
import com.nexa.social.databinding.ActivityCallBinding
import com.nexa.social.utils.CallSignalListener
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
        SocketManager.registerCallSignalListener(this)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = endCall("ended")
        })

        if (direction == "outgoing") requestMediaPermissions { prepareAndPlaceCall() }
    }

    private fun setupControls() {
        binding.btnAccept.setOnClickListener {
            requestMediaPermissions { prepareAndAcceptCall() }
        }
        binding.btnDecline.setOnClickListener {
            SocketManager.emitCallReject(callId)
            ended = true
            finish()
        }
        binding.btnEndCall.setOnClickListener { endCall("ended") }
        binding.btnMute.setOnClickListener {
            microphoneEnabled = !microphoneEnabled
            callManager?.setMicrophoneEnabled(microphoneEnabled)
            binding.btnMute.text = if (microphoneEnabled) "Mute" else "Unmute"
        }
        binding.btnToggleVideo.setOnClickListener {
            cameraEnabled = !cameraEnabled
            callManager?.setCameraEnabled(cameraEnabled)
            binding.btnToggleVideo.text = if (cameraEnabled) "Camera" else "Camera off"
        }
        binding.btnSwitchCamera.setOnClickListener { callManager?.switchCamera() }
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
            try {
                val response = NexaApiClient.callApi.getIceConfiguration()
                val config = response.body()?.data
                if (!response.isSuccessful || config?.enabled != true || config.iceServers.isEmpty()) {
                    throw IllegalStateException(config?.reason ?: "Calling is not configured")
                }
                withContext(Dispatchers.Main) {
                    callManager = createManager(config.iceServers)
                    callManager?.startLocalMedia()
                    onReady()
                }
            } catch (error: Exception) {
                withContext(Dispatchers.Main) { showFailure(error.message ?: "Unable to prepare call") }
            }
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
            SocketManager.emitCallInvite(callId, targetId, callType) { success, error ->
                if (success) binding.tvCallStatus.text = "Ringing…"
                else showFailure(error ?: "Unable to place call")
            }
        }
    }

    private fun prepareAndAcceptCall() {
        binding.btnAccept.isEnabled = false
        prepareManager {
            SocketManager.emitCallAccept(callId) { success, error ->
                if (success) {
                    accepted = true
                    binding.incomingControls.visibility = View.GONE
                    binding.activeControls.visibility = View.VISIBLE
                    binding.tvCallStatus.text = "Connecting…"
                } else {
                    showFailure(error ?: "Unable to accept call")
                }
            }
        }
    }

    override fun onCallAccepted(callId: String) {
        if (callId != this.callId) return
        accepted = true
        binding.tvCallStatus.text = "Connecting…"
        callManager?.createOffer()
    }

    override fun onCallRejected(callId: String, reason: String) {
        if (callId != this.callId) return
        ended = true
        showFailure(if (reason == "busy") "User is busy" else "Call declined", finishAfter = true)
    }

    override fun onCallOffer(callId: String, sdp: String) {
        if (callId == this.callId && accepted && sdp.isNotBlank()) callManager?.acceptOfferAndCreateAnswer(sdp)
    }

    override fun onCallAnswer(callId: String, sdp: String) {
        if (callId == this.callId && sdp.isNotBlank()) callManager?.acceptAnswer(sdp)
    }

    override fun onIceCandidate(callId: String, candidate: RemoteIceCandidate) {
        if (callId == this.callId) callManager?.addRemoteIceCandidate(candidate)
    }

    override fun onCallEnded(callId: String, reason: String) {
        if (callId != this.callId) return
        ended = true
        binding.tvCallStatus.text = if (reason == "disconnected") "User disconnected" else "Call ended"
        binding.root.postDelayed({ finish() }, 900)
    }

    override fun onLocalDescription(type: SessionDescription.Type, sdp: String) {
        if (type == SessionDescription.Type.OFFER) SocketManager.emitCallOffer(callId, sdp)
        else if (type == SessionDescription.Type.ANSWER) SocketManager.emitCallAnswer(callId, sdp)
    }

    override fun onLocalIceCandidate(candidate: RemoteIceCandidate) {
        SocketManager.emitIceCandidate(callId, candidate)
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
        }
    }

    override fun onError(message: String) {
        runOnUiThread { showFailure(message) }
    }

    private fun endCall(reason: String) {
        if (!ended) {
            if (direction == "incoming" && !accepted) SocketManager.emitCallReject(callId, "declined")
            else SocketManager.emitCallEnd(callId, reason)
            ended = true
        }
        finish()
    }

    private fun showFailure(message: String, finishAfter: Boolean = false) {
        binding.tvCallStatus.text = message
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
        if (finishAfter) binding.root.postDelayed({ finish() }, 900)
    }

    override fun onDestroy() {
        SocketManager.unregisterCallSignalListener(this)
        if (!ended) {
            if (direction == "incoming" && !accepted) SocketManager.emitCallReject(callId, "dismissed")
            else SocketManager.emitCallEnd(callId, "ended")
        }
        callManager?.release()
        callManager = null
        super.onDestroy()
    }
}
