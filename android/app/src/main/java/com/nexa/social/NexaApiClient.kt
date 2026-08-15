package com.nexa.social

import android.content.Context
import com.nexa.social.data.api.AuthApi
import com.nexa.social.data.api.AuthInterceptor
import com.nexa.social.data.api.GroupApi
import com.nexa.social.data.api.MessageApi
import com.nexa.social.data.api.PostApi
import com.nexa.social.data.api.TokenAuthenticator
import com.nexa.social.utils.TokenManager
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object NexaApiClient {
    const val BASE_URL = "https://nexa-backend-in6s.onrender.com/api/"

    private var tokenManager: TokenManager? = null

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    fun init(context: Context) {
        tokenManager = TokenManager(context.applicationContext)
    }

    val retrofit: Retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(
                tokenManager?.let { tm ->
                    OkHttpClient.Builder()
                        .connectTimeout(30, TimeUnit.SECONDS)
                        .readTimeout(30, TimeUnit.SECONDS)
                        .writeTimeout(30, TimeUnit.SECONDS)
                        .addInterceptor(AuthInterceptor(tm))
                        .authenticator(TokenAuthenticator(tm, BASE_URL))
                        .addInterceptor(loggingInterceptor)
                        .build()
                } ?: OkHttpClient.Builder()
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .readTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(30, TimeUnit.SECONDS)
                    .addInterceptor(loggingInterceptor)
                    .build()
            )
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val authApi: AuthApi by lazy { retrofit.create(AuthApi::class.java) }
    val postApi: PostApi by lazy { retrofit.create(PostApi::class.java) }
    val messageApi: MessageApi by lazy { retrofit.create(MessageApi::class.java) }
    val groupApi: GroupApi by lazy { retrofit.create(GroupApi::class.java) }
}
