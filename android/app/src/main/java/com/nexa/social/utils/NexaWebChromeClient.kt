package com.nexa.social.utils

import android.app.Activity
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient

/**
 * WebChromeClient implementation designed to bridge WebRTC audio/video capture
 * permissions between the Android system and web applications inside WebView.
 */
open class NexaWebChromeClient(
    private val activity: Activity
) : WebChromeClient() {

    companion object {
        private const val TAG = "NexaWebChromeClient"
    }

    override fun onPermissionRequest(request: PermissionRequest?) {
        if (request == null) return

        activity.runOnUiThread {
            try {
                val requestedResources = request.resources
                val resourcesToGrant = mutableListOf<String>()

                for (res in requestedResources) {
                    when (res) {
                        PermissionRequest.RESOURCE_AUDIO_CAPTURE,
                        PermissionRequest.RESOURCE_VIDEO_CAPTURE,
                        PermissionRequest.RESOURCE_PROTECTED_MEDIA_ID -> {
                            resourcesToGrant.add(res)
                        }
                        else -> {
                            Log.d(TAG, "Unrecognized permission requested by webview: $res")
                        }
                    }
                }

                if (resourcesToGrant.isNotEmpty()) {
                    Log.i(TAG, "Granting WebRTC media permissions to web origin: ${request.origin}")
                    request.grant(resourcesToGrant.toTypedArray())
                } else {
                    request.deny()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error handling onPermissionRequest for ${request.origin}", e)
                try {
                    request.deny()
                } catch (_: Exception) {
                }
            }
        }
    }

    override fun onPermissionRequestCanceled(request: PermissionRequest?) {
        Log.w(TAG, "WebRTC Permission request was canceled for origin: ${request?.origin}")
        super.onPermissionRequestCanceled(request)
    }

    override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
        if (consoleMessage != null) {
            val logMessage = "[WebView Console] ${consoleMessage.message()} -- From line ${consoleMessage.lineNumber()} of ${consoleMessage.sourceId()}"
            when (consoleMessage.messageLevel()) {
                ConsoleMessage.MessageLevel.ERROR -> Log.e(TAG, logMessage)
                ConsoleMessage.MessageLevel.WARNING -> Log.w(TAG, logMessage)
                ConsoleMessage.MessageLevel.LOG,
                ConsoleMessage.MessageLevel.TIP,
                ConsoleMessage.MessageLevel.DEBUG -> Log.d(TAG, logMessage)
                else -> Log.v(TAG, logMessage)
            }
        }
        return true
    }
}
