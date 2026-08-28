package com.nexa.social.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import coil.load
import com.nexa.social.NexaApiClient
import com.nexa.social.R
import com.nexa.social.data.repository.StoryRepository
import com.nexa.social.databinding.ActivityCreateStoryBinding
import com.nexa.social.utils.MediaFilePreparer
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody

class CreateStoryActivity : AppCompatActivity() {
    private lateinit var binding: ActivityCreateStoryBinding
    private val storyRepository = StoryRepository()
    private var selectedPhotoUri: Uri? = null

    private val editorLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val editedUriString = result.data?.getStringExtra(StoryEditorActivity.EXTRA_EDITED_URI)
            if (!editedUriString.isNullOrEmpty()) {
                val editedUri = Uri.parse(editedUriString)
                selectedPhotoUri = editedUri
                binding.ivPreview.setImageURI(editedUri)
                binding.ivPreview.visibility = View.VISIBLE
                binding.tvPhotoHelp.visibility = View.GONE
            }
        }
    }

    private val photoPicker = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            val cropDialog = CropImageDialogFragment.newInstance(uri, 9f / 16f) { croppedUri ->
                val intent = Intent(this, StoryEditorActivity::class.java).apply {
                    putExtra(StoryEditorActivity.EXTRA_IMAGE_URI, croppedUri.toString())
                }
                editorLauncher.launch(intent)
            }
            cropDialog.show(supportFragmentManager, "CropStoryImageDialog")
        }
    }

    private var selectedMusicTrack: com.nexa.social.data.models.SpotifyTrack? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCreateStoryBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnClose.setOnClickListener { finish() }
        binding.btnChoosePhoto.setOnClickListener {
            photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        }
        binding.btnAttachMusic.setOnClickListener {
            showMusicSearchDialog()
        }
        binding.btnPublish.setOnClickListener { publishStory() }
    }

    private fun showMusicSearchDialog() {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_spotify_search, null)
        val etSearch = dialogView.findViewById<EditText>(R.id.etSearchQuery)
        val btnSearch = dialogView.findViewById<Button>(R.id.btnSearch)
        val progressBar = dialogView.findViewById<ProgressBar>(R.id.dialogProgressBar)
        val container = dialogView.findViewById<LinearLayout>(R.id.layoutResultsContainer)

        val dialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .create()

        btnSearch.setOnClickListener {
            val query = etSearch.text.toString().trim()
            if (query.isEmpty()) return@setOnClickListener

            progressBar.visibility = View.VISIBLE
            container.removeAllViews()

            lifecycleScope.launch {
                try {
                    val response = NexaApiClient.spotifyApi.searchTracks(query)
                    val body = response.body()
                    if (response.isSuccessful && body?.data != null) {
                        val tracks = body.data
                        if (tracks.isEmpty()) {
                            val tvNoResults = TextView(this@CreateStoryActivity).apply {
                                text = "No tracks found."
                                setTextColor(getColor(R.color.text_secondary))
                                textSize = 13f
                                setPadding(16, 16, 16, 16)
                            }
                            container.addView(tvNoResults)
                        } else {
                            tracks.forEach { track ->
                                val trackView = LayoutInflater.from(this@CreateStoryActivity)
                                    .inflate(R.layout.item_spotify_track, container, false)
                                
                                val ivCover = trackView.findViewById<ImageView>(R.id.ivCover)
                                val tvTitle = trackView.findViewById<TextView>(R.id.tvTitle)
                                val tvArtist = trackView.findViewById<TextView>(R.id.tvArtist)

                                tvTitle.text = track.name
                                tvArtist.text = track.getArtistNames()
                                val thumb = track.getThumbnailUrl()
                                if (!thumb.isNullOrEmpty()) {
                                    ivCover.load(thumb)
                                }

                                trackView.setOnClickListener {
                                    selectedMusicTrack = track
                                    binding.layoutMusicSticker.visibility = View.VISIBLE
                                    binding.tvStickerTitle.text = track.name
                                    binding.tvStickerArtist.text = track.getArtistNames()
                                    if (!thumb.isNullOrEmpty()) {
                                        binding.ivStickerArt.load(thumb)
                                    }
                                    dialog.dismiss()
                                }
                                container.addView(trackView)
                            }
                        }
                    } else {
                        Toast.makeText(this@CreateStoryActivity, "Search failed", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(this@CreateStoryActivity, e.message ?: "Search failed", Toast.LENGTH_SHORT).show()
                } finally {
                    progressBar.visibility = View.GONE
                }
            }
        }

        dialog.show()
    }

    private fun publishStory() {
        val uri = selectedPhotoUri
        if (uri == null) {
            Toast.makeText(this, "Choose a photo first", Toast.LENGTH_SHORT).show()
            return
        }

        setLoading(true)
        lifecycleScope.launch {
            var prepared: MediaFilePreparer.PreparedMedia? = null
            try {
                prepared = MediaFilePreparer.prepare(
                    context = this@CreateStoryActivity,
                    uri = uri,
                    kind = MediaFilePreparer.Kind.IMAGE,
                    maxBytes = 20L * 1024L * 1024L
                ).getOrElse { throw it }

                val fileBody = prepared.file.asRequestBody(prepared.mimeType.toMediaTypeOrNull())
                val filePart = MultipartBody.Part.createFormData("file", prepared.file.name, fileBody)
                val kindPart = "story".toRequestBody("text/plain".toMediaTypeOrNull())
                val upload = NexaApiClient.postApi.uploadMedia(filePart, kindPart)
                val publicUrl = upload.body()?.data?.publicUrl
                if (!upload.isSuccessful || publicUrl.isNullOrBlank()) {
                    throw IllegalStateException(upload.body()?.error?.message ?: "Cosmic upload failed (${upload.code()})")
                }

                val caption = binding.etCaption.text?.toString()?.trim()?.takeIf { it.isNotEmpty() }
                val musicTrackId = selectedMusicTrack?.id
                storyRepository.createStory(publicUrl!!, caption, musicTrackId).getOrElse { throw it }
                Toast.makeText(this@CreateStoryActivity, "Cosmic shared", Toast.LENGTH_SHORT).show()
                setResult(RESULT_OK)
                finish()
            } catch (error: Exception) {
                Toast.makeText(this@CreateStoryActivity, error.message ?: "Unable to share Cosmic", Toast.LENGTH_LONG).show()
            } finally {
                prepared?.file?.delete()
                setLoading(false)
            }
        }
    }

    private fun setLoading(loading: Boolean) {
        binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
        binding.btnClose.isEnabled = !loading
        binding.btnChoosePhoto.isEnabled = !loading
        binding.btnAttachMusic.isEnabled = !loading
        binding.btnPublish.isEnabled = !loading
    }
}
