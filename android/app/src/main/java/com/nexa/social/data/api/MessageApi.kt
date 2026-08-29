package com.nexa.social.data.api

import com.nexa.social.data.models.ApiResponse
import com.nexa.social.data.models.Broadcast
import com.nexa.social.data.models.Conversation
import com.nexa.social.data.models.MarkReadResponse
import com.nexa.social.data.models.Message
import com.nexa.social.data.models.SendDirectMessageRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface MessageApi {
    @GET("conversations")
    suspend fun getConversations(): Response<ApiResponse<List<Conversation>>>

    @GET("messages/{userId}")
    suspend fun getMessagesWithUser(
        @Path("userId") userId: Int
    ): Response<ApiResponse<List<Message>>>

    @POST("messages")
    suspend fun sendMessage(
        @Body request: SendDirectMessageRequest
    ): Response<ApiResponse<Message>>

    @POST("messages/{messageId}/read")
    suspend fun markMessageRead(
        @Path("messageId") messageId: Int
    ): Response<ApiResponse<MarkReadResponse>>

    @POST("broadcasts")
    suspend fun createBroadcast(
        @Body request: com.nexa.social.data.models.CreateBroadcastRequest
    ): Response<ApiResponse<Map<String, Any>>>

    @GET("broadcasts")
    suspend fun getUserBroadcasts(): Response<ApiResponse<List<Broadcast>>>

    @POST("messages/{messageId}/reactions")
    suspend fun addReaction(
        @Path("messageId") messageId: Int,
        @Body request: com.nexa.social.data.models.AddReactionRequest
    ): Response<ApiResponse<Message>>

    @retrofit2.http.DELETE("messages/{messageId}/reactions")
    suspend fun removeReaction(
        @Path("messageId") messageId: Int
    ): Response<ApiResponse<Message>>

    @retrofit2.http.PUT("messages/{messageId}")
    suspend fun editMessage(
        @Path("messageId") messageId: Int,
        @Body request: com.nexa.social.data.models.EditMessageRequest
    ): Response<ApiResponse<Message>>

    @retrofit2.http.DELETE("messages/{messageId}")
    suspend fun unsendMessage(
        @Path("messageId") messageId: Int
    ): Response<ApiResponse<Unit>>
}
