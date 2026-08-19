package com.nexa.social.service

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.nexa.social.data.models.NotificationDestination
import com.nexa.social.utils.NotificationHelper

class NexaFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        FcmTokenSyncWorker.enqueue(applicationContext, token)
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val title = remoteMessage.notification?.title
            ?: remoteMessage.data["title"]
            ?: "Nexa Social"

        val body = remoteMessage.notification?.body
            ?: remoteMessage.data["body"]
            ?: remoteMessage.data["message"]
            ?: "You have a new update on Nexa."

        // Parse destination and validate
        val destinationStr = remoteMessage.data["destination"]
            ?: remoteMessage.data["type"]
            ?: "HOME"

        val destination = NotificationDestination.fromString(destinationStr)

        // Parse and validate resource identifiers
        val resourceId = remoteMessage.data["resourceId"]
            ?: remoteMessage.data["postId"]
            ?: remoteMessage.data["userId"]
            ?: remoteMessage.data["reelId"]

        val secondaryId = remoteMessage.data["secondaryId"]

        // Validation: Positive numeric IDs for relevant destinations
        val isValid = when (destination) {
            NotificationDestination.CHAT,
            NotificationDestination.POST,
            NotificationDestination.REEL -> {
                val id = resourceId?.toIntOrNull()
                id != null && id > 0
            }
            NotificationDestination.PROFILE -> !resourceId.isNullOrBlank()
            else -> true
        }

        val safeDestination = if (isValid) destination.name else NotificationDestination.HOME.name
        val safeResourceId = if (isValid) resourceId else null
        val safeSecondaryId = if (isValid) secondaryId else null

        NotificationHelper.showNotification(
            context = applicationContext,
            title = title,
            body = body,
            destination = safeDestination,
            resourceId = safeResourceId,
            secondaryId = safeSecondaryId
        )
    }
}
