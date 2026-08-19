package com.nexa.social.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.nexa.social.databinding.ActivityForgotPasswordBinding
import com.nexa.social.utils.TokenManager
import com.nexa.social.data.repository.AuthRepository
import kotlinx.coroutines.launch

class ForgotPasswordActivity : AppCompatActivity() {

    private lateinit var binding: ActivityForgotPasswordBinding
    private lateinit var authRepository: AuthRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityForgotPasswordBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val tokenManager = TokenManager(this)
        authRepository = AuthRepository(tokenManager)

        binding.ivBack.setOnClickListener {
            finish()
        }

        binding.btnSendResetLink.setOnClickListener {
            performForgotPassword()
        }
    }

    private fun performForgotPassword() {
        val email = binding.etEmail.text.toString().trim().lowercase()

        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            binding.tilEmail.error = "Enter a valid email address"
            return
        } else {
            binding.tilEmail.error = null
        }

        setLoading(true)

        lifecycleScope.launch {
            val result = authRepository.forgotPassword(email)
            setLoading(false)

            result.onSuccess { message ->
                Toast.makeText(this@ForgotPasswordActivity, message, Toast.LENGTH_LONG).show()
                // Redirect to verify email activity which can also handle reset tokens
                val intent = Intent(this@ForgotPasswordActivity, VerifyEmailActivity::class.java)
                intent.putExtra("email", email)
                intent.putExtra("type", "reset")
                startActivity(intent)
                finish()
            }.onFailure { exception ->
                Toast.makeText(this@ForgotPasswordActivity, "Error: ${exception.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun setLoading(isLoading: Boolean) {
        binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        binding.btnSendResetLink.isEnabled = !isLoading
        binding.etEmail.isEnabled = !isLoading
    }
}
