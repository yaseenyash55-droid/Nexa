package com.nexa.social.data.api

import com.nexa.social.data.models.ApiResponse
import com.nexa.social.data.models.Group
import com.nexa.social.data.models.GroupMessage
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface GroupApi {
    @GET("groups")
    suspend fun getUserGroups(): Response<ApiResponse<List<Group>>>

    @POST("groups")
    suspend fun createGroup(
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): Response<ApiResponse<Group>>

    @GET("groups/{id}/messages")
    suspend fun getGroupMessages(
        @Path("id") groupId: Int
    ): Response<ApiResponse<List<GroupMessage>>>

    @POST("groups/{id}/messages")
    suspend fun sendGroupMessage(
        @Path("id") groupId: Int,
        @Body body: Map<String, String>
    ): Response<ApiResponse<GroupMessage>>
}
