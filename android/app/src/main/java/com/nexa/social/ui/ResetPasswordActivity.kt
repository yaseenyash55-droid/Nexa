package com.nexa.social.ui

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.nexa.social.NexaApiClient
import com.nexa.social.data.models.ResetPasswordRequest
import com.nexa.social.databinding.ActivityResetPasswordBinding
import kotlinx.coroutines.launch

class ResetPasswordActivity : AppCompatActivity() {

    private lateinit var binding: ActivityResetPasswordBinding
    private var resetToken: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityResetPasswordBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Parse token from Intent extra or deep link URI
        resetToken = intent.getStringExtra("token")
            ?: intent.data?.getQueryParameter("token")

        if (resetToken.isNullOrBlank()) {
            Toast.makeText(this, "Missing or invalid password reset link. Please request a new link.", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        binding.ivBack.setOnClickListener {
            finish()
        }

        binding.btnSavePassword.setOnClickListener {
            performResetPassword()
        }
    }

    private fun performResetPassword() {
        val token = resetToken
        val newPassword = binding.etNewPassword.text.toString()
        val confirmPassword = binding.etConfirmPassword.text.toString()

        if (token.isNullOrBlank()) {
            Toast.makeText(this, "Reset token is missing. Please request a new link.", Toast.LENGTH_LONG).show()
            return
        }

        if (newPassword.length < 8) {
            binding.tilNewPassword.error = "Password must be at least 8 characters"
            return
        } else {
            binding.tilNewPassword.error = null
        }

        if (newPassword != confirmPassword) {
            binding.tilConfirmPassword.error = "Passwords do not match"
            return
        } else {
            binding.tilConfirmPassword.error = null
        }

        setLoading(true)

        lifecycleScope.launch {
            try {
                val response = NexaApiClient.authApi.resetPassword(ResetPasswordRequest(token, newPassword))
                setLoading(false)

                if (response.isSuccessful) {
                    Toast.makeText(this@ResetPasswordActivity, response.body()?.message ?: "Password reset successful! You can now sign in.", Toast.LENGTH_LONG).show()
                    finish()
                } else {
                    val errorMsg = response.body()?.error?.message ?: "The reset link is invalid or has expired."
                    Toast.makeText(this@ResetPasswordActivity, errorMsg, Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                setLoading(false)
                Toast.makeText(this@ResetPasswordActivity, "Error: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun setLoading(isLoading: Boolean) {
        binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        binding.btnSavePassword.isEnabled = !isLoading
        binding.etNewPassword.isEnabled = !isLoading
        binding.etConfirmPassword.isEnabled = !isLoading
    }
}
