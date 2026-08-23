package com.nexa.social.ui

import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.nexa.social.databinding.ActivityVerifyEmailBinding
import com.nexa.social.data.repository.AuthRepository
import com.nexa.social.utils.TokenManager
import kotlinx.coroutines.launch

class VerifyEmailActivity : AppCompatActivity() {

    private lateinit var binding: ActivityVerifyEmailBinding
    private lateinit var authRepository: AuthRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityVerifyEmailBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val tokenManager = TokenManager(this)
        authRepository = AuthRepository(tokenManager)

        binding.tvTitle.text = "Verify Email"
        binding.tvSubtitle.text = "Enter the verification code sent to your email."
        binding.tilToken.hint = "Verification Code"
        binding.tilNewPassword.visibility = View.GONE
        binding.btnSubmit.text = "Verify Account"

        binding.ivBack.setOnClickListener {
            finish()
        }

        binding.btnSubmit.setOnClickListener {
            performEmailVerification()
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

    private fun setLoading(isLoading: Boolean) {
        binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        binding.btnSubmit.isEnabled = !isLoading
        binding.etToken.isEnabled = !isLoading
    }
}
