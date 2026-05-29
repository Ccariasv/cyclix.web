package com.cyclix.cyclix_api.auth.service

import com.fasterxml.jackson.databind.ObjectMapper
import com.cyclix.cyclix_api.user.User
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Instant
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

@Service
class JwtService(
    @Value("\${app.jwt.secret}") private val secret: String,
    @Value("\${app.jwt.expiration-seconds}") val expirationSeconds: Long
) {
    private val objectMapper: ObjectMapper = ObjectMapper()

    fun generateToken(user: User): String {
        val now = Instant.now()
        val expiresAt = now.plusSeconds(expirationSeconds)
        val header = """{"alg":"HS256","typ":"JWT"}"""
        val payload = """
            {
              "sub":"${escapeJson(user.email)}",
              "userId":${user.id},
              "role":"${escapeJson(user.role.name)}",
              "iat":${now.epochSecond},
              "exp":${expiresAt.epochSecond}
            }
        """.trimIndent().replace(Regex("\\s+"), "")

        val encodedHeader = base64Url(header.toByteArray(StandardCharsets.UTF_8))
        val encodedPayload = base64Url(payload.toByteArray(StandardCharsets.UTF_8))
        val unsignedToken = "$encodedHeader.$encodedPayload"
        val signature = base64Url(sign(unsignedToken))

        return "$unsignedToken.$signature"
    }

    fun validateAndExtract(token: String): JwtPrincipal {
        val parts = token.split(".")
        if (parts.size != 3) {
            throw IllegalArgumentException("Formato de token inválido")
        }

        val unsignedToken = "${parts[0]}.${parts[1]}"
        val expectedSignature = base64Url(sign(unsignedToken))
        val providedSignature = parts[2]

        val isValidSignature = MessageDigest.isEqual(
            expectedSignature.toByteArray(StandardCharsets.UTF_8),
            providedSignature.toByteArray(StandardCharsets.UTF_8)
        )

        if (!isValidSignature) {
            throw IllegalArgumentException("Firma de token inválida")
        }

        val payloadBytes = base64UrlDecode(parts[1])
        val claims = objectMapper.readTree(payloadBytes)
        val expiration = claims.path("exp").asLong(0)
        if (expiration <= Instant.now().epochSecond) {
            throw IllegalArgumentException("Token expirado")
        }

        val email = claims.path("sub").asText("").trim()
        val role = claims.path("role").asText("").trim().uppercase()
        val userIdNode = claims.path("userId")

        if (email.isBlank() || role.isBlank() || !userIdNode.isNumber) {
            throw IllegalArgumentException("Claims de token incompletos")
        }

        return JwtPrincipal(
            email = email,
            role = role,
            userId = userIdNode.asLong()
        )
    }

    private fun sign(value: String): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        val key = SecretKeySpec(secret.toByteArray(StandardCharsets.UTF_8), "HmacSHA256")
        mac.init(key)
        return mac.doFinal(value.toByteArray(StandardCharsets.UTF_8))
    }

    private fun base64Url(bytes: ByteArray): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)

    private fun base64UrlDecode(value: String): ByteArray =
        Base64.getUrlDecoder().decode(value)

    private fun escapeJson(value: String): String =
        value.replace("\\", "\\\\").replace("\"", "\\\"")
}

data class JwtPrincipal(
    val email: String,
    val role: String,
    val userId: Long
)
