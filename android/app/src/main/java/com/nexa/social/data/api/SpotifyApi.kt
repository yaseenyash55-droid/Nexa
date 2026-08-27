package com.nexa.social.data.api

import com.nexa.social.data.models.ApiResponse
import com.nexa.social.data.models.SpotifyTrack
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface SpotifyApi {
    @GET("music/spotify/search")
    suspend fun searchTracks(@Query("q") query: String): Response<ApiResponse<List<SpotifyTrack>>>

    @GET("music/spotify/track/{id}")
    suspend fun getTrackDetails(@Path("id") trackId: String): Response<ApiResponse<SpotifyTrack>>
}
