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
import com.nexa.social.databinding.ActivityLoginBinding
import com.nexa.social.utils.SocketManager
import com.nexa.social.utils.TokenManager
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private var authRepository: AuthRepository? = null
    private var tokenManager: TokenManager? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        NexaApiClient.init(this)
        try {
            val tm = TokenManager(this)
            tokenManager = tm
            authRepository = AuthRepository(tm)
        } catch (_: Exception) {
            Toast.makeText(
                this,
                "Secure credential storage is unavailable on this device. Authentication actions are disabled.",
                Toast.LENGTH_LONG
            ).show()
            binding.btnLogin.isEnabled = false
            binding.tilUsername.isEnabled = false
            binding.tilPassword.isEnabled = false
        }

        binding.btnLogin.setOnClickListener {
            performLogin()
        }

        binding.tvCreateAccount.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }

        binding.tvForgotPassword.setOnClickListener {
            startActivity(Intent(this, ForgotPasswordActivity::class.java))
        }

        // Hide OAuth buttons until server-side Credential Manager OAuth is configured
        binding.btnGoogleLogin.visibility = View.GONE
        binding.btnGithubLogin.visibility = View.GONE
    }

    private fun performLogin() {
        val repo = authRepository
        val tm = tokenManager
        if (repo == null || tm == null) {
            Toast.makeText(this, "Secure storage is not available", Toast.LENGTH_SHORT).show()
            return
        }

        val username = binding.etUsername.text.toString().trim()
        val password = binding.etPassword.text.toString().trim()

        if (username.isEmpty()) {
            binding.tilUsername.error = "Username or email is required"
            return
        } else {
            binding.tilUsername.error = null
        }

        if (password.isEmpty()) {
            binding.tilPassword.error = "Password is required"
            return
        } else {
            binding.tilPassword.error = null
        }

        setLoading(true)

        lifecycleScope.launch {
            val result = repo.login(username, password)
            setLoading(false)
            result.onSuccess { user ->
                tm.accessToken?.let { token ->
                    SocketManager.connect(token)
                }
                Toast.makeText(this@LoginActivity, "Welcome back, ${user.displayName}!", Toast.LENGTH_SHORT).show()
                val intent = Intent(this@LoginActivity, MainActivity::class.java)
                startActivity(intent)
                overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
                finish()
            }.onFailure { exception ->
                Toast.makeText(this@LoginActivity, "Login failed: ${exception.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun setLoading(isLoading: Boolean) {
        binding.loginProgressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        binding.btnLogin.isEnabled = !isLoading && authRepository != null
        binding.btnGoogleLogin.isEnabled = !isLoading && authRepository != null
        binding.btnGithubLogin.isEnabled = !isLoading && authRepository != null
        binding.etUsername.isEnabled = !isLoading
        binding.etPassword.isEnabled = !isLoading
    }
}
