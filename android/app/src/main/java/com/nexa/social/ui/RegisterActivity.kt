package com.nexa.social.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.nexa.social.MainActivity
import com.nexa.social.data.models.RegisterRequest
import com.nexa.social.data.repository.AuthRepository
import com.nexa.social.databinding.ActivityRegisterBinding
import com.nexa.social.utils.SocketManager
import com.nexa.social.utils.TokenManager
import kotlinx.coroutines.launch

class RegisterActivity : AppCompatActivity() {

    private lateinit var binding: ActivityRegisterBinding
    private lateinit var authRepository: AuthRepository
    private lateinit var tokenManager: TokenManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityRegisterBinding.inflate(layoutInflater)
        setContentView(binding.root)

        tokenManager = TokenManager(this)
        authRepository = AuthRepository(tokenManager)

        binding.btnRegister.setOnClickListener {
            performRegistration()
        }

        binding.tvBackToLogin.setOnClickListener {
            finish()
        }
    }

    private fun performRegistration() {
        val displayName = binding.etDisplayName.text.toString().trim()
        val username = binding.etUsername.text.toString().trim().lowercase()
        val email = binding.etEmail.text.toString().trim().lowercase()
        val password = binding.etPassword.text.toString()
        val confirmPassword = binding.etConfirmPassword.text.toString()

        if (!validateInputs(displayName, username, email, password, confirmPassword)) {
            return
        }

        setLoading(true)

        lifecycleScope.launch {
            val request = RegisterRequest(
                username = username,
                email = email,
                password = password,
                displayName = displayName
            )

            val result = authRepository.register(request)
            setLoading(false)

            result.onSuccess {
                Toast.makeText(this@RegisterActivity, "Account created! Please verify your email.", Toast.LENGTH_LONG).show()

                val intent = Intent(this@RegisterActivity, VerifyEmailActivity::class.java).apply {
                    putExtra("email", email)
                }
                startActivity(intent)
                finish()
            }.onFailure { exception ->
                Toast.makeText(this@RegisterActivity, "Registration failed: ${exception.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun validateInputs(
        displayName: String,
        username: String,
        email: String,
        password: String,
        confirmPassword: String
    ): Boolean {
        var isValid = true

        if (displayName.length < 2) {
            binding.tilDisplayName.error = "Display name must be at least 2 characters"
            isValid = false
        } else {
            binding.tilDisplayName.error = null
        }

        if (username.length < 3) {
            binding.tilUsername.error = "Username must be at least 3 characters"
            isValid = false
        } else if (!username.matches(Regex("^[a-zA-Z0-9_]+$"))) {
            binding.tilUsername.error = "Only letters, numbers and underscores allowed"
            isValid = false
        } else {
            binding.tilUsername.error = null
        }

        if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            binding.tilEmail.error = "Enter a valid email address"
            isValid = false
        } else {
            binding.tilEmail.error = null
        }

        if (password.length < 8) {
            binding.tilPassword.error = "Password must be at least 8 characters"
            isValid = false
        } else if (!password.contains(Regex("[A-Z]"))) {
            binding.tilPassword.error = "Must contain at least one uppercase letter"
            isValid = false
        } else if (!password.contains(Regex("[0-9]"))) {
            binding.tilPassword.error = "Must contain at least one number"
            isValid = false
        } else {
            binding.tilPassword.error = null
        }

        if (confirmPassword != password) {
            binding.tilConfirmPassword.error = "Passwords do not match"
            isValid = false
        } else {
            binding.tilConfirmPassword.error = null
        }

        return isValid
    }

    private fun setLoading(isLoading: Boolean) {
        binding.registerProgressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        binding.btnRegister.isEnabled = !isLoading
        binding.etDisplayName.isEnabled = !isLoading
        binding.etUsername.isEnabled = !isLoading
        binding.etEmail.isEnabled = !isLoading
        binding.etPassword.isEnabled = !isLoading
        binding.etConfirmPassword.isEnabled = !isLoading
    }
}
