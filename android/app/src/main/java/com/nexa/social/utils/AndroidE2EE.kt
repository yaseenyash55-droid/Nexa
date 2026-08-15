package com.nexa.social.utils

import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

object AndroidE2EE {

    private val keyCache = mutableMapOf<String, SecretKey>()

    private fun bytesToHex(bytes: ByteArray): String {
        val sb = StringBuilder()
        for (b in bytes) {
            sb.append(String.format("%02x", b))
        }
        return sb.toString()
    }

    private fun hexToBytes(hex: String): ByteArray {
        val len = hex.length
        val data = ByteArray(len / 2)
        var i = 0
        while (i < len) {
            data[i / 2] = ((Character.digit(hex[i], 16) shl 4) + Character.digit(hex[i + 1], 16)).toByte()
            i += 2
        }
        return data
    }

    fun getConversationKey(userId1: Int, userId2: Int): SecretKey {
        val sortedPair = listOf(userId1, userId2).sorted().joinToString("_")
        val cacheKey = "e2ee_key_$sortedPair"

        keyCache[cacheKey]?.let { return it }

        val seedStr = "Nexa_E2EE_Secret_Seed_v1_$sortedPair"
        val saltStr = "Nexa_E2EE_Salt_$sortedPair"

        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        val spec = PBEKeySpec(
            seedStr.toCharArray(),
            saltStr.toByteArray(StandardCharsets.UTF_8),
            100000,
            256
        )

        val tmp = factory.generateSecret(spec)
        val secretKey = SecretKeySpec(tmp.encoded, "AES")
        keyCache[cacheKey] = secretKey
        return secretKey
    }

    fun encryptMessage(senderId: Int, receiverId: Int, plainText: String): String {
        if (plainText.isEmpty()) return plainText

        try {
            val key = getConversationKey(senderId, receiverId)
            val iv = ByteArray(12)
            SecureRandom().nextBytes(iv)

            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val spec = GCMParameterSpec(128, iv)
            cipher.init(Cipher.ENCRYPT_MODE, key, spec)

            val cipherText = cipher.doFinal(plainText.toByteArray(StandardCharsets.UTF_8))
            val ivHex = bytesToHex(iv)
            val cipherHex = bytesToHex(cipherText)

            return "E2EE::$ivHex::$cipherHex"
        } catch (e: Exception) {
            return plainText
        }
    }

    fun decryptMessage(currentUserId: Int, otherUserId: Int, formattedContent: String): Pair<String, Boolean> {
        if (!formattedContent.startsWith("E2EE::")) {
            return Pair(formattedContent, false)
        }

        try {
            val parts = formattedContent.split("::")
            if (parts.size != 3) {
                return Pair(formattedContent, false)
            }

            val ivHex = parts[1]
            val cipherHex = parts[2]

            val iv = hexToBytes(ivHex)
            val cipherText = hexToBytes(cipherHex)

            val key = getConversationKey(currentUserId, otherUserId)

            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val spec = GCMParameterSpec(128, iv)
            cipher.init(Cipher.DECRYPT_MODE, key, spec)

            val plainBytes = cipher.doFinal(cipherText)
            val plainText = String(plainBytes, StandardCharsets.UTF_8)

            return Pair(plainText, true)
        } catch (e: Exception) {
            return Pair("🔒 Unable to decrypt message (Key mismatch)", true)
        }
    }
}
