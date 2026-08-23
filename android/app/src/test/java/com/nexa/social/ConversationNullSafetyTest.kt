package com.nexa.social

import com.google.gson.Gson
import com.nexa.social.data.models.Conversation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ConversationNullSafetyTest {

    @Test
    fun `null conversation text fields never crash search or display`() {
        val conversation = Gson().fromJson(
            """{
              "otherUserId": 42,
              "username": null,
              "displayName": null,
              "profileImageUrl": null,
              "lastMessage": null,
              "lastMessageAt": null,
              "unreadCount": 0
            }""".trimIndent(),
            Conversation::class.java
        )

        assertEquals("user_42", conversation.resolvedUsername())
        assertEquals("user_42", conversation.resolvedDisplayName())
        assertEquals("Start a conversation", conversation.messagePreview())
        assertTrue(conversation.matchesSearch("user_42"))
        assertFalse(conversation.matchesSearch("missing"))
    }

    @Test
    fun `search matches available conversation fields`() {
        val conversation = Conversation(
            otherUserId = 7,
            username = "wanda",
            displayName = "Wanda Maximoff",
            profileImageUrl = null,
            lastMessage = "Hello from Nexa",
            lastMessageAt = null
        )

        assertTrue(conversation.matchesSearch("maximoff"))
        assertTrue(conversation.matchesSearch("wanda"))
        assertTrue(conversation.matchesSearch("hello"))
    }

    @Test
    fun `legacy postgres nested conversation contract remains readable during rollout`() {
        val conversation = Gson().fromJson(
            """{
              "partnerId": 821,
              "user": {
                "userId": 821,
                "username": "leon_yash",
                "displayName": "Yash",
                "profileImageUrl": "https://cdn.nexa.social/leon.png"
              },
              "lastMessage": "hi",
              "lastMessageAt": "2026-08-23T13:05:21.829Z",
              "unreadCount": 1
            }""".trimIndent(),
            Conversation::class.java
        )

        assertEquals(821, conversation.otherUserId)
        assertEquals("leon_yash", conversation.resolvedUsername())
        assertEquals("Yash", conversation.resolvedDisplayName())
        assertEquals("https://cdn.nexa.social/leon.png", conversation.resolvedProfileImageUrl())
        assertTrue(conversation.matchesSearch("Yash"))
    }
}
