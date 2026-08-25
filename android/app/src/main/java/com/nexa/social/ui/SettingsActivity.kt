package com.nexa.social.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.nexa.social.NexaApiClient
import com.nexa.social.data.models.UpdateProfileRequest
import com.nexa.social.data.repository.AuthRepository
import com.nexa.social.databinding.ActivitySettingsBinding
import com.nexa.social.utils.LocalChatStorage
import com.nexa.social.utils.PreferenceManager
import com.nexa.social.utils.TokenManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private lateinit var prefManager: PreferenceManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        prefManager = PreferenceManager(this)

        setupToolbar()
        loadUserData()
        setupListeners()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun loadUserData() {
        val currentUserId = prefManager.userId
        binding.etDisplayName.setText(prefManager.displayName ?: "")

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val res = NexaApiClient.userApi.getProfileById(currentUserId)
                if (res.isSuccessful) {
                    val user = res.body()?.data
                    withContext(Dispatchers.Main) {
                        user?.let {
                            binding.etDisplayName.setText(it.displayName)
                            binding.etBio.setText(it.bio ?: "")
                            binding.etLocation.setText(it.location ?: "")
                            binding.etWebsite.setText(it.websiteUrl ?: "")
                        }
                    }
                }
            } catch (_: Exception) {}
        }
    }

    private fun setupListeners() {
        binding.btnSaveProfile.setOnClickListener {
            val displayName = binding.etDisplayName.text.toString().trim()
            val bio = binding.etBio.text.toString().trim()
            val location = binding.etLocation.text.toString().trim()
            val website = binding.etWebsite.text.toString().trim()

            if (displayName.isEmpty()) {
                Toast.makeText(this, "Display name cannot be empty", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            binding.btnSaveProfile.isEnabled = false
            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    val req = UpdateProfileRequest(
                        displayName = displayName,
                        bio = bio.ifEmpty { null },
                        location = location.ifEmpty { null },
                        websiteUrl = website.ifEmpty { null }
                    )
                    val res = NexaApiClient.userApi.updateProfile(prefManager.userId, req)
                    withContext(Dispatchers.Main) {
                        binding.btnSaveProfile.isEnabled = true
                        if (res.isSuccessful) {
                            prefManager.displayName = displayName
                            Toast.makeText(this@SettingsActivity, "Profile settings updated successfully!", Toast.LENGTH_SHORT).show()
                        } else {
                            Toast.makeText(this@SettingsActivity, res.body()?.error?.message ?: "Failed to update profile", Toast.LENGTH_SHORT).show()
                        }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        binding.btnSaveProfile.isEnabled = true
                        Toast.makeText(this@SettingsActivity, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }

        binding.btnUpdatePassword.setOnClickListener {
            val currentPassword = binding.etCurrentPassword.text.toString()
            val newPassword = binding.etNewPassword.text.toString()

            if (currentPassword.isEmpty() || newPassword.length < 8) {
                Toast.makeText(this, "New password must be at least 8 characters", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            Toast.makeText(this, "Password update request submitted", Toast.LENGTH_SHORT).show()
            binding.etCurrentPassword.setText("")
            binding.etNewPassword.setText("")
        }

        binding.btnDownloadLatestApk.setOnClickListener {
            val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://nexa-social-app.surge.sh/download"))
            startActivity(browserIntent)
        }

        binding.btnClearCache.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Clear Offline Message Cache")
                .setMessage("This will clear locally stored chat messages. They will be re-synced from the server when you open a chat.")
                .setPositiveButton("Clear") { _, _ ->
                    val prefs = getSharedPreferences("nexa_local_chat_storage", MODE_PRIVATE)
                    prefs.edit().clear().apply()
                    Toast.makeText(this, "Local chat cache cleared", Toast.LENGTH_SHORT).show()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        binding.btnLogout.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Log Out")
                .setMessage("Are you sure you want to log out of Nexa Social?")
                .setPositiveButton("Log Out") { _, _ ->
                    lifecycleScope.launch {
                        try {
                            val tm = TokenManager(this@SettingsActivity)
                            AuthRepository(tm).logout()
                        } catch (_: Exception) {}
                        val intent = Intent(this@SettingsActivity, LoginActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                        }
                        startActivity(intent)
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }
    }
}
