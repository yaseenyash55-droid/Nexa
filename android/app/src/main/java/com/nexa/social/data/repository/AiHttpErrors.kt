package com.nexa.social.data.repository

import com.google.gson.JsonParser
import retrofit2.Response
import java.net.SocketTimeoutException
import java.net.UnknownHostException

class AiHttpException(
    val statusCode: Int,
    message: String
) : Exception(message)

object AiHttpErrors {

    const val OFFLINE_MESSAGE = "NEXA AI requires an internet connection."

    fun userMessageForStatus(statusCode: Int, detail: String? = null): String {
        return when (statusCode) {
            401 -> "Your session expired. Please sign in again."
            403 -> detail?.takeIf { it.isNotBlank() } ?: "You do not have access to this conversation."
            429 -> "Rate limit reached. Please try again shortly."
            502 -> "AI provider is unavailable. Please try again later."
            503 -> "NEXA AI is currently unavailable."
            504 -> "The AI request timed out. Please try again."
            else -> detail?.takeIf { it.isNotBlank() } ?: "Request failed ($statusCode)"
        }
    }

    fun parseProblemDetail(rawBody: String?): String? {
        if (rawBody.isNullOrBlank()) return null
        return try {
            val json = JsonParser.parseString(rawBody).asJsonObject
            json.get("detail")?.asString
                ?: json.getAsJsonObject("error")?.get("message")?.asString
                ?: json.get("message")?.asString
                ?: json.get("title")?.asString
        } catch (_: Exception) {
            null
        }
    }

    fun fromResponse(response: Response<*>): AiHttpException {
        val raw = try {
            response.errorBody()?.string()
        } catch (_: Exception) {
            null
        }
        val detail = parseProblemDetail(raw)
        val message = userMessageForStatus(response.code(), detail)
        return AiHttpException(response.code(), message)
    }

    fun fromThrowable(error: Throwable): String {
        if (error is AiHttpException) return error.message ?: userMessageForStatus(error.statusCode)
        val message = error.message.orEmpty()
        return when {
            error is UnknownHostException ||
                error is SocketTimeoutException ||
                message.contains("Unable to resolve host", ignoreCase = true) ||
                message.contains("Failed to connect", ignoreCase = true) ||
                message.contains("timeout", ignoreCase = true) && message.contains("connect", ignoreCase = true) ||
                message.contains("No address associated", ignoreCase = true) -> OFFLINE_MESSAGE
            error is SocketTimeoutException || message.contains("timed out", ignoreCase = true) ->
                userMessageForStatus(504)
            else -> error.message?.takeIf { it.isNotBlank() } ?: "Failed to generate AI response"
        }
    }
}
