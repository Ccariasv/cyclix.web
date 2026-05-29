package com.cyclix.cyclix_api.support.dto

import jakarta.validation.constraints.NotBlank

data class UpdateTicketStatusRequest(
    @field:NotBlank(message = "El estado es obligatorio")
    val status: String
)
