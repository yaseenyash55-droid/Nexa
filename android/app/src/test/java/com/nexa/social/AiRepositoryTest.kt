package com.nexa.social

import com.google.gson.Gson
import com.nexa.social.data.api.AiApi
import com.nexa.social.data.models.*
import com.nexa.social.data.repository.AiRepository
import com.nexa.social.data.repository.AiStreamListener
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class AiRepositoryTest {

    private val gson = Gson()

    // Stub AiApi for testing
    private class FakeAiApi : AiApi {
        var statusToReturn: Response<ApiResponse<AiStatus>> = Response.success(
            ApiResponse(
                data = AiStatus(enabled = true, provider = "groq", model = "llama-3.3-70b-versatile"),
                message = "Success",
                error = null
            )
        )

        var conversationsToReturn: Response<ApiResponse<List<AiConversation>>> = Response.success(
            ApiResponse(
                data = listOf(
                    AiConversation(conversationId = 1, userId = 42, title = "Kotlin Coding Help", createdAt = "2026-08-28T10:00:00Z")
                ),
                message = "Success",
                error = null
            )
        )

        var conversationDetailsToReturn: Response<ApiResponse<AiConversationDetails>> = Response.success(
            ApiResponse(
                data = AiConversationDetails(
                    conversation = AiConversation(conversationId = 1, userId = 42, title = "Kotlin Coding Help"),
                    messages = listOf(
                        AiMessage(messageId = 101, conversationId = 1, role = "user", content = "Explain Flows"),
                        AiMessage(messageId = 102, conversationId = 1, role = "assistant", content = "Kotlin Flows are asynchronous cold streams.")
                    )
                ),
                message = "Success",
                error = null
            )
        )

        var sseStreamBody: String = "event: chunk\ndata: {\"chunk\":\"Hello\"}\n\nevent: chunk\ndata: {\"chunk\":\" world!\"}\n\nevent: complete\ndata: {\"message\":\"Hello world!\",\"conversationId\":1}\n\n"

        override suspend fun getStatus(): Response<ApiResponse<AiStatus>> = statusToReturn

        override suspend fun sendChatMessage(request: AiChatRequest): Response<ApiResponse<AiChatResponse>> {
            return Response.success(
                ApiResponse(
                    data = AiChatResponse(message = "Direct response", conversationId = request.conversationId ?: 1, provider = "groq", model = "llama-3.3-70b"),
                    message = "Success",
                    error = null
                )
            )
        }

        override suspend fun streamChatMessage(request: AiChatRequest): Response<okhttp3.ResponseBody> {
            val responseBody = sseStreamBody.toResponseBody("text/event-stream".toMediaTypeOrNull())
            return Response.success(responseBody)
        }

        override suspend fun assistWriting(request: AiWritingRequest): Response<ApiResponse<AiWritingResponse>> {
            return Response.success(
                ApiResponse(
                    data = AiWritingResponse(result = "Polished text", operation = request.operation, originalText = request.text, model = "llama-3.3-70b"),
                    message = "Success",
                    error = null
                )
            )
        }

        override suspend fun createConversation(request: AiCreateConversationRequest): Response<ApiResponse<AiConversation>> {
            return Response.success(
                ApiResponse(
                    data = AiConversation(conversationId = 2, userId = 42, title = request.title ?: "New Chat"),
                    message = "Success",
                    error = null
                )
            )
        }

        override suspend fun getConversations(): Response<ApiResponse<List<AiConversation>>> = conversationsToReturn

        override suspend fun getConversation(conversationId: Int): Response<ApiResponse<AiConversationDetails>> = conversationDetailsToReturn

        override suspend fun deleteConversation(conversationId: Int): Response<ApiResponse<Unit>> {
            return Response.success(ApiResponse(data = Unit, message = "Deleted", error = null))
        }

        override suspend fun getPreferences(): Response<ApiResponse<AiPreference>> {
            return Response.success(
                ApiResponse(
                    data = AiPreference(userId = 42, personalizationEnabled = true, preferredLanguage = "en", responseLength = "concise", writingTone = "friendly"),
                    message = "Success",
                    error = null
                )
            )
        }

        override suspend fun updatePreferences(request: AiUpdatePreferencesRequest): Response<ApiResponse<AiPreference>> {
            return Response.success(
                ApiResponse(
                    data = AiPreference(userId = 42, personalizationEnabled = request.personalizationEnabled ?: false, preferredLanguage = request.preferredLanguage ?: "en", responseLength = request.responseLength ?: "balanced", writingTone = request.writingTone ?: "friendly"),
                    message = "Updated",
                    error = null
                )
            )
        }

        override suspend fun getMemories(): Response<ApiResponse<List<AiMemory>>> {
            return Response.success(
                ApiResponse(
                    data = listOf(
                        AiMemory(memoryId = 5, userId = 42, keyName = "favorite_language", content = "Kotlin", category = "preferences")
                    ),
                    message = "Success",
                    error = null
                )
            )
        }

        override suspend fun createMemory(request: AiCreateMemoryRequest): Response<ApiResponse<AiMemory>> {
            return Response.success(
                ApiResponse(
                    data = AiMemory(memoryId = 6, userId = 42, keyName = request.keyName, content = request.content, category = request.category),
                    message = "Saved",
                    error = null
                )
            )
        }

        override suspend fun clearAllMemories(): Response<ApiResponse<Unit>> {
            return Response.success(ApiResponse(data = Unit, message = "Cleared", error = null))
        }

        override suspend fun deleteMemory(memoryId: Int): Response<ApiResponse<Unit>> {
            return Response.success(ApiResponse(data = Unit, message = "Deleted", error = null))
        }
    }

    @Test
    fun testAiModelsSerialization() {
        val chatReq = AiChatRequest(message = "Hello NEXA AI", conversationId = 10)
        val jsonReq = gson.toJson(chatReq)
        assertTrue(jsonReq.contains("\"message\":\"Hello NEXA AI\""))
        assertTrue(jsonReq.contains("\"conversationId\":10"))

        val chatRespJson = """{"message":"Hi there!","conversationId":10,"provider":"groq","model":"llama-3.3-70b"}"""
        val chatResp = gson.fromJson(chatRespJson, AiChatResponse::class.java)
        assertEquals("Hi there!", chatResp.message)
        assertEquals(10, chatResp.conversationId)
        assertEquals("groq", chatResp.provider)

        val prefJson = """{"userId":42,"personalizationEnabled":true,"preferredLanguage":"en","responseLength":"concise","writingTone":"friendly"}"""
        val pref = gson.fromJson(prefJson, AiPreference::class.java)
        assertEquals(42, pref.userId)
        assertTrue(pref.personalizationEnabled)
        assertEquals("concise", pref.responseLength)
    }

    @Test
    fun testGetStatusAndConversations() = runTest {
        val fakeApi = FakeAiApi()
        val repo = AiRepository(fakeApi, gson)

        val statusResult = repo.getStatus()
        assertTrue(statusResult.isSuccess)
        val status = statusResult.getOrNull()
        assertNotNull(status)
        assertTrue(status!!.enabled)
        assertEquals("groq", status.provider)

        val convsResult = repo.getConversations()
        assertTrue(convsResult.isSuccess)
        val convs = convsResult.getOrNull()
        assertNotNull(convs)
        assertEquals(1, convs!!.size)
        assertEquals("Kotlin Coding Help", convs[0].title)

        val detailsResult = repo.getConversation(1)
        assertTrue(detailsResult.isSuccess)
        val details = detailsResult.getOrNull()
        assertNotNull(details)
        assertEquals(2, details!!.messages.size)
        assertEquals("user", details.messages[0].role)
        assertEquals("assistant", details.messages[1].role)
    }

    @Test
    fun testAiPreferencesAndMemories() = runTest {
        val fakeApi = FakeAiApi()
        val repo = AiRepository(fakeApi, gson)

        val getPrefResult = repo.getPreferences()
        assertTrue(getPrefResult.isSuccess)
        assertEquals("concise", getPrefResult.getOrNull()?.responseLength)

        val updatePrefResult = repo.updatePreferences(
            AiUpdatePreferencesRequest(responseLength = "detailed", writingTone = "technical")
        )
        assertTrue(updatePrefResult.isSuccess)
        assertEquals("detailed", updatePrefResult.getOrNull()?.responseLength)

        val memoriesResult = repo.getMemories()
        assertTrue(memoriesResult.isSuccess)
        assertEquals(1, memoriesResult.getOrNull()?.size)
        assertEquals("favorite_language", memoriesResult.getOrNull()?.get(0)?.keyName)

        val createMemoryResult = repo.createMemory("editor_choice", "Android Studio", "preferences")
        assertTrue(createMemoryResult.isSuccess)
        assertEquals("editor_choice", createMemoryResult.getOrNull()?.keyName)
    }

    @Test
    fun testSseStreamingParsing() = runTest {
        val fakeApi = FakeAiApi()
        val repo = AiRepository(fakeApi, gson)

        val chunksReceived = mutableListOf<String>()
        var completedText = ""
        var completedConvId = 0
        var errorEncountered: Throwable? = null

        val listener = object : AiStreamListener {
            override fun onChunk(chunk: String) {
                chunksReceived.add(chunk)
            }

            override fun onComplete(fullText: String, conversationId: Int) {
                completedText = fullText
                completedConvId = conversationId
            }

            override fun onError(error: Throwable) {
                errorEncountered = error
            }
        }

        val cancellable = repo.streamChat(
            scope = this,
            message = "Hello",
            conversationId = 1,
            ioDispatcher = Dispatchers.Unconfined,
            mainDispatcher = Dispatchers.Unconfined,
            listener = listener
        )
        cancellable.job.join()

        assertNotNull(cancellable)
        assertNull(errorEncountered)
        assertEquals(listOf("Hello", " world!"), chunksReceived)
        assertEquals("Hello world!", completedText)
        assertEquals(1, completedConvId)
    }

    @Test
    fun testNexaAiMentionInDisplayMessage() {
        val aiMessage = Message(
            messageId = 555,
            senderId = null,
            receiverId = 42,
            content = "🤖 **NEXA AI**: Here is your summary.",
            aiAgent = "nexa"
        )
        val isAi = aiMessage.aiAgent == "nexa" || aiMessage.senderId == null || aiMessage.content.startsWith("🤖 **NEXA AI**")
        val displayMsg = DisplayMessage(
            id = aiMessage.messageId,
            senderId = aiMessage.senderId,
            senderName = if (isAi) "NEXA AI" else "Sender",
            content = aiMessage.content,
            isSelf = if (isAi) false else (aiMessage.senderId == 42),
            timestamp = "2026-08-28T12:00:00Z",
            isRead = false,
            isAi = isAi,
            aiAgent = aiMessage.aiAgent
        )

        assertTrue(displayMsg.isAi)
        assertEquals("NEXA AI", displayMsg.senderName)
        assertFalse(displayMsg.isSelf)
        assertNull(displayMsg.senderId)
    }
}
