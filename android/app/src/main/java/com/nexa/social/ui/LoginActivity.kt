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
import com.nexa.social.data.repository.LoginOutcome
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
            Toast.makeText(this, "Secure credential storage is unavailable on this device. Authentication actions are disabled.", Toast.LENGTH_LONG).show()
            binding.btnLogin.isEnabled = false
            binding.tilUsername.isEnabled = false
            binding.tilPassword.isEnabled = false
        }
        binding.btnLogin.setOnClickListener { performLogin() }
        binding.tvCreateAccount.setOnClickListener { startActivity(Intent(this, RegisterActivity::class.java)) }
        binding.tvForgotPassword.setOnClickListener { startActivity(Intent(this, ForgotPasswordActivity::class.java)) }
        binding.btnGoogleLogin.visibility = View.GONE
        binding.btnGithubLogin.visibility = View.GONE
    }

    private fun performLogin() {
        val repo = authRepository ?: return
        val username = binding.etUsername.text.toString().trim()
        val password = binding.etPassword.text.toString()
        binding.tilUsername.error = if (username.isEmpty()) "Username or email is required" else null
        binding.tilPassword.error = if (password.isEmpty()) "Password is required" else null
        if (username.isEmpty() || password.isEmpty()) return
        setLoading(true)
        lifecycleScope.launch {
            repo.login(username, password)
                .onSuccess { outcome ->
                    when (outcome) {
                        is LoginOutcome.Authenticated -> openMain(outcome.user.displayName)
                        is LoginOutcome.OtpRequired -> {
                            startActivity(Intent(this@LoginActivity, OtpVerificationActivity::class.java).apply {
                                putExtra(OtpVerificationActivity.EXTRA_CHALLENGE_ID, outcome.challengeId)
                                putExtra(OtpVerificationActivity.EXTRA_MASKED_EMAIL, outcome.maskedEmail)
                                putExtra(OtpVerificationActivity.EXTRA_EXPIRES_AT, outcome.expiresAt)
                            })
                        }
                    }
                }
                .onFailure { Toast.makeText(this@LoginActivity, "Login failed: ${it.message}", Toast.LENGTH_LONG).show() }
            setLoading(false)
        }
    }

    private fun openMain(displayName: String) {
        tokenManager?.accessToken?.let(SocketManager::connect)
        Toast.makeText(this, "Welcome back, $displayName!", Toast.LENGTH_SHORT).show()
        startActivity(Intent(this, MainActivity::class.java))
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
        finish()
    }

    private fun setLoading(loading: Boolean) {
        binding.loginProgressBar.visibility = if (loading) View.VISIBLE else View.GONE
        binding.btnLogin.isEnabled = !loading && authRepository != null
        binding.etUsername.isEnabled = !loading
        binding.etPassword.isEnabled = !loading
    }
}
