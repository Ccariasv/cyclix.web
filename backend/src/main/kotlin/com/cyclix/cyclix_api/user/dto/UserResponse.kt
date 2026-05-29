package com.cyclix.cyclix_api.user.dto

import java.time.LocalDateTime

data class UserResponse(
    val id: Long,
    val firstName: String,
    val lastName: String?,
    val email: String,
    val phone: String?,
    val role: String,
    val status: String,
    val emailVerified: Boolean,
    val lastLoginAt: LocalDateTime?,
    val createdAt: LocalDateTime,
    val updatedAt: LocalDateTime
)
