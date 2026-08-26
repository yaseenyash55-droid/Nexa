package com.nexa.social.data.api

import com.nexa.social.data.models.ApiResponse
import com.nexa.social.data.models.Group
import com.nexa.social.data.models.GroupMember
import com.nexa.social.data.models.GroupMessage
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

interface GroupApi {
    @GET("groups")
    suspend fun getUserGroups(): Response<ApiResponse<List<Group>>>

    @POST("groups")
    suspend fun createGroup(
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): Response<ApiResponse<Group>>

    @GET("groups/{id}")
    suspend fun getGroupById(
        @Path("id") groupId: Int
    ): Response<ApiResponse<Group>>

    @GET("groups/{id}/members")
    suspend fun getGroupMembers(
        @Path("id") groupId: Int
    ): Response<ApiResponse<List<GroupMember>>>

    @POST("groups/{id}/members")
    suspend fun addGroupMembers(
        @Path("id") groupId: Int,
        @Body body: Map<String, List<Int>>
    ): Response<ApiResponse<List<GroupMember>>>

    @DELETE("groups/{id}/members/{userId}")
    suspend fun removeGroupMember(
        @Path("id") groupId: Int,
        @Path("userId") userId: Int
    ): Response<ApiResponse<Map<String, Any>>>

    @POST("groups/{id}/leave")
    suspend fun leaveGroup(
        @Path("id") groupId: Int
    ): Response<ApiResponse<Map<String, Any>>>

    @PATCH("groups/{id}/settings")
    suspend fun updateGroupSettings(
        @Path("id") groupId: Int,
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): Response<ApiResponse<Group>>

    @DELETE("groups/{id}")
    suspend fun deleteGroup(
        @Path("id") groupId: Int
    ): Response<ApiResponse<Map<String, Any>>>

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
