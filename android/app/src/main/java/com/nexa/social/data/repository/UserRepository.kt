package com.nexa.social.data.repository

import com.nexa.social.NexaApiClient
import com.nexa.social.data.models.User

class UserRepository {
    suspend fun getProfile(username: String): Result<User> {
        return try {
            val response = NexaApiClient.userApi.getProfileByUsername(username)
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Profile not found"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun searchUsers(query: String): Result<List<User>> {
        return try {
            val response = NexaApiClient.userApi.searchUsers(query)
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Search failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
