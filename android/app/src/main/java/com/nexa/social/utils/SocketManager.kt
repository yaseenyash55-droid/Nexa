package com.nexa.social.utils

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.google.gson.Gson
import com.nexa.social.BuildConfig
import com.nexa.social.data.models.GroupMessage
import com.nexa.social.data.models.Message
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URISyntaxException

object SocketManager {

    private const val TAG = "NexaSocket"
    val SOCKET_SERVER_URL: String = BuildConfig.SOCKET_SERVER_URL

    private var socket: Socket? = null
    private val gson = Gson()
    private val mainHandler = Handler(Looper.getMainLooper())

    private var messageListener: ((Message) -> Unit)? = null
    private var groupMessageListener: ((GroupMessage) -> Unit)? = null
    private var typingStartListener: ((userId: Int, username: String?) -> Unit)? = null
    private var typingStopListener: ((userId: Int) -> Unit)? = null

    private var appContext: Context? = null

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    @Synchronized
    fun connect(token: String) {
        if (token.isBlank()) return
        if (socket?.connected() == true) return

        try {
            val options = IO.Options().apply {
                forceNew = false
                reconnection = true
                reconnectionAttempts = 5
                reconnectionDelay = 1000
                reconnectionDelayMax = 10000
                timeout = 15000
                auth = mapOf("token" to token)
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

    fun registerGroupMessageListener(listener: (GroupMessage) -> Unit) {
        groupMessageListener = listener
    }

    fun unregisterGroupMessageListener() {
        groupMessageListener = null
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
