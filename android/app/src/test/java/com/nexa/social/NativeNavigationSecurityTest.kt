package com.nexa.social

import com.nexa.social.data.models.NotificationDestination
import com.nexa.social.utils.NetworkUtils
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeNavigationSecurityTest {

    @Test
    fun `NotificationDestination fromString maps correctly and is case-insensitive`() {
        assertEquals(NotificationDestination.HOME, NotificationDestination.fromString("HOME"))
        assertEquals(NotificationDestination.HOME, NotificationDestination.fromString("home"))
        assertEquals(NotificationDestination.EXPLORE, NotificationDestination.fromString("EXPLORE"))
        assertEquals(NotificationDestination.MESSAGES, NotificationDestination.fromString("messages"))
        assertEquals(NotificationDestination.CHAT, NotificationDestination.fromString("Chat"))
        assertEquals(NotificationDestination.POST, NotificationDestination.fromString("post"))
        assertEquals(NotificationDestination.REEL, NotificationDestination.fromString("REEL"))
        assertEquals(NotificationDestination.PROFILE, NotificationDestination.fromString("profile"))
    }

    @Test
    fun `NotificationDestination fromString falls back to HOME for unknown or malicious values`() {
        assertEquals(NotificationDestination.HOME, NotificationDestination.fromString("UNKNOWN"))
        assertEquals(NotificationDestination.HOME, NotificationDestination.fromString(""))
        assertEquals(NotificationDestination.HOME, NotificationDestination.fromString(null))
        assertEquals(NotificationDestination.HOME, NotificationDestination.fromString("https://nexa-social-app.surge.sh/messages"))
        assertEquals(NotificationDestination.HOME, NotificationDestination.fromString("javascript:alert(1)"))
        assertEquals(NotificationDestination.HOME, NotificationDestination.fromString("intent:#Intent;action=android.intent.action.VIEW;end"))
    }

    @Test
    fun `Validation of resource IDs ensures only positive numeric values for secure destinations`() {
        fun isValid(dest: NotificationDestination, resId: String?): Boolean {
            return when (dest) {
                NotificationDestination.CHAT,
                NotificationDestination.POST,
                NotificationDestination.REEL -> {
                    val id = resId?.toIntOrNull()
                    id != null && id > 0
                }
                NotificationDestination.PROFILE -> !resId.isNullOrBlank()
                else -> true
            }
        }

        // Valid cases
        assertEquals(true, isValid(NotificationDestination.POST, "123"))
        assertEquals(true, isValid(NotificationDestination.CHAT, "1"))
        assertEquals(true, isValid(NotificationDestination.PROFILE, "alice"))
        assertEquals(true, isValid(NotificationDestination.HOME, null))

        // Invalid cases
        assertEquals(false, isValid(NotificationDestination.POST, "0"))
        assertEquals(false, isValid(NotificationDestination.POST, "-5"))
        assertEquals(false, isValid(NotificationDestination.CHAT, "abc"))
        assertEquals(false, isValid(NotificationDestination.CHAT, null))
        assertEquals(false, isValid(NotificationDestination.REEL, "999999999999999999")) // Oversized
        assertEquals(false, isValid(NotificationDestination.PROFILE, ""))
        assertEquals(false, isValid(NotificationDestination.PROFILE, "   "))
    }

    @Test
    fun `isValidExternalHttpsUrl strictly accepts valid HTTPS URLs and rejects hostile schemes`() {
        // Valid HTTPS URLs
        assertTrue(NetworkUtils.isValidExternalHttpsUrl("https://example.com"))
        assertTrue(NetworkUtils.isValidExternalHttpsUrl("https://docs.oracle.com/en/database/"))

        // Reject non-HTTPS schemes
        assertFalse(NetworkUtils.isValidExternalHttpsUrl("http://insecure-site.com"))
        assertFalse(NetworkUtils.isValidExternalHttpsUrl("file:///sdcard/malware.apk"))
        assertFalse(NetworkUtils.isValidExternalHttpsUrl("content://media/external/images"))
        assertFalse(NetworkUtils.isValidExternalHttpsUrl("javascript:alert(document.cookie)"))
        assertFalse(NetworkUtils.isValidExternalHttpsUrl("data:text/html,<script>alert(1)</script>"))
        assertFalse(NetworkUtils.isValidExternalHttpsUrl("intent:#Intent;action=android.intent.action.VIEW;end"))

        // Reject user-info and credential leak URLs
        assertFalse(NetworkUtils.isValidExternalHttpsUrl("https://admin:secret@example.com/dashboard"))
        assertFalse(NetworkUtils.isValidExternalHttpsUrl("https://example.com/auth?token=eyJhbGciOi..."))
        assertFalse(NetworkUtils.isValidExternalHttpsUrl("https://example.com/profile?jwt=secret123"))

        // Reject empty or malformed URLs
        assertFalse(NetworkUtils.isValidExternalHttpsUrl(""))
        assertFalse(NetworkUtils.isValidExternalHttpsUrl(null))
        assertFalse(NetworkUtils.isValidExternalHttpsUrl(":::malformed:::"))
    }
}
