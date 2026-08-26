package com.nexa.social.ui.adapters

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.nexa.social.R
import com.nexa.social.data.models.MusicTrack
import com.nexa.social.utils.MusicPlayerManager

class MusicTrackAdapter(
    private val onTrackClick: (MusicTrack, List<MusicTrack>) -> Unit
) : RecyclerView.Adapter<MusicTrackAdapter.TrackViewHolder>() {

    private val tracks = mutableListOf<MusicTrack>()
    private var playingTrackId: String? = null
    private var isPlaying: Boolean = false

    fun submitList(newTracks: List<MusicTrack>) {
        tracks.clear()
        tracks.addAll(newTracks)
        playingTrackId = MusicPlayerManager.currentTrack?.id
        isPlaying = MusicPlayerManager.isPlaying
        notifyDataSetChanged()
    }

    fun updatePlaybackState(trackId: String?, isPlayingNow: Boolean) {
        val oldId = playingTrackId
        playingTrackId = trackId
        isPlaying = isPlayingNow

        if (oldId != null) {
            val oldIndex = tracks.indexOfFirst { it.id == oldId }
            if (oldIndex >= 0) notifyItemChanged(oldIndex)
        }
        if (trackId != null) {
            val newIndex = tracks.indexOfFirst { it.id == trackId }
            if (newIndex >= 0) notifyItemChanged(newIndex)
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TrackViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_music_track, parent, false)
        return TrackViewHolder(view)
    }

    override fun onBindViewHolder(holder: TrackViewHolder, position: Int) {
        holder.bind(tracks[position])
    }

    override fun getItemCount(): Int = tracks.size

    inner class TrackViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val ivCover: ImageView = itemView.findViewById(R.id.ivTrackCover)
        private val ivPlayIndicator: ImageView = itemView.findViewById(R.id.ivPlayIndicator)
        private val tvTitle: TextView = itemView.findViewById(R.id.tvTrackTitle)
        private val tvArtist: TextView = itemView.findViewById(R.id.tvArtistName)
        private val tvDuration: TextView = itemView.findViewById(R.id.tvDuration)
        private val btnPlay: ImageButton = itemView.findViewById(R.id.btnTrackPlay)

        fun bind(track: MusicTrack) {
            val isCurrent = track.id == playingTrackId

            tvTitle.text = track.name
            tvArtist.text = "${track.artistName} • Jamendo"
            tvDuration.text = track.formattedDuration()

            val imageUrl = track.resolvedImageUrl()
            ivCover.load(imageUrl.ifEmpty { null }) {
                crossfade(true)
                placeholder(R.drawable.ic_gallery)
                error(R.drawable.ic_gallery)
            }

            if (isCurrent) {
                tvTitle.setTextColor(ContextCompat.getColor(itemView.context, R.color.brand_indigo))
                ivPlayIndicator.visibility = if (isPlaying) View.VISIBLE else View.GONE
                btnPlay.setColorFilter(ContextCompat.getColor(itemView.context, R.color.brand_indigo))
            } else {
                tvTitle.setTextColor(ContextCompat.getColor(itemView.context, R.color.text_white))
                ivPlayIndicator.visibility = View.GONE
                btnPlay.setColorFilter(ContextCompat.getColor(itemView.context, R.color.text_secondary))
            }

            itemView.setOnClickListener {
                onTrackClick(track, tracks)
            }

            btnPlay.setOnClickListener {
                onTrackClick(track, tracks)
            }
        }
    }
}
