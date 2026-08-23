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
}
