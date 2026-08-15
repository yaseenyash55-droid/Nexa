package com.nexa.social.ui

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
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
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream

class CreatePostActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCreatePostBinding
    private lateinit var prefManager: PreferenceManager

    private var selectedImageUri: Uri? = null
    private var capturedBitmap: Bitmap? = null

    private val galleryLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            selectedImageUri = uri
            capturedBitmap = null
            binding.imgPreview.setImageURI(uri)
            binding.cardImagePreview.visibility = View.VISIBLE
        }
    }

    private val cameraLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicturePreview()
    ) { bitmap: Bitmap? ->
        if (bitmap != null) {
            capturedBitmap = bitmap
            selectedImageUri = null
            binding.imgPreview.setImageBitmap(bitmap)
            binding.cardImagePreview.visibility = View.VISIBLE
        }
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            cameraLauncher.launch(null)
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
            galleryLauncher.launch("image/*")
        }

        binding.btnCamera.setOnClickListener {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                cameraLauncher.launch(null)
            } else {
                cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
        }

        binding.btnRemoveImage.setOnClickListener {
            selectedImageUri = null
            capturedBitmap = null
            binding.cardImagePreview.visibility = View.GONE
        }

        binding.btnPost.setOnClickListener {
            submitPost()
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

        if (content.isEmpty() && selectedImageUri == null && capturedBitmap == null) {
            binding.tilContent.error = "Please enter post text or attach an image"
            return
        } else {
            binding.tilContent.error = null
        }

        setLoading(true)

        lifecycleScope.launch {
            try {
                var uploadedImageUrl: String? = null

                // 1. Upload media file if present
                val imageFile = prepareImageFile()
                if (imageFile != null) {
                    val requestFile = imageFile.readBytes().toRequestBody("image/jpeg".toMediaTypeOrNull())
                    val filePart = MultipartBody.Part.createFormData("file", imageFile.name, requestFile)
                    val kindPart = "photo".toRequestBody("text/plain".toMediaTypeOrNull())

                    val mediaResponse = NexaApiClient.postApi.uploadMedia("Bearer $token", filePart, kindPart)
                    if (mediaResponse.isSuccessful && mediaResponse.body()?.data != null) {
                        uploadedImageUrl = mediaResponse.body()!!.data?.publicUrl
                    } else {
                        val mediaError = mediaResponse.body()?.error?.message ?: "Failed to upload image"
                        Toast.makeText(this@CreatePostActivity, mediaError, Toast.LENGTH_SHORT).show()
                    }
                }

                // 2. Create post
                val postResponse = NexaApiClient.postApi.createPost(
                    token = "Bearer $token",
                    request = CreatePostRequest(content = content, imageUrl = uploadedImageUrl)
                )

                setLoading(false)

                if (postResponse.isSuccessful && postResponse.body()?.data != null) {
                    Toast.makeText(this@CreatePostActivity, "✔ Post published successfully!", Toast.LENGTH_SHORT).show()
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
            }
        }
    }

    private suspend fun prepareImageFile(): File? = withContext(Dispatchers.IO) {
        return@withContext when {
            selectedImageUri != null -> {
                try {
                    val inputStream = contentResolver.openInputStream(selectedImageUri!!)
                    val tempFile = File.createTempFile("upload_", ".jpg", cacheDir)
                    val outputStream = FileOutputStream(tempFile)
                    inputStream?.copyTo(outputStream)
                    inputStream?.close()
                    outputStream.close()
                    tempFile
                } catch (e: Exception) {
                    null
                }
            }
            capturedBitmap != null -> {
                try {
                    val tempFile = File.createTempFile("camera_", ".jpg", cacheDir)
                    val bos = ByteArrayOutputStream()
                    capturedBitmap!!.compress(Bitmap.CompressFormat.JPEG, 90, bos)
                    val bitmapData = bos.toByteArray()
                    val fos = FileOutputStream(tempFile)
                    fos.write(bitmapData)
                    fos.flush()
                    fos.close()
                    tempFile
                } catch (e: Exception) {
                    null
                }
            }
            else -> null
        }
    }

    private fun setLoading(isLoading: Boolean) {
        binding.postProgressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        binding.btnPost.isEnabled = !isLoading
        binding.btnClose.isEnabled = !isLoading
        binding.btnGallery.isEnabled = !isLoading
        binding.btnCamera.isEnabled = !isLoading
        binding.etContent.isEnabled = !isLoading
    }
}
