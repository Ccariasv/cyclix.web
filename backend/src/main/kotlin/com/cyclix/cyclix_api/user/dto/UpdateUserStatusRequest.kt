package com.cyclix.cyclix_api.user.dto

import jakarta.validation.constraints.NotBlank

data class UpdateUserStatusRequest(
    @field:NotBlank(message = "El estado es obligatorio")
    val status: String
)
