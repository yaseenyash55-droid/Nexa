package com.nexa.social.utils

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Utility helper to properly initialize Android WebViews for WebRTC streaming,
 * strict HTTPS enforcement, media playback, and runtime permission validation.
 */
object NexaWebViewHelper {

    val REQUIRED_WEBRTC_PERMISSIONS: Array<String>
        get() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(
                Manifest.permission.CAMERA,
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.MODIFY_AUDIO_SETTINGS,
                Manifest.permission.BLUETOOTH_CONNECT
            )
        } else {
            arrayOf(
                Manifest.permission.CAMERA,
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.MODIFY_AUDIO_SETTINGS
            )
        }

    const val WEBRTC_PERMISSION_REQUEST_CODE = 4001

    /**
     * Checks if all required runtime permissions for WebRTC calling are granted.
     */
    fun hasWebRtcPermissions(context: Context): Boolean {
        return REQUIRED_WEBRTC_PERMISSIONS.all { permission ->
            ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
        }
    }

    /**
     * Requests runtime permissions via ActivityCompat if not already granted.
     */
    fun requestWebRtcPermissions(activity: Activity, requestCode: Int = WEBRTC_PERMISSION_REQUEST_CODE) {
        val missing = REQUIRED_WEBRTC_PERMISSIONS.filter { permission ->
            ContextCompat.checkSelfPermission(activity, permission) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(activity, missing.toTypedArray(), requestCode)
        }
    }

    /**
     * Configures a WebView for WebRTC media calling, DOM storage, and security.
     */
    @SuppressLint("SetJavaScriptEnabled")
    fun configureForWebRtc(webView: WebView, activity: Activity) {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false // Allows WebRTC audio/video to play automatically
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW // Enforce HTTPS
            useWideViewPort = true
            loadWithOverviewMode = true
        }

        webView.webChromeClient = NexaWebChromeClient(activity)
    }
}
