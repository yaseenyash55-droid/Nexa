package com.nexa.social.ui

import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import coil.load
import coil.transform.CircleCropTransformation
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.nexa.social.data.models.UpdateProfileRequest
import com.nexa.social.data.models.User
import com.nexa.social.data.repository.UserRepository
import com.nexa.social.databinding.DialogEditProfileBinding
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

class EditProfileBottomSheetDialogFragment : BottomSheetDialogFragment() {

    companion object {
        fun newInstance(
            user: User,
            onProfileUpdated: (User) -> Unit
        ): EditProfileBottomSheetDialogFragment {
            return EditProfileBottomSheetDialogFragment().apply {
                this.currentUser = user
                this.onProfileUpdatedCallback = onProfileUpdated
            }
        }
    }

    private var _binding: DialogEditProfileBinding? = null
    private val binding get() = _binding!!
    private val userRepository = UserRepository()
    private var currentUser: User? = null
    private var onProfileUpdatedCallback: ((User) -> Unit)? = null

    private var selectedProfileImageUri: Uri? = null

    private val profileImagePicker = registerForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            selectedProfileImageUri = uri
            binding.ivProfilePreview.load(uri) {
                transformations(CircleCropTransformation())
            }
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = DialogEditProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        populateFields()
        setupProfileImagePicker()
        setupSaveButton()
    }

    private fun setupProfileImagePicker() {
        binding.btnChooseProfileImage.setOnClickListener {
            profileImagePicker.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
            )
        }
    }

    private fun populateFields() {
        currentUser?.let { user ->
            binding.ivProfilePreview.load(user.profileImageUrl) {
                placeholder(com.nexa.social.R.drawable.ic_profile)
                error(com.nexa.social.R.drawable.ic_profile)
                transformations(CircleCropTransformation())
            }
            binding.etDisplayName.setText(user.displayName)
            binding.etBio.setText(user.bio ?: "")
            binding.etLocation.setText(user.location ?: "")
            binding.etWebsite.setText(user.websiteUrl ?: "")
        }
    }

    private fun setupSaveButton() {
        binding.btnSaveProfile.setOnClickListener {
            val user = currentUser ?: return@setOnClickListener
            val displayName = binding.etDisplayName.text.toString().trim()
            val bio = binding.etBio.text.toString().trim()
            val location = binding.etLocation.text.toString().trim()
            val website = binding.etWebsite.text.toString().trim()

            if (displayName.isEmpty()) {
                binding.tilDisplayName.error = "Display name cannot be empty"
                return@setOnClickListener
            } else {
                binding.tilDisplayName.error = null
            }

            binding.btnSaveProfile.isEnabled = false

            lifecycleScope.launch {
                var profileImageUrl = user.profileImageUrl
                var temporaryFile: File? = null

                selectedProfileImageUri?.let { uri ->
                    val mimeType = requireContext().contentResolver.getType(uri) ?: "image/jpeg"

                    if (mimeType !in listOf("image/jpeg", "image/png", "image/webp")) {
                        binding.btnSaveProfile.isEnabled = true
                        Toast.makeText(context, "Choose a JPEG, PNG, or WebP image", Toast.LENGTH_LONG).show()
                        return@launch
                    }

                    val extension = when (mimeType) {
                        "image/png" -> ".png"
                        "image/webp" -> ".webp"
                        else -> ".jpg"
                    }

                    temporaryFile = File.createTempFile(
                        "profile_upload_",
                        extension,
                        requireContext().cacheDir
                    )

                    requireContext().contentResolver.openInputStream(uri)?.use { input ->
                        temporaryFile!!.outputStream().use { output ->
                            input.copyTo(output)
                        }
                    } ?: throw IllegalStateException("Unable to read the selected image")

                    if (temporaryFile!!.length() > 10L * 1024L * 1024L) {
                        temporaryFile!!.delete()
                        binding.btnSaveProfile.isEnabled = true
                        Toast.makeText(context, "Profile image must be under 10 MB", Toast.LENGTH_LONG).show()
                        return@launch
                    }

                    val fileBody = temporaryFile!!.asRequestBody(mimeType.toMediaTypeOrNull())
                    val filePart = MultipartBody.Part.createFormData(
                        "file",
                        temporaryFile!!.name,
                        fileBody
                    )
                    val kindPart = "avatar".toRequestBody("text/plain".toMediaTypeOrNull())

                    val uploadResponse =
                        com.nexa.social.NexaApiClient.userApi.uploadProfileImage(filePart, kindPart)

                    profileImageUrl = uploadResponse.body()?.data?.publicUrl

                    if (!uploadResponse.isSuccessful || profileImageUrl.isNullOrBlank()) {
                        temporaryFile!!.delete()
                        binding.btnSaveProfile.isEnabled = true
                        val message = uploadResponse.body()?.error?.message
                            ?: "Profile image upload failed (${uploadResponse.code()})"
                        Toast.makeText(context, message, Toast.LENGTH_LONG).show()
                        return@launch
                    }
                }

                val req = UpdateProfileRequest(
                    displayName = displayName,
                    bio = bio.ifEmpty { null },
                    location = location.ifEmpty { null },
                    websiteUrl = website.ifEmpty { null },
                    profileImageUrl = profileImageUrl
                )

                userRepository.updateProfile(user.userId, req).onSuccess { updatedUser ->
                    temporaryFile?.delete()
                    Toast.makeText(context, "Profile updated successfully", Toast.LENGTH_SHORT).show()
                    onProfileUpdatedCallback?.invoke(updatedUser)
                    dismiss()
                }.onFailure { err ->
                    temporaryFile?.delete()
                    Toast.makeText(context, "Failed to update: ${err.message}", Toast.LENGTH_SHORT).show()
                    binding.btnSaveProfile.isEnabled = true
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
