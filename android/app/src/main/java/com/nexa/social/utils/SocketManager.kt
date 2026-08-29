package com.nexa.social.utils

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.google.gson.Gson
import com.nexa.social.BuildConfig
import com.nexa.social.data.models.GroupMessage
import com.nexa.social.data.models.Message
import io.socket.client.IO
import io.socket.client.Socket
import io.socket.client.Ack
import org.json.JSONObject
import java.net.URISyntaxException

data class IncomingCall(
    val callId: String,
    val callerId: Int,
    val callerUsername: String,
    val callType: String
)

data class RemoteIceCandidate(
    val candidate: String,
    val sdpMid: String?,
    val sdpMLineIndex: Int
)

interface CallSignalListener {
    fun onCallAccepted(callId: String) {}
    fun onCallRejected(callId: String, reason: String) {}
    fun onCallOffer(callId: String, sdp: String) {}
    fun onCallAnswer(callId: String, sdp: String) {}
    fun onIceCandidate(callId: String, candidate: RemoteIceCandidate) {}
    fun onCallEnded(callId: String, reason: String) {}
}

object SocketManager {

    private const val TAG = "NexaSocket"
    val SOCKET_SERVER_URL: String = BuildConfig.SOCKET_SERVER_URL

    private var socket: Socket? = null
    private val gson = Gson()
    private val mainHandler = Handler(Looper.getMainLooper())

    private var messageListener: ((Message) -> Unit)? = null
    private var messageReadListener: ((messageId: Int, readAt: String?) -> Unit)? = null
    private var messageEditedListener: ((Message) -> Unit)? = null
    private var messageUnsentListener: ((messageId: Int) -> Unit)? = null
    private var messageReactionListener: ((Message) -> Unit)? = null
    
    private var groupMessageListener: ((GroupMessage) -> Unit)? = null
    private var groupMessageEditedListener: ((GroupMessage) -> Unit)? = null
    private var groupMessageUnsentListener: ((messageId: Int) -> Unit)? = null
    private var groupMessageReactionListener: ((GroupMessage) -> Unit)? = null
    private var typingStartListener: ((userId: Int, username: String?) -> Unit)? = null
    private var typingStopListener: ((userId: Int) -> Unit)? = null
    private var incomingCallListener: ((IncomingCall) -> Unit)? = null
    private var callSignalListener: CallSignalListener? = null

    private var appContext: Context? = null

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    @Synchronized
    fun connect(token: String) {
        if (token.isBlank()) return
        if (socket?.connected() == true) return

        try {
            val authToken = if (token.startsWith("Bearer ")) token else "Bearer $token"
            val options = IO.Options().apply {
                forceNew = false
                reconnection = true
                reconnectionAttempts = 10
                reconnectionDelay = 1000
                reconnectionDelayMax = 10000
                timeout = 15000
                transports = arrayOf(io.socket.engineio.client.transports.WebSocket.NAME)
                upgrade = false
                auth = mapOf("token" to authToken)
            }

            socket = IO.socket(SOCKET_SERVER_URL, options)

            socket?.on(Socket.EVENT_CONNECT) {
                if (BuildConfig.DEBUG) {
                    Log.d(TAG, "Socket connected to server")
                }
            }

            socket?.on(Socket.EVENT_DISCONNECT) { args ->
                if (BuildConfig.DEBUG) {
                    Log.d(TAG, "Socket disconnected: ${args.getOrNull(0)}")
                }
            }

            socket?.on(Socket.EVENT_CONNECT_ERROR) { args ->
                if (BuildConfig.DEBUG) {
                    Log.w(TAG, "Socket connection error: ${args.getOrNull(0)}")
                }
            }

            // Real-time Event Listeners
            socket?.on("message:created") { args ->
                if (args.isNotEmpty()) {
                    val jsonStr = args[0].toString()
                    try {
                        val message = gson.fromJson(jsonStr, Message::class.java)
                        mainHandler.post {
                            messageListener?.invoke(message)
                        }
                    } catch (e: Exception) {
                        if (BuildConfig.DEBUG) {
                            Log.e(TAG, "Error parsing incoming message payload", e)
                        }
                    }
                }
            }

            socket?.on("message:read") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val json = if (args[0] is JSONObject) args[0] as JSONObject else JSONObject(args[0].toString())
                        val messageId = json.optInt("messageId")
                        val readAt = json.optString("readAt").takeIf { it.isNotBlank() }
                        mainHandler.post { messageReadListener?.invoke(messageId, readAt) }
                    } catch (e: Exception) {
                        if (BuildConfig.DEBUG) Log.e(TAG, "Error parsing message:read event", e)
                    }
                }
            }
            socket?.on("group:message:created") { args ->
                if (args.isNotEmpty()) {
                    val jsonStr = args[0].toString()
                    try {
                        val groupMessage = gson.fromJson(jsonStr, GroupMessage::class.java)
                        mainHandler.post {
                            groupMessageListener?.invoke(groupMessage)
                        }
                    } catch (e: Exception) {
                        if (BuildConfig.DEBUG) {
                            Log.e(TAG, "Error parsing group message payload", e)
                        }
                    }
                }
            }

            socket?.on("message:edited") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val message = gson.fromJson(args[0].toString(), Message::class.java)
                        mainHandler.post { messageEditedListener?.invoke(message) }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing message:edited payload", e)
                    }
                }
            }

            socket?.on("message:reaction:updated") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val message = gson.fromJson(args[0].toString(), Message::class.java)
                        mainHandler.post { messageReactionListener?.invoke(message) }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing message:reaction:updated payload", e)
                    }
                }
            }

            socket?.on("message:unsent") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val json = if (args[0] is JSONObject) args[0] as JSONObject else JSONObject(args[0].toString())
                        val messageId = json.optInt("messageId")
                        mainHandler.post { messageUnsentListener?.invoke(messageId) }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing message:unsent payload", e)
                    }
                }
            }

            socket?.on("group:message:edited") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val message = gson.fromJson(args[0].toString(), GroupMessage::class.java)
                        mainHandler.post { groupMessageEditedListener?.invoke(message) }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing group:message:edited payload", e)
                    }
                }
            }

            socket?.on("group:message:reaction:updated") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val message = gson.fromJson(args[0].toString(), GroupMessage::class.java)
                        mainHandler.post { groupMessageReactionListener?.invoke(message) }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing group:message:reaction:updated payload", e)
                    }
                }
            }

            socket?.on("group:message:unsent") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val json = if (args[0] is JSONObject) args[0] as JSONObject else JSONObject(args[0].toString())
                        val messageId = json.optInt("messageId")
                        mainHandler.post { groupMessageUnsentListener?.invoke(messageId) }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing group:message:unsent payload", e)
                    }
                }
            }

            socket?.on("typing:start") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val json = if (args[0] is JSONObject) args[0] as JSONObject else JSONObject(args[0].toString())
                        val userId = json.optInt("userId")
                        val username = if (json.has("username") && !json.isNull("username")) json.getString("username") else null
                        mainHandler.post {
                            typingStartListener?.invoke(userId, username)
                        }
                    } catch (e: Exception) {
                        if (BuildConfig.DEBUG) {
                            Log.e(TAG, "Error parsing typing:start event", e)
                        }
                    }
                }
            }

            socket?.on("typing:stop") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val json = if (args[0] is JSONObject) args[0] as JSONObject else JSONObject(args[0].toString())
                        val userId = json.optInt("userId")
                        mainHandler.post {
                            typingStopListener?.invoke(userId)
                        }
                    } catch (e: Exception) {
                        if (BuildConfig.DEBUG) {
                            Log.e(TAG, "Error parsing typing:stop event", e)
                        }
                    }
                }
            }

            socket?.on("call:invite") { args ->
                parseObject(args)?.let { json ->
                    val call = IncomingCall(
                        callId = json.optString("callId"),
                        callerId = json.optInt("callerId"),
                        callerUsername = json.optString("callerUsername", "Nexa user"),
                        callType = json.optString("callType", "audio")
                    )
                    if (call.callId.isNotBlank() && call.callerId > 0) {
                        mainHandler.post {
                            if (incomingCallListener != null) {
                                incomingCallListener?.invoke(call)
                            } else {
                                appContext?.let { ctx ->
                                    try {
                                        val intent = com.nexa.social.ui.CallActivity.incomingIntent(
                                            ctx,
                                            call.callId,
                                            call.callerId,
                                            call.callerUsername,
                                            call.callType
                                        ).apply {
                                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                                        }
                                        ctx.startActivity(intent)
                                    } catch (e: Exception) {
                                        Log.e(TAG, "Failed to launch incoming call directly", e)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            socket?.on("call:accepted") { args ->
                parseObject(args)?.let { json ->
                    mainHandler.post { callSignalListener?.onCallAccepted(json.optString("callId")) }
                }
            }

            socket?.on("call:rejected") { args ->
                parseObject(args)?.let { json ->
                    mainHandler.post {
                        callSignalListener?.onCallRejected(
                            json.optString("callId"),
                            json.optString("reason", "declined")
                        )
                    }
                }
            }

            socket?.on("call:offer") { args ->
                parseObject(args)?.let { json ->
                    mainHandler.post {
                        callSignalListener?.onCallOffer(json.optString("callId"), json.optString("sdp"))
                    }
                }
            }

            socket?.on("call:answer") { args ->
                parseObject(args)?.let { json ->
                    mainHandler.post {
                        callSignalListener?.onCallAnswer(json.optString("callId"), json.optString("sdp"))
                    }
                }
            }

            socket?.on("call:ice-candidate") { args ->
                parseObject(args)?.let { json ->
                    val candidateJson = json.optJSONObject("candidate") ?: return@let
                    val candidate = RemoteIceCandidate(
                        candidate = candidateJson.optString("candidate"),
                        sdpMid = candidateJson.optString("sdpMid").takeIf { it.isNotBlank() },
                        sdpMLineIndex = candidateJson.optInt("sdpMLineIndex", 0)
                    )
                    if (candidate.candidate.isNotBlank()) {
                        mainHandler.post {
                            callSignalListener?.onIceCandidate(json.optString("callId"), candidate)
                        }
                    }
                }
            }

            socket?.on("call:ended") { args ->
                parseObject(args)?.let { json ->
                    mainHandler.post {
                        callSignalListener?.onCallEnded(
                            json.optString("callId"),
                            json.optString("reason", "ended")
                        )
                    }
                }
            }

            socket?.connect()
        } catch (e: URISyntaxException) {
            Log.e(TAG, "Invalid socket URI configuration: $SOCKET_SERVER_URL", e)
        }
    }

    @Synchronized
    fun disconnect() {
        socket?.off()
        socket?.disconnect()
        socket = null
        messageListener = null
        groupMessageListener = null
        typingStartListener = null
        typingStopListener = null
        incomingCallListener = null
        callSignalListener = null
        if (BuildConfig.DEBUG) {
            Log.d(TAG, "Socket disconnected and listeners cleared")
        }
    }

    fun isConnected(): Boolean = socket?.connected() == true

    fun registerMessageListener(listener: (Message) -> Unit) {
        messageListener = listener
    }

    fun unregisterMessageListener() {
        messageListener = null
    }

    fun registerMessageReadListener(listener: (messageId: Int, readAt: String?) -> Unit) {
        messageReadListener = listener
    }

    fun unregisterMessageReadListener() {
        messageReadListener = null
    }

    fun registerGroupMessageListener(listener: (GroupMessage) -> Unit) {
        groupMessageListener = listener
    }

    fun unregisterGroupMessageListener() {
        groupMessageListener = null
    }

    fun registerMessageInteractionListeners(
        onEdit: ((Message) -> Unit)? = null,
        onUnsend: ((Int) -> Unit)? = null,
        onReaction: ((Message) -> Unit)? = null
    ) {
        messageEditedListener = onEdit
        messageUnsentListener = onUnsend
        messageReactionListener = onReaction
    }

    fun unregisterMessageInteractionListeners() {
        messageEditedListener = null
        messageUnsentListener = null
        messageReactionListener = null
    }

    fun registerGroupMessageInteractionListeners(
        onEdit: ((GroupMessage) -> Unit)? = null,
        onUnsend: ((Int) -> Unit)? = null,
        onReaction: ((GroupMessage) -> Unit)? = null
    ) {
        groupMessageEditedListener = onEdit
        groupMessageUnsentListener = onUnsend
        groupMessageReactionListener = onReaction
    }

    fun unregisterGroupMessageInteractionListeners() {
        groupMessageEditedListener = null
        groupMessageUnsentListener = null
        groupMessageReactionListener = null
    }

    fun setTypingListeners(
        onStart: (userId: Int, username: String?) -> Unit,
        onStop: (userId: Int) -> Unit
    ) {
        typingStartListener = onStart
        typingStopListener = onStop
    }

    fun removeTypingListeners() {
        typingStartListener = null
        typingStopListener = null
    }

    fun registerIncomingCallListener(listener: (IncomingCall) -> Unit) {
        incomingCallListener = listener
    }

    fun unregisterIncomingCallListener() {
        incomingCallListener = null
    }

    fun registerCallSignalListener(listener: CallSignalListener) {
        callSignalListener = listener
    }

    fun unregisterCallSignalListener(listener: CallSignalListener) {
        if (callSignalListener === listener) callSignalListener = null
    }

    fun emitCallInvite(callId: String, targetUserId: Int, callType: String, onResult: (Boolean, String?) -> Unit) {
        emitCallEvent("call:invite", JSONObject().apply {
            put("callId", callId)
            put("targetUserId", targetUserId)
            put("callType", callType)
        }, onResult)
    }

    fun emitCallAccept(callId: String, targetUserId: Int = 0, onResult: (Boolean, String?) -> Unit) {
        emitCallEvent("call:accept", JSONObject().apply {
            put("callId", callId)
            if (targetUserId > 0) put("targetUserId", targetUserId)
        }, onResult)
    }

    fun emitCallReject(callId: String, targetUserId: Int = 0, reason: String = "declined") {
        emitCallEvent("call:reject", JSONObject().apply {
            put("callId", callId)
            put("reason", reason)
            if (targetUserId > 0) put("targetUserId", targetUserId)
        }) { _, _ -> }
    }

    fun emitCallOffer(callId: String, targetUserId: Int = 0, sdp: String) {
        emitCallEvent("call:offer", JSONObject().apply {
            put("callId", callId)
            put("sdp", sdp)
            if (targetUserId > 0) put("targetUserId", targetUserId)
        }) { _, _ -> }
    }

    fun emitCallAnswer(callId: String, targetUserId: Int = 0, sdp: String) {
        emitCallEvent("call:answer", JSONObject().apply {
            put("callId", callId)
            put("sdp", sdp)
            if (targetUserId > 0) put("targetUserId", targetUserId)
        }) { _, _ -> }
    }

    fun emitIceCandidate(callId: String, targetUserId: Int = 0, candidate: RemoteIceCandidate) {
        emitCallEvent("call:ice-candidate", JSONObject().apply {
            put("callId", callId)
            if (targetUserId > 0) put("targetUserId", targetUserId)
            put("candidate", JSONObject().apply {
                put("candidate", candidate.candidate)
                put("sdpMid", candidate.sdpMid)
                put("sdpMLineIndex", candidate.sdpMLineIndex)
            })
        }) { _, _ -> }
    }

    fun emitCallEnd(callId: String, targetUserId: Int = 0, reason: String = "ended") {
        emitCallEvent("call:end", JSONObject().apply {
            put("callId", callId)
            put("reason", reason)
            if (targetUserId > 0) put("targetUserId", targetUserId)
        }) { _, _ -> }
    }

    private fun emitCallEvent(event: String, payload: JSONObject, onResult: (Boolean, String?) -> Unit) {
        val currentSocket = socket
        if (currentSocket?.connected() != true) {
            mainHandler.post { onResult(false, "Realtime connection is unavailable") }
            return
        }
        currentSocket.emit(event, payload, Ack { args ->
            val response = args.firstOrNull() as? JSONObject
            val success = response?.optBoolean("success", false) == true
            val error = response?.optString("error")?.takeIf { it.isNotBlank() }
            mainHandler.post { onResult(success, error) }
        })
    }

    private fun parseObject(args: Array<out Any>): JSONObject? {
        if (args.isEmpty()) return null
        return try {
            if (args[0] is JSONObject) args[0] as JSONObject else JSONObject(args[0].toString())
        } catch (e: Exception) {
            if (BuildConfig.DEBUG) Log.e(TAG, "Failed to parse realtime event", e)
            null
        }
    }

    fun emitTypingStart(receiverId: Int) {
        if (receiverId <= 0) return
        try {
            val json = JSONObject().apply {
                put("receiverId", receiverId)
            }
            socket?.emit("typing:start", json)
        } catch (e: Exception) {
            if (BuildConfig.DEBUG) {
                Log.e(TAG, "Failed to emit typing:start", e)
            }
        }
    }

    fun emitTypingStop(receiverId: Int) {
        if (receiverId <= 0) return
        try {
            val json = JSONObject().apply {
                put("receiverId", receiverId)
            }
            socket?.emit("typing:stop", json)
        } catch (e: Exception) {
            if (BuildConfig.DEBUG) {
                Log.e(TAG, "Failed to emit typing:stop", e)
            }
        }
    }
}
