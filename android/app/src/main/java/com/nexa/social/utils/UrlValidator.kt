package com.nexa.social.utils

import com.nexa.social.BuildConfig
import java.net.URI

object UrlValidator {

    val APPROVED_ORIGIN: String = BuildConfig.WEB_ORIGIN
    val APPROVED_HOST: String = try {
        URI(APPROVED_ORIGIN).host ?: "nexa-social-app.surge.sh"
    } catch (_: Exception) {
        "nexa-social-app.surge.sh"
    }

    /**
     * Validates whether a given URL belongs strictly to the approved canonical HTTPS origin.
     * Rejects HTTP, hostile lookalikes, query confusion, userInfo confusion, and non-web schemes.
     */
    fun isApprovedOrigin(url: String?): Boolean {
        if (url.isNullOrBlank()) return false

        return try {
            val trimmed = url.trim()
            val uri = URI(trimmed)

            // 1. Strict scheme check
            val scheme = uri.scheme
            if (scheme == null || !scheme.equals("https", ignoreCase = true)) {
                return false
            }

            // 2. Reject user-info (e.g. https://nexa-social-app.surge.sh@attacker.com)
            if (!uri.rawUserInfo.isNullOrEmpty()) {
                return false
            }

            // 3. Strict host equality (no subdomains or superdomains)
            val host = uri.host
            if (host == null || !host.equals(APPROVED_HOST, ignoreCase = true)) {
                return false
            }

            // 4. Port verification (default HTTPS port 443 or unassigned -1)
            val port = uri.port
            if (port != -1 && port != 443) {
                return false
            }

            true
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Safely resolves and canonicalizes a deep link or notification target URL.
     * If relative (e.g. "/messages"), attaches to the approved origin.
     * If absolute, must strictly match the approved origin; otherwise returns the approved home URL.
     */
    fun sanitizeTargetUrl(rawUrl: String?): String {
        if (rawUrl.isNullOrBlank()) {
            return APPROVED_ORIGIN
        }

        val trimmed = rawUrl.trim()

        // Handle relative paths safely
        if (trimmed.startsWith("/")) {
            val base = if (APPROVED_ORIGIN.endsWith("/")) APPROVED_ORIGIN.dropLast(1) else APPROVED_ORIGIN
            return base + trimmed
        }

        // Validate absolute URL
        return if (isApprovedOrigin(trimmed)) {
            trimmed
        } else {
            APPROVED_ORIGIN
        }
    }
}
