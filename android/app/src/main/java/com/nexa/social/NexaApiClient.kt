package com.nexa.social

import android.content.Context
import com.nexa.social.data.api.AiApi
import com.nexa.social.data.api.AuthApi
import com.nexa.social.data.api.AuthInterceptor
import com.nexa.social.data.api.CallApi
import com.nexa.social.data.api.GroupApi
import com.nexa.social.data.api.MessageApi
import com.nexa.social.data.api.MusicApi
import com.nexa.social.data.api.PostApi
import com.nexa.social.data.api.SpotifyApi
import com.nexa.social.data.api.StoryApi
import com.nexa.social.data.api.TokenAuthenticator
import com.nexa.social.data.api.UserApi
import com.nexa.social.utils.TokenManager
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object NexaApiClient {
    val BASE_URL: String = BuildConfig.API_BASE_URL

    @Volatile
    private var tokenManager: TokenManager? = null

    @Volatile
    private var isInitialized = false

    fun init(context: Context) {
        if (!isInitialized || tokenManager == null) {
            synchronized(this) {
                if (!isInitialized || tokenManager == null) {
                    try {
                        tokenManager = TokenManager(context.applicationContext)
                        isInitialized = true
                    } catch (_: Exception) {
                        // Fail closed: tokenManager remains null, isInitialized remains false to allow recovery
                        tokenManager = null
                        isInitialized = false
                    }
                }
            }
        }
    }

    private fun createLoggingInterceptor(): HttpLoggingInterceptor {
        val logging = HttpLoggingInterceptor { message ->
            // Redact tokens, passwords, and sensitive headers in logcat
            val sanitized = message
                .replace(Regex("(?i)(authorization:\\s*bearer\\s+)[a-zA-Z0-9_.-]+"), "$1[REDACTED]")
                .replace(Regex("(?i)(token\"?\\s*:\\s*\"?)[^\",\\s]+"), "$1[REDACTED]")
                .replace(Regex("(?i)(password\"?\\s*:\\s*\"?)[^\",\\s]+"), "$1[REDACTED]")
                .replace(Regex("(?i)(set-cookie:\\s*)[^\r\n]+"), "$1[REDACTED]")
            android.util.Log.d("NexaHttp", sanitized)
        }

        logging.level = if (BuildConfig.DEBUG) {
            HttpLoggingInterceptor.Level.BASIC
        } else {
            HttpLoggingInterceptor.Level.NONE
        }

        return logging
    }

    val retrofit: Retrofit by lazy {
        val okHttpClientBuilder = OkHttpClient.Builder()
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(300, TimeUnit.SECONDS)
            .writeTimeout(300, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .addInterceptor(createLoggingInterceptor())

        tokenManager?.let { tm ->
            okHttpClientBuilder
                .addInterceptor(AuthInterceptor(tm))
                .authenticator(TokenAuthenticator(tm, BASE_URL))
        }

        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClientBuilder.build())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val authApi: AuthApi by lazy { retrofit.create(AuthApi::class.java) }
    val postApi: PostApi by lazy { retrofit.create(PostApi::class.java) }
    val messageApi: MessageApi by lazy { retrofit.create(MessageApi::class.java) }
    val groupApi: GroupApi by lazy { retrofit.create(GroupApi::class.java) }
    val userApi: UserApi by lazy { retrofit.create(UserApi::class.java) }
    val storyApi: StoryApi by lazy { retrofit.create(StoryApi::class.java) }
    val callApi: CallApi by lazy { retrofit.create(CallApi::class.java) }
    val musicApi: MusicApi by lazy { retrofit.create(MusicApi::class.java) }
    val spotifyApi: SpotifyApi by lazy { retrofit.create(SpotifyApi::class.java) }
    val aiApi: AiApi by lazy { retrofit.create(AiApi::class.java) }
}
