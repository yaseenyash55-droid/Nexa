package com.nexa.social.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.nexa.social.data.models.UpdateProfileRequest
import com.nexa.social.data.models.User
import com.nexa.social.data.repository.UserRepository
import com.nexa.social.databinding.DialogEditProfileBinding
import kotlinx.coroutines.launch

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

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = DialogEditProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        populateFields()
        setupSaveButton()
    }

    private fun populateFields() {
        currentUser?.let { user ->
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
                val req = UpdateProfileRequest(
                    displayName = displayName,
                    bio = bio.ifEmpty { null },
                    location = location.ifEmpty { null },
                    websiteUrl = website.ifEmpty { null }
                )

                userRepository.updateProfile(user.userId, req).onSuccess { updatedUser ->
                    Toast.makeText(context, "Profile updated successfully", Toast.LENGTH_SHORT).show()
                    onProfileUpdatedCallback?.invoke(updatedUser)
                    dismiss()
                }.onFailure { err ->
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
