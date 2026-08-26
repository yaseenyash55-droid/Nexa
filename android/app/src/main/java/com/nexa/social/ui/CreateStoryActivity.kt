package com.nexa.social.ui

import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.nexa.social.NexaApiClient
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

    private val photoPicker = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            val cropDialog = CropImageDialogFragment.newInstance(uri, 9f / 16f) { croppedUri ->
                selectedPhotoUri = croppedUri
                binding.ivPreview.setImageURI(croppedUri)
                binding.ivPreview.visibility = View.VISIBLE
                binding.tvPhotoHelp.visibility = View.GONE
            }
            cropDialog.show(supportFragmentManager, "CropStoryImageDialog")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCreateStoryBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnClose.setOnClickListener { finish() }
        binding.btnChoosePhoto.setOnClickListener {
            photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        }
        binding.btnPublish.setOnClickListener { publishStory() }
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
                storyRepository.createStory(publicUrl!!, caption).getOrElse { throw it }
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
        binding.btnPublish.isEnabled = !loading
    }
}
