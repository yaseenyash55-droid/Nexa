package com.nexa.social.service

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.nexa.social.NexaApiClient
import com.nexa.social.data.models.FcmTokenRequest
import com.nexa.social.utils.NotificationHelper
import com.nexa.social.utils.TokenManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class NexaFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        sendTokenToBackend(token)
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

        val targetUrl = remoteMessage.data["targetUrl"]
            ?: remoteMessage.data["url"]
            ?: remoteMessage.data["postId"]?.let { "https://nexa-social-app.surge.sh/post/$it" }

        NotificationHelper.showNotification(
            context = applicationContext,
            title = title,
            body = body,
            targetUrl = targetUrl
        )
    }

    private fun sendTokenToBackend(fcmToken: String) {
        val tokenManager = TokenManager(applicationContext)
        val accessToken = tokenManager.accessToken

        if (!accessToken.isNullOrEmpty()) {
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    NexaApiClient.authApi.registerFcmToken(FcmTokenRequest(fcmToken))
                } catch (e: Exception) {
                    // Suppress network errors on background token sync
                }
            }
        }
    }
}
