package com.nexa.social

import android.app.Application
import com.nexa.social.utils.ThemeManager

class NexaApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        // 1. Initialize API Client singleton
        NexaApiClient.init(this)

        // 2. Initialize saved theme settings (System Default, Light, or Dark)
        ThemeManager.initTheme(this)
    }
}
