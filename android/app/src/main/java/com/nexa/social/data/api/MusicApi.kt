package com.nexa.social.data.api

import com.nexa.social.data.models.ApiResponse
import com.nexa.social.data.models.MusicTrack
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface MusicApi {
    @GET("music/tracks")
    suspend fun getTracks(
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<MusicTrack>>>

    @GET("music/search")
    suspend fun searchTracks(
        @Query("q") query: String,
        @Query("limit") limit: Int = 20
    ): Response<ApiResponse<List<MusicTrack>>>

    @GET("music/genres/{genre}")
    suspend fun getTracksByGenre(
        @Path("genre") genre: String
    ): Response<ApiResponse<List<MusicTrack>>>

    @GET("music/tracks/{trackId}")
    suspend fun getTrackById(
        @Path("trackId") trackId: String
    ): Response<ApiResponse<MusicTrack>>
}
