package com.nexa.social.utils

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.nexa.social.MainActivity
import com.nexa.social.R
import com.nexa.social.service.CallActionReceiver
import com.nexa.social.ui.CallActivity

object NotificationHelper {

    const val CHANNEL_ID = "nexa_notifications_channel"
    const val CHANNEL_NAME = "Nexa Notifications"

    const val CALL_CHANNEL_ID = "nexa_call_channel"
    const val CALL_CHANNEL_NAME = "Incoming Calls"
    const val CALL_NOTIFICATION_ID = 2001

    const val EXTRA_DESTINATION = "extra_destination"
    const val EXTRA_RESOURCE_ID = "extra_resource_id"
    const val EXTRA_SECONDARY_ID = "extra_secondary_id"

    private val CALL_VIBRATION_PATTERN = longArrayOf(0, 1000, 1000, 1000, 1000, 1000)

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Push notifications for Nexa Social network updates, likes, comments, and messages."
                enableLights(true)
                lightColor = ContextCompat.getColor(context, R.color.brand_primary)
                enableVibration(true)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PRIVATE
            }

            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun createCallNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ringtoneUri = try {
                android.net.Uri.parse("android.resource://${context.packageName}/${R.raw.ringtone}")
            } catch (e: Exception) {
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            }
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build()

            val callChannel = NotificationChannel(
                CALL_CHANNEL_ID,
                CALL_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "High-priority full-screen incoming audio and video call alerts."
                enableLights(true)
                lightColor = ContextCompat.getColor(context, R.color.brand_primary)
                enableVibration(true)
                vibrationPattern = CALL_VIBRATION_PATTERN
                setSound(ringtoneUri, audioAttributes)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                setBypassDnd(true)
            }

            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(callChannel)
        }
    }

    fun showNotification(
        context: Context,
        title: String,
        body: String,
        destination: String? = null,
        resourceId: String? = null,
        secondaryId: String? = null,
        notificationId: Int = System.currentTimeMillis().toInt()
    ) {
        createNotificationChannel(context)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_DESTINATION, destination)
            putExtra(EXTRA_RESOURCE_ID, resourceId)
            putExtra(EXTRA_SECONDARY_ID, secondaryId)
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getActivity(context, notificationId, intent, flags)

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setColor(ContextCompat.getColor(context, R.color.brand_primary))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)

        val notificationManager = NotificationManagerCompat.from(context)
        try {
            notificationManager.notify(notificationId, builder.build())
        } catch (_: SecurityException) {
            // Permission missing or denied on Android 13+
        }
    }

    /**
     * Displays a full-screen high-priority incoming call notification with ringtone, vibration,
     * and interactive Accept / Decline action buttons.
     */
    fun showIncomingCallNotification(
        context: Context,
        callId: String,
        callerId: Int,
        callerName: String,
        callType: String = "audio"
    ) {
        createCallNotificationChannel(context)

        val fullScreenIntent = CallActivity.incomingIntent(
            context = context,
            callId = callId,
            callerId = callerId,
            callerName = callerName,
            callType = callType
        ).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            CALL_NOTIFICATION_ID,
            fullScreenIntent,
            flags
        )

        // Decline action broadcast intent
        val declineIntent = Intent(context, CallActionReceiver::class.java).apply {
            action = CallActionReceiver.ACTION_DECLINE_CALL
            putExtra(CallActionReceiver.EXTRA_CALL_ID, callId)
            putExtra(CallActionReceiver.EXTRA_NOTIFICATION_ID, CALL_NOTIFICATION_ID)
        }
        val declinePendingIntent = PendingIntent.getBroadcast(
            context,
            1001,
            declineIntent,
            flags
        )

        // Accept action intent
        val acceptIntent = Intent(context, CallActionReceiver::class.java).apply {
            action = CallActionReceiver.ACTION_ACCEPT_CALL
            putExtra(CallActionReceiver.EXTRA_CALL_ID, callId)
            putExtra(CallActionReceiver.EXTRA_CALLER_ID, callerId)
            putExtra(CallActionReceiver.EXTRA_CALLER_NAME, callerName)
            putExtra(CallActionReceiver.EXTRA_CALL_TYPE, callType)
            putExtra(CallActionReceiver.EXTRA_NOTIFICATION_ID, CALL_NOTIFICATION_ID)
        }
        val acceptPendingIntent = PendingIntent.getBroadcast(
            context,
            1002,
            acceptIntent,
            flags
        )

        val ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        val title = if (callType == "video") "Incoming Video Call" else "Incoming Voice Call"
        val body = "$callerName is calling you on Nexa"

        val builder = NotificationCompat.Builder(context, CALL_CHANNEL_ID)
            .setSmallIcon(if (callType == "video") R.drawable.ic_video_call else R.drawable.ic_phone_call)
            .setColor(ContextCompat.getColor(context, R.color.brand_primary))
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(true)
            .setSound(ringtoneUri)
            .setVibrate(CALL_VIBRATION_PATTERN)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setContentIntent(fullScreenPendingIntent)
            .addAction(R.drawable.ic_pip_call_end, "Decline", declinePendingIntent)
            .addAction(R.drawable.ic_phone_call, "Accept", acceptPendingIntent)

        val notificationManager = NotificationManagerCompat.from(context)
        try {
            notificationManager.notify(CALL_NOTIFICATION_ID, builder.build())
        } catch (_: SecurityException) {
            // Permission missing or denied on Android 13+
        }
    }

    fun cancelNotification(context: Context, notificationId: Int = CALL_NOTIFICATION_ID) {
        val notificationManager = NotificationManagerCompat.from(context)
        try {
            notificationManager.cancel(notificationId)
        } catch (_: Exception) {
            // Safe ignore
        }
    }
}
