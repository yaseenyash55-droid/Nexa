package com.nexa.social.data.api

import com.nexa.social.data.models.ApiResponse
import com.nexa.social.data.models.Broadcast
import com.nexa.social.data.models.Message
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

interface MessageApi {
    @GET("messages/{userId}")
    suspend fun getMessagesWithUser(
        @Path("userId") userId: Int
    ): Response<ApiResponse<List<Message>>>

    @POST("messages/{userId}")
    suspend fun sendMessage(
        @Path("userId") userId: Int,
        @Body body: Map<String, String>
    ): Response<ApiResponse<Message>>

    @PATCH("messages/{messageId}/read")
    suspend fun markMessageRead(
        @Path("messageId") messageId: Int
    ): Response<ApiResponse<Map<String, Boolean>>>

    @POST("broadcasts")
    suspend fun createBroadcast(
        @Body body: Map<String, Any>
    ): Response<ApiResponse<Map<String, Any>>>

    @GET("broadcasts")
    suspend fun getUserBroadcasts(): Response<ApiResponse<List<Broadcast>>>
}
