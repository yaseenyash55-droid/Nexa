package com.nexa.social.data.repository

import com.nexa.social.NexaApiClient
import com.nexa.social.data.models.Conversation
import com.nexa.social.data.models.Message
import com.nexa.social.data.models.SendDirectMessageRequest

class MessageRepository {
    suspend fun getConversations(): Result<List<Conversation>> {
        return try {
            val response = NexaApiClient.messageApi.getConversations()
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to fetch conversations"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getMessages(userId: Int): Result<List<Message>> {
        return try {
            val response = NexaApiClient.messageApi.getMessagesWithUser(userId)
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to fetch messages"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun sendMessage(receiverId: Int, content: String): Result<Message> {
        return try {
            val response = NexaApiClient.messageApi.sendMessage(SendDirectMessageRequest(receiverId, content))
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!)
            } else {
                Result.failure(Exception(response.body()?.message ?: "Failed to send message"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
