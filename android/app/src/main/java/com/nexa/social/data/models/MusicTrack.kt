package com.nexa.social.data.models

import com.google.gson.annotations.SerializedName

data class MusicTrack(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("duration") val duration: Int = 0,
    @SerializedName("artist_id") val artistId: String? = null,
    @SerializedName("artist_name") val artistName: String,
    @SerializedName("album_name") val albumName: String? = null,
    @SerializedName("album_image") val albumImage: String? = null,
    @SerializedName("image") val image: String? = null,
    @SerializedName("audio") val audioUrl: String,
    @SerializedName("audiodownload") val audioDownloadUrl: String? = null,
    @SerializedName("shareurl") val shareUrl: String? = null
) {
    fun resolvedImageUrl(): String =
        image?.takeIf { it.isNotBlank() }
            ?: albumImage?.takeIf { it.isNotBlank() }
            ?: ""

    fun formattedDuration(): String {
        if (duration <= 0) return "0:00"
        val mins = duration / 60
        val secs = duration % 60
        return String.format("%d:%02d", mins, secs)
    }
}
