package com.nexa.social

import com.nexa.social.utils.UrlValidator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WebViewSecurityTest {

    @Test
    fun `approved canonical HTTPS origin is accepted`() {
        assertTrue(UrlValidator.isApprovedOrigin("https://nexa-social-app.surge.sh"))
        assertTrue(UrlValidator.isApprovedOrigin("https://nexa-social-app.surge.sh/"))
        assertTrue(UrlValidator.isApprovedOrigin("https://nexa-social-app.surge.sh/explore"))
        assertTrue(UrlValidator.isApprovedOrigin("https://nexa-social-app.surge.sh/messages/123"))
        assertTrue(UrlValidator.isApprovedOrigin("https://nexa-social-app.surge.sh/profile/alice?tab=posts"))
        assertTrue(UrlValidator.isApprovedOrigin("https://nexa-social-app.surge.sh:443/feed"))
    }

    @Test
    fun `HTTP scheme is rejected`() {
        assertFalse(UrlValidator.isApprovedOrigin("http://nexa-social-app.surge.sh"))
        assertFalse(UrlValidator.isApprovedOrigin("http://nexa-social-app.surge.sh/explore"))
    }

    @Test
    fun `host lookalike and subdomain attacks are rejected`() {
        assertFalse(UrlValidator.isApprovedOrigin("https://nexa-social-app.surge.sh.evil.example"))
        assertFalse(UrlValidator.isApprovedOrigin("https://nexa-social-app.surge.sh.attacker.com/"))
        assertFalse(UrlValidator.isApprovedOrigin("https://sub.nexa-social-app.surge.sh/"))
        assertFalse(UrlValidator.isApprovedOrigin("https://fake-nexa-social-app.surge.sh/"))
    }

    @Test
    fun `query parameter redirect confusion is rejected`() {
        assertFalse(UrlValidator.isApprovedOrigin("https://evil.example/?redirect=nexa-social-app.surge.sh"))
        assertFalse(UrlValidator.isApprovedOrigin("https://evil.example/#https://nexa-social-app.surge.sh"))
    }

    @Test
    fun `userinfo and authority confusion is rejected`() {
        assertFalse(UrlValidator.isApprovedOrigin("https://nexa-social-app.surge.sh@evil.example"))
        assertFalse(UrlValidator.isApprovedOrigin("https://nexa-social-app.surge.sh:password@attacker.com"))
        assertFalse(UrlValidator.isApprovedOrigin("https://user:pass@nexa-social-app.surge.sh"))
    }

    @Test
    fun `dangerous schemes and pseudo protocols are rejected`() {
        assertFalse(UrlValidator.isApprovedOrigin("javascript:alert(document.cookie)"))
        assertFalse(UrlValidator.isApprovedOrigin("file:///android_asset/index.html"))
        assertFalse(UrlValidator.isApprovedOrigin("file:///sdcard/malware.apk"))
        assertFalse(UrlValidator.isApprovedOrigin("content://com.android.providers.media.documents/document/1"))
        assertFalse(UrlValidator.isApprovedOrigin("data:text/html,<script>alert(1)</script>"))
        assertFalse(UrlValidator.isApprovedOrigin("intent:#Intent;action=android.intent.action.VIEW;end"))
        assertFalse(UrlValidator.isApprovedOrigin("about:blank"))
    }

    @Test
    fun `null, empty, and malformed URLs are rejected`() {
        assertFalse(UrlValidator.isApprovedOrigin(null))
        assertFalse(UrlValidator.isApprovedOrigin(""))
        assertFalse(UrlValidator.isApprovedOrigin("   "))
        assertFalse(UrlValidator.isApprovedOrigin("ht\\tp://malformed"))
        assertFalse(UrlValidator.isApprovedOrigin("https://:80/"))
    }

    @Test
    fun `sanitizeTargetUrl safely handles relative paths and hostile deep links`() {
        // Relative path should resolve to approved base origin
        assertEquals("https://nexa-social-app.surge.sh/messages", UrlValidator.sanitizeTargetUrl("/messages"))
        assertEquals("https://nexa-social-app.surge.sh/post/42", UrlValidator.sanitizeTargetUrl("/post/42"))

        // Approved absolute URL passes through
        assertEquals(
            "https://nexa-social-app.surge.sh/explore",
            UrlValidator.sanitizeTargetUrl("https://nexa-social-app.surge.sh/explore")
        )

        // Hostile URLs fall back to approved home
        assertEquals(
            UrlValidator.APPROVED_ORIGIN,
            UrlValidator.sanitizeTargetUrl("https://evil.com/phishing")
        )
        assertEquals(
            UrlValidator.APPROVED_ORIGIN,
            UrlValidator.sanitizeTargetUrl("javascript:stealData()")
        )
        assertEquals(
            UrlValidator.APPROVED_ORIGIN,
            UrlValidator.sanitizeTargetUrl(null)
        )
    }
}
