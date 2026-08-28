package com.nexa.social.ui

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.nexa.social.NexaApiClient
import com.nexa.social.R
import com.nexa.social.data.models.MusicTrack
import com.nexa.social.ui.adapters.MusicTrackAdapter
import com.nexa.social.utils.MusicPlayerManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MusicPickerBottomSheetDialogFragment(
    private val onTrackSelected: (MusicTrack) -> Unit
) : BottomSheetDialogFragment(), MusicPlayerManager.PlayerListener {

    private lateinit var etSearch: EditText
    private lateinit var chipGroupGenres: ChipGroup
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var rvTracks: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var layoutEmpty: LinearLayout
    private lateinit var btnClose: ImageButton

    private lateinit var adapter: MusicTrackAdapter

    private val genres = listOf("All", "Pop", "Electronic", "Rock", "Hip-Hop", "Chillout", "Acoustic", "Jazz", "Cinematic")
    private var currentGenre = "All"
    private var currentSearchQuery = ""
    private var searchJob: Job? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.dialog_music_picker, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        etSearch = view.findViewById(R.id.etSearchMusic)
        chipGroupGenres = view.findViewById(R.id.chipGroupGenres)
        swipeRefresh = view.findViewById(R.id.swipeRefreshMusic)
        rvTracks = view.findViewById(R.id.rvMusicTracks)
        progressBar = view.findViewById(R.id.progressBarMusic)
        layoutEmpty = view.findViewById(R.id.layoutEmptyMusic)
        btnClose = view.findViewById(R.id.btnClosePicker)

        btnClose.setOnClickListener { dismiss() }

        setupGenreChips()
        setupRecyclerView()
        setupSearch()

        MusicPlayerManager.addListener(this)
        fetchTracks()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        MusicPlayerManager.removeListener(this)
        searchJob?.cancel()
    }

    private fun setupGenreChips() {
        val context = requireContext()
        genres.forEachIndexed { index, genre ->
            val chip = Chip(context).apply {
                text = genre
                isCheckable = true
                isChecked = index == 0
                setChipBackgroundColorResource(if (index == 0) R.color.brand_indigo else R.color.background_card)
                setTextColor(ContextCompat.getColor(context, R.color.text_white))
                setOnClickListener {
                    currentGenre = genre
                    etSearch.setText("")
                    currentSearchQuery = ""
                    fetchTracks()
                }
            }
            chipGroupGenres.addView(chip)
        }
    }

    private fun setupRecyclerView() {
        adapter = MusicTrackAdapter { track, allTracks ->
            // If already playing this track, select it and return to composer
            if (MusicPlayerManager.currentTrack?.id == track.id && MusicPlayerManager.isPlaying) {
                MusicPlayerManager.stop()
                onTrackSelected(track)
                dismiss()
            } else {
                // Play preview first; clicking again or long-clicking selects
                MusicPlayerManager.playTrack(requireContext(), track, allTracks)
                // Show toast indicating click again to attach
                Toast.makeText(requireContext(), "Tap again or keep listening to attach: ${track.name}", Toast.LENGTH_SHORT).show()
            }
        }
        rvTracks.layoutManager = LinearLayoutManager(requireContext())
        rvTracks.adapter = adapter

        swipeRefresh.setOnRefreshListener {
            fetchTracks()
        }
    }

    private fun setupSearch() {
        etSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                currentSearchQuery = s?.toString()?.trim() ?: ""
                searchJob?.cancel()
                searchJob = lifecycleScope.launch {
                    delay(350)
                    fetchTracks()
                }
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun fetchTracks() {
        progressBar.visibility = View.VISIBLE
        layoutEmpty.visibility = View.GONE

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val res = if (currentSearchQuery.isNotEmpty()) {
                    NexaApiClient.musicApi.searchTracks(currentSearchQuery)
                } else if (currentGenre != "All") {
                    NexaApiClient.musicApi.getTracksByGenre(currentGenre.lowercase())
                } else {
                    NexaApiClient.musicApi.getTracks()
                }

                val tracks = res.body()?.data ?: emptyList()

                withContext(Dispatchers.Main) {
                    progressBar.visibility = View.GONE
                    swipeRefresh.isRefreshing = false
                    adapter.submitList(tracks)
                    layoutEmpty.visibility = if (tracks.isEmpty()) View.VISIBLE else View.GONE
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    progressBar.visibility = View.GONE
                    swipeRefresh.isRefreshing = false
                    if (adapter.itemCount == 0) {
                        layoutEmpty.visibility = View.VISIBLE
                    }
                }
            }
        }
    }

    // PlayerListener callbacks to update Play/Pause UI in track list
    override fun onTrackChanged(track: MusicTrack?) {
        activity?.runOnUiThread {
            adapter.updatePlaybackState(track?.id, MusicPlayerManager.isPlaying)
        }
    }

    override fun onPlaybackStateChanged(isPlaying: Boolean) {
        activity?.runOnUiThread {
            adapter.updatePlaybackState(MusicPlayerManager.currentTrack?.id, isPlaying)
        }
    }

    override fun onProgressUpdate(currentPositionMs: Long, durationMs: Long) {}
}
