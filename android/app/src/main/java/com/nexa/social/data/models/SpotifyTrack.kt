package com.nexa.social.data.models

import com.google.gson.annotations.SerializedName

data class SpotifyArtist(
    @SerializedName("name") val name: String
)

data class SpotifyImage(
    @SerializedName("url") val url: String
)

data class SpotifyAlbum(
    @SerializedName("name") val name: String,
    @SerializedName("images") val images: List<SpotifyImage>? = null
)

data class SpotifyTrack(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("artists") val artists: List<SpotifyArtist>,
    @SerializedName("album") val album: SpotifyAlbum,
    @SerializedName("preview_url") val previewUrl: String? = null
) {
    fun getArtistNames(): String {
        return artists.joinToString(", ") { it.name }
    }

    fun getThumbnailUrl(): String? {
        return album.images?.firstOrNull()?.url
    }
}
