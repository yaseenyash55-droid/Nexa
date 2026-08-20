package com.nexa.social.ui

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.nexa.social.data.api.AuthApi
import com.nexa.social.data.models.ResetPasswordRequest
import com.nexa.social.data.models.VerifyEmailRequest
import com.nexa.social.databinding.ActivityVerifyEmailBinding
import com.nexa.social.NexaApiClient
import com.nexa.social.data.repository.AuthRepository
import com.nexa.social.utils.TokenManager
import kotlinx.coroutines.launch

class VerifyEmailActivity : AppCompatActivity() {

    private lateinit var binding: ActivityVerifyEmailBinding
    private lateinit var authRepository: AuthRepository
    private var isResetMode = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityVerifyEmailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val tokenManager = TokenManager(this)
        authRepository = AuthRepository(tokenManager)

        isResetMode = intent.getStringExtra("type") == "reset"

        if (isResetMode) {
            binding.tvTitle.text = "Reset Password"
            binding.tvSubtitle.text = "Enter the reset token and your new password."
            binding.tilToken.hint = "Reset Token"
            binding.tilNewPassword.visibility = View.VISIBLE
            binding.btnSubmit.text = "Reset Password"
            binding.tvResend.visibility = View.GONE
        }

        binding.ivBack.setOnClickListener {
            finish()
        }

        binding.btnSubmit.setOnClickListener {
            if (isResetMode) {
                performResetPassword()
            } else {
                performEmailVerification()
            }
        }

        val email = intent.getStringExtra("email")

        binding.tvResend.setOnClickListener {
            if (!email.isNullOrBlank()) {
                setLoading(true)
                lifecycleScope.launch {
                    val result = authRepository.resendVerification(email)
                    setLoading(false)
                    result.onSuccess { msg ->
                        Toast.makeText(this@VerifyEmailActivity, msg, Toast.LENGTH_SHORT).show()
                    }.onFailure { err ->
                        Toast.makeText(this@VerifyEmailActivity, err.message ?: "Resend failed", Toast.LENGTH_SHORT).show()
                    }
                }
            } else {
                Toast.makeText(this, "Please enter your email or register to receive a code", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun performEmailVerification() {
        val token = binding.etToken.text.toString().trim()

        if (token.isEmpty()) {
            binding.tilToken.error = "Token is required"
            return
        }

        setLoading(true)
        lifecycleScope.launch {
            val result = authRepository.verifyEmail(token)
            setLoading(false)
            result.onSuccess { message ->
                Toast.makeText(this@VerifyEmailActivity, message, Toast.LENGTH_LONG).show()
                finish()
            }.onFailure { exception ->
                Toast.makeText(this@VerifyEmailActivity, "Verification failed: ${exception.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun performResetPassword() {
        val token = binding.etToken.text.toString().trim()
        val newPassword = binding.etNewPassword.text.toString()

        if (token.isEmpty()) {
            binding.tilToken.error = "Token is required"
            return
        }
        if (newPassword.length < 8) {
            binding.tilNewPassword.error = "Password must be at least 8 characters"
            return
        }

        setLoading(true)
        lifecycleScope.launch {
            try {
                val response = NexaApiClient.authApi.resetPassword(ResetPasswordRequest(token, newPassword))
                setLoading(false)
                if (response.isSuccessful) {
                    Toast.makeText(this@VerifyEmailActivity, response.body()?.message ?: "Password reset successful", Toast.LENGTH_LONG).show()
                    finish()
                } else {
                    val errorMsg = response.body()?.error?.message ?: "Reset failed"
                    Toast.makeText(this@VerifyEmailActivity, errorMsg, Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                setLoading(false)
                Toast.makeText(this@VerifyEmailActivity, "Error: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun setLoading(isLoading: Boolean) {
        binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        binding.btnSubmit.isEnabled = !isLoading
        binding.etToken.isEnabled = !isLoading
        binding.etNewPassword.isEnabled = !isLoading
    }
}
