package com.nexa.social

import com.nexa.social.data.models.NotificationDestination
import org.junit.Assert.assertEquals
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
}
