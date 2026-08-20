package com.nexa.social.utils

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import java.net.URI

object NetworkUtils {
    fun isNetworkAvailable(context: Context): Boolean {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return false
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    fun isValidExternalHttpsUrl(urlString: String?): Boolean {
        if (urlString.isNullOrBlank()) return false
        return try {
            val uri = URI(urlString)
            val scheme = uri.scheme?.lowercase() ?: return false
            if (scheme != "https") return false

            val host = uri.host ?: return false
            if (host.isBlank() || uri.userInfo != null) return false

            // Reject URLs leaking sensitive authentication parameters
            val rawQuery = uri.rawQuery?.lowercase() ?: ""
            if (rawQuery.contains("token=") || rawQuery.contains("jwt=") || rawQuery.contains("secret=") || rawQuery.contains("password=")) {
                return false
            }

            true
        } catch (_: Exception) {
            false
        }
    }
}
