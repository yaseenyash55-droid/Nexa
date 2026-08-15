package com.nexa.social.utils

import android.os.Handler
import android.os.Looper

object NexaSocketManager {

    private var onTypingStartListener: ((userId: Int, username: String?) -> Unit)? = null
    private var onTypingStopListener: ((userId: Int) -> Unit)? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    fun setTypingListeners(
        onStart: (userId: Int, username: String?) -> Unit,
        onStop: (userId: Int) -> Unit
    ) {
        onTypingStartListener = onStart
        onTypingStopListener = onStop
    }

    fun removeTypingListeners() {
        onTypingStartListener = null
        onTypingStopListener = null
    }

    fun emitTypingStart(receiverId: Int) {
        // Emit typing:start event via socket connection or HTTP notification
    }

    fun emitTypingStop(receiverId: Int) {
        // Emit typing:stop event via socket connection or HTTP notification
    }

    fun simulateIncomingTypingStart(userId: Int, username: String?) {
        mainHandler.post {
            onTypingStartListener?.invoke(userId, username)
        }
    }

    fun simulateIncomingTypingStop(userId: Int) {
        mainHandler.post {
            onTypingStopListener?.invoke(userId)
        }
    }
}
