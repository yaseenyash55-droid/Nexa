package com.nexa.social.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.nexa.social.ui.CallActivity
import com.nexa.social.utils.NotificationHelper
import com.nexa.social.utils.SocketManager

class CallActionReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_ACCEPT_CALL = "com.nexa.social.action.ACCEPT_CALL"
        const val ACTION_DECLINE_CALL = "com.nexa.social.action.DECLINE_CALL"

        const val EXTRA_CALL_ID = "extra_call_id"
        const val EXTRA_CALLER_ID = "extra_caller_id"
        const val EXTRA_CALLER_NAME = "extra_caller_name"
        const val EXTRA_CALL_TYPE = "extra_call_type"
        const val EXTRA_NOTIFICATION_ID = "extra_notification_id"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent == null) return

        val callId = intent.getStringExtra(EXTRA_CALL_ID).orEmpty()
        val callerId = intent.getIntExtra(EXTRA_CALLER_ID, 0)
        val callerName = intent.getStringExtra(EXTRA_CALLER_NAME) ?: "Nexa User"
        val callType = intent.getStringExtra(EXTRA_CALL_TYPE) ?: "audio"
        val notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, NotificationHelper.CALL_NOTIFICATION_ID)

        // Dismiss the incoming call notification
        NotificationHelper.cancelNotification(context, notificationId)

        when (intent.action) {
            ACTION_DECLINE_CALL -> {
                if (callId.isNotBlank()) {
                    SocketManager.emitCallReject(callId, callerId, "declined")
                }
            }
            ACTION_ACCEPT_CALL -> {
                if (callId.isNotBlank() && callerId > 0) {
                    val callIntent = CallActivity.incomingIntent(
                        context = context,
                        callId = callId,
                        callerId = callerId,
                        callerName = callerName,
                        callType = callType
                    ).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                        putExtra("extra_auto_accept", true)
                    }
                    context.startActivity(callIntent)
                }
            }
        }
    }
}
