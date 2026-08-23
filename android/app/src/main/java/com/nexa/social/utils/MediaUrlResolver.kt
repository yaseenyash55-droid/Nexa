package com.nexa.social.utils

import com.nexa.social.NexaApiClient

object MediaUrlResolver {
    fun resolve(url: String?): String? {
        if (url.isNullOrBlank()) return null
        if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("content://") || url.startsWith("file://")) {
            return url
        }
        val base = NexaApiClient.BASE_URL.removeSuffix("/api").removeSuffix("/api/")
        val path = if (url.startsWith("/")) url else "/$url"
        return "$base$path"
    }
}
