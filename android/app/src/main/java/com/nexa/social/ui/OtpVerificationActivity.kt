package com.nexa.social.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.nexa.social.MainActivity
import com.nexa.social.NexaApiClient
import com.nexa.social.data.repository.AuthRepository
import com.nexa.social.databinding.ActivityOtpVerificationBinding
import com.nexa.social.utils.SocketManager
import com.nexa.social.utils.TokenManager
import kotlinx.coroutines.launch

class OtpVerificationActivity : AppCompatActivity() {
    private lateinit var binding: ActivityOtpVerificationBinding
    private lateinit var tokenManager: TokenManager
    private lateinit var repository: AuthRepository
    private lateinit var challengeId: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityOtpVerificationBinding.inflate(layoutInflater)
        setContentView(binding.root)
        challengeId = intent.getStringExtra(EXTRA_CHALLENGE_ID).orEmpty()
        if (challengeId.length != 64) { finish(); return }
        NexaApiClient.init(this)
        try {
            tokenManager = TokenManager(this)
            repository = AuthRepository(tokenManager)
        } catch (_: Exception) {
            Toast.makeText(this, "Secure credential storage is unavailable", Toast.LENGTH_LONG).show()
            finish(); return
        }
        val masked = intent.getStringExtra(EXTRA_MASKED_EMAIL)
        binding.tvOtpDescription.text = if (masked.isNullOrBlank()) "Enter the six-digit code sent to your email." else "Enter the six-digit code sent to $masked."
        binding.btnVerifyOtp.setOnClickListener { verify() }
        binding.tvBackToLogin.setOnClickListener { finish() }
    }

    private fun verify() {
        val code = binding.etOtp.text.toString().trim()
        binding.tilOtp.error = if (code.length == 6 && code.all { it.isDigit() }) null else "Enter the six-digit verification code"
        if (binding.tilOtp.error != null) return
        setLoading(true)
        lifecycleScope.launch {
            repository.verifyLoginOtp(challengeId, code)
                .onSuccess { user ->
                    tokenManager.accessToken?.let(SocketManager::connect)
                    Toast.makeText(this@OtpVerificationActivity, "Welcome back, ${user.displayName}!", Toast.LENGTH_SHORT).show()
                    startActivity(Intent(this@OtpVerificationActivity, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    })
                    finish()
                }
                .onFailure { Toast.makeText(this@OtpVerificationActivity, it.message ?: "Verification failed", Toast.LENGTH_LONG).show() }
            setLoading(false)
        }
    }

    private fun setLoading(loading: Boolean) {
        binding.otpProgressBar.visibility = if (loading) View.VISIBLE else View.GONE
        binding.btnVerifyOtp.isEnabled = !loading
        binding.etOtp.isEnabled = !loading
    }

    companion object {
        const val EXTRA_CHALLENGE_ID = "challenge_id"
        const val EXTRA_MASKED_EMAIL = "masked_email"
        const val EXTRA_EXPIRES_AT = "expires_at"
    }
}
