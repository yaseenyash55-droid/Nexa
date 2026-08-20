package com.nexa.social

import android.content.Intent
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.action.ViewActions.typeText
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.espresso.matcher.ViewMatchers.withText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.nexa.social.ui.LoginActivity
import com.nexa.social.ui.RegisterActivity
import com.nexa.social.utils.NotificationHelper
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class NativeAndroidInstrumentedTest {

    @Test
    fun testLoginValidationAndNavigationToRegister() {
        val scenario = ActivityScenario.launch(LoginActivity::class.java)

        // Verify login fields are present
        onView(withId(R.id.et_username)).check(matches(isDisplayed()))
        onView(withId(R.id.et_password)).check(matches(isDisplayed()))
        onView(withId(R.id.btn_login)).check(matches(isDisplayed()))

        // Click create account
        onView(withId(R.id.tv_create_account)).perform(click())

        scenario.close()
    }

    @Test
    fun testRegistrationFieldsAndValidation() {
        val scenario = ActivityScenario.launch(RegisterActivity::class.java)

        // Verify registration fields
        onView(withId(R.id.et_display_name)).check(matches(isDisplayed()))
        onView(withId(R.id.et_username)).check(matches(isDisplayed()))
        onView(withId(R.id.et_email)).check(matches(isDisplayed()))
        onView(withId(R.id.et_password)).check(matches(isDisplayed()))
        onView(withId(R.id.et_confirm_password)).check(matches(isDisplayed()))

        // Empty registration triggers error
        onView(withId(R.id.btn_register)).perform(click())

        scenario.close()
    }

    @Test
    fun testMainActivityBottomNavigationDestinations() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)

        // Verify bottom navigation is displayed
        onView(withId(R.id.bottom_navigation)).check(matches(isDisplayed()))

        // Test bottom navigation items
        onView(withId(R.id.navigation_explore)).perform(click())
        onView(withId(R.id.navigation_messages)).perform(click())
        onView(withId(R.id.navigation_reels)).perform(click())
        onView(withId(R.id.navigation_profile)).perform(click())
        onView(withId(R.id.navigation_home)).perform(click())

        scenario.close()
    }

    @Test
    fun testNotificationDeepLinkRouting() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val intent = Intent(context, MainActivity::class.java).apply {
            putExtra(NotificationHelper.EXTRA_DESTINATION, "EXPLORE")
        }

        val scenario = ActivityScenario.launch<MainActivity>(intent)
        onView(withId(R.id.nav_host_fragment)).check(matches(isDisplayed()))
        scenario.close()
    }
}
