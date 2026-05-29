package com.cyclix.cyclix_api.auth.dto

data class AuthResponse(
    val token: String,
    val tokenType: String = "Bearer",
    val expiresIn: Long,
    val userId: Long,
    val email: String
)
