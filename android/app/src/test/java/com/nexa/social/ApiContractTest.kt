package com.nexa.social

import com.google.gson.Gson
import com.nexa.social.data.api.AuthApi
import com.nexa.social.data.api.GroupApi
import com.nexa.social.data.api.MessageApi
import com.nexa.social.data.api.PostApi
import com.nexa.social.data.api.UserApi
import com.nexa.social.data.models.CreatePostRequest
import com.nexa.social.data.models.FcmTokenRequest
import com.nexa.social.data.models.LoginRequest
import com.nexa.social.data.models.RefreshTokenRequest
import com.nexa.social.data.models.SendDirectMessageRequest
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

class ApiContractTest {

    private lateinit var mockServer: MockWebServer
    private lateinit var retrofit: Retrofit

    private lateinit var messageApi: MessageApi
    private lateinit var authApi: AuthApi
    private lateinit var userApi: UserApi
    private lateinit var groupApi: GroupApi
    private lateinit var postApi: PostApi

    @Before
    fun setUp() {
        mockServer = MockWebServer()
        mockServer.start()

        val okHttpClient = OkHttpClient.Builder().build()

        retrofit = Retrofit.Builder()
            .baseUrl(mockServer.url("/"))
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        messageApi = retrofit.create(MessageApi::class.java)
        authApi = retrofit.create(AuthApi::class.java)
        userApi = retrofit.create(UserApi::class.java)
        groupApi = retrofit.create(GroupApi::class.java)
        postApi = retrofit.create(PostApi::class.java)
    }

    @After
    fun tearDown() {
        mockServer.shutdown()
    }

    @Test
    fun `direct message send contract matches POST api messages`() = runBlocking {
        val mockResponseBody = """
            {
                "data": {
                    "messageId": 101,
                    "senderId": 1,
                    "receiverId": 2,
                    "content": "Hello via Retrofit",
                    "isRead": false,
                    "createdAt": "2026-08-16T12:00:00Z"
                },
                "message": "Message sent"
            }
        """.trimIndent()

        mockServer.enqueue(
            MockResponse()
                .setResponseCode(201)
                .setHeader("Content-Type", "application/json")
                .setBody(mockResponseBody)
        )

        val response = messageApi.sendMessage(
            SendDirectMessageRequest(receiverId = 2, content = "Hello via Retrofit")
        )

        val recordedRequest = mockServer.takeRequest()
        assertEquals("POST", recordedRequest.method)
        assertEquals("/messages", recordedRequest.path)

        val requestJson = JSONObject(recordedRequest.body.readUtf8())
        assertEquals(2, requestJson.getInt("receiverId"))
        assertEquals("Hello via Retrofit", requestJson.getString("content"))

        assertTrue(response.isSuccessful)
        val data = response.body()?.data
        assertNotNull(data)
        assertEquals(101, data?.messageId)
        assertEquals("Hello via Retrofit", data?.content)
    }

    @Test
    fun `mark message read contract matches POST api messages messageId read`() = runBlocking {
        val mockResponseBody = """
            {
                "data": {
                    "rowsAffected": 1,
                    "read": true,
                    "readAt": "2026-08-16T12:05:00Z"
                }
            }
        """.trimIndent()

        mockServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(mockResponseBody)
        )

        val response = messageApi.markMessageRead(42)

        val recordedRequest = mockServer.takeRequest()
        assertEquals("POST", recordedRequest.method)
        assertEquals("/messages/42/read", recordedRequest.path)

        assertTrue(response.isSuccessful)
        assertEquals(true, response.body()?.data?.read)
    }

    @Test
    fun `FCM registration contract matches POST notifications register`() = runBlocking {
        val mockResponseBody = """
            {
                "data": { "success": true },
                "message": "FCM token registered successfully"
            }
        """.trimIndent()

        mockServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(mockResponseBody)
        )

        val response = authApi.registerFcmToken(
            FcmTokenRequest(fcmToken = "test_fcm_token_123", platform = "android")
        )

        val recordedRequest = mockServer.takeRequest()
        assertEquals("POST", recordedRequest.method)
        assertEquals("/notifications/register", recordedRequest.path)

        val requestJson = JSONObject(recordedRequest.body.readUtf8())
        assertEquals("test_fcm_token_123", requestJson.getString("fcmToken"))
        assertEquals("android", requestJson.getString("platform"))

        assertTrue(response.isSuccessful)
    }

    @Test
    fun `auth login contract matches POST auth login`() = runBlocking {
        val mockResponseBody = """
            {
                "data": {
                    "user": {
                        "userId": 10,
                        "username": "tester",
                        "displayName": "Test User",
                        "email": "test@test.com"
                    },
                    "accessToken": "mock.jwt.token",
                    "refreshToken": "mock.refresh.token"
                }
            }
        """.trimIndent()

        mockServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(mockResponseBody)
        )

        val response = authApi.login(LoginRequest(username = "tester", password = "SecretPassword123!"))

        val recordedRequest = mockServer.takeRequest()
        assertEquals("POST", recordedRequest.method)
        assertEquals("/auth/login", recordedRequest.path)

        assertTrue(response.isSuccessful)
        assertEquals("mock.jwt.token", response.body()?.data?.accessToken)
        assertEquals(10, response.body()?.data?.user?.userId)
    }

    @Test
    fun `user suggestions contract matches GET users suggestions`() = runBlocking {
        val mockResponseBody = """
            {
                "data": [
                    {
                        "userId": 1,
                        "username": "alice",
                        "displayName": "Alice Smith"
                    },
                    {
                        "userId": 2,
                        "username": "bob",
                        "displayName": "Bob Jones"
                    }
                ]
            }
        """.trimIndent()

        mockServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(mockResponseBody)
        )

        val response = userApi.getSuggestions(limit = 20)

        val recordedRequest = mockServer.takeRequest()
        assertEquals("GET", recordedRequest.method)
        assertTrue(recordedRequest.path?.startsWith("/users/suggestions") == true)

        assertTrue(response.isSuccessful)
        assertEquals(2, response.body()?.data?.size)
    }
}
