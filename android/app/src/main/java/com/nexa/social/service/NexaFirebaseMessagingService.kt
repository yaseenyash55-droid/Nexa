package com.nexa.social.service

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.nexa.social.utils.NotificationHelper
import com.nexa.social.utils.UrlValidator

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

        val rawUrl = remoteMessage.data["targetUrl"]
            ?: remoteMessage.data["url"]
            ?: remoteMessage.data["postId"]?.let { "/post/$it" }

        val targetUrl = UrlValidator.sanitizeTargetUrl(rawUrl)

        NotificationHelper.showNotification(
            context = applicationContext,
            title = title,
            body = body,
            targetUrl = targetUrl
        )
    }
}
