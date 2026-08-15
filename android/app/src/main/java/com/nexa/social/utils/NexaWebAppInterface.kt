package com.nexa.social.utils

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.widget.Toast

class NexaWebAppInterface(private val context: Context) {

    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun isAndroidApp(): Boolean {
        return true
    }

    @JavascriptInterface
    fun showToast(message: String?) {
        if (!message.isNullOrEmpty()) {
            mainHandler.post {
                Toast.makeText(context.applicationContext, message, Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun onMessageReceived(senderName: String?, messageText: String?) {
        val title = if (!senderName.isNullOrEmpty()) "New Message from $senderName" else "New Nexa Message"
        val body = messageText ?: "You have a new message on Nexa Social."
        NotificationHelper.showNotification(
            context = context.applicationContext,
            title = title,
            body = body,
            targetUrl = "https://nexa-social-app.surge.sh/messages"
        )
    }

    @JavascriptInterface
    fun onRouteChanged(route: String?) {
        // Callback hook for native activity route updates
    }
}
