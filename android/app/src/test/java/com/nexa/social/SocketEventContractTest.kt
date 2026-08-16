package com.nexa.social

import com.google.gson.Gson
import com.nexa.social.data.models.GroupMessage
import com.nexa.social.data.models.Message
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class SocketEventContractTest {

    private val gson = Gson()

    @Test
    fun `parses message created payload properly`() {
        val payload = """
            {
                "messageId": 201,
                "senderId": 5,
                "receiverId": 10,
                "content": "Real-time socket message",
                "isRead": false,
                "createdAt": "2026-08-16T12:00:00Z"
            }
        """.trimIndent()

        val msg = gson.fromJson(payload, Message::class.java)
        assertNotNull(msg)
        assertEquals(201, msg.messageId)
        assertEquals(5, msg.senderId)
        assertEquals(10, msg.receiverId)
        assertEquals("Real-time socket message", msg.content)
    }

    @Test
    fun `parses group message created payload properly`() {
        val payload = """
            {
                "messageId": 301,
                "groupId": 7,
                "senderId": 12,
                "sender": {
                    "userId": 12,
                    "username": "sarah",
                    "displayName": "Sarah Connor",
                    "profileImageUrl": null
                },
                "content": "Welcome to the group!",
                "createdAt": "2026-08-16T12:05:00Z"
            }
        """.trimIndent()

        val groupMsg = gson.fromJson(payload, GroupMessage::class.java)
        assertNotNull(groupMsg)
        assertEquals(301, groupMsg.messageId)
        assertEquals(7, groupMsg.groupId)
        assertEquals("Sarah Connor", groupMsg.sender.displayName)
    }

    @Test
    fun `creates valid typing event JSON objects`() {
        val startJson = JSONObject().apply {
            put("receiverId", 42)
        }
        assertEquals(42, startJson.getInt("receiverId"))

        val stopJson = JSONObject().apply {
            put("receiverId", 42)
        }
        assertEquals(42, stopJson.getInt("receiverId"))
    }
}
