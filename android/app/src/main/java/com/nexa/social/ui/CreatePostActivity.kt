package com.nexa.social.ui

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import com.nexa.social.NexaApiClient
import com.nexa.social.data.models.CreatePostRequest
import com.nexa.social.databinding.ActivityCreatePostBinding
import com.nexa.social.utils.PreferenceManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

class CreatePostActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCreatePostBinding
    private lateinit var prefManager: PreferenceManager

    private var selectedMediaUri: Uri? = null
    private var isVideoSelected = false
    private var cameraTempFile: File? = null

    private val photoPickerLauncher = registerForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri: Uri? ->
        if (uri != null) {
            selectedMediaUri = uri
            isVideoSelected = false
            cleanupCameraTempFile()
            binding.videoBadge.visibility = View.GONE
            binding.imgPreview.setImageURI(uri)
            binding.cardImagePreview.visibility = View.VISIBLE
        }
    }

    private val videoPickerLauncher = registerForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri: Uri? ->
        if (uri != null) {
            selectedMediaUri = uri
            isVideoSelected = true
            cleanupCameraTempFile()
            binding.videoBadge.visibility = View.VISIBLE
            loadVideoThumbnail(uri)
            binding.cardImagePreview.visibility = View.VISIBLE
        }
    }

    private val cameraLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success: Boolean ->
        if (success && cameraTempFile != null && cameraTempFile!!.exists() && cameraTempFile!!.length() > 0) {
            val uri = Uri.fromFile(cameraTempFile)
            selectedMediaUri = uri
            isVideoSelected = false
            binding.videoBadge.visibility = View.GONE
            binding.imgPreview.setImageURI(uri)
            binding.cardImagePreview.visibility = View.VISIBLE
        } else {
            cleanupCameraTempFile()
        }
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            launchCameraCapture()
        } else {
            Toast.makeText(this, "Camera permission is required to capture photos", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityCreatePostBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefManager = PreferenceManager(this)

        setupUserHeader()
        setupClickListeners()
    }

    override fun onDestroy() {
        super.onDestroy()
        cleanupCameraTempFile()
    }

    private fun cleanupCameraTempFile() {
        try {
            cameraTempFile?.let {
                if (it.exists()) it.delete()
            }
            cameraTempFile = null
        } catch (_: Exception) {}
    }

    private fun setupUserHeader() {
        val displayName = prefManager.displayName ?: "Nexa User"
        val username = prefManager.username ?: "user"
        binding.tvDisplayName.text = displayName
        binding.tvUsername.text = "@$username"
    }

    private fun setupClickListeners() {
        binding.btnClose.setOnClickListener {
            finish()
        }

        binding.btnGallery.setOnClickListener {
            photoPickerLauncher.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
            )
        }

        binding.btnVideos.setOnClickListener {
            videoPickerLauncher.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.VideoOnly)
            )
        }

        binding.btnCamera.setOnClickListener {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                launchCameraCapture()
            } else {
                cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
        }

        binding.btnRemoveImage.setOnClickListener {
            selectedMediaUri = null
            isVideoSelected = false
            cleanupCameraTempFile()
            binding.videoBadge.visibility = View.GONE
            binding.cardImagePreview.visibility = View.GONE
        }

        binding.btnPost.setOnClickListener {
            submitPost()
        }
    }

    private fun loadVideoThumbnail(uri: Uri) {
        lifecycleScope.launch(Dispatchers.IO) {
            var retriever: MediaMetadataRetriever? = null
            try {
                retriever = MediaMetadataRetriever()
                retriever.setDataSource(this@CreatePostActivity, uri)
                val bitmap = retriever.getFrameAtTime(1000000, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                    ?: retriever.frameAtTime
                withContext(Dispatchers.Main) {
                    if (bitmap != null) {
                        binding.imgPreview.setImageBitmap(bitmap)
                    } else {
                        binding.imgPreview.setImageResource(com.nexa.social.R.drawable.ic_video)
                    }
                }
            } catch (_: Exception) {
                withContext(Dispatchers.Main) {
                    binding.imgPreview.setImageResource(com.nexa.social.R.drawable.ic_video)
                }
            } finally {
                try { retriever?.release() } catch (_: Exception) {}
            }
        }
    }

    private fun launchCameraCapture() {
        try {
            cleanupCameraTempFile()
            val tempFile = File.createTempFile("camera_capture_", ".jpg", cacheDir)
            cameraTempFile = tempFile
            val photoUri = FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.fileprovider",
                tempFile
            )
            cameraLauncher.launch(photoUri)
        } catch (e: Exception) {
            Toast.makeText(this, "Failed to initialize camera: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun submitPost() {
        val content = binding.etContent.text.toString().trim()
        val token = prefManager.accessToken

        if (token.isNullOrEmpty()) {
            Toast.makeText(this, "Session expired. Please log in again.", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        if (content.isEmpty() && selectedMediaUri == null) {
            binding.tilContent.error = "Please enter post text or attach a photo/video"
            return
        } else {
            binding.tilContent.error = null
        }

        setLoading(true)

        lifecycleScope.launch {
            var tempProcessingFile: File? = null
            try {
                var uploadedMediaUrl: String? = null

                // 1. Process and upload media file if selected
                if (selectedMediaUri != null) {
                    val mediaInfo = prepareAndValidateMedia(selectedMediaUri!!, isVideoSelected)
                    if (mediaInfo == null) {
                        setLoading(false)
                        val limitMsg = if (isVideoSelected) "Invalid video (must be MP4/WebM under 50 MB)" else "Invalid image (must be JPEG/PNG/WebP under 10 MB)"
                        Toast.makeText(this@CreatePostActivity, limitMsg, Toast.LENGTH_LONG).show()
                        return@launch
                    }

                    tempProcessingFile = mediaInfo.file

                    val requestFile: RequestBody = tempProcessingFile.asRequestBody(mediaInfo.mimeType.toMediaTypeOrNull())
                    val filePart = MultipartBody.Part.createFormData("file", tempProcessingFile.name, requestFile)
                    val kindPart = (if (isVideoSelected) "video" else "photo").toRequestBody("text/plain".toMediaTypeOrNull())

                    val mediaResponse = NexaApiClient.postApi.uploadMedia(filePart, kindPart)
                    if (mediaResponse.isSuccessful && mediaResponse.body()?.data != null) {
                        uploadedMediaUrl = mediaResponse.body()!!.data?.publicUrl
                    } else {
                        setLoading(false)
                        val mediaError = mediaResponse.body()?.error?.message ?: "Failed to upload media (${mediaResponse.code()})"
                        Toast.makeText(this@CreatePostActivity, mediaError, Toast.LENGTH_LONG).show()
                        return@launch
                    }
                }

                // 2. Create post
                val postResponse = NexaApiClient.postApi.createPost(
                    request = CreatePostRequest(content = content, imageUrl = uploadedMediaUrl)
                )

                setLoading(false)

                if (postResponse.isSuccessful && postResponse.body()?.data != null) {
                    Toast.makeText(this@CreatePostActivity, "Post published successfully!", Toast.LENGTH_SHORT).show()
                    setResult(RESULT_OK)
                    finish()
                } else {
                    val errorMsg = postResponse.body()?.error?.message
                        ?: postResponse.body()?.message
                        ?: "Failed to publish post (${postResponse.code()})"
                    Toast.makeText(this@CreatePostActivity, errorMsg, Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                setLoading(false)
                Toast.makeText(this@CreatePostActivity, "Error: ${e.localizedMessage ?: e.message}", Toast.LENGTH_LONG).show()
            } finally {
                tempProcessingFile?.let {
                    if (it.exists()) it.delete()
                }
            }
        }
    }

    private data class ValidatedMedia(val file: File, val mimeType: String)

    private suspend fun prepareAndValidateMedia(uri: Uri, isVideo: Boolean): ValidatedMedia? = withContext(Dispatchers.IO) {
        return@withContext try {
            val inputStream: InputStream = contentResolver.openInputStream(uri) ?: return@withContext null

            // Read magic bytes
            val headerBytes = ByteArray(32)
            val bytesRead = inputStream.read(headerBytes)
            if (bytesRead < 4) {
                inputStream.close()
                return@withContext null
            }

            val detectedMime = if (isVideo) {
                detectVideoMimeType(headerBytes) ?: contentResolver.getType(uri) ?: "video/mp4"
            } else {
                detectImageMimeType(headerBytes) ?: contentResolver.getType(uri) ?: "image/jpeg"
            }

            val ext = when (detectedMime) {
                "image/jpeg" -> ".jpg"
                "image/png" -> ".png"
                "image/webp" -> ".webp"
                "video/mp4" -> ".mp4"
                "video/webm" -> ".webm"
                "video/quicktime" -> ".mov"
                "video/3gpp" -> ".3gp"
                else -> if (isVideo) ".mp4" else ".jpg"
            }

            val tempFile = File.createTempFile("upload_stage_", ext, cacheDir)
            val outputStream = FileOutputStream(tempFile)
            outputStream.write(headerBytes, 0, bytesRead)
            inputStream.copyTo(outputStream)
            inputStream.close()
            outputStream.flush()
            outputStream.close()

            // Verify size limits: 50 MB for video, 10 MB for image
            val maxAllowedBytes = if (isVideo) 50L * 1024 * 1024 else 10L * 1024 * 1024
            if (tempFile.length() > maxAllowedBytes) {
                tempFile.delete()
                return@withContext null
            }

            ValidatedMedia(tempFile, detectedMime)
        } catch (_: Exception) {
            null
        }
    }

    private fun detectImageMimeType(header: ByteArray): String? {
        // JPEG: FF D8 FF
        if (header.size >= 3 &&
            header[0] == 0xFF.toByte() &&
            header[1] == 0xD8.toByte() &&
            header[2] == 0xFF.toByte()
        ) {
            return "image/jpeg"
        }

        // PNG: 89 50 4E 47
        if (header.size >= 4 &&
            header[0] == 0x89.toByte() &&
            header[1] == 0x50.toByte() &&
            header[2] == 0x4E.toByte() &&
            header[3] == 0x47.toByte()
        ) {
            return "image/png"
        }

        // WebP: RIFF ... WEBP
        if (header.size >= 12 &&
            header[0] == 'R'.code.toByte() &&
            header[1] == 'I'.code.toByte() &&
            header[2] == 'F'.code.toByte() &&
            header[3] == 'F'.code.toByte() &&
            header[8] == 'W'.code.toByte() &&
            header[9] == 'E'.code.toByte() &&
            header[10] == 'B'.code.toByte() &&
            header[11] == 'P'.code.toByte()
        ) {
            return "image/webp"
        }

        return null
    }

    private fun detectVideoMimeType(header: ByteArray): String? {
        // MP4 / MOV: bytes 4..7 contain "ftyp" or "moov"
        if (header.size >= 8) {
            val tag = String(header.sliceArray(4..7))
            if (tag == "ftyp" || tag == "moov") {
                return "video/mp4"
            }
        }
        // WebM / Matroska: 1A 45 DF A3
        if (header.size >= 4 &&
            header[0] == 0x1A.toByte() &&
            header[1] == 0x45.toByte() &&
            header[2] == 0xDF.toByte() &&
            header[3] == 0xA3.toByte()
        ) {
            return "video/webm"
        }
        return null
    }

    private fun setLoading(isLoading: Boolean) {
        binding.postProgressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        binding.btnPost.isEnabled = !isLoading
        binding.btnClose.isEnabled = !isLoading
        binding.btnGallery.isEnabled = !isLoading
        binding.btnVideos.isEnabled = !isLoading
        binding.btnCamera.isEnabled = !isLoading
        binding.etContent.isEnabled = !isLoading
    }
}
