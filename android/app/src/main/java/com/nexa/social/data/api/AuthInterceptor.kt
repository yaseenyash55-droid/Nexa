package com.nexa.social.data.api

import com.nexa.social.utils.TokenManager
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(private val tokenManager: TokenManager) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val builder = originalRequest.newBuilder()

        val token = tokenManager.accessToken
        if (!token.isNullOrEmpty() && originalRequest.header("Authorization") == null) {
            builder.addHeader("Authorization", "Bearer $token")
        }

        return chain.proceed(builder.build())
    }
}
