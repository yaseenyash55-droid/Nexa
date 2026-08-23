package com.nexa.social.data.api

import com.nexa.social.data.models.ApiResponse
import com.nexa.social.data.models.IceConfiguration
import retrofit2.Response
import retrofit2.http.GET

interface CallApi {
    @GET("calls/ice-config")
    suspend fun getIceConfiguration(): Response<ApiResponse<IceConfiguration>>
}
