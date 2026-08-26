package com.nexa.social.ui

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.cardview.widget.CardView
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import coil.load
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup
import com.nexa.social.R
import com.nexa.social.data.models.MusicTrack
import com.nexa.social.ui.adapters.MusicTrackAdapter
import com.nexa.social.utils.MusicPlayerManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder

class MusicActivity : AppCompatActivity(), MusicPlayerManager.PlayerListener {

    private lateinit var toolbar: MaterialToolbar
    private lateinit var etSearch: EditText
    private lateinit var chipGroupGenres: ChipGroup
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var rvTracks: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var layoutEmpty: LinearLayout

    // Mini-Player Views
    private lateinit var cardMiniPlayer: CardView
    private lateinit var ivMiniCover: ImageView
    private lateinit var tvMiniTitle: TextView
    private lateinit var tvMiniArtist: TextView
    private lateinit var btnMiniPlayPause: ImageButton
    private lateinit var btnMiniPrevious: ImageButton
    private lateinit var btnMiniNext: ImageButton
    private lateinit var seekMiniProgress: SeekBar
    private lateinit var tvMiniCurrentTime: TextView
    private lateinit var tvMiniDuration: TextView

    private lateinit var adapter: MusicTrackAdapter
    private val httpClient = OkHttpClient()

    private val jamendoClientId = "c031c261"
    private val genres = listOf("All", "Pop", "Electronic", "Rock", "Hip-Hop", "Chillout", "Acoustic", "Jazz", "Cinematic")
    private var currentGenre = "All"
    private var currentSearchQuery = ""
    private var searchJob: Job? = null
    private var isUserTrackingSeek = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_music)

        initViews()
        setupToolbar()
        setupGenreChips()
        setupRecyclerView()
        setupMiniPlayer()
        setupSearch()

        MusicPlayerManager.addListener(this)
        fetchTracks()
    }

    override fun onDestroy() {
        super.onDestroy()
        MusicPlayerManager.removeListener(this)
    }

    private fun initViews() {
        toolbar = findViewById(R.id.toolbar)
        etSearch = findViewById(R.id.etSearchMusic)
        chipGroupGenres = findViewById(R.id.chipGroupGenres)
        swipeRefresh = findViewById(R.id.swipeRefreshMusic)
        rvTracks = findViewById(R.id.rvMusicTracks)
        progressBar = findViewById(R.id.progressBarMusic)
        layoutEmpty = findViewById(R.id.layoutEmptyMusic)

        cardMiniPlayer = findViewById(R.id.cardMiniPlayer)
        ivMiniCover = findViewById(R.id.ivMiniCover)
        tvMiniTitle = findViewById(R.id.tvMiniTitle)
        tvMiniArtist = findViewById(R.id.tvMiniArtist)
        btnMiniPlayPause = findViewById(R.id.btnMiniPlayPause)
        btnMiniPrevious = findViewById(R.id.btnMiniPrevious)
        btnMiniNext = findViewById(R.id.btnMiniNext)
        seekMiniProgress = findViewById(R.id.seekMiniProgress)
        tvMiniCurrentTime = findViewById(R.id.tvMiniCurrentTime)
        tvMiniDuration = findViewById(R.id.tvMiniDuration)
    }

    private fun setupToolbar() {
        toolbar.setNavigationOnClickListener { finish() }
    }

    private fun setupGenreChips() {
        genres.forEachIndexed { index, genre ->
            val chip = Chip(this).apply {
                text = genre
                isCheckable = true
                isChecked = index == 0
                setChipBackgroundColorResource(if (index == 0) R.color.brand_indigo else R.color.background_card)
                setTextColor(ContextCompat.getColor(this@MusicActivity, R.color.text_white))
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
            if (MusicPlayerManager.currentTrack?.id == track.id) {
                MusicPlayerManager.togglePlayPause(this)
            } else {
                MusicPlayerManager.playTrack(this, track, allTracks)
            }
        }
        rvTracks.layoutManager = LinearLayoutManager(this)
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
                    delay(400)
                    fetchTracks()
                }
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun setupMiniPlayer() {
        btnMiniPlayPause.setOnClickListener {
            MusicPlayerManager.togglePlayPause(this)
        }

        btnMiniPrevious.setOnClickListener {
            MusicPlayerManager.playPrevious(this)
        }

        btnMiniNext.setOnClickListener {
            MusicPlayerManager.playNext(this)
        }

        seekMiniProgress.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                if (fromUser) {
                    val durationMs = MusicPlayerManager.getDurationMs()
                    val targetMs = (progress / 100f * durationMs).toLong()
                    tvMiniCurrentTime.text = formatTimeMs(targetMs)
                }
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) {
                isUserTrackingSeek = true
            }

            override fun onStopTrackingTouch(seekBar: SeekBar?) {
                seekBar?.let {
                    val durationMs = MusicPlayerManager.getDurationMs()
                    val targetMs = (it.progress / 100f * durationMs).toLong()
                    MusicPlayerManager.seekTo(targetMs)
                }
                isUserTrackingSeek = false
            }
        })

        updateMiniPlayerUI(MusicPlayerManager.currentTrack, MusicPlayerManager.isPlaying)
    }

    private fun fetchTracks() {
        progressBar.visibility = View.VISIBLE
        layoutEmpty.visibility = View.GONE

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                var url = "https://api.jamendo.com/v3.0/tracks/?client_id=$jamendoClientId&format=jsonpretty&limit=25&include=musicinfo&audioformat=mp32"
                if (currentSearchQuery.isNotEmpty()) {
                    val encoded = URLEncoder.encode(currentSearchQuery, "UTF-8")
                    url += "&search=$encoded"
                } else if (currentGenre != "All") {
                    val encoded = URLEncoder.encode(currentGenre.lowercase(), "UTF-8")
                    url += "&tags=$encoded&boost=popularity_month"
                } else {
                    url += "&boost=popularity_month"
                }

                val request = Request.Builder().url(url).build()
                val response = httpClient.newCall(request).execute()
                val body = response.body?.string()

                if (response.isSuccessful && body != null) {
                    val json = JSONObject(body)
                    val results = json.optJSONArray("results")
                    val parsedTracks = mutableListOf<MusicTrack>()

                    if (results != null) {
                        for (i in 0 until results.length()) {
                            val item = results.getJSONObject(i)
                            val id = item.optString("id")
                            val name = item.optString("name", "Unknown Track")
                            val duration = item.optInt("duration", 0)
                            val artistId = item.optString("artist_id")
                            val artistName = item.optString("artist_name", "Unknown Artist")
                            val albumName = item.optString("album_name")
                            val albumImage = item.optString("album_image")
                            val image = item.optString("image")
                            val audio = item.optString("audio")
                            val audioDownload = item.optString("audiodownload")
                            val shareUrl = item.optString("shareurl")

                            if (audio.isNotBlank()) {
                                parsedTracks.add(
                                    MusicTrack(
                                        id = id,
                                        name = name,
                                        duration = duration,
                                        artistId = artistId,
                                        artistName = artistName,
                                        albumName = albumName,
                                        albumImage = albumImage,
                                        image = image,
                                        audioUrl = audio,
                                        audioDownloadUrl = audioDownload,
                                        shareUrl = shareUrl
                                    )
                                )
                            }
                        }
                    }

                    withContext(Dispatchers.Main) {
                        progressBar.visibility = View.GONE
                        swipeRefresh.isRefreshing = false
                        adapter.submitList(parsedTracks)
                        layoutEmpty.visibility = if (parsedTracks.isEmpty()) View.VISIBLE else View.GONE
                    }
                    return@launch
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }

            withContext(Dispatchers.Main) {
                progressBar.visibility = View.GONE
                swipeRefresh.isRefreshing = false
                layoutEmpty.visibility = View.VISIBLE
                Toast.makeText(this@MusicActivity, "Could not fetch Jamendo music", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun updateMiniPlayerUI(track: MusicTrack?, isPlaying: Boolean) {
        if (track == null) {
            cardMiniPlayer.visibility = View.GONE
            return
        }

        cardMiniPlayer.visibility = View.VISIBLE
        tvMiniTitle.text = track.name
        tvMiniArtist.text = "${track.artistName} • Music via Jamendo"
        tvMiniDuration.text = track.formattedDuration()

        val cover = track.resolvedImageUrl()
        ivMiniCover.load(cover.ifEmpty { null }) {
            crossfade(true)
            placeholder(R.drawable.ic_gallery)
            error(R.drawable.ic_gallery)
        }

        btnMiniPlayPause.setImageResource(if (isPlaying) R.drawable.ic_close else R.drawable.ic_call_audio)
    }

    private fun formatTimeMs(ms: Long): String {
        val totalSecs = ms / 1000
        val mins = totalSecs / 60
        val secs = totalSecs % 60
        return String.format("%d:%02d", mins, secs)
    }

    // PlayerListener callbacks
    override fun onTrackChanged(track: MusicTrack?) {
        runOnUiThread {
            updateMiniPlayerUI(track, MusicPlayerManager.isPlaying)
            adapter.updatePlaybackState(track?.id, MusicPlayerManager.isPlaying)
        }
    }

    override fun onPlaybackStateChanged(isPlaying: Boolean) {
        runOnUiThread {
            updateMiniPlayerUI(MusicPlayerManager.currentTrack, isPlaying)
            adapter.updatePlaybackState(MusicPlayerManager.currentTrack?.id, isPlaying)
        }
    }

    override fun onProgressUpdate(currentPositionMs: Long, durationMs: Long) {
        if (isUserTrackingSeek) return
        runOnUiThread {
            tvMiniCurrentTime.text = formatTimeMs(currentPositionMs)
            tvMiniDuration.text = formatTimeMs(durationMs)
            if (durationMs > 0) {
                val progress = ((currentPositionMs.toFloat() / durationMs.toFloat()) * 100).toInt()
                seekMiniProgress.progress = progress
            }
        }
    }
}
