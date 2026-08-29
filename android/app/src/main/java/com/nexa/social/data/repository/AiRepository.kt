package com.nexa.social.data.repository

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.nexa.social.NexaApiClient
import com.nexa.social.data.api.AiApi
import com.nexa.social.data.models.AiChatRequest
import com.nexa.social.data.models.AiChatResponse
import com.nexa.social.data.models.AiConversation
import com.nexa.social.data.models.AiConversationDetails
import com.nexa.social.data.models.AiCreateConversationRequest
import com.nexa.social.data.models.AiCreateMemoryRequest
import com.nexa.social.data.models.AiMemory
import com.nexa.social.data.models.AiPreference
import com.nexa.social.data.models.AiStatus
import com.nexa.social.data.models.AiUpdatePreferencesRequest
import com.nexa.social.data.models.AiWritingRequest
import com.nexa.social.data.models.AiWritingResponse
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.ResponseBody
import java.io.BufferedReader
import java.io.InputStreamReader
import java.nio.charset.StandardCharsets

interface AiStreamListener {
    fun onChunk(chunk: String)
    fun onComplete(fullText: String, conversationId: Int)
    fun onError(error: Throwable)
}

interface CancellableStream {
    fun cancel()
}

class AiRepository(
    private val aiApi: AiApi = NexaApiClient.aiApi,
    private val gson: Gson = Gson()
) {

    suspend fun getStatus(): Result<AiStatus> = withContext(Dispatchers.IO) {
        try {
            val response = aiApi.getStatus()
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to get AI status (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getConversations(): Result<List<AiConversation>> = withContext(Dispatchers.IO) {
        try {
            val response = aiApi.getConversations()
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to load conversations (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getConversation(id: Int): Result<AiConversationDetails> = withContext(Dispatchers.IO) {
        try {
            val response = aiApi.getConversation(id)
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to load conversation details (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createConversation(title: String? = null): Result<AiConversation> = withContext(Dispatchers.IO) {
        try {
            val response = aiApi.createConversation(AiCreateConversationRequest(title))
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to create conversation (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteConversation(id: Int): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = aiApi.deleteConversation(id)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to delete conversation (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun sendMessage(message: String, conversationId: Int? = null): Result<AiChatResponse> = withContext(Dispatchers.IO) {
        try {
            val response = aiApi.sendChatMessage(AiChatRequest(message, conversationId))
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to send message (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun assistWriting(operation: String, text: String?, targetLanguage: String? = null): Result<AiWritingResponse> = withContext(Dispatchers.IO) {
        try {
            val response = aiApi.assistWriting(AiWritingRequest(operation, text, targetLanguage))
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to execute writing assistant (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getPreferences(): Result<AiPreference> = withContext(Dispatchers.IO) {
        try {
            val response = aiApi.getPreferences()
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to get AI preferences (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updatePreferences(req: AiUpdatePreferencesRequest): Result<AiPreference> = withContext(Dispatchers.IO) {
        try {
            val response = aiApi.updatePreferences(req)
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to update AI preferences (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getMemories(): Result<List<AiMemory>> = withContext(Dispatchers.IO) {
        try {
            val response = aiApi.getMemories()
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to get AI memories (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createMemory(keyName: String, content: String, category: String = "general"): Result<AiMemory> = withContext(Dispatchers.IO) {
        try {
            val response = aiApi.createMemory(AiCreateMemoryRequest(keyName, content, category))
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to create AI memory (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteMemory(id: Int): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = aiApi.deleteMemory(id)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to delete AI memory (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun clearAllMemories(): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = aiApi.clearAllMemories()
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to clear AI memories (${response.code()})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Start SSE streaming chat with Server-Sent Events parsing.
     * Returns a CancellableStream handle allowing immediate cancellation ("Stop Generation").
     */
    fun streamChat(
        scope: CoroutineScope,
        message: String,
        conversationId: Int? = null,
        ioDispatcher: CoroutineDispatcher = Dispatchers.IO,
        mainDispatcher: CoroutineDispatcher = Dispatchers.Main,
        listener: AiStreamListener
    ): CancellableStream {
        var responseBody: ResponseBody? = null
        val job: Job = scope.launch(ioDispatcher) {
            try {
                val response = aiApi.streamChatMessage(AiChatRequest(message, conversationId))
                if (!response.isSuccessful || response.body() == null) {
                    val errMsg = when (response.code()) {
                        401 -> "Authentication expired. Please log in again."
                        429 -> "Rate limit exceeded. Please wait a moment before sending another prompt."
                        502, 503 -> "AI service is currently unavailable. Please try again later."
                        504 -> "AI request timed out. Please try a shorter prompt."
                        else -> "Request failed with status ${response.code()}"
                    }
                    withContext(mainDispatcher) {
                        listener.onError(Exception(errMsg))
                    }
                    return@launch
                }

                responseBody = response.body()
                val inputStream = responseBody!!.byteStream()
                val reader = BufferedReader(InputStreamReader(inputStream, StandardCharsets.UTF_8))

                var currentEvent = "message"
                var currentData = StringBuilder()

                var line: String? = null
                while (isActive && reader.readLine().also { line = it } != null) {
                    val currentLine = line ?: break

                    if (currentLine.isEmpty()) {
                        // End of an SSE event block -> Dispatch
                        val dataStr = currentData.toString().trim()
                        if (dataStr.isNotEmpty()) {
                            dispatchSseEvent(currentEvent, dataStr, conversationId, mainDispatcher, listener)
                        }
                        currentEvent = "message"
                        currentData = StringBuilder()
                    } else if (currentLine.startsWith("event:")) {
                        currentEvent = currentLine.substringAfter("event:").trim()
                    } else if (currentLine.startsWith("data:")) {
                        val piece = currentLine.substringAfter("data:").trim()
                        if (currentData.isNotEmpty()) {
                            currentData.append("\n")
                        }
                        currentData.append(piece)
                    }
                }

                // If stream closed with buffered data
                val remainingData = currentData.toString().trim()
                if (remainingData.isNotEmpty()) {
                    dispatchSseEvent(currentEvent, remainingData, conversationId, mainDispatcher, listener)
                }
            } catch (e: CancellationException) {
                // User clicked Stop Generation -> Safe cancel
            } catch (e: Exception) {
                withContext(mainDispatcher) {
                    val userFriendlyError = when {
                        e.message?.contains("Unable to resolve host", ignoreCase = true) == true ||
                        e.message?.contains("Failed to connect", ignoreCase = true) == true ->
                            Exception("NEXA AI requires an active internet connection.", e)
                        else -> e
                    }
                    listener.onError(userFriendlyError)
                }
            } finally {
                try {
                    responseBody?.close()
                } catch (_: Exception) {}
            }
        }

        return object : CancellableStream {
            override val job: Job = job
            override fun cancel() {
                job.cancel()
                try {
                    responseBody?.close()
                } catch (_: Exception) {}
            }
        }
    }

    private suspend fun dispatchSseEvent(
        event: String,
        data: String,
        defaultConvId: Int?,
        mainDispatcher: CoroutineDispatcher,
        listener: AiStreamListener
    ) {
        when (event) {
            "chunk" -> {
                val chunkText = try {
                    val obj = gson.fromJson(data, JsonObject::class.java)
                    if (obj.has("chunk")) obj.get("chunk").asString else data
                } catch (_: Exception) {
                    data
                }
                withContext(mainDispatcher) {
                    listener.onChunk(chunkText)
                }
            }
            "complete" -> {
                var fullText = ""
                var convId = defaultConvId ?: 0
                try {
                    val obj = gson.fromJson(data, JsonObject::class.java)
                    if (obj.has("message")) fullText = obj.get("message").asString
                    if (obj.has("conversationId")) convId = obj.get("conversationId").asInt
                } catch (_: Exception) {
                    fullText = data
                }
                withContext(mainDispatcher) {
                    listener.onComplete(fullText, convId)
                }
            }
            "error" -> {
                val errorMsg = try {
                    val obj = gson.fromJson(data, JsonObject::class.java)
                    if (obj.has("error")) obj.get("error").asString else data
                } catch (_: Exception) {
                    data
                }
                withContext(mainDispatcher) {
                    listener.onError(Exception(errorMsg))
                }
            }
        }
    }
}
