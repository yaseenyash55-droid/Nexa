package com.nexa.social.utils

import android.content.Context
import android.content.SharedPreferences
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import com.google.android.material.dialog.MaterialAlertDialogBuilder

object ThemeManager {

    const val THEME_SYSTEM = "system"
    const val THEME_LIGHT = "light"
    const val THEME_DARK = "dark"

    private const val PREF_NAME = "nexa_theme_prefs"
    private const val KEY_THEME_MODE = "theme_mode"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    }

    fun initTheme(context: Context) {
        val savedTheme = getSavedThemeMode(context)
        applyNightMode(savedTheme)
    }

    fun applyTheme(context: Context, themeMode: String) {
        getPrefs(context).edit().putString(KEY_THEME_MODE, themeMode).apply()
        applyNightMode(themeMode)
    }

    fun getSavedThemeMode(context: Context): String {
        return getPrefs(context).getString(KEY_THEME_MODE, THEME_SYSTEM) ?: THEME_SYSTEM
    }

    private fun applyNightMode(themeMode: String) {
        val mode = when (themeMode) {
            THEME_LIGHT -> AppCompatDelegate.MODE_NIGHT_NO
            THEME_DARK -> AppCompatDelegate.MODE_NIGHT_YES
            else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
        }
        AppCompatDelegate.setDefaultNightMode(mode)
    }

    fun showThemeSelectionDialog(activity: AppCompatActivity) {
        val themes = arrayOf("System Default", "Light Theme", "Dark Theme")
        val currentTheme = getSavedThemeMode(activity)

        val checkedItem = when (currentTheme) {
            THEME_LIGHT -> 1
            THEME_DARK -> 2
            else -> 0
        }

        MaterialAlertDialogBuilder(activity)
            .setTitle("Choose App Theme")
            .setSingleChoiceItems(themes, checkedItem) { dialog, which ->
                val selectedThemeMode = when (which) {
                    1 -> THEME_LIGHT
                    2 -> THEME_DARK
                    else -> THEME_SYSTEM
                }

                if (selectedThemeMode != currentTheme) {
                    applyTheme(activity, selectedThemeMode)
                }
                dialog.dismiss()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
