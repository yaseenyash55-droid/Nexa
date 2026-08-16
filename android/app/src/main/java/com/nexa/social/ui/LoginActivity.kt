package com.nexa.social.ui

import android.content.Intent
import android.net.Uri
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
    private lateinit var authRepository: AuthRepository
    private lateinit var tokenManager: TokenManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        NexaApiClient.init(this)
        try {
            tokenManager = TokenManager(this)
            authRepository = AuthRepository(tokenManager)
        } catch (e: Exception) {
            Toast.makeText(this, "Secure storage initialization failed: ${e.message}", Toast.LENGTH_LONG).show()
        }

        binding.btnLogin.setOnClickListener {
            performLogin()
        }

        binding.tvCreateAccount.setOnClickListener {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://nexa-social-app.surge.sh/register"))
            startActivity(intent)
        }

        binding.tvForgotPassword.setOnClickListener {
            Toast.makeText(this, "Forgot password? Reset link is available at https://nexa-social-app.surge.sh/login", Toast.LENGTH_LONG).show()
        }

        binding.btnGoogleLogin.setOnClickListener {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://nexa-social-app.surge.sh/login"))
            startActivity(intent)
        }

        binding.btnGithubLogin.setOnClickListener {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("https://nexa-social-app.surge.sh/login"))
            startActivity(intent)
        }
    }

    private fun performLogin() {
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
            val result = authRepository.login(username, password)
            setLoading(false)
            result.onSuccess { user ->
                tokenManager.accessToken?.let { token ->
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
        binding.btnLogin.isEnabled = !isLoading
        binding.btnGoogleLogin.isEnabled = !isLoading
        binding.btnGithubLogin.isEnabled = !isLoading
        binding.etUsername.isEnabled = !isLoading
        binding.etPassword.isEnabled = !isLoading
    }
}
