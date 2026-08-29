package com.nexa.social.data.api

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
import com.nexa.social.data.models.ApiResponse
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Streaming

interface AiApi {

    @GET("ai/status")
    suspend fun getStatus(): Response<ApiResponse<AiStatus>>

    @POST("ai/chat")
    suspend fun sendChatMessage(
        @Body request: AiChatRequest
    ): Response<ApiResponse<AiChatResponse>>

    @Streaming
    @POST("ai/chat/stream")
    suspend fun streamChatMessage(
        @Body request: AiChatRequest
    ): Response<ResponseBody>

    @POST("ai/writing")
    suspend fun assistWriting(
        @Body request: AiWritingRequest
    ): Response<ApiResponse<AiWritingResponse>>

    @POST("ai/conversations")
    suspend fun createConversation(
        @Body request: AiCreateConversationRequest = AiCreateConversationRequest()
    ): Response<ApiResponse<AiConversation>>

    @GET("ai/conversations")
    suspend fun getConversations(): Response<ApiResponse<List<AiConversation>>>

    @GET("ai/conversations/{id}")
    suspend fun getConversation(
        @Path("id") conversationId: Int
    ): Response<ApiResponse<AiConversationDetails>>

    @DELETE("ai/conversations/{id}")
    suspend fun deleteConversation(
        @Path("id") conversationId: Int
    ): Response<ApiResponse<Unit>>

    @GET("ai/preferences")
    suspend fun getPreferences(): Response<ApiResponse<AiPreference>>

    @PUT("ai/preferences")
    suspend fun updatePreferences(
        @Body request: AiUpdatePreferencesRequest
    ): Response<ApiResponse<AiPreference>>

    @GET("ai/memories")
    suspend fun getMemories(): Response<ApiResponse<List<AiMemory>>>

    @POST("ai/memories")
    suspend fun createMemory(
        @Body request: AiCreateMemoryRequest
    ): Response<ApiResponse<AiMemory>>

    @DELETE("ai/memories")
    suspend fun clearAllMemories(): Response<ApiResponse<Unit>>

    @DELETE("ai/memories/{id}")
    suspend fun deleteMemory(
        @Path("id") memoryId: Int
    ): Response<ApiResponse<Unit>>
}
