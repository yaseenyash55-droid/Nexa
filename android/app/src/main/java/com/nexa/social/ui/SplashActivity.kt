package com.nexa.social.ui

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AppCompatActivity
import com.nexa.social.MainActivity
import com.nexa.social.R
import com.nexa.social.utils.PreferenceManager

class SplashActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)

        val prefManager = PreferenceManager(this)

        // Duration: 2.0 seconds (2000 ms)
        Handler(Looper.getMainLooper()).postDelayed({
            val destination = if (prefManager.isLoggedIn) {
                MainActivity::class.java
            } else {
                LoginActivity::class.java
            }

            val intent = Intent(this@SplashActivity, destination)
            startActivity(intent)
            overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
            finish()
        }, 2000)
    }
}
